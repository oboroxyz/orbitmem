import { describe, expect, test } from "bun:test";
import { ed25519 } from "@noble/curves/ed25519.js";
import { Hono } from "hono";

import { type ERC8128Env, erc8128 } from "../middleware/erc8128.js";

describe("ERC-8128 Middleware — Solana", () => {
  const privateKey = ed25519.utils.randomSecretKey();
  const publicKey = ed25519.getPublicKey(privateKey);
  // Use hex-encoded public key as signer address (relay needs it for verification)
  const solanaAddress = Array.from(publicKey)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  function createTestApp(opts?: Parameters<typeof erc8128>[0]) {
    const app = new Hono<ERC8128Env>();
    app.use("/protected/*", erc8128(opts));
    app.get("/protected/test", (c) => {
      return c.json({
        signer: c.get("signer"),
        family: c.get("signerFamily"),
        algorithm: c.get("signerAlgorithm"),
      });
    });
    return app;
  }

  async function makeSolanaHeaders(overrides?: Record<string, string>) {
    const timestamp = Date.now();
    const nonce = crypto.randomUUID();
    const method = "GET";
    const url = "/protected/test";
    const bodyHashHex = Array.from(new Uint8Array(0))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const payloadStr = `${method}\n${url}\n${timestamp}\n${nonce}\n${bodyHashHex}`;
    const payload = new TextEncoder().encode(payloadStr);
    const signature = ed25519.sign(payload, privateKey);
    const signatureHex = Array.from(signature)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return {
      "X-OrbitMem-Signer": solanaAddress,
      "X-OrbitMem-Family": "solana",
      "X-OrbitMem-Algorithm": "ed25519",
      "X-OrbitMem-Timestamp": String(timestamp),
      "X-OrbitMem-Nonce": nonce,
      "X-OrbitMem-Signature": signatureHex,
      ...overrides,
    };
  }

  test("accepts valid Solana headers (trust mode)", async () => {
    const app = createTestApp();
    const headers = await makeSolanaHeaders();
    const res = await app.request("/protected/test", { headers });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.signer).toBe(solanaAddress);
    expect(body.family).toBe("solana");
    expect(body.algorithm).toBe("ed25519");
  });

  test("verify: 'auto' accepts real Ed25519 Solana signature", async () => {
    const app = createTestApp({ verify: "auto" });
    const headers = await makeSolanaHeaders();
    const res = await app.request("/protected/test", { headers });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.signer).toBe(solanaAddress);
    expect(body.family).toBe("solana");
  });

  test("verify: 'auto' rejects forged Solana signature", async () => {
    const app = createTestApp({ verify: "auto" });
    const headers = await makeSolanaHeaders({
      "X-OrbitMem-Signature": "ab".repeat(64), // fake 64-byte signature
    });
    const res = await app.request("/protected/test", { headers });
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.error).toContain("Invalid signature");
  });

  test("rejects expired timestamp for Solana", async () => {
    const app = createTestApp();
    const headers = await makeSolanaHeaders({
      "X-OrbitMem-Timestamp": String(Date.now() - 60_000),
    });
    const res = await app.request("/protected/test", { headers });
    expect(res.status).toBe(401);
  });

  test("rejects replayed nonce for Solana", async () => {
    const app = createTestApp();
    const headers = await makeSolanaHeaders();

    const first = await app.request("/protected/test", { headers });
    expect(first.status).toBe(200);

    const second = await app.request("/protected/test", { headers });
    expect(second.status).toBe(401);
  });
});
