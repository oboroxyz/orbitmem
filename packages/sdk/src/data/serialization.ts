import type { AESEncryptedData, EncryptedData, LitEncryptedData } from "../types.js";

/** JSON-safe AES encrypted data (Uint8Array fields as base64 strings) */
export interface SerializedAESEncryptedData {
  engine: "aes";
  ciphertext: string;
  iv: string;
  authTag: string;
  keyDerivation: {
    source: "wallet-signature" | "password" | "raw";
    salt: string;
    kdf: "hkdf-sha256" | "pbkdf2-sha256";
    iterations?: number;
  };
}

/** JSON-safe Lit encrypted data */
export interface SerializedLitEncryptedData {
  engine: "lit";
  ciphertext: string;
  dataToEncryptHash: string;
  accessControlConditions: unknown[];
  chain: string;
}

export type SerializedEncryptedData = SerializedAESEncryptedData | SerializedLitEncryptedData;

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function serializeEncrypted(data: EncryptedData): SerializedEncryptedData {
  if (data.engine === "aes") {
    const aes = data as AESEncryptedData;
    return {
      engine: "aes",
      ciphertext: uint8ToBase64(aes.ciphertext),
      iv: uint8ToBase64(aes.iv),
      authTag: uint8ToBase64(aes.authTag),
      keyDerivation: {
        source: aes.keyDerivation.source,
        salt: uint8ToBase64(aes.keyDerivation.salt),
        kdf: aes.keyDerivation.kdf,
        ...(aes.keyDerivation.iterations != null
          ? { iterations: aes.keyDerivation.iterations }
          : {}),
      },
    };
  }
  const lit = data as LitEncryptedData;
  return {
    engine: "lit",
    ciphertext: uint8ToBase64(lit.ciphertext),
    dataToEncryptHash: lit.dataToEncryptHash,
    accessControlConditions: lit.accessControlConditions,
    chain: lit.chain as string,
  };
}

export function deserializeEncrypted(data: SerializedEncryptedData): EncryptedData {
  if (data.engine === "aes") {
    return {
      engine: "aes",
      ciphertext: base64ToUint8(data.ciphertext),
      iv: base64ToUint8(data.iv),
      authTag: base64ToUint8(data.authTag),
      keyDerivation: {
        source: data.keyDerivation.source,
        salt: base64ToUint8(data.keyDerivation.salt),
        kdf: data.keyDerivation.kdf,
        ...(data.keyDerivation.iterations != null
          ? { iterations: data.keyDerivation.iterations }
          : {}),
      },
    };
  }
  return {
    engine: "lit",
    ciphertext: base64ToUint8(data.ciphertext),
    dataToEncryptHash: data.dataToEncryptHash,
    accessControlConditions: data.accessControlConditions as any,
    chain: data.chain as any,
  };
}

/** Check whether a stored value is a serialized encrypted blob */
export function isSerializedEncrypted(value: unknown): value is SerializedEncryptedData {
  return (
    value !== null &&
    typeof value === "object" &&
    "engine" in (value as Record<string, unknown>) &&
    ((value as Record<string, unknown>).engine === "aes" ||
      (value as Record<string, unknown>).engine === "lit")
  );
}
