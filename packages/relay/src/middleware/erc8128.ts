import { type NonceStore, type VerifyResult, createVerifierClient } from "@slicekit/erc8128";
import type { MiddlewareHandler } from "hono";
import { getAddress, verifyMessage } from "viem";

import { verifyEd25519 } from "./ed25519-verify.js";
import { verifySessionToken } from "./session.js";

export type ERC8128Env = {
  Variables: {
    signer: string;
    signerFamily: string;
    signerAlgorithm: string;
  };
};

/**
 * In-memory nonce store for replay protection.
 * Entries auto-expire after their TTL.
 */
function createMemoryNonceStore(): NonceStore {
  const seen = new Map<string, number>(); // key -> expiry timestamp (ms)

  function clean() {
    const now = Date.now();
    for (const [key, expiry] of seen) {
      if (now > expiry) seen.delete(key);
    }
  }

  return {
    async consume(key: string, ttlSeconds: number): Promise<boolean> {
      clean();
      if (seen.has(key)) return false; // already consumed
      seen.set(key, Date.now() + ttlSeconds * 1000);
      return true; // newly stored
    },
  };
}

const nonceStore = createMemoryNonceStore();

/**
 * ERC-8128 signature verification middleware using @slicekit/erc8128.
 *
 * Options:
 * - `verify: 'evm'` — cryptographic verification using viem (secp256k1 recovery)
 * - `verifier: fn` — custom verification callback (legacy, mapped to verifyMessage)
 * - neither — trusts headers without signature check (development/testing)
 * - `required` — whether auth is required (default true)
 * - `replayable` — allow replayable (nonce-less) class-bound signatures (default false)
 */
export function erc8128(opts?: {
  verify?: "evm" | "auto";
  verifier?: (payload: Uint8Array, signature: Uint8Array, algorithm: string) => Promise<boolean>;
  required?: boolean;
  replayable?: boolean;
}): MiddlewareHandler<ERC8128Env> {
  const required = opts?.required ?? true;
  const allowReplayable = opts?.replayable ?? true;

  return async (c, next) => {
    // --- Bearer session token path (fastest, no signature check) ---
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const session = await verifySessionToken(token);
      if (session) {
        c.set("signer", session.address);
        c.set("signerFamily", "session");
        c.set("signerAlgorithm", "hmac-sha256");
        await next();
        return;
      }
      // Invalid/expired bearer — check for ERC-8128 fallback headers
      const hasLegacy = !!c.req.header("X-OrbitMem-Signer");
      const hasRfc = !!c.req.header("Signature-Input");
      if (!hasLegacy && !hasRfc) {
        return c.json({ error: "Invalid or expired session token" }, 401);
      }
      // Fall through to ERC-8128 verification below
    }

    // Check if this is a legacy X-OrbitMem-* request or RFC 9421 Signature request
    const hasLegacyHeaders = !!c.req.header("X-OrbitMem-Signer");
    const hasRfc9421Headers = !!c.req.header("Signature-Input");

    if (!hasLegacyHeaders && !hasRfc9421Headers) {
      if (!required) {
        await next();
        return;
      }
      return c.json({ error: "Missing ERC-8128 headers" }, 401);
    }

    // --- Legacy X-OrbitMem-* header path (backward compat) ---
    if (hasLegacyHeaders) {
      return handleLegacy(c, next, opts);
    }

    // --- RFC 9421 / @slicekit/erc8128 path ---
    const shouldVerify = opts?.verify === "evm" || opts?.verifier;

    if (!shouldVerify) {
      // Trust mode: parse keyid from Signature-Input to extract signer address
      const sigInput = c.req.header("Signature-Input") ?? "";
      const keyidMatch = sigInput.match(/keyid="(?:eip155|erc8128):(\d+):(0x[a-fA-F0-9]+)"/);
      if (!keyidMatch) {
        return c.json({ error: "Cannot parse signer from Signature-Input" }, 401);
      }
      c.set("signer", getAddress(keyidMatch[2] as `0x${string}`));
      c.set("signerFamily", "evm");
      c.set("signerAlgorithm", "ecdsa-secp256k1");
      await next();
      return;
    }

    // Verified mode — use @slicekit/erc8128 verifier
    const result = await verifyWithLibrary(c.req.raw.clone(), allowReplayable);
    if (!result.ok) {
      return c.json({ error: `Invalid signature: ${result.reason}` }, 401);
    }

    c.set("signer", getAddress(result.address));
    c.set("signerFamily", "evm");
    c.set("signerAlgorithm", "ecdsa-secp256k1");
    await next();
  };
}

async function verifyWithLibrary(
  request: Request,
  allowReplayable: boolean,
): Promise<VerifyResult> {
  const verifier = createVerifierClient({
    verifyMessage: async ({ address, message, signature }) => {
      return verifyMessage({ address, message, signature });
    },
    nonceStore,
    defaults: {
      replayable: allowReplayable,
      classBoundPolicies: [["@authority"]],
      clockSkewSec: 30,
      maxValiditySec: 3600, // 1 hour max
    },
  });

  return verifier.verifyRequest({ request });
}

// --- Legacy handler for backward compatibility with X-OrbitMem-* headers ---

const legacyNonceCache = new Map<string, number>();
const LEGACY_NONCE_TTL = 5 * 60 * 1000;
const LEGACY_TIMESTAMP_TOLERANCE = 30 * 1000;

function cleanLegacyNonces() {
  const now = Date.now();
  for (const [nonce, ts] of legacyNonceCache) {
    if (now - ts > LEGACY_NONCE_TTL) legacyNonceCache.delete(nonce);
  }
}

async function evmVerify(
  payload: Uint8Array,
  signature: Uint8Array,
  claimedSigner: string,
): Promise<boolean> {
  try {
    const sigHex = `0x${Array.from(signature)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")}` as `0x${string}`;
    return await verifyMessage({
      address: claimedSigner as `0x${string}`,
      message: { raw: payload },
      signature: sigHex,
    });
  } catch {
    return false;
  }
}

async function handleLegacy(
  c: any,
  next: () => Promise<void>,
  opts?: {
    verify?: "evm" | "auto";
    verifier?: (payload: Uint8Array, signature: Uint8Array, algorithm: string) => Promise<boolean>;
    required?: boolean;
  },
) {
  const signer = c.req.header("X-OrbitMem-Signer");
  const family = c.req.header("X-OrbitMem-Family");
  const algorithm = c.req.header("X-OrbitMem-Algorithm");
  const timestampStr = c.req.header("X-OrbitMem-Timestamp");
  const nonce = c.req.header("X-OrbitMem-Nonce");
  const signatureHex = c.req.header("X-OrbitMem-Signature");

  if (!signer || !family || !algorithm || !timestampStr || !nonce || !signatureHex) {
    return c.json({ error: "Missing ERC-8128 headers" }, 401);
  }

  const timestamp = Number(timestampStr);
  const now = Date.now();
  if (Math.abs(now - timestamp) > LEGACY_TIMESTAMP_TOLERANCE) {
    return c.json({ error: "Request timestamp out of tolerance" }, 401);
  }

  cleanLegacyNonces();
  if (legacyNonceCache.has(nonce)) {
    return c.json({ error: "Replay detected: nonce already used" }, 401);
  }

  const shouldVerify = opts?.verify === "evm" || opts?.verify === "auto" || opts?.verifier;
  if (shouldVerify) {
    const body = c.req.method !== "GET" ? await c.req.text() : undefined;
    const bodyHash = body
      ? new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body) as BufferSource),
        )
      : new Uint8Array(0);
    const payload = new TextEncoder().encode(
      `${c.req.method}\n${c.req.path}\n${timestamp}\n${nonce}\n${Array.from(bodyHash)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")}`,
    );

    const signature = new Uint8Array(
      signatureHex.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)),
    );

    let valid: boolean;
    if (opts?.verify === "evm" || (opts?.verify === "auto" && family === "evm")) {
      valid = await evmVerify(payload, signature, signer);
    } else if (opts?.verify === "auto" && family === "solana" && algorithm === "ed25519") {
      valid = await verifyEd25519(payload, signature, signer);
    } else if (opts?.verifier) {
      valid = await opts.verifier(payload, signature, algorithm);
    } else {
      valid = false;
    }

    if (!valid) {
      return c.json({ error: "Invalid signature" }, 401);
    }
  }

  legacyNonceCache.set(nonce, Date.now());
  c.set("signer", signer);
  c.set("signerFamily", family);
  c.set("signerAlgorithm", algorithm);

  await next();
}
