import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
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
});
