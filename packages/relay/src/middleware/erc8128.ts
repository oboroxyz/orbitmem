import type { MiddlewareHandler } from "hono";
import { verifyMessage } from "viem";

export type ERC8128Env = {
  Variables: {
    signer: string;
    signerFamily: string;
    signerAlgorithm: string;
  };
};

const nonceCache = new Map<string, number>();
const NONCE_TTL = 5 * 60 * 1000; // 5 min
const TIMESTAMP_TOLERANCE = 30 * 1000; // ±30s

function cleanNonces() {
  const now = Date.now();
  for (const [nonce, ts] of nonceCache) {
    if (now - ts > NONCE_TTL) nonceCache.delete(nonce);
  }
}

/**
 * Verify an EVM signature using viem's secp256k1 recovery.
 * Recovers the signer address from the payload+signature and checks
 * it matches the claimed signer address.
 */
async function evmVerify(
  payload: Uint8Array,
  signature: Uint8Array,
  claimedSigner: string,
): Promise<boolean> {
  try {
    const sigHex = `0x${Array.from(signature)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")}` as `0x${string}`;

    const valid = await verifyMessage({
      address: claimedSigner as `0x${string}`,
      message: { raw: payload },
      signature: sigHex,
    });
    return valid;
  } catch {
    return false;
  }
}

/**
 * ERC-8128 signature verification middleware.
 * Extracts X-OrbitMem-* headers, verifies timestamp/nonce,
 * and sets `signer`, `signerFamily`, and `signerAlgorithm` on the context.
 *
 * Options:
 * - `verify: 'evm'` — cryptographic verification using viem (secp256k1 recovery)
 * - `verifier: fn` — custom verification callback
 * - neither — trusts headers without signature check (development/testing)
 */
export function erc8128(opts?: {
  verify?: "evm";
  verifier?: (payload: Uint8Array, signature: Uint8Array, algorithm: string) => Promise<boolean>;
  required?: boolean;
}): MiddlewareHandler<ERC8128Env> {
  const required = opts?.required ?? true;

  return async (c, next) => {
    const signer = c.req.header("X-OrbitMem-Signer");
    const family = c.req.header("X-OrbitMem-Family");
    const algorithm = c.req.header("X-OrbitMem-Algorithm");
    const timestampStr = c.req.header("X-OrbitMem-Timestamp");
    const nonce = c.req.header("X-OrbitMem-Nonce");
    const signatureHex = c.req.header("X-OrbitMem-Signature");

    // If headers are missing and not required, pass through
    if (!signer && !required) {
      await next();
      return;
    }

    // Validate required headers
    if (!signer || !family || !algorithm || !timestampStr || !nonce || !signatureHex) {
      return c.json({ error: "Missing ERC-8128 headers" }, 401);
    }

    const timestamp = Number(timestampStr);

    // Timestamp check
    const now = Date.now();
    if (Math.abs(now - timestamp) > TIMESTAMP_TOLERANCE) {
      return c.json({ error: "Request timestamp out of tolerance" }, 401);
    }

    // Nonce replay check
    cleanNonces();
    if (nonceCache.has(nonce)) {
      return c.json({ error: "Replay detected: nonce already used" }, 401);
    }

    // Signature verification
    const shouldVerify = opts?.verify === "evm" || opts?.verifier;
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
        signatureHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
      );

      let valid: boolean;
      if (opts?.verify === "evm") {
        valid = await evmVerify(payload, signature, signer);
      } else {
        valid = await opts!.verifier!(payload, signature, algorithm);
      }

      if (!valid) {
        return c.json({ error: "Invalid signature" }, 401);
      }
    }

    // Accept — record nonce and set context
    nonceCache.set(nonce, Date.now());
    c.set("signer", signer);
    c.set("signerFamily", family);
    c.set("signerAlgorithm", algorithm);

    await next();
  };
}
