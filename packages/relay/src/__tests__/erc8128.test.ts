import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { privateKeyToAccount } from "viem/accounts";
import { erc8128 } from "../middleware/erc8128.js";

describe("ERC-8128 Middleware", () => {
  function createTestApp(opts?: Parameters<typeof erc8128>[0]) {
    const app = new Hono();
    app.use("/protected/*", erc8128(opts));
    app.get("/protected/test", (c) => {
      return c.json({ signer: c.get("signer"), family: c.get("signerFamily") });
    });
    return app;
  }

  function makeHeaders(overrides?: Record<string, string>) {
    return {
      "X-OrbitMem-Signer": "0xAGENT",
      "X-OrbitMem-Family": "evm",
      "X-OrbitMem-Algorithm": "ecdsa-secp256k1",
      "X-OrbitMem-Timestamp": String(Date.now()),
      "X-OrbitMem-Nonce": crypto.randomUUID(),
      "X-OrbitMem-Signature": "ab".repeat(32),
      ...overrides,
    };
  }

  test("accepts valid ERC-8128 headers", async () => {
    const app = createTestApp();
    const res = await app.request("/protected/test", {
      headers: makeHeaders(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.signer).toBe("0xAGENT");
    expect(body.family).toBe("evm");
  });

  test("rejects missing headers when required", async () => {
    const app = createTestApp({ required: true });
    const res = await app.request("/protected/test");
    expect(res.status).toBe(401);
  });

  test("rejects expired timestamp", async () => {
    const app = createTestApp();
    const res = await app.request("/protected/test", {
      headers: makeHeaders({
        "X-OrbitMem-Timestamp": String(Date.now() - 60_000), // 60s ago
      }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.error).toContain("timestamp");
  });

  test("rejects replayed nonce", async () => {
    const app = createTestApp();
    const headers = makeHeaders();

    const first = await app.request("/protected/test", { headers });
    expect(first.status).toBe(200);

    const second = await app.request("/protected/test", { headers });
    expect(second.status).toBe(401);
    const body = (await second.json()) as any;
    expect(body.error).toContain("Replay");
  });

  test("passes through when not required and no headers", async () => {
    const app = createTestApp({ required: false });
    const res = await app.request("/protected/test");
    expect(res.status).toBe(200);
  });

  test("verify: 'evm' accepts real viem signature", async () => {
    const app = createTestApp({ verify: "evm" });

    // Create a real wallet from a test private key
    const account = privateKeyToAccount(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    );

    const timestamp = Date.now();
    const nonce = crypto.randomUUID();
    const method = "GET";
    const url = "/protected/test";
    const bodyHashHex = Array.from(new Uint8Array(0))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const payloadStr = `${method}\n${url}\n${timestamp}\n${nonce}\n${bodyHashHex}`;
    const payload = new TextEncoder().encode(payloadStr);

    // Sign the payload with the real wallet
    const signature = await account.signMessage({ message: { raw: payload } });

    const res = await app.request(url, {
      headers: {
        "X-OrbitMem-Signer": account.address,
        "X-OrbitMem-Family": "evm",
        "X-OrbitMem-Algorithm": "ecdsa-secp256k1",
        "X-OrbitMem-Timestamp": String(timestamp),
        "X-OrbitMem-Nonce": nonce,
        "X-OrbitMem-Signature": signature.slice(2), // remove 0x prefix
      },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.signer).toBe(account.address);
  });

  test("verify: 'evm' rejects forged signature", async () => {
    const app = createTestApp({ verify: "evm" });

    const account = privateKeyToAccount(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    );

    const res = await app.request("/protected/test", {
      headers: {
        "X-OrbitMem-Signer": account.address,
        "X-OrbitMem-Family": "evm",
        "X-OrbitMem-Algorithm": "ecdsa-secp256k1",
        "X-OrbitMem-Timestamp": String(Date.now()),
        "X-OrbitMem-Nonce": crypto.randomUUID(),
        "X-OrbitMem-Signature": "ab".repeat(65), // fake signature
      },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.error).toContain("Invalid signature");
  });
});
