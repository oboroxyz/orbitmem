// Random secret per process — tokens invalidate on relay restart
const SECRET = crypto.getRandomValues(new Uint8Array(32));

let hmacKey: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
  if (!hmacKey) {
    hmacKey = await crypto.subtle.importKey(
      "raw",
      SECRET,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  }
  return hmacKey;
}

/**
 * Create a stateless HMAC-signed session token.
 * Format: base64(JSON payload) + "." + base64(HMAC signature)
 */
export async function createSessionToken(address: string, ttlSeconds: number): Promise<string> {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const payload = JSON.stringify({ address, expiresAt });
  const payloadB64 = btoa(payload);
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${payloadB64}.${sigB64}`;
}

/**
 * Verify a session token. Returns the payload if valid, null otherwise.
 */
export async function verifySessionToken(
  token: string,
): Promise<{ address: string; expiresAt: number } | null> {
  const dot = token.indexOf(".");
  if (dot === -1) return null;

  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);

  try {
    const key = await getKey();
    const sig = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sig,
      new TextEncoder().encode(payloadB64),
    );
    if (!valid) return null;

    const payload = JSON.parse(atob(payloadB64));
    if (payload.expiresAt <= Date.now()) return null;

    return { address: payload.address, expiresAt: payload.expiresAt };
  } catch {
    return null;
  }
}
