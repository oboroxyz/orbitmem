import { AESEngine } from "@orbitmem/sdk";
import type { AESEncryptedData } from "@orbitmem/sdk";

const aes = new AESEngine({ kdf: "hkdf-sha256" });

/**
 * Derive a deterministic AES-256 vault key from a wallet signature.
 * SHA-256 of the signature -> raw import as AES-GCM key.
 */
export async function deriveVaultKey(signature: Uint8Array): Promise<CryptoKey> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", signature as BufferSource));
  return aes.deriveKey({ type: "raw", key: hash });
}

/** Encrypt a value for private vault storage. Returns serialized JSON string. */
export async function encryptValue(value: unknown, key: CryptoKey): Promise<string> {
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await aes.encrypt(plaintext, key);
  return JSON.stringify({
    engine: encrypted.engine,
    ciphertext: uint8ToBase64(encrypted.ciphertext),
    iv: uint8ToBase64(encrypted.iv),
    authTag: uint8ToBase64(encrypted.authTag),
    keyDerivation: encrypted.keyDerivation
      ? {
          ...encrypted.keyDerivation,
          salt: uint8ToBase64(encrypted.keyDerivation.salt),
        }
      : undefined,
  });
}

/** Decrypt a stored value. Input is the serialized JSON string from encryptValue. */
export async function decryptValue<T>(blob: string, key: CryptoKey): Promise<T> {
  const parsed = JSON.parse(blob);
  const encrypted: AESEncryptedData = {
    engine: "aes",
    ciphertext: base64ToUint8(parsed.ciphertext),
    iv: base64ToUint8(parsed.iv),
    authTag: base64ToUint8(parsed.authTag),
    keyDerivation: parsed.keyDerivation
      ? {
          ...parsed.keyDerivation,
          salt: base64ToUint8(parsed.keyDerivation.salt),
        }
      : { source: "raw", salt: new Uint8Array(0), kdf: "hkdf-sha256" },
  };
  const decrypted = await aes.decrypt(encrypted, key);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

function uint8ToBase64(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr));
}

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  return new Uint8Array([...bin].map((c) => c.charCodeAt(0)));
}
