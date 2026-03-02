import type {
  ChainFamily,
  SessionKey,
  SessionPermission,
  SignatureAlgorithm,
  WalletAddress,
} from "../types.js";

export async function deriveSessionKey(opts: {
  family: ChainFamily;
  signature: Uint8Array;
  parentAddress: WalletAddress;
  permissions: SessionPermission[];
  ttl: number; // seconds
  nonce?: Uint8Array;
}): Promise<SessionKey> {
  const nonce = opts.nonce ?? crypto.getRandomValues(new Uint8Array(32));

  // Derive session address from signature + nonce
  const combined = new Uint8Array(opts.signature.length + nonce.length);
  combined.set(opts.signature, 0);
  combined.set(nonce, opts.signature.length);

  const hashBuffer = await crypto.subtle.digest("SHA-256", combined);
  const hashArray = new Uint8Array(hashBuffer);

  // Use first 20 bytes as session address (EVM-style)
  const sessionAddrBytes = hashArray.slice(0, 20);
  const sessionAddress = ("0x" +
    Array.from(sessionAddrBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")) as WalletAddress;

  // Session ID from hash
  const id = Array.from(hashArray.slice(20, 32))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const expiresAt = Date.now() + opts.ttl * 1000;

  const algorithmMap: Record<ChainFamily, SignatureAlgorithm> = {
    passkey: "p256",
    evm: "ecdsa-secp256k1",
    solana: "ed25519",
  };

  return {
    id,
    parentAddress: opts.parentAddress,
    family: opts.family,
    sessionAddress,
    permissions: opts.permissions,
    expiresAt,
    isActive: expiresAt > Date.now(),
    algorithm: algorithmMap[opts.family],
  };
}
