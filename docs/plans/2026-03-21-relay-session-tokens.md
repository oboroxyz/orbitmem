# Relay Session Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add relay-side session tokens so clients authenticate once via ERC-8128 and reuse a bearer token for subsequent requests, eliminating wallet re-signing on page reload.

**Architecture:** The relay issues HMAC-SHA256 signed bearer tokens after a successful ERC-8128 authenticated request to `POST /auth/session`. The erc8128 middleware is extended to accept `Authorization: Bearer <token>` as an alternative to signature headers. Tokens are stateless (no server-side store). The memo app caches the token and vault key signature in `sessionStorage`.

**Tech Stack:** Hono middleware, Web Crypto HMAC-SHA256, bun:test

---

### Task 1: Session token utility module

**Files:**
- Create: `packages/relay/src/middleware/session.ts`
- Test: `packages/relay/src/__tests__/session.test.ts`

- [ ] **Step 1: Write failing tests for token create/verify**

```ts
// packages/relay/src/__tests__/session.test.ts
import { describe, expect, test } from "bun:test";

import { createSessionToken, verifySessionToken } from "../middleware/session.js";

describe("Session Tokens", () => {
  test("creates and verifies a valid token", async () => {
    const token = await createSessionToken("0xABC", 1800);
    expect(token).toBeTruthy();
    const result = await verifySessionToken(token);
    expect(result).not.toBeNull();
    expect(result!.address).toBe("0xABC");
  });

  test("rejects a tampered token", async () => {
    const token = await createSessionToken("0xABC", 1800);
    const tampered = token.slice(0, -4) + "0000";
    const result = await verifySessionToken(tampered);
    expect(result).toBeNull();
  });

  test("rejects an expired token", async () => {
    const token = await createSessionToken("0xABC", -1); // already expired
    const result = await verifySessionToken(token);
    expect(result).toBeNull();
  });

  test("returns expiresAt in token payload", async () => {
    const token = await createSessionToken("0xABC", 60);
    const result = await verifySessionToken(token);
    expect(result!.expiresAt).toBeGreaterThan(Date.now());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/relay/src/__tests__/session.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement session token module**

```ts
// packages/relay/src/middleware/session.ts

// Random secret per process — tokens invalidate on relay restart
const SECRET = crypto.getRandomValues(new Uint8Array(32));

let hmacKey: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
  if (!hmacKey) {
    hmacKey = await crypto.subtle.importKey("raw", SECRET, { name: "HMAC", hash: "SHA-256" }, false, [
      "sign",
      "verify",
    ]);
  }
  return hmacKey;
}

/**
 * Create a stateless HMAC-signed session token.
 * Format: base64url(JSON payload) + "." + base64url(HMAC signature)
 */
export async function createSessionToken(address: string, ttlSeconds: number): Promise<string> {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const payload = JSON.stringify({ address, expiresAt });
  const payloadB64 = btoa(payload);
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${payloadB64}.${sigB64}`;
}

/**
 * Verify a session token. Returns the payload if valid, null otherwise.
 */
export async function verifySessionToken(
  token: string,
): Promise<{ address: string; expiresAt: number } | null> {
  const dot = token.indexOf(".");
  if (dot === -1) return null;

  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);

  try {
    const key = await getKey();
    const sig = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, sig, new TextEncoder().encode(payloadB64));
    if (!valid) return null;

    const payload = JSON.parse(atob(payloadB64));
    if (payload.expiresAt <= Date.now()) return null;

    return { address: payload.address, expiresAt: payload.expiresAt };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test packages/relay/src/__tests__/session.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/relay/src/middleware/session.ts packages/relay/src/__tests__/session.test.ts
git commit -m "feat(relay): add HMAC session token create/verify utility"
```

---

### Task 2: Extend erc8128 middleware to accept bearer tokens

**Files:**
- Modify: `packages/relay/src/middleware/erc8128.ts`
- Modify: `packages/relay/src/__tests__/erc8128.test.ts`

- [ ] **Step 1: Write failing tests for bearer token auth**

Add to `packages/relay/src/__tests__/erc8128.test.ts`:

```ts
import { createSessionToken } from "../middleware/session.js";

// ... inside the existing describe block:

test("accepts valid Bearer session token", async () => {
  const app = createTestApp();
  const token = await createSessionToken("0xSESSION_USER", 1800);
  const res = await app.request("/protected/test", {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as any;
  expect(body.signer).toBe("0xSESSION_USER");
});

test("rejects expired Bearer token", async () => {
  const app = createTestApp();
  const token = await createSessionToken("0xSESSION_USER", -1);
  const res = await app.request("/protected/test", {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status).toBe(401);
});

test("rejects invalid Bearer token", async () => {
  const app = createTestApp();
  const res = await app.request("/protected/test", {
    headers: { Authorization: "Bearer invalid.token" },
  });
  expect(res.status).toBe(401);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/relay/src/__tests__/erc8128.test.ts`
Expected: 3 new tests FAIL

- [ ] **Step 3: Extend erc8128 middleware**

In `packages/relay/src/middleware/erc8128.ts`, add bearer token check at the top of the returned handler, before the existing ERC-8128 header checks:

```ts
import { verifySessionToken } from "./session.js";

// Inside the erc8128() function's returned middleware, at the top:
    // --- Bearer session token path (fastest, no signature check) ---
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const session = await verifySessionToken(token);
      if (session) {
        c.set("signer", session.address);
        c.set("signerFamily", "session");
        c.set("signerAlgorithm", "hmac-sha256");
        await next();
        return;
      }
      // Invalid/expired token — fall through to ERC-8128 check or reject
      if (!hasLegacyHeaders && !hasRfc9421Headers) {
        return c.json({ error: "Invalid or expired session token" }, 401);
      }
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/relay/src/__tests__/erc8128.test.ts`
Expected: All tests PASS (existing + 3 new)

- [ ] **Step 5: Commit**

```bash
git add packages/relay/src/middleware/erc8128.ts packages/relay/src/__tests__/erc8128.test.ts
git commit -m "feat(relay): accept Bearer session tokens in erc8128 middleware"
```

---

### Task 3: Add POST /auth/session route

**Files:**
- Modify: `packages/relay/src/routes/vault.ts`
- Modify: `packages/relay/src/__tests__/vault.test.ts`

- [ ] **Step 1: Write failing test for session endpoint**

Add to `packages/relay/src/__tests__/vault.test.ts`:

```ts
import { verifySessionToken } from "../middleware/session.js";

// Inside the existing describe block:

test("POST /v1/auth/session returns valid token after ERC-8128 auth", async () => {
  const res = await app.request("/v1/auth/session", {
    method: "POST",
    headers: makeERC8128Headers(),
    body: JSON.stringify({}),
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as any;
  expect(body.token).toBeTruthy();
  expect(body.expiresAt).toBeGreaterThan(Date.now());
  expect(body.address).toBe("0xTEST_SIGNER");

  // Token should be valid
  const verified = await verifySessionToken(body.token);
  expect(verified).not.toBeNull();
  expect(verified!.address).toBe("0xTEST_SIGNER");
});

test("POST /v1/auth/session accepts custom ttl", async () => {
  const res = await app.request("/v1/auth/session", {
    method: "POST",
    headers: makeERC8128Headers(),
    body: JSON.stringify({ ttl: 60 }),
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as any;
  // Should expire within ~60s (allow 2s tolerance)
  expect(body.expiresAt).toBeLessThanOrEqual(Date.now() + 62_000);
});

test("POST /v1/auth/session caps ttl at max", async () => {
  const res = await app.request("/v1/auth/session", {
    method: "POST",
    headers: makeERC8128Headers(),
    body: JSON.stringify({ ttl: 999999 }),
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as any;
  // Should be capped at 86400s (24h)
  expect(body.expiresAt).toBeLessThanOrEqual(Date.now() + 86_400_000 + 2000);
});

test("POST /v1/auth/session rejects unauthenticated request", async () => {
  const res = await app.request("/v1/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  expect(res.status).toBe(401);
});

test("Bearer token from /auth/session works on protected routes", async () => {
  // Get session token
  const sessionRes = await app.request("/v1/auth/session", {
    method: "POST",
    headers: makeERC8128Headers(),
    body: JSON.stringify({}),
  });
  const { token } = (await sessionRes.json()) as any;

  // Use token on vault keys route
  const keysRes = await app.request("/v1/vault/keys", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  expect(keysRes.status).toBe(200);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/relay/src/__tests__/vault.test.ts`
Expected: 5 new tests FAIL

- [ ] **Step 3: Add /auth/session route**

In `packages/relay/src/routes/vault.ts`, add the session endpoint:

```ts
import { createSessionToken } from "../middleware/session.js";

const DEFAULT_SESSION_TTL = 1800; // 30 minutes
const MAX_SESSION_TTL = 86400; // 24 hours

// Inside createVaultRoutes(), after the existing /auth/challenge route:

  // Issue session token — requires ERC-8128 auth
  routes.post("/auth/session", erc8128(), async (c) => {
    const body = await c.req.json<{ ttl?: number }>().catch(() => ({}));
    const ttl = Math.min(body.ttl ?? DEFAULT_SESSION_TTL, MAX_SESSION_TTL);
    const address = c.get("signer");
    const token = await createSessionToken(address, ttl);
    const expiresAt = Date.now() + ttl * 1000;
    return c.json({ token, expiresAt, address });
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/relay/src/__tests__/vault.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/relay/src/routes/vault.ts packages/relay/src/__tests__/vault.test.ts
git commit -m "feat(relay): add POST /auth/session endpoint for bearer token issuance"
```

---

### Task 4: Update memo app to use session tokens

**Files:**
- Modify: `examples/memo/src/lib/erc8128.ts`
- Modify: `examples/memo/src/lib/relay.ts`
- Modify: `examples/memo/src/hooks/useOrbitMem.ts`

- [ ] **Step 1: Add session token management to erc8128.ts**

In `examples/memo/src/lib/erc8128.ts`, add session token cache and a `sessionFetch` function:

```ts
const SESSION_CACHE_KEY = "orbitmem:session";

interface CachedSession {
  token: string;
  expiresAt: number;
  address: string;
}

/** Get cached session token if still valid (with 30s buffer). */
function getCachedSession(address: string): CachedSession | null {
  const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
  if (!raw) return null;
  const session: CachedSession = JSON.parse(raw);
  if (session.address !== address) return null;
  if (session.expiresAt <= Date.now() + 30_000) return null; // 30s buffer
  return session;
}

/** Acquire a session token — returns cached or fetches new via ERC-8128. */
export async function acquireSessionToken(): Promise<string> {
  const client = getSignerClient();
  // Parse address from the signer client's signRequest
  // We need the address — get it from wagmi config
  const account = getAccount(config as Config);
  if (!account.address) throw new Error("No wallet connected");

  const cached = getCachedSession(account.address);
  if (cached) return cached.token;

  // Sign one ERC-8128 request to get a session token
  const res = await client.fetch(`${RELAY}/v1/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }, {
    binding: "class-bound",
    replay: "replayable",
    components: ["@authority"],
  });
  if (!res.ok) throw new Error(`Session request failed: ${res.status}`);
  const { token, expiresAt, address } = await res.json();
  sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({ token, expiresAt, address }));
  return token;
}

/** Make an authenticated fetch using a session bearer token. */
export async function sessionFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await acquireSessionToken();
  return fetch(`${RELAY}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

/** Clear session cache (on disconnect). */
export function clearSessionCache() {
  sessionStorage.removeItem(SESSION_CACHE_KEY);
}
```

- [ ] **Step 2: Update relay.ts to use sessionFetch**

In `examples/memo/src/lib/relay.ts`, replace `signedFetch` with `sessionFetch`:

```ts
import { sessionFetch } from "./erc8128";

// Replace all signedFetch calls with sessionFetch (same API)
```

Change the import and all 4 usages: `writeEntry`, `readEntry`, `listKeys`, `deleteEntry`.

- [ ] **Step 3: Update useOrbitMem.ts to cache vault key sig**

In `examples/memo/src/hooks/useOrbitMem.ts`, cache vault key signature in sessionStorage:

```ts
import { clearSessionCache } from "../lib/erc8128";

// In the disconnect branch:
clearSessionCache();

// In the connect branch, replace vault key derivation:
const vaultSigCacheKey = `orbitmem:vault-sig:${address}`;
let sig = sessionStorage.getItem(vaultSigCacheKey);
if (!sig) {
  sig = await signMessageRef.current({ message: "OrbitMem Vault Key v1" });
  sessionStorage.setItem(vaultSigCacheKey, sig);
}

// In the disconnect branch, also clear vault sig cache:
sessionStorage.removeItem(`orbitmem:vault-sig:${address}`);
```

- [ ] **Step 4: Test manually**

Run: `bun run dev:relay` in one terminal, `cd examples/memo && bun run dev` in another.
1. Connect wallet — should see 2 signature prompts (ERC-8128 + vault key)
2. Reload page — should see 0 signature prompts (session token + cached vault sig)
3. Disconnect — reconnect — should see 2 prompts again (caches cleared)

- [ ] **Step 5: Commit**

```bash
git add examples/memo/src/lib/erc8128.ts examples/memo/src/lib/relay.ts examples/memo/src/hooks/useOrbitMem.ts
git commit -m "feat(memo): use relay session tokens to eliminate re-signing on reload"
```

---

### Task 5: Run full test suite and lint

**Files:** None (verification only)

- [ ] **Step 1: Run relay tests**

Run: `bun test packages/relay`
Expected: All tests PASS

- [ ] **Step 2: Run full test suite**

Run: `bun test`
Expected: All tests PASS

- [ ] **Step 3: Run lint and format**

Run: `bun run lint:fix`
Expected: No errors

- [ ] **Step 4: Run typecheck**

Run: `bun run typecheck`
Expected: No errors

- [ ] **Step 5: Final commit if lint/format made changes**

```bash
git add -A && git commit -m "style: format relay session tokens"
```
