import { describe, expect, test } from "bun:test";

import { createTransportLayer } from "../transport-layer.js";

describe("TransportLayer", () => {
  test("createSignedRequest adds ERC-8128 headers", async () => {
    const transport = createTransportLayer({
      signer: async (_payload: Uint8Array) => ({
        signature: new Uint8Array(65).fill(0xab),
        algorithm: "ecdsa-secp256k1" as const,
      }),
      signerAddress: "0x1234567890abcdef1234567890abcdef12345678",
      family: "evm",
    });

    const signed = await transport.createSignedRequest({
      url: "https://orbitmem-relay.fly.dev/v1/vault/read",
      method: "POST",
      body: { key: "preferences" },
    });

    expect(signed.proof.signer).toBe("0x1234567890abcdef1234567890abcdef12345678");
    expect(signed.proof.family).toBe("evm");
    expect(signed.proof.algorithm).toBe("ecdsa-secp256k1");
    expect(signed.proof.signature).toBeInstanceOf(Uint8Array);
    expect(signed.proof.nonce).toBeTruthy();
    expect(signed.proof.timestamp).toBeGreaterThan(0);
    expect(signed.headers["X-OrbitMem-Signer"]).toBe("0x1234567890abcdef1234567890abcdef12345678");
  });

  test("verifyRequest validates signature round-trip", async () => {
    const transport = createTransportLayer({
      signer: async (payload: Uint8Array) => {
        // Simple "sign" = hash of payload (for testing)
        const hash = await crypto.subtle.digest("SHA-256", payload as BufferSource);
        return {
          signature: new Uint8Array(hash),
          algorithm: "ecdsa-secp256k1" as const,
        };
      },
      verifier: async (payload: Uint8Array, signature: Uint8Array) => {
        const hash = await crypto.subtle.digest("SHA-256", payload as BufferSource);
        const expected = new Uint8Array(hash);
        return signature.length === expected.length && signature.every((b, i) => b === expected[i]);
      },
      signerAddress: "0xAGENT",
      family: "evm",
    });

    const signed = await transport.createSignedRequest({
      url: "https://orbitmem-relay.fly.dev/v1/vault/read",
      method: "POST",
      body: { key: "test" },
    });

    const result = await transport.verifyRequest(signed);
    expect(result.valid).toBe(true);
    expect(result.signer).toBe("0xAGENT");
    expect(result.isReplay).toBe(false);
  });

  test("replay detection rejects seen nonce", async () => {
    const transport = createTransportLayer({
      signer: async (_payload) => ({
        signature: new Uint8Array(32).fill(1),
        algorithm: "ecdsa-secp256k1" as const,
      }),
      verifier: async () => true,
      signerAddress: "0xAGENT",
      family: "evm",
    });

    const signed = await transport.createSignedRequest({
      url: "https://orbitmem-relay.fly.dev/v1/health",
      method: "GET",
    });

    const first = await transport.verifyRequest(signed);
    expect(first.isReplay).toBe(false);

    const second = await transport.verifyRequest(signed);
    expect(second.isReplay).toBe(true);
  });
});
