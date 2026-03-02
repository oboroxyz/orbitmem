import { describe, expect, test } from "bun:test";
import { createEncryptionLayer } from "../encryption-layer.js";

describe("EncryptionLayer", () => {
  const layer = createEncryptionLayer({
    defaultEngine: "aes",
    aes: { kdf: "hkdf-sha256" },
  });

  test("encrypt/decrypt with AES via unified interface", async () => {
    const data = new TextEncoder().encode("unified test");
    const rawKey = crypto.getRandomValues(new Uint8Array(32));

    const encrypted = await layer.encrypt(data, {
      engine: "aes",
      keySource: { type: "raw", key: rawKey },
    });

    expect(encrypted.engine).toBe("aes");

    const decrypted = await layer.decrypt(encrypted, {
      keySource: { type: "raw", key: rawKey },
    });
    expect(new TextDecoder().decode(decrypted)).toBe("unified test");
  });

  test("deriveAESKey returns CryptoKey", async () => {
    const key = await layer.deriveAESKey({
      type: "raw",
      key: crypto.getRandomValues(new Uint8Array(32)),
    });
    expect(key.type).toBe("secret");
  });

  test("canDecrypt returns true for AES", async () => {
    const rawKey = crypto.getRandomValues(new Uint8Array(32));
    const encrypted = await layer.encrypt(new TextEncoder().encode("test"), {
      engine: "aes",
      keySource: { type: "raw", key: rawKey },
    });
    const result = await layer.canDecrypt(encrypted);
    expect(result).toBe(true);
  });
});
