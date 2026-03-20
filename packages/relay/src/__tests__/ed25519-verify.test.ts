import { describe, expect, test } from "bun:test";

import { ed25519 } from "@noble/curves/ed25519.js";

import { verifyEd25519 } from "../middleware/ed25519-verify.js";

describe("Ed25519 Verify", () => {
  const privateKey = ed25519.utils.randomSecretKey();
  const publicKey = ed25519.getPublicKey(privateKey);
  const publicKeyHex = Array.from(publicKey)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  test("accepts valid Ed25519 signature", async () => {
    const payload = new TextEncoder().encode("GET\n/test\n1234567890\nnonce123\n");
    const signature = ed25519.sign(payload, privateKey);

    const valid = await verifyEd25519(payload, signature, publicKeyHex);
    expect(valid).toBe(true);
  });

  test("rejects tampered signature", async () => {
    const payload = new TextEncoder().encode("GET\n/test\n1234567890\nnonce123\n");
    const fakeSignature = new Uint8Array(64).fill(0xab);

    const valid = await verifyEd25519(payload, fakeSignature, publicKeyHex);
    expect(valid).toBe(false);
  });

  test("rejects wrong public key", async () => {
    const payload = new TextEncoder().encode("GET\n/test\n1234567890\nnonce123\n");
    const signature = ed25519.sign(payload, privateKey);
    const wrongKey = ed25519.utils.randomSecretKey();
    const wrongPublicKeyHex = Array.from(ed25519.getPublicKey(wrongKey))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const valid = await verifyEd25519(payload, signature, wrongPublicKeyHex);
    expect(valid).toBe(false);
  });

  test("rejects tampered payload", async () => {
    const payload = new TextEncoder().encode("GET\n/test\n1234567890\nnonce123\n");
    const signature = ed25519.sign(payload, privateKey);
    const tampered = new TextEncoder().encode("POST\n/test\n1234567890\nnonce123\n");

    const valid = await verifyEd25519(tampered, signature, publicKeyHex);
    expect(valid).toBe(false);
  });
});
