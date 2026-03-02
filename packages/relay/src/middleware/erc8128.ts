import type { MiddlewareHandler } from 'hono';

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
 * ERC-8128 signature verification middleware.
 * Extracts X-OrbitMem-* headers, verifies timestamp/nonce,
 * and sets `signer`, `signerFamily`, and `signerAlgorithm` on the context.
 *
 * Signature cryptographic verification is optional — pass a verifier function
 * for production use. Without a verifier, the middleware trusts the headers
 * (suitable for development/testing).
 */
export function erc8128(opts?: {
  verifier?: (payload: Uint8Array, signature: Uint8Array, algorithm: string) => Promise<boolean>;
  required?: boolean;
}): MiddlewareHandler {
  const required = opts?.required ?? true;

  return async (c, next) => {
    const signer = c.req.header('X-OrbitMem-Signer');
    const family = c.req.header('X-OrbitMem-Family');
    const algorithm = c.req.header('X-OrbitMem-Algorithm');
    const timestampStr = c.req.header('X-OrbitMem-Timestamp');
    const nonce = c.req.header('X-OrbitMem-Nonce');
    const signatureHex = c.req.header('X-OrbitMem-Signature');

    // If headers are missing and not required, pass through
    if (!signer && !required) {
      await next();
      return;
    }

    // Validate required headers
    if (!signer || !family || !algorithm || !timestampStr || !nonce || !signatureHex) {
      return c.json({ error: 'Missing ERC-8128 headers' }, 401);
    }

    const timestamp = Number(timestampStr);

    // Timestamp check
    const now = Date.now();
    if (Math.abs(now - timestamp) > TIMESTAMP_TOLERANCE) {
      return c.json({ error: 'Request timestamp out of tolerance' }, 401);
    }

    // Nonce replay check
    cleanNonces();
    if (nonceCache.has(nonce)) {
      return c.json({ error: 'Replay detected: nonce already used' }, 401);
    }

    // Signature verification (if verifier provided)
    if (opts?.verifier) {
      const body = c.req.method !== 'GET' ? await c.req.text() : undefined;
      const bodyHash = body
        ? new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body)))
        : new Uint8Array(0);
      const payload = new TextEncoder().encode(
        `${c.req.method}\n${c.req.url}\n${timestamp}\n${nonce}\n${Array.from(bodyHash).map(b => b.toString(16).padStart(2, '0')).join('')}`
      );

      const signature = new Uint8Array(
        signatureHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
      );

      const valid = await opts.verifier(payload, signature, algorithm);
      if (!valid) {
        return c.json({ error: 'Invalid signature' }, 401);
      }
    }

    // Accept — record nonce and set context
    nonceCache.set(nonce, Date.now());
    c.set('signer', signer);
    c.set('signerFamily', family);
    c.set('signerAlgorithm', algorithm);

    await next();
  };
}
