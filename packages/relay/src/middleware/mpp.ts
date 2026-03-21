import type { MiddlewareHandler } from "hono";

import type { IVaultService } from "../services/types.js";

export type MPPConfig = {
  acceptedMethods: ("tempo" | "stripe" | "lightning")[];
  network: "base" | "base-sepolia";
};

export type MPPEnv = {
  Variables: {
    mppPayment?: {
      producer: string;
      amount: string;
      currency: string;
      method: string;
    };
  };
};

/** In-memory LRU pricing cache (address:path -> pricing). TTL: 60s. Only caches positive hits. */
const pricingCache = new Map<
  string,
  { value: { amount: string; currency: string }; expiry: number }
>();
const CACHE_TTL = 60_000;
const MAX_CACHE_SIZE = 1000;

function getCachedPricing(
  key: string,
): { amount: string; currency: string } | undefined {
  const entry = pricingCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiry) {
    pricingCache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCachedPricing(
  key: string,
  value: { amount: string; currency: string },
): void {
  if (pricingCache.size >= MAX_CACHE_SIZE) {
    const keys = Array.from(pricingCache.keys());
    for (let i = 0; i < keys.length / 2; i++) {
      pricingCache.delete(keys[i]);
    }
  }
  pricingCache.set(key, { value, expiry: Date.now() + CACHE_TTL });
}

/**
 * MPP pricing middleware for vault read routes (GET with :address/:key params).
 */
export function mppPricing(opts: {
  vault: IVaultService;
  config: MPPConfig;
}): MiddlewareHandler<MPPEnv> {
  const { vault, config } = opts;

  return async (c, next) => {
    const address = c.req.param("address");
    const key = c.req.param("key");

    if (!address || !key) {
      await next();
      return;
    }

    const cacheKey = `${address}:${key}`;
    let pricing = getCachedPricing(cacheKey);
    if (pricing === undefined) {
      const fetched = await vault.getVaultPricing(address, key);
      if (fetched) {
        setCachedPricing(cacheKey, fetched);
        pricing = fetched;
      }
    }

    if (!pricing) {
      await next();
      return;
    }

    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Payment ")) {
      const challenge = `Payment realm="orbitmem", intent="charge", amount="${pricing.amount}", currency="${pricing.currency}", recipient="${address}", network="${config.network}"`;
      c.header("WWW-Authenticate", challenge);
      return c.json(
        {
          error: "payment_required",
          amount: pricing.amount,
          currency: pricing.currency,
          recipient: address,
          network: config.network,
          methods: config.acceptedMethods,
        },
        402,
      );
    }

    // TODO: Verify payment credential via mppx once SDK API is confirmed.
    // For now, accept any Authorization: Payment header as valid.

    c.set("mppPayment", {
      producer: address,
      amount: pricing.amount,
      currency: pricing.currency,
      method: "unverified",
    });

    await next();
  };
}

/**
 * MPP pricing middleware for POST /vault/read.
 * Extracts vaultAddress from JSON body instead of route params.
 */
export function mppPricingPost(opts: {
  vault: IVaultService;
  config: MPPConfig;
}): MiddlewareHandler<MPPEnv & { Variables: { signer: string } }> {
  const { vault, config } = opts;

  return async (c, next) => {
    const body = await c.req.json<{ vaultAddress?: string; path: string }>();
    const address = body.vaultAddress ?? c.get("signer");
    const path = body.path;

    if (!address || !path) {
      await next();
      return;
    }

    const cacheKey = `${address}:${path}`;
    let pricing = getCachedPricing(cacheKey);
    if (pricing === undefined) {
      const fetched = await vault.getVaultPricing(address, path);
      if (fetched) {
        setCachedPricing(cacheKey, fetched);
        pricing = fetched;
      }
    }

    if (!pricing) {
      await next();
      return;
    }

    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Payment ")) {
      const challenge = `Payment realm="orbitmem", intent="charge", amount="${pricing.amount}", currency="${pricing.currency}", recipient="${address}", network="${config.network}"`;
      c.header("WWW-Authenticate", challenge);
      return c.json(
        {
          error: "payment_required",
          amount: pricing.amount,
          currency: pricing.currency,
          recipient: address,
          network: config.network,
          methods: config.acceptedMethods,
        },
        402,
      );
    }

    c.set("mppPayment", {
      producer: address,
      amount: pricing.amount,
      currency: pricing.currency,
      method: "unverified",
    });

    await next();
  };
}
