import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { hasOrbitDbNativeSupport } from "../../__tests__/orbitdb-availability.js";

const orbitdbAvailable = hasOrbitDbNativeSupport();

describe.skipIf(!orbitdbAvailable)("Vault Pricing", () => {
  let vault: any;
  let pricing: any;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const { createOrbitDBInstance, createVault } = await import("../index.js");
    const { createVaultPricing } = await import("../pricing.js");
    const { orbitdb, cleanup: c } = await createOrbitDBInstance({
      directory: "./.test-orbitdb-pricing",
    });
    cleanup = c;
    vault = await createVault(orbitdb, {});
    pricing = createVaultPricing(vault.metaDb);
  });

  afterAll(async () => {
    await vault?.close?.();
    await cleanup?.();
  });

  test("getPrice returns null when no price set and no default", async () => {
    const price = await pricing.getPrice("some/path");
    expect(price).toBeNull();
  });

  test("setPrice and getPrice round-trip", async () => {
    await pricing.setPrice("agent/memory", { amount: "0.005", currency: "USDC" });
    const price = await pricing.getPrice("agent/memory");
    expect(price).toEqual({ amount: "0.005", currency: "USDC" });
  });

  test("getPrice falls back to _default", async () => {
    await pricing.setPrice("_default", { amount: "0.001", currency: "USDC" });
    const price = await pricing.getPrice("unpriced/path");
    expect(price).toEqual({ amount: "0.001", currency: "USDC" });
  });

  test("per-path price overrides _default", async () => {
    const price = await pricing.getPrice("agent/memory");
    expect(price).toEqual({ amount: "0.005", currency: "USDC" });
  });

  test("removePrice reverts to _default", async () => {
    await pricing.removePrice("agent/memory");
    const price = await pricing.getPrice("agent/memory");
    expect(price).toEqual({ amount: "0.001", currency: "USDC" });
  });

  test("removePrice with no _default returns null", async () => {
    await pricing.removePrice("_default");
    const price = await pricing.getPrice("agent/memory");
    expect(price).toBeNull();
  });

  test("listPrices returns all priced paths", async () => {
    await pricing.setPrice("a", { amount: "0.01", currency: "USDC" });
    await pricing.setPrice("b", { amount: "0.02", currency: "USDC" });
    const list = await pricing.listPrices();
    expect(list).toEqual(
      expect.arrayContaining([
        { path: "a", amount: "0.01", currency: "USDC" },
        { path: "b", amount: "0.02", currency: "USDC" },
      ]),
    );
  });
});
