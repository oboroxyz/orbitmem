import { describe, expect, test } from "bun:test";
import { ed25519 } from "@noble/curves/ed25519.js";

import { createTransportLayer } from "../transport-layer.js";

describe("TransportLayer — Solana Ed25519", () => {
  const privateKey = ed25519.utils.randomSecretKey();
  const publicKey = ed25519.getPublicKey(privateKey);
  const solanaAddress = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";

  test("createSignedRequest adds Solana headers with ed25519", async () => {
    const transport = createTransportLayer({
      signer: async (payload: Uint8Array) => ({
        signature: ed25519.sign(payload, privateKey),
        algorithm: "ed25519" as const,
      }),
      signerAddress: solanaAddress,
      family: "solana",
    });

    const signed = await transport.createSignedRequest({
      url: "https://relay.orbitmem.com/v1/vault/read",
      method: "POST",
      body: { key: "preferences" },
    });

    expect(signed.proof.signer).toBe(solanaAddress);
    expect(signed.proof.family).toBe("solana");
    expect(signed.proof.algorithm).toBe("ed25519");
    expect(signed.proof.signature).toBeInstanceOf(Uint8Array);
    expect(signed.proof.nonce).toBeTruthy();
    expect(signed.proof.timestamp).toBeGreaterThan(0);
    expect(signed.headers["X-OrbitMem-Signer"]).toBe(solanaAddress);
    expect(signed.headers["X-OrbitMem-Family"]).toBe("solana");
    expect(signed.headers["X-OrbitMem-Algorithm"]).toBe("ed25519");
  });

  test("verifyRequest validates Ed25519 signature round-trip", async () => {
    const transport = createTransportLayer({
      signer: async (payload: Uint8Array) => ({
        signature: ed25519.sign(payload, privateKey),
        algorithm: "ed25519" as const,
      }),
      verifier: async (payload: Uint8Array, signature: Uint8Array) => {
        return ed25519.verify(signature, payload, publicKey);
      },
      signerAddress: solanaAddress,
      family: "solana",
    });

    const signed = await transport.createSignedRequest({
      url: "https://relay.orbitmem.com/v1/vault/read",
      method: "POST",
      body: { key: "test" },
    });

    const result = await transport.verifyRequest(signed);
    expect(result.valid).toBe(true);
    expect(result.signer).toBe(solanaAddress);
    expect(result.family).toBe("solana");
    expect(result.isReplay).toBe(false);
  });

  test("rejects tampered Ed25519 signature", async () => {
    const transport = createTransportLayer({
      signer: async (payload: Uint8Array) => ({
        signature: ed25519.sign(payload, privateKey),
        algorithm: "ed25519" as const,
      }),
      verifier: async (payload: Uint8Array, signature: Uint8Array) => {
        return ed25519.verify(signature, payload, publicKey);
      },
      signerAddress: solanaAddress,
      family: "solana",
    });

    const signed = await transport.createSignedRequest({
      url: "https://relay.orbitmem.com/v1/vault/read",
      method: "POST",
      body: { key: "test" },
    });

    signed.proof.signature = new Uint8Array(64).fill(0xab);

    const result = await transport.verifyRequest(signed);
    expect(result.valid).toBe(false);
  });

  test("replay detection works for Solana signer", async () => {
    const transport = createTransportLayer({
      signer: async (_payload) => ({
        signature: new Uint8Array(64).fill(1),
        algorithm: "ed25519" as const,
      }),
      verifier: async () => true,
      signerAddress: solanaAddress,
      family: "solana",
    });

    const signed = await transport.createSignedRequest({
      url: "https://relay.orbitmem.com/v1/health",
      method: "GET",
    });

    const first = await transport.verifyRequest(signed);
    expect(first.isReplay).toBe(false);

    const second = await transport.verifyRequest(signed);
    expect(second.isReplay).toBe(true);
  });
});
