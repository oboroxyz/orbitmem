import { describe, expect, test } from "bun:test";
import { Hono } from "hono";

import { type MPPConfig, type MPPEnv, mppPricing } from "../middleware/mpp.js";
import { MockVaultService } from "../services/mock-vault.js";

function createTestApp(vaultService: MockVaultService, config?: Partial<MPPConfig>) {
  const mppConfig: MPPConfig = {
    acceptedMethods: ["tempo"],
    network: "base-sepolia",
    ...config,
  };

  const app = new Hono<MPPEnv>();

  app.get(
    "/vault/public/:address/:key{.+}",
    mppPricing({ vault: vaultService, config: mppConfig }),
    async (c) => {
      return c.json({ value: "test-data", visibility: "public" });
    },
  );

  return app;
}

describe("MPP Pricing Middleware", () => {
  test("free path — no pricing set, returns 200", async () => {
    const vault = new MockVaultService();
    const app = createTestApp(vault);

    const res = await app.request("/vault/public/0xABC/agent/memory");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.value).toBe("test-data");
  });

  test("priced path — no payment credential, returns 402", async () => {
    const vault = new MockVaultService();
    vault.seedPricing("0xABC", "agent/memory", { amount: "0.005", currency: "USDC" });
    const app = createTestApp(vault);

    const res = await app.request("/vault/public/0xABC/agent/memory");
    expect(res.status).toBe(402);
    const body = (await res.json()) as any;
    expect(body.error).toBe("payment_required");
    expect(body.amount).toBe("0.005");
    expect(body.currency).toBe("USDC");
    expect(body.recipient).toBe("0xABC");
    expect(res.headers.get("WWW-Authenticate")).toContain("Payment");
  });

  test("_default pricing applies to unpriced paths", async () => {
    const vault = new MockVaultService();
    vault.seedPricing("0xABC", "_default", { amount: "0.001", currency: "USDC" });
    const app = createTestApp(vault);

    const res = await app.request("/vault/public/0xABC/any/path");
    expect(res.status).toBe(402);
    const body = (await res.json()) as any;
    expect(body.amount).toBe("0.001");
  });

  test("per-path price overrides _default", async () => {
    const vault = new MockVaultService();
    vault.seedPricing("0xABC", "_default", { amount: "0.001", currency: "USDC" });
    vault.seedPricing("0xABC", "premium/data", { amount: "0.05", currency: "USDC" });
    const app = createTestApp(vault);

    const res = await app.request("/vault/public/0xABC/premium/data");
    expect(res.status).toBe(402);
    const body = (await res.json()) as any;
    expect(body.amount).toBe("0.05");
  });

  test("402 response includes accepted methods", async () => {
    const vault = new MockVaultService();
    vault.seedPricing("0xABC", "data", { amount: "0.01", currency: "USDC" });
    const app = createTestApp(vault, { acceptedMethods: ["tempo", "stripe"] });

    const res = await app.request("/vault/public/0xABC/data");
    expect(res.status).toBe(402);
    const body = (await res.json()) as any;
    expect(body.methods).toEqual(["tempo", "stripe"]);
  });
});
