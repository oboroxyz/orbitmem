import { Hono } from "hono";

import { type ERC8128Env, erc8128 } from "../middleware/erc8128.js";
import { type MPPConfig, mppPricing } from "../middleware/mpp.js";
import { createSessionToken } from "../middleware/session.js";
import type { IVaultService } from "../services/types.js";

const DEFAULT_SESSION_TTL = 1800; // 30 minutes
const MAX_SESSION_TTL = 86400; // 24 hours

export function createVaultRoutes(vault: IVaultService, mppConfig?: MPPConfig): Hono<ERC8128Env> {
  const routes = new Hono<ERC8128Env>();

  // List public keys — must be before the wildcard route (always free)
  routes.get("/vault/public/:address/keys", async (c) => {
    const address = c.req.param("address");
    const prefix = c.req.query("prefix");
    const keys = await vault.getPublicKeys(address, prefix ?? undefined);
    return c.json({ keys });
  });

  // Public read — no auth required (wildcard must come after /keys)
  // If MPP config is provided, apply pricing middleware
  if (mppConfig) {
    routes.get(
      "/vault/public/:address/:key{.+}",
      mppPricing({ vault, config: mppConfig }),
      async (c) => {
        const address = c.req.param("address");
        const key = c.req.param("key");
        const entry = await vault.getPublic(address, key);

        if (!entry) {
          return c.json({ error: "Entry not found or not public" }, 404);
        }

        return c.json({ key, value: entry.value, visibility: "public" });
      },
    );
  } else {
    routes.get("/vault/public/:address/:key{.+}", async (c) => {
      const address = c.req.param("address");
      const key = c.req.param("key");
      const entry = await vault.getPublic(address, key);

      if (!entry) {
        return c.json({ error: "Entry not found or not public" }, 404);
      }

      return c.json({ key, value: entry.value, visibility: "public" });
    });
  }

  // Encrypted read — requires ERC-8128
  routes.post("/vault/read", erc8128(), async (c) => {
    const body = await c.req.json<{ vaultAddress?: string; path: string }>();
    const address = body.vaultAddress ?? c.get("signer");
    const entry = await vault.getEncrypted(address, body.path);

    if (!entry) {
      return c.json({ error: "Entry not found" }, 404);
    }

    return c.json({
      key: body.path,
      value: entry.value,
      visibility: entry.visibility,
      signer: c.get("signer"),
    });
  });

  // Sync trigger — requires ERC-8128
  routes.post("/vault/sync", erc8128(), async (c) => {
    const result = await vault.sync(c.get("signer"));
    return c.json({ ...result, signer: c.get("signer") });
  });

  // Auth challenge — generate nonce for wallet signing
  routes.post("/auth/challenge", async (c) => {
    const nonce = crypto.randomUUID();
    const timestamp = Date.now();
    const message = `OrbitMem Authentication\nTimestamp: ${timestamp}\nNonce: ${nonce}`;
    return c.json({ message, nonce, timestamp });
  });

  // Issue session token — requires ERC-8128 auth
  routes.post("/auth/session", erc8128(), async (c) => {
    const body = await c.req.json<{ ttl?: number }>().catch(() => ({}) as { ttl?: number });
    const ttl = Math.min(body.ttl ?? DEFAULT_SESSION_TTL, MAX_SESSION_TTL);
    const address = c.get("signer");
    const token = await createSessionToken(address, ttl);
    const expiresAt = Date.now() + ttl * 1000;
    return c.json({ token, expiresAt, address });
  });

  // Internal: seed vault data (for testing / initial sync)
  routes.post("/vault/seed", async (c) => {
    const body = await c.req.json<{
      address: string;
      entries: Array<{ key: string; value: unknown; visibility: string }>;
    }>();
    const count = await vault.seed(body.address, body.entries);
    return c.json({ status: "ok", count });
  });

  // Write vault entry — requires ERC-8128
  routes.post("/vault/write", erc8128(), async (c) => {
    const body = await c.req.json<{ path: string; value: unknown; visibility: string }>();
    const signer = c.get("signer");
    const result = await vault.write(signer, body.path, body.value, body.visibility);
    return c.json({ ok: true, hash: result.hash });
  });

  // Delete vault entry — requires ERC-8128
  routes.post("/vault/delete", erc8128(), async (c) => {
    const body = await c.req.json<{ path: string }>();
    const signer = c.get("signer");
    await vault.delete(signer, body.path);
    return c.json({ ok: true });
  });

  // List vault keys — requires ERC-8128
  routes.post("/vault/keys", erc8128(), async (c) => {
    const body = await c.req.json<{ prefix?: string }>();
    const signer = c.get("signer");
    const keys = await vault.getKeys(signer, body.prefix);
    return c.json({ keys });
  });

  return routes;
}
