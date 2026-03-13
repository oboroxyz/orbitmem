# Memo App Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `examples/memo/` — a decentralized memo app with Porto Passkey + EVM wallet auth, per-memo public/private visibility, client-side AES encryption, markdown rendering, and shareable public memo URLs. Requires relay endpoint additions and SDK export update.

**Architecture:** React + Vite + wagmi frontend talks to `@orbitmem/relay` via ERC-8128 signed HTTP. Encryption happens client-side via SDK's `AESEngine`. Relay stores data in OrbitDB (mock service for dev/test, OrbitDB peer for production). Three new relay endpoints: write, delete, keys.

**Tech Stack:** React 19, Vite 6, Tailwind CSS 4 + @tailwindcss/typography, wagmi 2, porto, viem 2, @orbitmem/sdk (AESEngine), nanoid, react-markdown, remark-gfm

**Spec:** `docs/plans/2026-03-13-memo-app-design.md`

---

## Chunk 1: Relay Backend (SDK export + relay endpoints + tests)

### Task 1: Export AESEngine from SDK

**Files:**
- Modify: `packages/sdk/src/index.ts`

- [ ] **Step 1: Add AESEngine export**

Add after the `createEncryptionLayer` export in `packages/sdk/src/index.ts`:

```typescript
export { AESEngine } from "./encryption/index.js";
```

- [ ] **Step 2: Verify typecheck passes**

Run: `bun run typecheck`
Expected: PASS (no new errors)

- [ ] **Step 3: Commit**

```bash
git add packages/sdk/src/index.ts
git commit -m "feat(sdk): export AESEngine from main entry"
```

---

### Task 2: Add write/delete/getKeys to IVaultService interface

**Files:**
- Modify: `packages/relay/src/services/types.ts`

- [ ] **Step 1: Add three new methods to IVaultService**

In `packages/relay/src/services/types.ts`, add to the `IVaultService` interface:

```typescript
export interface IVaultService {
  getPublicKeys(address: string, prefix?: string): Promise<string[]>;
  getPublic(address: string, key: string): Promise<VaultEntry | null>;
  getEncrypted(vaultAddress: string, path: string): Promise<VaultEntry | null>;
  seed(
    address: string,
    entries: { key: string; value: unknown; visibility: string }[],
  ): Promise<number>;
  sync(address: string): Promise<{ status: string; timestamp: number }>;
  // New methods for memo app:
  write(address: string, path: string, value: unknown, visibility: string): Promise<{ hash: string }>;
  delete(address: string, path: string): Promise<void>;
  getKeys(address: string, prefix?: string): Promise<string[]>;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/relay/src/services/types.ts
git commit -m "feat(relay): add write/delete/getKeys to IVaultService interface"
```

---

### Task 3: Implement write/delete/getKeys in MockVaultService

**Files:**
- Modify: `packages/relay/src/services/mock-vault.ts`
- Test: `packages/relay/src/__tests__/vault.test.ts`

- [ ] **Step 1: Write failing tests for the three new operations**

Add to `packages/relay/src/__tests__/vault.test.ts`:

```typescript
describe("Vault Write/Delete/Keys", () => {
  test("POST /v1/vault/write stores entry", async () => {
    const res = await app.request("/v1/vault/write", {
      method: "POST",
      headers: makeERC8128Headers({ "X-OrbitMem-Signer": "0xWRITER" }),
      body: JSON.stringify({
        path: "memos/abc/title",
        value: "My First Memo",
        visibility: "public",
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.ok).toBe(true);
    expect(body.hash).toBeTruthy();

    // Verify it's readable via public endpoint
    const read = await app.request("/v1/vault/public/0xWRITER/memos/abc/title");
    expect(read.status).toBe(200);
    const readBody = (await read.json()) as any;
    expect(readBody.value).toBe("My First Memo");
  });

  test("POST /v1/vault/write requires auth", async () => {
    const res = await app.request("/v1/vault/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "x", value: "y", visibility: "public" }),
    });
    expect(res.status).toBe(401);
  });

  test("POST /v1/vault/keys returns all keys for signer", async () => {
    // Seed some data first
    await app.request("/v1/vault/write", {
      method: "POST",
      headers: makeERC8128Headers({ "X-OrbitMem-Signer": "0xKEYS_USER" }),
      body: JSON.stringify({ path: "memos/a/title", value: "A", visibility: "public" }),
    });
    await app.request("/v1/vault/write", {
      method: "POST",
      headers: makeERC8128Headers({ "X-OrbitMem-Signer": "0xKEYS_USER" }),
      body: JSON.stringify({ path: "memos/a/body", value: "Body A", visibility: "private" }),
    });
    await app.request("/v1/vault/write", {
      method: "POST",
      headers: makeERC8128Headers({ "X-OrbitMem-Signer": "0xKEYS_USER" }),
      body: JSON.stringify({ path: "other/x", value: "X", visibility: "public" }),
    });

    const res = await app.request("/v1/vault/keys", {
      method: "POST",
      headers: makeERC8128Headers({ "X-OrbitMem-Signer": "0xKEYS_USER" }),
      body: JSON.stringify({ prefix: "memos/" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.keys).toContain("memos/a/title");
    expect(body.keys).toContain("memos/a/body");
    expect(body.keys).not.toContain("other/x");
  });

  test("POST /v1/vault/keys without prefix returns all keys", async () => {
    const res = await app.request("/v1/vault/keys", {
      method: "POST",
      headers: makeERC8128Headers({ "X-OrbitMem-Signer": "0xKEYS_USER" }),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.keys).toContain("memos/a/title");
    expect(body.keys).toContain("other/x");
  });

  test("POST /v1/vault/delete removes entry", async () => {
    // Write then delete
    await app.request("/v1/vault/write", {
      method: "POST",
      headers: makeERC8128Headers({ "X-OrbitMem-Signer": "0xDELETER" }),
      body: JSON.stringify({ path: "temp/data", value: "gone", visibility: "public" }),
    });
    const del = await app.request("/v1/vault/delete", {
      method: "POST",
      headers: makeERC8128Headers({ "X-OrbitMem-Signer": "0xDELETER" }),
      body: JSON.stringify({ path: "temp/data" }),
    });
    expect(del.status).toBe(200);
    const delBody = (await del.json()) as any;
    expect(delBody.ok).toBe(true);

    // Verify it's gone
    const read = await app.request("/v1/vault/public/0xDELETER/temp/data");
    expect(read.status).toBe(404);
  });

  test("POST /v1/vault/read falls back to signer when vaultAddress omitted", async () => {
    // Write via 0xREADER
    await app.request("/v1/vault/write", {
      method: "POST",
      headers: makeERC8128Headers({ "X-OrbitMem-Signer": "0xREADER" }),
      body: JSON.stringify({ path: "notes/x", value: "CIPHER", visibility: "private" }),
    });

    // Read without vaultAddress — should use signer
    const res = await app.request("/v1/vault/read", {
      method: "POST",
      headers: makeERC8128Headers({ "X-OrbitMem-Signer": "0xREADER" }),
      body: JSON.stringify({ path: "notes/x" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.value).toBe("CIPHER");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/relay/src/__tests__/vault.test.ts`
Expected: FAIL (routes don't exist yet)

- [ ] **Step 3: Implement write/delete/getKeys in MockVaultService**

In `packages/relay/src/services/mock-vault.ts`, add three methods:

```typescript
async write(
  address: string,
  path: string,
  value: unknown,
  visibility: string,
): Promise<{ hash: string }> {
  const vault = this.getOrCreate(address);
  vault.set(path, { value, visibility });
  return { hash: `mock-hash-${Date.now()}` };
}

async delete(address: string, path: string): Promise<void> {
  const vault = this.store.get(address);
  if (vault) {
    vault.delete(path);
  }
}

async getKeys(address: string, prefix?: string): Promise<string[]> {
  const vault = this.store.get(address);
  if (!vault) return [];
  let keys = Array.from(vault.keys());
  if (prefix) {
    keys = keys.filter((k) => k.startsWith(prefix));
  }
  return keys;
}
```

- [ ] **Step 4: Add routes for write/delete/keys in vault.ts**

In `packages/relay/src/routes/vault.ts`, add three new routes before the `return routes;`:

```typescript
// Write vault entry — requires ERC-8128
routes.post("/vault/write", erc8128(), async (c) => {
  const body = await c.req.json<{ path: string; value: unknown; visibility: string }>();
  const signer = c.get("signer");
  const result = await vault.write(signer, body.path, body.value, body.visibility);
  return c.json({ ok: true, hash: result.hash });
});

// Delete vault entry — requires ERC-8128
routes.post("/vault/delete", erc8128(), async (c) => {
  const body = await c.req.json<{ path: string }>();
  const signer = c.get("signer");
  await vault.delete(signer, body.path);
  return c.json({ ok: true });
});

// List vault keys — requires ERC-8128
routes.post("/vault/keys", erc8128(), async (c) => {
  const body = await c.req.json<{ prefix?: string }>();
  const signer = c.get("signer");
  const keys = await vault.getKeys(signer, body.prefix);
  return c.json({ keys });
});
```

- [ ] **Step 5: Update existing read route to make vaultAddress optional**

In `packages/relay/src/routes/vault.ts`, modify the existing `/vault/read` handler:

```typescript
routes.post("/vault/read", erc8128(), async (c) => {
  const body = await c.req.json<{ vaultAddress?: string; path: string }>();
  const address = body.vaultAddress ?? c.get("signer");
  const entry = await vault.getEncrypted(address, body.path);

  if (!entry) {
    return c.json({ error: "Entry not found" }, 404);
  }

  return c.json({
    key: body.path,
    value: entry.value,
    visibility: entry.visibility,
    signer: c.get("signer"),
  });
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun test packages/relay/src/__tests__/vault.test.ts`
Expected: ALL PASS

- [ ] **Step 7: Run full test suite + typecheck**

Run: `bun test && bun run typecheck`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add packages/relay/src/services/mock-vault.ts packages/relay/src/routes/vault.ts packages/relay/src/__tests__/vault.test.ts
git commit -m "feat(relay): add vault write/delete/keys endpoints with tests"
```

---

### Task 3b: Add write/delete/getKeys stubs to LiveVaultService

**Files:**
- Modify: `packages/relay/src/services/live-vault.ts`

`LiveVaultService` also implements `IVaultService` and will fail typecheck without the new methods.

- [ ] **Step 1: Add three stub methods to LiveVaultService**

In `packages/relay/src/services/live-vault.ts`, add:

```typescript
async write(address: string, path: string, value: unknown, _visibility: string): Promise<{ hash: string }> {
  const db = await this.getDB(address);
  const hash = await db.put(path, value);
  return { hash: hash ?? `live-${Date.now()}` };
}

async delete(address: string, path: string): Promise<void> {
  const db = await this.getDB(address);
  await db.del(path);
}

async getKeys(address: string, prefix?: string): Promise<string[]> {
  const db = await this.getDB(address);
  const all: Record<string, unknown> = await db.all();
  let keys = Object.keys(all);
  if (prefix) {
    keys = keys.filter((k) => k.startsWith(prefix));
  }
  return keys;
}
```

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/relay/src/services/live-vault.ts
git commit -m "feat(relay): add write/delete/getKeys to LiveVaultService"
```

---

## Chunk 2: Memo App Scaffold (project setup, build, wagmi config)

### Task 4: Create examples/memo package scaffold

**Files:**
- Create: `examples/memo/package.json`
- Create: `examples/memo/tsconfig.json`
- Create: `examples/memo/vite.config.ts`
- Create: `examples/memo/index.html`
- Create: `examples/memo/.env.example`
- Create: `examples/memo/src/main.tsx`
- Create: `examples/memo/src/styles/index.css`

- [ ] **Step 1: Create `examples/memo/package.json`**

```json
{
  "name": "@orbitmem/memo-example",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@orbitmem/sdk": "workspace:*",
    "nanoid": "^5.0.0",
    "porto": "^0.5.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0",
    "@tailwindcss/typography": "^0.5.0",
    "viem": "^2.0.0",
    "wagmi": "^2.14.0",
    "@wagmi/core": "^2.16.0",
    "@wagmi/connectors": "^5.7.0",
    "@tanstack/react-query": "^5.62.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^4.1.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create `examples/memo/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "types": ["vite/client"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `examples/memo/vite.config.ts`**

```typescript
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
  },
});
```

- [ ] **Step 4: Create `examples/memo/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OrbitMem Memo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `examples/memo/.env.example`**

```
VITE_RELAY_URL=http://localhost:3000
VITE_WALLETCONNECT_PROJECT_ID=orbitmem-memo-demo
```

- [ ] **Step 6: Create `examples/memo/src/styles/index.css`**

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

- [ ] **Step 7: Create `examples/memo/src/main.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { App } from "./App";
import { config } from "./lib/wagmi";
import "./styles/index.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
```

- [ ] **Step 8: Install deps and verify build**

Run: `cd examples/memo && bun install && cd ../..`
Expected: Installs successfully

- [ ] **Step 9: Commit**

```bash
git add examples/memo/
git commit -m "feat(memo): scaffold examples/memo with React, Vite, Tailwind, wagmi"
```

---

### Task 5: wagmi config + ConnectButton

**Files:**
- Create: `examples/memo/src/lib/wagmi.ts`
- Create: `examples/memo/src/components/ConnectButton.tsx`
- Create: `examples/memo/src/App.tsx`

- [ ] **Step 1: Create wagmi config with Porto connector**

Create `examples/memo/src/lib/wagmi.ts`:

```typescript
import { http, createConfig, createStorage } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";
import { porto } from "porto/wagmi";
// If this import fails, try: import { porto } from "wagmi/connectors"
// The correct path depends on the installed porto package version.
// After `bun install`, check: `ls node_modules/porto/dist/` for available exports.

export const config = createConfig({
  chains: [baseSepolia],
  connectors: [
    porto(),
    injected(),
    walletConnect({
      projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "orbitmem-memo-demo",
    }),
  ],
  storage: createStorage({ storage: localStorage }),
  transports: {
    [baseSepolia.id]: http(),
  },
});
```

- [ ] **Step 2: Create ConnectButton component**

Create `examples/memo/src/components/ConnectButton.tsx`:

```tsx
import { useAccount, useConnect, useDisconnect } from "wagmi";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm font-mono text-gray-600">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="px-3 py-1 text-sm rounded-md bg-gray-200 hover:bg-gray-300 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          onClick={() => connect({ connector })}
          className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          {connector.name}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create App shell**

Create `examples/memo/src/App.tsx`:

```tsx
import { useAccount } from "wagmi";
import { ConnectButton } from "./components/ConnectButton";

export function App() {
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">OrbitMem Memo</h1>
        <ConnectButton />
      </header>
      <main className="max-w-3xl mx-auto px-6 py-8">
        {isConnected ? (
          <p className="text-gray-500">Memo list will go here.</p>
        ) : (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold mb-4">Decentralized Memos</h2>
            <p className="text-gray-600 mb-8">
              Encrypted, peer-to-peer notes. Your data, your vault, your rules.
            </p>
            <ConnectButton />
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Verify dev server starts**

Run: `cd examples/memo && bun run dev`
Expected: Vite dev server on http://localhost:5174, page renders with "OrbitMem Memo" header and connect buttons

- [ ] **Step 5: Commit**

```bash
git add examples/memo/src/
git commit -m "feat(memo): add wagmi config with Porto + ConnectButton + App shell"
```

---

## Chunk 3: Lib Layer (encryption, ERC-8128, relay client)

### Task 6: Encryption helpers

**Files:**
- Create: `examples/memo/src/lib/encryption.ts`

- [ ] **Step 1: Create encryption.ts**

```typescript
import { AESEngine } from "@orbitmem/sdk";
import type { AESEncryptedData } from "@orbitmem/sdk";

const aes = new AESEngine({ kdf: "hkdf-sha256" });

/**
 * Derive a deterministic AES-256 vault key from a wallet signature.
 * SHA-256 of the signature → raw import as AES-GCM key.
 */
export async function deriveVaultKey(signature: Uint8Array): Promise<CryptoKey> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", signature));
  return aes.deriveKey({ type: "raw", key: hash });
}

/** Encrypt a value for private vault storage. Returns serialized JSON string. */
export async function encryptValue(value: unknown, key: CryptoKey): Promise<string> {
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await aes.encrypt(plaintext, key);
  // Serialize Uint8Arrays to base64 for JSON transport
  return JSON.stringify({
    engine: encrypted.engine,
    ciphertext: uint8ToBase64(encrypted.ciphertext),
    iv: uint8ToBase64(encrypted.iv),
    authTag: uint8ToBase64(encrypted.authTag),
    keyDerivation: encrypted.keyDerivation
      ? {
          ...encrypted.keyDerivation,
          salt: uint8ToBase64(encrypted.keyDerivation.salt),
        }
      : undefined,
  });
}

/** Decrypt a stored value. Input is the serialized JSON string from encryptValue. */
export async function decryptValue<T>(blob: string, key: CryptoKey): Promise<T> {
  const parsed = JSON.parse(blob);
  const encrypted: AESEncryptedData = {
    engine: "aes",
    ciphertext: base64ToUint8(parsed.ciphertext),
    iv: base64ToUint8(parsed.iv),
    authTag: base64ToUint8(parsed.authTag),
    keyDerivation: parsed.keyDerivation
      ? {
          ...parsed.keyDerivation,
          salt: base64ToUint8(parsed.keyDerivation.salt),
        }
      : { source: "raw", salt: new Uint8Array(0), kdf: "hkdf-sha256" },
  };
  const decrypted = await aes.decrypt(encrypted, key);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

function uint8ToBase64(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr));
}

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  return new Uint8Array([...bin].map((c) => c.charCodeAt(0)));
}
```

- [ ] **Step 2: Commit**

```bash
git add examples/memo/src/lib/encryption.ts
git commit -m "feat(memo): add client-side AES encryption helpers"
```

---

### Task 7: ERC-8128 header generation

**Files:**
- Create: `examples/memo/src/lib/erc8128.ts`

- [ ] **Step 1: Create erc8128.ts**

Adapted from `apps/web/app/lib/erc8128.ts`:

```typescript
import { type Config, getAccount, signMessage } from "@wagmi/core";
import { type Hex, toHex } from "viem";
import { config } from "./wagmi";

const RELAY = import.meta.env.VITE_RELAY_URL ?? "http://localhost:3000";

export async function createErc8128Headers(
  method: string,
  url: string,
  body?: string,
): Promise<Record<string, string>> {
  // Get nonce from relay
  const challengeRes = await fetch(`${RELAY}/v1/auth/challenge`, { method: "POST" });
  const { nonce, timestamp } = (await challengeRes.json()) as {
    nonce: string;
    timestamp: number;
  };

  // Compute body hash
  const bodyBytes = new TextEncoder().encode(body ?? "");
  const bodyHashBuf = await crypto.subtle.digest("SHA-256", bodyBytes);
  const bodyHash = toHex(new Uint8Array(bodyHashBuf));

  // Build payload
  const payload = `${method}\n${url}\n${timestamp}\n${nonce}\n${bodyHash}`;

  // Sign with connected wallet
  const signature = await signMessage(config as Config, { message: payload });

  // Get signer address
  const account = getAccount(config as Config);
  const signer = account.address!;

  return {
    "X-OrbitMem-Signer": signer,
    "X-OrbitMem-Family": "evm",
    "X-OrbitMem-Algorithm": "ecdsa-secp256k1",
    "X-OrbitMem-Timestamp": String(timestamp),
    "X-OrbitMem-Nonce": nonce,
    "X-OrbitMem-Signature": signature,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add examples/memo/src/lib/erc8128.ts
git commit -m "feat(memo): add ERC-8128 header generation"
```

---

### Task 8: Relay API client

**Files:**
- Create: `examples/memo/src/lib/relay.ts`

- [ ] **Step 1: Create relay.ts**

```typescript
const RELAY = import.meta.env.VITE_RELAY_URL ?? "http://localhost:3000";

export async function writeEntry(
  path: string,
  value: unknown,
  visibility: string,
  headers: Record<string, string>,
): Promise<{ ok: boolean; hash: string }> {
  const res = await fetch(`${RELAY}/v1/vault/write`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ path, value, visibility }),
  });
  if (!res.ok) throw new Error(`Write failed: ${res.status}`);
  return res.json();
}

export async function readEntry(
  path: string,
  headers: Record<string, string>,
): Promise<{ key: string; value: unknown; visibility: string }> {
  const res = await fetch(`${RELAY}/v1/vault/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error(`Read failed: ${res.status}`);
  return res.json();
}

export async function listKeys(
  headers: Record<string, string>,
  prefix?: string,
): Promise<{ keys: string[] }> {
  const res = await fetch(`${RELAY}/v1/vault/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ prefix }),
  });
  if (!res.ok) throw new Error(`List failed: ${res.status}`);
  return res.json();
}

export async function deleteEntry(
  path: string,
  headers: Record<string, string>,
): Promise<{ ok: boolean }> {
  const res = await fetch(`${RELAY}/v1/vault/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
  return res.json();
}

export async function readPublic(
  address: string,
  key: string,
): Promise<{ key: string; value: unknown; visibility: string } | null> {
  const res = await fetch(`${RELAY}/v1/vault/public/${address}/${encodeURIComponent(key)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Public read failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: Commit**

```bash
git add examples/memo/src/lib/relay.ts
git commit -m "feat(memo): add relay API client"
```

---

## Chunk 4: React Hook + Memo CRUD Components

### Task 9: useOrbitMem hook (wallet state + memo CRUD)

**Files:**
- Create: `examples/memo/src/hooks/useOrbitMem.ts`

- [ ] **Step 1: Create useOrbitMem hook**

```typescript
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { deriveVaultKey, decryptValue, encryptValue } from "../lib/encryption";
import { createErc8128Headers } from "../lib/erc8128";
import * as relay from "../lib/relay";

export interface Memo {
  id: string;
  title: string;
  body: string;
  visibility: "public" | "private";
  created: number;
  updated: number;
}

export function useOrbitMem() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const vaultKeyRef = useRef<CryptoKey | null>(null);

  // Derive vault key on connect
  useEffect(() => {
    if (!isConnected || !address) {
      vaultKeyRef.current = null;
      setMemos([]);
      return;
    }

    (async () => {
      try {
        const sig = await signMessageAsync({ message: "OrbitMem Vault Key v1" });
        // Convert hex signature to Uint8Array
        const sigBytes = new Uint8Array(
          (sig.slice(2).match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)),
        );
        vaultKeyRef.current = await deriveVaultKey(sigBytes);
        await loadMemos();
      } catch (e) {
        setError(`Key derivation failed: ${e}`);
      }
    })();
  }, [isConnected, address]);

  const getHeaders = useCallback(
    async (method: string, url: string, body?: string) => {
      return createErc8128Headers(method, url, body);
    },
    [],
  );

  const loadMemos = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const body = JSON.stringify({ prefix: "memos/" });
      const headers = await getHeaders("POST", "/v1/vault/keys", body);
      const { keys } = await relay.listKeys(headers, "memos/");

      // Extract unique memo IDs from keys like "memos/{id}/title"
      const ids = [...new Set(keys.map((k) => k.split("/")[1]).filter(Boolean))];

      const loaded: Memo[] = [];
      for (const id of ids) {
        try {
          const memo = await loadSingleMemo(id, headers);
          if (memo) loaded.push(memo);
        } catch {
          // Skip memos that fail to load
        }
      }

      loaded.sort((a, b) => b.updated - a.updated);
      setMemos(loaded);
    } catch (e) {
      setError(`Failed to load memos: ${e}`);
    } finally {
      setLoading(false);
    }
  }, [address, getHeaders]);

  const loadSingleMemo = async (
    id: string,
    headers: Record<string, string>,
  ): Promise<Memo | null> => {
    const readField = async (field: string) => {
      const readBody = JSON.stringify({ path: `memos/${id}/${field}` });
      const readHeaders = await getHeaders("POST", "/v1/vault/read", readBody);
      return relay.readEntry(`memos/${id}/${field}`, readHeaders);
    };

    const [titleRes, bodyRes, createdRes, updatedRes] = await Promise.all([
      readField("title"),
      readField("body"),
      readField("created"),
      readField("updated"),
    ]);

    const isPrivate = titleRes.visibility === "private";
    const key = vaultKeyRef.current;

    const title = isPrivate && key
      ? await decryptValue<string>(titleRes.value as string, key)
      : (titleRes.value as string);
    const body = isPrivate && key
      ? await decryptValue<string>(bodyRes.value as string, key)
      : (bodyRes.value as string);
    const created = isPrivate && key
      ? await decryptValue<number>(createdRes.value as string, key)
      : (createdRes.value as number);
    const updated = isPrivate && key
      ? await decryptValue<number>(updatedRes.value as string, key)
      : (updatedRes.value as number);

    return { id, title, body, visibility: isPrivate ? "private" : "public", created, updated };
  };

  const saveMemo = useCallback(
    async (memo: { id: string; title: string; body: string; visibility: "public" | "private"; created?: number }) => {
      const now = Date.now();
      const isPrivate = memo.visibility === "private";
      const key = vaultKeyRef.current;

      const writeField = async (field: string, value: unknown) => {
        const stored = isPrivate && key ? await encryptValue(value, key) : value;
        const writeBody = JSON.stringify({
          path: `memos/${memo.id}/${field}`,
          value: stored,
          visibility: memo.visibility,
        });
        const headers = await getHeaders("POST", "/v1/vault/write", writeBody);
        return relay.writeEntry(`memos/${memo.id}/${field}`, stored, memo.visibility, headers);
      };

      await Promise.all([
        writeField("title", memo.title),
        writeField("body", memo.body),
        writeField("created", memo.created ?? now),
        writeField("updated", now),
      ]);

      await loadMemos();
    },
    [getHeaders, loadMemos],
  );

  const deleteMemo = useCallback(
    async (id: string) => {
      if (!confirm("Delete this memo?")) return;
      const fields = ["title", "body", "created", "updated"];
      await Promise.all(
        fields.map(async (field) => {
          const delBody = JSON.stringify({ path: `memos/${id}/${field}` });
          const headers = await getHeaders("POST", "/v1/vault/delete", delBody);
          return relay.deleteEntry(`memos/${id}/${field}`, headers);
        }),
      );
      await loadMemos();
    },
    [getHeaders, loadMemos],
  );

  return {
    address,
    isConnected,
    memos,
    loading,
    error,
    saveMemo,
    deleteMemo,
    refresh: loadMemos,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add examples/memo/src/hooks/useOrbitMem.ts
git commit -m "feat(memo): add useOrbitMem hook with CRUD operations"
```

---

### Task 10: MemoList component

**Files:**
- Create: `examples/memo/src/components/MemoList.tsx`

- [ ] **Step 1: Create MemoList**

```tsx
import type { Memo } from "../hooks/useOrbitMem";

interface MemoListProps {
  memos: Memo[];
  address: string;
  onSelect: (memo: Memo) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export function MemoList({ memos, address, onSelect, onDelete, onNew }: MemoListProps) {
  const copyShareUrl = (memo: Memo) => {
    const url = `${window.location.origin}/${address}/${memo.id}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">My Memos</h2>
        <button
          onClick={onNew}
          className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          New Memo
        </button>
      </div>

      {memos.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No memos yet. Create your first one!</p>
      ) : (
        <ul className="space-y-3">
          {memos.map((memo) => (
            <li
              key={memo.id}
              className="border rounded-lg p-4 bg-white hover:border-blue-300 transition-colors cursor-pointer"
              onClick={() => onSelect(memo)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{memo.title || "Untitled"}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      memo.visibility === "public"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {memo.visibility}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {new Date(memo.updated).toLocaleDateString()}
                  </span>
                  {memo.visibility === "public" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyShareUrl(memo);
                      }}
                      className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 transition-colors"
                      title="Copy share URL"
                    >
                      Share
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(memo.id);
                    }}
                    className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add examples/memo/src/components/MemoList.tsx
git commit -m "feat(memo): add MemoList component with share + delete"
```

---

### Task 11: MemoEditor component

**Files:**
- Create: `examples/memo/src/components/MemoEditor.tsx`

- [ ] **Step 1: Create MemoEditor with markdown preview**

```tsx
import { nanoid } from "nanoid";
import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Memo } from "../hooks/useOrbitMem";

interface MemoEditorProps {
  memo?: Memo;
  onSave: (memo: {
    id: string;
    title: string;
    body: string;
    visibility: "public" | "private";
    created?: number;
  }) => Promise<void>;
  onBack: () => void;
}

export function MemoEditor({ memo, onSave, onBack }: MemoEditorProps) {
  const [title, setTitle] = useState(memo?.title ?? "");
  const [body, setBody] = useState(memo?.body ?? "");
  const [visibility, setVisibility] = useState<"public" | "private">(
    memo?.visibility ?? "public",
  );
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        id: memo?.id ?? nanoid(),
        title,
        body,
        visibility,
        created: memo?.created,
      });
      onBack();
    } catch (e) {
      alert(`Save failed: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          &larr; Back
        </button>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span>Visibility:</span>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as "public" | "private")}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </label>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full text-2xl font-bold border-0 border-b pb-2 mb-4 focus:outline-none focus:border-blue-500"
      />

      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setPreview(false)}
          className={`text-sm px-3 py-1 rounded ${!preview ? "bg-gray-200" : "hover:bg-gray-100"}`}
        >
          Edit
        </button>
        <button
          onClick={() => setPreview(true)}
          className={`text-sm px-3 py-1 rounded ${preview ? "bg-gray-200" : "hover:bg-gray-100"}`}
        >
          Preview
        </button>
      </div>

      {preview ? (
        <div className="prose max-w-none min-h-[300px] p-4 border rounded-md bg-white">
          <Markdown remarkPlugins={[remarkGfm]}>{body}</Markdown>
        </div>
      ) : (
        <textarea
          placeholder="Write your memo in Markdown..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full min-h-[300px] p-4 border rounded-md font-mono text-sm resize-y focus:outline-none focus:border-blue-500"
        />
      )}

      {memo && (
        <div className="mt-4 text-xs text-gray-400">
          Created: {new Date(memo.created).toLocaleString()} | Updated:{" "}
          {new Date(memo.updated).toLocaleString()}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add examples/memo/src/components/MemoEditor.tsx
git commit -m "feat(memo): add MemoEditor with markdown preview + visibility toggle"
```

---

### Task 12: PublicMemoView component

**Files:**
- Create: `examples/memo/src/components/PublicMemoView.tsx`

- [ ] **Step 1: Create PublicMemoView**

```tsx
import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { readPublic } from "../lib/relay";

interface PublicMemoViewProps {
  address: string;
  memoId: string;
}

export function PublicMemoView({ address, memoId }: PublicMemoViewProps) {
  const [title, setTitle] = useState<string | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [created, setCreated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [titleRes, bodyRes, createdRes] = await Promise.all([
          readPublic(address, `memos/${memoId}/title`),
          readPublic(address, `memos/${memoId}/body`),
          readPublic(address, `memos/${memoId}/created`),
        ]);

        if (!titleRes || !bodyRes) {
          setError("This memo is private or does not exist.");
          return;
        }

        setTitle(titleRes.value as string);
        setBody(bodyRes.value as string);
        setCreated(createdRes?.value as number | null);
      } catch {
        setError("Failed to load memo.");
      } finally {
        setLoading(false);
      }
    })();
  }, [address, memoId]);

  if (loading) {
    return <p className="text-center py-12 text-gray-500">Loading...</p>;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">{error}</p>
        <a href="/" className="text-blue-600 hover:underline">
          Go to OrbitMem Memo
        </a>
      </div>
    );
  }

  const copyUrl = () => navigator.clipboard.writeText(window.location.href);

  return (
    <article className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">{title}</h1>
      <div className="flex items-center gap-3 mb-6 text-sm text-gray-500">
        <span className="font-mono">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        {created && <span>{new Date(created).toLocaleDateString()}</span>}
        <button onClick={copyUrl} className="text-blue-600 hover:underline">
          Copy link
        </button>
      </div>
      <div className="prose max-w-none">
        <Markdown remarkPlugins={[remarkGfm]}>{body ?? ""}</Markdown>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add examples/memo/src/components/PublicMemoView.tsx
git commit -m "feat(memo): add PublicMemoView for shareable memo URLs"
```

---

## Chunk 5: Wire It All Together + Verify

### Task 13: Wire App.tsx with routing and all components

**Files:**
- Modify: `examples/memo/src/App.tsx`

- [ ] **Step 1: Update App.tsx with URL-based routing**

Replace `examples/memo/src/App.tsx` with:

```tsx
import { useAccount } from "wagmi";
import { useState } from "react";
import { ConnectButton } from "./components/ConnectButton";
import { MemoEditor } from "./components/MemoEditor";
import { MemoList } from "./components/MemoList";
import { PublicMemoView } from "./components/PublicMemoView";
import { useOrbitMem, type Memo } from "./hooks/useOrbitMem";

type View = { type: "list" } | { type: "edit"; memo?: Memo } | { type: "public"; address: string; memoId: string };

function parseRoute(): View {
  const path = window.location.pathname;
  // Match /:address/:memoId
  const match = path.match(/^\/(0x[a-fA-F0-9]+)\/([a-zA-Z0-9_-]+)$/);
  if (match) {
    return { type: "public", address: match[1], memoId: match[2] };
  }
  return { type: "list" };
}

export function App() {
  const { isConnected } = useAccount();
  const orbit = useOrbitMem();
  const initialView = parseRoute();
  const [view, setView] = useState<View>(initialView);

  // Public memo view — no wallet required
  if (view.type === "public") {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="border-b bg-white px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-xl font-bold hover:text-blue-600 transition-colors">
            OrbitMem Memo
          </a>
          <ConnectButton />
        </header>
        <main className="px-6 py-8">
          <PublicMemoView address={view.address} memoId={view.memoId} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <h1
          className="text-xl font-bold cursor-pointer"
          onClick={() => setView({ type: "list" })}
        >
          OrbitMem Memo
        </h1>
        <ConnectButton />
      </header>
      <main className="max-w-3xl mx-auto px-6 py-8">
        {!isConnected ? (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold mb-4">Decentralized Memos</h2>
            <p className="text-gray-600 mb-8">
              Encrypted, peer-to-peer notes. Your data, your vault, your rules.
            </p>
            <ConnectButton />
          </div>
        ) : orbit.error ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <p className="text-red-700 text-sm">{orbit.error}</p>
            <button onClick={orbit.refresh} className="text-sm text-red-600 underline mt-2">
              Retry
            </button>
          </div>
        ) : orbit.loading ? (
          <p className="text-center py-12 text-gray-500">Loading memos...</p>
        ) : view.type === "edit" ? (
          <MemoEditor
            memo={view.memo}
            onSave={orbit.saveMemo}
            onBack={() => setView({ type: "list" })}
          />
        ) : (
          <MemoList
            memos={orbit.memos}
            address={orbit.address!}
            onSelect={(memo) => setView({ type: "edit", memo })}
            onDelete={orbit.deleteMemo}
            onNew={() => setView({ type: "edit" })}
          />
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add examples/memo/src/App.tsx
git commit -m "feat(memo): wire App with routing, MemoList, MemoEditor, PublicMemoView"
```

---

### Task 14: End-to-end verification

- [ ] **Step 1: Run relay tests**

Run: `bun test packages/relay/src/__tests__/vault.test.ts`
Expected: ALL PASS

- [ ] **Step 2: Run full test suite**

Run: `bun test`
Expected: ALL PASS

- [ ] **Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

- [ ] **Step 4: Run lint**

Run: `bun run lint`
Expected: PASS (or fix any issues)

- [ ] **Step 5: Start relay and memo app together**

Terminal 1: `bun run dev:relay`
Terminal 2: `cd examples/memo && bun run dev`

Expected: Relay on http://localhost:3000, Memo app on http://localhost:5174

- [ ] **Step 6: Manual smoke test**

1. Open http://localhost:5174
2. See "Decentralized Memos" landing with connect buttons (Porto, MetaMask, etc.)
3. Connect wallet → signs "OrbitMem Vault Key v1" message
4. Create a public memo → appears in list with green "public" badge
5. Create a private memo → appears with yellow "private" badge
6. Edit a memo → changes saved
7. Click "Share" on public memo → URL copied
8. Open share URL in incognito → memo renders as markdown (no wallet needed)
9. Delete a memo → removed from list
10. Disconnect → back to landing page

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat(memo): complete decentralized memo app example"
```
