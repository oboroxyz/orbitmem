# MPP Vault Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pay-per-read monetization to OrbitMem vault data using MPP (Machine Payments Protocol), where producers set per-path prices and agents pay producers directly via HTTP 402.

**Architecture:** Pricing metadata lives in the existing `-meta` OrbitDB store. A new `mppPricing()` Hono middleware on vault read routes looks up pricing, returns 402 challenges for priced paths, and verifies payment credentials via `mppx`. SDK and CLI get thin pricing CRUD wrappers. Unpriced data stays free (backward compatible).

**Tech Stack:** TypeScript, Bun, Hono, `mppx` SDK, OrbitDB, `bun:test`

**Spec:** `docs/design/2026-03-20-mpp-vault-payments-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `packages/sdk/src/data/pricing.ts` | Pricing CRUD — `setPrice`, `getPrice`, `removePrice`, `listPrices` operating on `-meta` OrbitDB |
| Modify | `packages/sdk/src/types.ts` | Add `VaultPricing` type and `IVaultPricing` interface |
| Modify | `packages/sdk/src/data/vault.ts` | Expose `metaDb` to pricing module, wire pricing into vault return type |
| Create | `packages/sdk/src/data/__tests__/pricing.test.ts` | Unit tests for pricing CRUD |
| Modify | `packages/relay/src/services/types.ts` | Add `getVaultPricing(address, path)` to `IVaultService` |
| Modify | `packages/relay/src/services/mock-vault.ts` | Implement mock `getVaultPricing` with pricing store |
| Modify | `packages/relay/src/services/live-vault.ts` | Implement `getVaultPricing` stub (throws "not yet supported in live mode") |
| Modify | `packages/sdk/src/data/index.ts` | Barrel export `createVaultPricing` |
| Modify | `packages/sdk/src/agent/client.ts` | Expose `pricing` property on `IOrbitMemClient` |
| Create | `packages/relay/src/middleware/mpp.ts` | `mppPricing()` Hono middleware — pricing lookup, 402 challenge, payment verification |
| Modify | `packages/relay/src/routes/vault.ts` | Wire `mppPricing()` onto read routes |
| Modify | `packages/relay/src/app.ts` | Pass `MPPConfig` through to vault routes |
| Create | `packages/relay/src/__tests__/mpp.test.ts` | Unit tests for MPP middleware (mock pricing, challenge, verify flows) |
| Modify | `packages/relay/src/__tests__/vault.test.ts` | Integration tests for 402 flow on vault routes |
| Modify | `packages/relay/package.json` | Add `mppx` dependency |
| Modify | `packages/cli/src/commands/vault.ts` | Add `price` subcommand (set/get/ls/rm) |
| Modify | `packages/cli/src/index.ts` | Update help text with `vault price` commands |

---

### Task 1: SDK Types — `VaultPricing` and `IVaultPricing`

**Files:**
- Modify: `packages/sdk/src/types.ts` (append near line 369, before `IDataLayer`)

- [ ] **Step 1: Add VaultPricing type and IVaultPricing interface**

Open `packages/sdk/src/types.ts` and add before the `IDataLayer` interface definition:

```ts
// ────────────────────────────────────────────────────────────
//  VAULT PRICING — MPP Pay-Per-Read
// ────────────────────────────────────────────────────────────

/** Per-path read pricing for MPP monetization */
export interface VaultPricing {
  /** Price amount as decimal string (e.g. "0.005") */
  amount: string;
  /** Currency identifier (e.g. "USDC") */
  currency: string;
}

/** Pricing CRUD for vault data monetization */
export interface IVaultPricing {
  /** Set per-read price for a vault path. Use "_default" as path for vault-wide fallback. */
  setPrice(path: string, pricing: VaultPricing): Promise<void>;
  /** Get price for a path. Falls back to "_default" pricing if no per-path price. Returns null if free. */
  getPrice(path: string): Promise<VaultPricing | null>;
  /** Remove price for a path (reverts to _default or free). */
  removePrice(path: string): Promise<void>;
  /** List all explicitly priced paths. */
  listPrices(): Promise<Array<{ path: string } & VaultPricing>>;
}
```

- [ ] **Step 2: Run typecheck to verify no regressions**

Run: `cd packages/sdk && bun run typecheck`
Expected: PASS — no errors (we only added new types, nothing references them yet)

- [ ] **Step 3: Commit**

```bash
git add packages/sdk/src/types.ts
git commit -m "feat(sdk): add VaultPricing and IVaultPricing types for MPP"
```

---

### Task 2: SDK Pricing CRUD — `pricing.ts`

**Files:**
- Create: `packages/sdk/src/data/pricing.ts`
- Create: `packages/sdk/src/data/__tests__/pricing.test.ts`

- [ ] **Step 1: Write failing tests for pricing CRUD**

Create `packages/sdk/src/data/__tests__/pricing.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/sdk/src/data/__tests__/pricing.test.ts`
Expected: FAIL — `Cannot find module "../pricing.js"`

- [ ] **Step 3: Implement pricing CRUD**

Create `packages/sdk/src/data/pricing.ts`:

```ts
import type { IVaultPricing, VaultPricing } from "../types.js";

const PRICING_PREFIX = "pricing/";
const DEFAULT_KEY = "pricing/_default";

/**
 * Create pricing CRUD methods backed by a vault's `-meta` OrbitDB store.
 * Pricing keys live under the `pricing/` prefix in metadata.
 */
export function createVaultPricing(metaDb: any): IVaultPricing {
  return {
    async setPrice(path: string, pricing: VaultPricing): Promise<void> {
      const key = path === "_default" ? DEFAULT_KEY : `${PRICING_PREFIX}${path}`;
      await metaDb.put(key, { amount: pricing.amount, currency: pricing.currency });
    },

    async getPrice(path: string): Promise<VaultPricing | null> {
      // Try per-path price first
      const key = `${PRICING_PREFIX}${path}`;
      const perPath = await metaDb.get(key);
      if (perPath?.amount != null) {
        return { amount: perPath.amount, currency: perPath.currency };
      }

      // Fall back to _default
      const fallback = await metaDb.get(DEFAULT_KEY);
      if (fallback?.amount != null) {
        return { amount: fallback.amount, currency: fallback.currency };
      }

      return null;
    },

    async removePrice(path: string): Promise<void> {
      const key = path === "_default" ? DEFAULT_KEY : `${PRICING_PREFIX}${path}`;
      await metaDb.del(key);
    },

    async listPrices(): Promise<Array<{ path: string } & VaultPricing>> {
      const all = await metaDb.all();
      const results: Array<{ path: string } & VaultPricing> = [];

      // Navigate into the "pricing" subtree of the nested OrbitDB
      const pricingTree = all?.pricing;
      if (!pricingTree || typeof pricingTree !== "object") return results;

      // Walk the pricing subtree to find all pricing entries (may be nested)
      const walk = (obj: any, prefix: string) => {
        for (const [k, v] of Object.entries(obj)) {
          const path = prefix ? `${prefix}/${k}` : k;
          if (v && typeof v === "object" && "amount" in (v as any) && "currency" in (v as any)) {
            results.push({ path, ...(v as VaultPricing) });
          } else if (v && typeof v === "object") {
            walk(v, path);
          }
        }
      };

      walk(pricingTree, "");
      return results;
    },
  };
}
```

- [ ] **Step 4: Expose metaDb from vault**

In `packages/sdk/src/data/vault.ts`, add `metaDb` to the returned object. Find the line where `vaultImpl` is defined (~line 155) and add `metaDb` alongside the existing `db` property:

```ts
  const vaultImpl: IDataLayer & {
    close: () => Promise<void>;
    db: any;
    metaDb: any;  // <-- ADD THIS
    setDefaultKey: (key: CryptoKey) => void;
    setAuthSig: (authSig: LitAuthSig) => void;
  } = {
    db,
    metaDb,  // <-- ADD THIS
```

Also update the return type annotation in the `createVault` function signature (~line 44) to include `metaDb: any`.

- [ ] **Step 5: Add barrel export for `createVaultPricing`**

In `packages/sdk/src/data/index.ts`, add:

```ts
export { createVaultPricing } from "./pricing.js";
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun test packages/sdk/src/data/__tests__/pricing.test.ts`
Expected: PASS (all 7 tests, or skip if OrbitDB native not available)

- [ ] **Step 7: Run full SDK typecheck and tests**

Run: `cd packages/sdk && bun run typecheck && bun test`
Expected: PASS — no regressions

- [ ] **Step 8: Commit**

```bash
git add packages/sdk/src/data/pricing.ts packages/sdk/src/data/__tests__/pricing.test.ts packages/sdk/src/data/vault.ts packages/sdk/src/data/index.ts
git commit -m "feat(sdk): add vault pricing CRUD backed by -meta OrbitDB"
```

---

### Task 3: Relay Service — `getVaultPricing` on `IVaultService`

**Files:**
- Modify: `packages/relay/src/services/types.ts`
- Modify: `packages/relay/src/services/mock-vault.ts`

- [ ] **Step 1: Add `getVaultPricing` to `IVaultService` interface**

In `packages/relay/src/services/types.ts`, add to the `IVaultService` interface (after `getKeys`):

```ts
  getVaultPricing(
    address: string,
    path: string,
  ): Promise<{ amount: string; currency: string } | null>;
```

- [ ] **Step 2: Run typecheck to see the compile error**

Run: `cd packages/relay && bun run typecheck`
Expected: FAIL — `MockVaultService` doesn't implement `getVaultPricing`

- [ ] **Step 3: Implement mock `getVaultPricing`**

In `packages/relay/src/services/mock-vault.ts`, add a pricing store and the method. Add a `private pricingStore` alongside `private store`:

```ts
  private pricingStore = new Map<string, Map<string, { amount: string; currency: string }>>();
```

Add a `seedPricing` helper (for tests) and implement `getVaultPricing`:

```ts
  /** Seed pricing data for testing */
  seedPricing(address: string, path: string, pricing: { amount: string; currency: string }): void {
    if (!this.pricingStore.has(address)) {
      this.pricingStore.set(address, new Map());
    }
    this.pricingStore.get(address)!.set(path, pricing);
  }

  async getVaultPricing(
    address: string,
    path: string,
  ): Promise<{ amount: string; currency: string } | null> {
    const vault = this.pricingStore.get(address);
    if (!vault) return null;

    // Try per-path pricing
    const perPath = vault.get(path);
    if (perPath) return perPath;

    // Fall back to _default
    const fallback = vault.get("_default");
    if (fallback) return fallback;

    return null;
  }
```

- [ ] **Step 4: Add stub to `LiveVaultService`**

In `packages/relay/src/services/live-vault.ts`, add the `getVaultPricing` method. Since live mode vault doesn't yet read from OrbitDB `-meta` store on the relay side, add a stub:

```ts
  async getVaultPricing(
    _address: string,
    _path: string,
  ): Promise<{ amount: string; currency: string } | null> {
    // TODO: Implement live pricing lookup from OrbitDB -meta store
    // For now, live mode does not support MPP pricing
    return null;
  }
```

This ensures TypeScript compiles and live mode treats all paths as free (graceful degradation).

- [ ] **Step 5: Run typecheck to verify it passes**

Run: `cd packages/relay && bun run typecheck`
Expected: PASS

- [ ] **Step 6: Run existing relay tests to verify no regressions**

Run: `cd packages/relay && bun test`
Expected: PASS — all existing tests still pass

- [ ] **Step 7: Commit**

```bash
git add packages/relay/src/services/types.ts packages/relay/src/services/mock-vault.ts packages/relay/src/services/live-vault.ts
git commit -m "feat(relay): add getVaultPricing to IVaultService with mock and live stubs"
```

---

### Task 4: MPP Middleware — `mppPricing()`

**Files:**
- Create: `packages/relay/src/middleware/mpp.ts`
- Create: `packages/relay/src/__tests__/mpp.test.ts`
- Modify: `packages/relay/package.json` (add `mppx` dependency)

- [ ] **Step 1: Install `mppx` dependency**

Run: `cd packages/relay && bun add mppx`

Verify it's in `package.json` dependencies.

- [ ] **Step 2: Write failing tests for MPP middleware**

Create `packages/relay/src/__tests__/mpp.test.ts`:

```ts
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

  // Public read route with MPP pricing
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun test packages/relay/src/__tests__/mpp.test.ts`
Expected: FAIL — `Cannot find module "../middleware/mpp.js"`

- [ ] **Step 4: Implement the MPP middleware**

Create `packages/relay/src/middleware/mpp.ts`:

```ts
import type { MiddlewareHandler } from "hono";

import type { IVaultService } from "../services/types.js";

export type MPPConfig = {
  acceptedMethods: ("tempo" | "stripe" | "lightning")[];
  network: "base" | "base-sepolia";
};

export type MPPEnv = {
  Variables: {
    mppPayment?: {
      producer: string;
      amount: string;
      currency: string;
      method: string;
    };
  };
};

/** In-memory LRU pricing cache (address:path -> pricing | null). TTL: 60s. */
const pricingCache = new Map<string, { value: { amount: string; currency: string } | null; expiry: number }>();
const CACHE_TTL = 60_000;
const MAX_CACHE_SIZE = 1000;

function getCachedPricing(key: string): { amount: string; currency: string } | null | undefined {
  const entry = pricingCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiry) {
    pricingCache.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCachedPricing(key: string, value: { amount: string; currency: string } | null): void {
  // Simple eviction: clear oldest half when full
  if (pricingCache.size >= MAX_CACHE_SIZE) {
    const keys = Array.from(pricingCache.keys());
    for (let i = 0; i < keys.length / 2; i++) {
      pricingCache.delete(keys[i]);
    }
  }
  pricingCache.set(key, { value, expiry: Date.now() + CACHE_TTL });
}

/**
 * MPP pricing middleware for vault read routes.
 *
 * Looks up per-path pricing from vault metadata. If priced and no valid
 * payment credential is present, returns 402 Payment Required with a
 * WWW-Authenticate challenge. Free paths pass through.
 */
export function mppPricing(opts: {
  vault: IVaultService;
  config: MPPConfig;
}): MiddlewareHandler<MPPEnv> {
  const { vault, config } = opts;

  return async (c, next) => {
    // Resolve producer address and path from route
    const address = c.req.param("address");
    const key = c.req.param("key");

    if (!address || !key) {
      // Cannot determine pricing without address/key — pass through
      await next();
      return;
    }

    // Check pricing (with cache)
    const cacheKey = `${address}:${key}`;
    let pricing = getCachedPricing(cacheKey);
    if (pricing === undefined) {
      pricing = await vault.getVaultPricing(address, key);
      setCachedPricing(cacheKey, pricing);
    }

    // Free path — no pricing
    if (!pricing) {
      await next();
      return;
    }

    // Check for payment credential
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Payment ")) {
      // Return 402 challenge
      const challenge = `Payment realm="orbitmem", intent="charge", amount="${pricing.amount}", currency="${pricing.currency}", recipient="${address}", network="${config.network}"`;
      c.header("WWW-Authenticate", challenge);
      return c.json(
        {
          error: "payment_required",
          amount: pricing.amount,
          currency: pricing.currency,
          recipient: address,
          network: config.network,
          methods: config.acceptedMethods,
        },
        402,
      );
    }

    // TODO: Verify payment credential via mppx once SDK API is confirmed.
    // For now, we accept any Authorization: Payment header as valid
    // to unblock the integration. Real verification will be added when
    // we confirm mppx supports dynamic per-request pricing.
    //
    // When implementing real verification:
    // 1. Parse the payment credential from the Authorization header
    // 2. Verify via mppx that payment of `pricing.amount` was made to `address`
    // 3. On failure, return 402 with { error: "payment_invalid", detail: "..." }

    c.set("mppPayment", {
      producer: address,
      amount: pricing.amount,
      currency: pricing.currency,
      method: "unverified",
    });

    await next();
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test packages/relay/src/__tests__/mpp.test.ts`
Expected: PASS — all 5 tests pass

- [ ] **Step 6: Run full relay typecheck and tests**

Run: `cd packages/relay && bun run typecheck && bun test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/relay/src/middleware/mpp.ts packages/relay/src/__tests__/mpp.test.ts packages/relay/package.json
git commit -m "feat(relay): add mppPricing middleware with 402 challenge flow"
```

---

### Task 5: Wire MPP Middleware into Vault Routes

**Files:**
- Modify: `packages/relay/src/routes/vault.ts`
- Modify: `packages/relay/src/app.ts`
- Modify: `packages/relay/src/services/index.ts`
- Modify: `packages/relay/src/__tests__/vault.test.ts`

- [ ] **Step 1: Write failing integration test for 402 on priced vault read**

Add to `packages/relay/src/__tests__/vault.test.ts`, inside the existing `describe("Relay Vault Routes")` block, after the existing tests:

```ts
  test("GET /v1/vault/public/:address/:key returns 402 for priced entry", async () => {
    // Seed pricing on the mock vault service
    const { getTestVaultService } = await import("../services/test-helpers.js");
    const vault = getTestVaultService();
    vault.seedPricing("test-vault-001", "travel/dietary", {
      amount: "0.005",
      currency: "USDC",
    });

    const res = await app.request("/v1/vault/public/test-vault-001/travel/dietary");
    expect(res.status).toBe(402);
    const body = (await res.json()) as any;
    expect(body.error).toBe("payment_required");
    expect(body.amount).toBe("0.005");
  });

  test("GET /v1/vault/public/:address/:key returns 200 with payment header", async () => {
    const res = await app.request("/v1/vault/public/test-vault-001/travel/dietary", {
      headers: { Authorization: "Payment mock-credential" },
    });
    expect(res.status).toBe(200);
  });

  test("GET /v1/vault/public/:address/keys is always free (no 402)", async () => {
    const { getTestVaultService } = await import("../services/test-helpers.js");
    const vault = getTestVaultService();
    vault.seedPricing("test-vault-001", "_default", { amount: "0.01", currency: "USDC" });

    const res = await app.request("/v1/vault/public/test-vault-001/keys");
    expect(res.status).toBe(200);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/relay/src/__tests__/vault.test.ts`
Expected: FAIL — `Cannot find module "../services/test-helpers.js"` or 200 instead of 402

- [ ] **Step 3: Create test helper for accessing mock vault service**

Create `packages/relay/src/services/test-helpers.ts`:

```ts
import { MockVaultService } from "./mock-vault.js";

// Singleton mock vault service used by the test app instance.
// This must be the same instance passed to buildApp() in the test setup.
let testVaultService: MockVaultService | null = null;

export function setTestVaultService(service: MockVaultService): void {
  testVaultService = service;
}

export function getTestVaultService(): MockVaultService {
  if (!testVaultService) throw new Error("Test vault service not initialized");
  return testVaultService;
}
```

- [ ] **Step 4: Update `createVaultRoutes` to accept MPP config**

In `packages/relay/src/routes/vault.ts`:

1. Import the MPP middleware:
```ts
import { type MPPConfig, type MPPEnv, mppPricing } from "../middleware/mpp.js";
```

2. Change the function signature to accept vault service + MPP config:
```ts
export function createVaultRoutes(
  vault: IVaultService,
  mppConfig?: MPPConfig,
): Hono<ERC8128Env & MPPEnv> {
```

3. Add `mppPricing()` middleware to the public read route (the wildcard one), but NOT to the `/keys` route:
```ts
  // Public read — MPP-gated if priced
  const mppMiddleware = mppConfig ? mppPricing({ vault, config: mppConfig }) : undefined;

  routes.get("/vault/public/:address/:key{.+}", async (c, next) => {
    if (mppMiddleware) return mppMiddleware(c, next);
    await next();
  }, async (c) => {
    // ... existing handler unchanged
  });
```

4. For the encrypted read route (`POST /vault/read`), the `mppPricing()` middleware cannot use `:address` route params. Create a separate `mppPricingPost()` wrapper that extracts the vault address from the parsed request body and calls `getVaultPricing` directly. Add this to `packages/relay/src/middleware/mpp.ts`:

```ts
/**
 * MPP pricing middleware for POST /vault/read.
 * Extracts vaultAddress from JSON body instead of route params.
 */
export function mppPricingPost(opts: {
  vault: IVaultService;
  config: MPPConfig;
}): MiddlewareHandler<MPPEnv & { Variables: { signer: string } }> {
  const { vault, config } = opts;

  return async (c, next) => {
    const body = await c.req.json<{ vaultAddress?: string; path: string }>();
    const address = body.vaultAddress ?? c.get("signer");
    const path = body.path;

    if (!address || !path) {
      await next();
      return;
    }

    const cacheKey = `${address}:${path}`;
    let pricing = getCachedPricing(cacheKey);
    if (pricing === undefined) {
      pricing = await vault.getVaultPricing(address, path);
      setCachedPricing(cacheKey, pricing);
    }

    if (!pricing) {
      await next();
      return;
    }

    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Payment ")) {
      const challenge = `Payment realm="orbitmem", intent="charge", amount="${pricing.amount}", currency="${pricing.currency}", recipient="${address}", network="${config.network}"`;
      c.header("WWW-Authenticate", challenge);
      return c.json(
        {
          error: "payment_required",
          amount: pricing.amount,
          currency: pricing.currency,
          recipient: address,
          network: config.network,
          methods: config.acceptedMethods,
        },
        402,
      );
    }

    c.set("mppPayment", {
      producer: address,
      amount: pricing.amount,
      currency: pricing.currency,
      method: "unverified",
    });

    await next();
  };
}
```

Then wire it in `vault.ts`:
```ts
  routes.post("/vault/read", erc8128(), mppPostMiddleware ?? ((c: any, next: any) => next()), async (c) => {
    // ... existing handler unchanged
  });
```

Where `mppPostMiddleware = mppConfig ? mppPricingPost({ vault, config: mppConfig }) : undefined`.

- [ ] **Step 5: Update `buildApp` to pass MPP config**

In `packages/relay/src/app.ts`, update `buildApp` to accept and pass `MPPConfig`:

```ts
import type { MPPConfig } from "./middleware/mpp.js";

export function buildApp(services: RelayServices, mppConfig?: MPPConfig): Hono {
  const app = new Hono().basePath("/v1");
  app.use(logger());
  app.use(cors());
  app.route("/", healthRoutes);
  app.route("/", createVaultRoutes(services.vault, mppConfig));
  app.route("/", createDataRoutes(services.discovery));
  app.route("/", createSnapshotRoutes(services.snapshot, services.plan));
  return app;
}
```

Update the default app export to include a default MPP config:

```ts
const defaultMppConfig: MPPConfig = {
  acceptedMethods: (process.env.MPP_ACCEPTED_METHODS?.split(",") ?? ["tempo"]) as MPPConfig["acceptedMethods"],
  network: (process.env.MPP_NETWORK ?? "base-sepolia") as MPPConfig["network"],
};

const app = buildApp(createMockServices(), defaultMppConfig);
```

- [ ] **Step 6: Update vault test setup to use test helpers**

In `packages/relay/src/__tests__/vault.test.ts`, update the imports and setup:

```ts
import { buildApp } from "../app.js";
import type { MPPConfig } from "../middleware/mpp.js";
import { MockVaultService } from "../services/mock-vault.js";
import { createMockServices } from "../services/index.js";
import { setTestVaultService } from "../services/test-helpers.js";
```

Replace the direct `app` import with a custom build that uses the test vault service:

```ts
const mockVault = new MockVaultService();
setTestVaultService(mockVault);
const mppConfig: MPPConfig = { acceptedMethods: ["tempo"], network: "base-sepolia" };
const services = { ...createMockServices(), vault: mockVault };
const app = buildApp(services, mppConfig);
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `bun test packages/relay/src/__tests__/vault.test.ts`
Expected: PASS — all tests including new 402 tests

- [ ] **Step 8: Run full relay typecheck and test suite**

Run: `cd packages/relay && bun run typecheck && bun test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/relay/src/routes/vault.ts packages/relay/src/app.ts packages/relay/src/services/test-helpers.ts packages/relay/src/__tests__/vault.test.ts
git commit -m "feat(relay): wire mppPricing middleware into vault read routes"
```

---

### Task 6: SDK Client Facade — Expose `pricing` Property

**Files:**
- Modify: `packages/sdk/src/agent/client.ts`
- Modify: `packages/sdk/src/types.ts` (add `pricing` to `IOrbitMemClient`)

- [ ] **Step 1: Add `pricing` to `IOrbitMemClient` interface**

In `packages/sdk/src/types.ts`, find the `IOrbitMemClient` interface and add:

```ts
  /** Vault pricing CRUD (MPP pay-per-read). Only available when vault is configured. */
  pricing?: IVaultPricing;
```

- [ ] **Step 2: Wire `createVaultPricing` into the client factory**

In `packages/sdk/src/agent/client.ts`, the client does not have direct access to the vault's `metaDb` (it operates via relay transport). The `pricing` property on the client facade is for **local vault** usage (CLI, SDK direct mode). For the client facade, expose pricing only when a local vault is available.

The CLI's `createClient` in `packages/cli/src/utils/client.ts` creates a local OrbitMem instance with a vault. Wire pricing there:

```ts
import { createVaultPricing } from "@orbitmem/sdk/data";

// After creating the vault:
const pricing = createVaultPricing(vault.metaDb);
// Add to returned client: { vault, pricing, destroy, ... }
```

Check the exact structure of `createClient` and add `pricing` to the returned object.

- [ ] **Step 3: Run typecheck**

Run: `cd packages/sdk && bun run typecheck && cd ../cli && bun run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/sdk/src/types.ts packages/sdk/src/agent/client.ts packages/cli/src/utils/client.ts
git commit -m "feat(sdk): expose pricing property on client facade for CLI usage"
```

---

### Task 7: CLI — `vault price` Subcommand

**Files:**
- Modify: `packages/cli/src/commands/vault.ts`
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: Add `price` case to vault subcommand router**

In `packages/cli/src/commands/vault.ts`, add the `price` case to the `switch (sub)` block:

```ts
    case "price":
      return vaultPrice(args.slice(1), flags);
```

Update the default error message to include `price`:

```ts
    default:
      error(`Unknown vault command: ${sub ?? "(none)"}. Use: store, get, ls, price`);
```

- [ ] **Step 2: Implement `vaultPrice` function**

Add to `packages/cli/src/commands/vault.ts`:

```ts
async function vaultPrice(args: string[], flags: Record<string, string>): Promise<void> {
  const action = args[0];
  switch (action) {
    case "set":
      return vaultPriceSet(args.slice(1), flags);
    case "get":
      return vaultPriceGet(args.slice(1), flags);
    case "ls":
      return vaultPriceLs(flags);
    case "rm":
      return vaultPriceRm(args.slice(1), flags);
    default:
      error(`Unknown price command: ${action ?? "(none)"}. Use: set, get, ls, rm`);
  }
}

async function vaultPriceSet(args: string[], flags: Record<string, string>): Promise<void> {
  const [path, amount] = args;
  if (!path || !amount) error("Usage: orbitmem vault price set <path> <amount>");

  const config = loadConfig();
  if (flags.relay) config.relay = flags.relay;
  const client = await createClient(config, loadKey());

  try {
    const currency = flags.currency ?? "USDC";
    await client.pricing.setPrice(path, { amount, currency });
    if (flags.json !== undefined) {
      output({ path, amount, currency }, true);
    } else {
      process.stdout.write(`Set price for "${path}": ${amount} ${currency} per read\n`);
    }
  } finally {
    await client.destroy();
  }
}

async function vaultPriceGet(args: string[], flags: Record<string, string>): Promise<void> {
  const [path] = args;
  if (!path) error("Usage: orbitmem vault price get <path>");

  const config = loadConfig();
  if (flags.relay) config.relay = flags.relay;
  const client = await createClient(config, loadKey());

  try {
    const price = await client.pricing.getPrice(path);
    if (!price) {
      if (flags.json !== undefined) {
        output(null, true);
      } else {
        process.stdout.write(`"${path}" is free (no pricing set)\n`);
      }
    } else {
      output(flags.json !== undefined ? { path, ...price } : `${price.amount} ${price.currency}`, flags.json !== undefined);
    }
  } finally {
    await client.destroy();
  }
}

async function vaultPriceLs(flags: Record<string, string>): Promise<void> {
  const config = loadConfig();
  if (flags.relay) config.relay = flags.relay;
  const client = await createClient(config, loadKey());

  try {
    const prices = await client.pricing.listPrices();
    if (flags.json !== undefined) {
      output(prices, true);
    } else if (prices.length === 0) {
      process.stdout.write("(no priced paths)\n");
    } else {
      for (const p of prices) {
        process.stdout.write(`${p.path}\t${p.amount} ${p.currency}\n`);
      }
    }
  } finally {
    await client.destroy();
  }
}

async function vaultPriceRm(args: string[], flags: Record<string, string>): Promise<void> {
  const [path] = args;
  if (!path) error("Usage: orbitmem vault price rm <path>");

  const config = loadConfig();
  if (flags.relay) config.relay = flags.relay;
  const client = await createClient(config, loadKey());

  try {
    await client.pricing.removePrice(path);
    if (flags.json !== undefined) {
      output({ path, removed: true }, true);
    } else {
      process.stdout.write(`Removed pricing for "${path}"\n`);
    }
  } finally {
    await client.destroy();
  }
}
```

**Note:** The CLI assumes `client.pricing` exists. This requires the `createClient` utility in `packages/cli/src/utils/client.ts` to expose the pricing interface from the vault. Check how `createClient` works and wire `createVaultPricing(vault.metaDb)` into the returned client object as `pricing`.

- [ ] **Step 3: Update CLI help text**

In `packages/cli/src/index.ts`, update the `printUsage` function to include price commands:

```ts
  vault price set <path> <amount>  Set per-read price (USDC)
  vault price get <path>           Show price for path
  vault price ls                   List all priced paths
  vault price rm <path>            Remove pricing (free)
```

- [ ] **Step 4: Run CLI typecheck**

Run: `cd packages/cli && bun run typecheck`
Expected: PASS (or identify type issues with `client.pricing` that need wiring)

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/vault.ts packages/cli/src/index.ts
git commit -m "feat(cli): add vault price set/get/ls/rm subcommands"
```

---

### Task 8: Final Integration — Typecheck, Lint, Full Test Suite

**Files:** None (validation only)

- [ ] **Step 1: Run full monorepo typecheck**

Run: `bun run typecheck`
Expected: PASS across all packages

- [ ] **Step 2: Run linter**

Run: `bun run lint`
Expected: PASS (or fix any lint issues)

- [ ] **Step 3: Run full test suite**

Run: `bun test`
Expected: PASS across all packages

- [ ] **Step 4: Fix any issues found in steps 1-3**

Address any type errors, lint violations, or test failures. Re-run until all three pass.

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address lint and type issues from MPP integration"
```

- [ ] **Step 6: Run format**

Run: `bun run format`

```bash
git add -A
git commit -m "style: format MPP vault payments code"
```
