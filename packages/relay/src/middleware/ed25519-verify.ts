import { ed25519 } from "@noble/curves/ed25519.js";

/**
 * Verify an Ed25519 signature against a payload and public key.
 * Used for Solana wallet authentication in the legacy X-OrbitMem-* header path.
 *
 * The signer address is the hex-encoded Ed25519 public key (not base58).
 * This doubles as both identifier and verification key.
 *
 * @param payload - The signed payload bytes
 * @param signature - The Ed25519 signature (64 bytes)
 * @param publicKeyHex - The signer's public key as hex string (64 hex chars = 32 bytes)
 * @returns true if the signature is valid
 */
export async function verifyEd25519(
  payload: Uint8Array,
  signature: Uint8Array,
  publicKeyHex: string,
): Promise<boolean> {
  try {
    const publicKey = hexToBytes(publicKeyHex);
    return ed25519.verify(signature, payload, publicKey);
  } catch {
    return false;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
