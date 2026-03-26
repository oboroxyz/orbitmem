# OpenWallet (OWS) Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace direct private key generation/storage in CLI and SDK with OpenWallet Standard (`@open-wallet-standard/core`).

**Architecture:** OWS manages all private key lifecycle (generation, encrypted storage, signing). OrbitMem stores only a wallet name in config. The SDK identity layer gets an OWS code path that constructs a signer from OWS `signMessage`. CLI commands drop `loadKey()` in favor of loading wallet name from config.

**Tech Stack:** `@open-wallet-standard/core`, viem (custom account adapter), bun:test

**Spec:** `docs/design/2026-03-26-openwallet-integration.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `package.json` (root) | Add `@open-wallet-standard/core` dependency |
| Modify | `packages/cli/package.json` | Add `@open-wallet-standard/core` dependency |
| Modify | `packages/sdk/package.json` | Add `@open-wallet-standard/core` dependency |
| Modify | `packages/sdk/src/types.ts` | Replace `privateKey` with `owsWallet` in `IdentityConfig` |
| Create | `packages/sdk/src/identity/ows-adapter.ts` | OWS wallet adapter: getAddress, signMessage, toViemAccount |
| Modify | `packages/sdk/src/identity/identity-layer.ts` | Add `config.owsWallet` code path |
| Modify | `packages/sdk/package.json` | Add `./identity` export entry for ows-adapter |
| Modify | `packages/cli/src/config.ts` | Remove `saveKey`/`loadKey`, add `walletName` to config |
| Modify | `packages/cli/src/commands/init.ts` | Use OWS `createWallet` instead of `generatePrivateKey` |
| Modify | `packages/cli/src/commands/status.ts` | Use OWS `getAddress` instead of `privateKeyToAccount` |
| Modify | `packages/cli/src/utils/client.ts` | Build client from OWS wallet instead of private key |
| Modify | `packages/cli/src/commands/vault.ts` | Replace `loadKey()` with config-based wallet |
| Modify | `packages/cli/src/commands/register.ts` | Replace `loadKey()` with config-based wallet |
| Modify | `packages/cli/src/commands/discover.ts` | Replace `loadKey()` with config-based wallet |
| Modify | `packages/cli/src/commands/snapshot.ts` | Replace `loadKey()` with config-based wallet |
| Modify | `examples/agent-research/tools/shared.ts` | Replace `loadKey()` / `privateKeyToAccount` with OWS |
| Rewrite | `packages/cli/src/__tests__/config.test.ts` | Remove key tests, keep config tests |
| Rewrite | `packages/cli/src/__tests__/init.test.ts` | Test OWS wallet creation + config |

---

### Task 1: Add `@open-wallet-standard/core` Dependency

**Files:**
- Modify: `package.json` (root)
- Modify: `packages/cli/package.json`
- Modify: `packages/sdk/package.json`

- [ ] **Step 1: Install the dependency**

Run: `cd /Users/yujiym/GitHub/@oboroxyz/orbitmem && bun add @open-wallet-standard/core --cwd packages/sdk && bun add @open-wallet-standard/core --cwd packages/cli`

Expected: Packages installed, lockfile updated.

- [ ] **Step 2: Verify import works**

Run: `cd /Users/yujiym/GitHub/@oboroxyz/orbitmem && bun -e "import { createWallet, signMessage } from '@open-wallet-standard/core'; console.log('OK')"`

Expected: Prints `OK`.

- [ ] **Step 3: Commit**

```bash
git add packages/sdk/package.json packages/cli/package.json bun.lock
git commit -m "deps: add @open-wallet-standard/core to sdk and cli"
```

---

### Task 2: Create OWS Wallet Adapter in SDK

**Files:**
- Create: `packages/sdk/src/identity/ows-adapter.ts`
- Test: `packages/sdk/src/identity/__tests__/ows-adapter.test.ts`

This adapter wraps OWS SDK calls into the shapes the identity layer and viem need.

- [ ] **Step 1: Write the failing test**

Create `packages/sdk/src/identity/__tests__/ows-adapter.test.ts`:

```ts
import { describe, expect, test, beforeAll } from "bun:test";
import { createOwsAdapter } from "../ows-adapter.js";

const WALLET = "orbitmem-test-adapter";
const CHAIN = "eip155:84532"; // Base Sepolia

describe("ows-adapter", () => {
  beforeAll(async () => {
    // Ensure a test wallet exists
    const { createWallet } = await import("@open-wallet-standard/core");
    await createWallet(WALLET);
  });

  test("getAddress returns a valid EVM address", async () => {
    const adapter = createOwsAdapter(WALLET, CHAIN);
    const address = await adapter.getAddress();
    expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  test("signMessage returns a Uint8Array signature", async () => {
    const adapter = createOwsAdapter(WALLET, CHAIN);
    const result = await adapter.signMessage("hello");
    expect(result.signature).toBeInstanceOf(Uint8Array);
    expect(result.signature.length).toBeGreaterThan(0);
    expect(result.algorithm).toBe("ecdsa-secp256k1");
  });

  test("toViemAccount returns account with address and sign methods", async () => {
    const adapter = createOwsAdapter(WALLET, CHAIN);
    const account = await adapter.toViemAccount();
    expect(account.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(typeof account.signMessage).toBe("function");
    expect(typeof account.signTransaction).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test packages/sdk/src/identity/__tests__/ows-adapter.test.ts`

Expected: FAIL — module `../ows-adapter.js` not found.

- [ ] **Step 3: Write the adapter**

Create `packages/sdk/src/identity/ows-adapter.ts`:

```ts
import type { SignatureAlgorithm, WalletAddress } from "../types.js";

export interface OwsAdapter {
  getAddress(): Promise<WalletAddress>;
  signMessage(
    message: string,
  ): Promise<{ signature: Uint8Array; algorithm: SignatureAlgorithm }>;
  toViemAccount(): Promise<import("viem").Account>;
}

/**
 * @param walletName — OWS wallet name (e.g., "orbitmem")
 * @param chain — CAIP-2 chain ID (e.g., "eip155:84532" for Base Sepolia)
 */
export function createOwsAdapter(walletName: string, chain: string): OwsAdapter {
  // Lazy import to avoid loading OWS when not needed
  const ows = () => import("@open-wallet-standard/core");

  function hexToBytes(hex: string): Uint8Array {
    const clean = hex.replace(/^0x/, "");
    return new Uint8Array(
      clean.match(/.{2}/g)!.map((b) => Number.parseInt(b, 16)),
    );
  }

  return {
    async getAddress(): Promise<WalletAddress> {
      const { createWallet } = await ows();
      // createWallet is idempotent — returns existing wallet if name matches
      const wallet = await createWallet(walletName);
      // Access the EVM address from the wallet object
      return (wallet as any).address ?? (wallet as any).accounts?.evm?.address;
    },

    async signMessage(
      message: string,
    ): Promise<{ signature: Uint8Array; algorithm: SignatureAlgorithm }> {
      const { signMessage: owsSign } = await ows();
      const result = await owsSign(walletName, chain, message);
      const sigHex = (result as any).signature as string;
      return { signature: hexToBytes(sigHex), algorithm: "ecdsa-secp256k1" };
    },

    async toViemAccount(): Promise<import("viem").Account> {
      const address = await this.getAddress();
      const { toAccount } = await import("viem/accounts");
      return toAccount({
        address: address as `0x${string}`,
        async signMessage({ message }) {
          const { signMessage: owsSign } = await ows();
          const msg =
            typeof message === "string"
              ? message
              : typeof message === "object" && "raw" in message
                ? typeof message.raw === "string"
                  ? message.raw
                  : new TextDecoder().decode(message.raw)
                : String(message);
          const result = await owsSign(walletName, chain, msg);
          return (result as any).signature as `0x${string}`;
        },
        async signTransaction(tx) {
          const { signMessage: owsSign } = await ows();
          // Serialize the transaction object for OWS signing
          const result = await owsSign(walletName, chain, JSON.stringify(tx));
          return (result as any).signature as `0x${string}`;
        },
        async signTypedData(typedData) {
          // EIP-712 typed data — OWS may not have native support yet.
          // For now, sign the JSON-serialized typed data.
          // TODO: Replace with OWS native signTypedData when available.
          const { signMessage: owsSign } = await ows();
          const result = await owsSign(walletName, chain, JSON.stringify(typedData));
          return (result as any).signature as `0x${string}`;
        },
      });
    },
  };
}
```

> **Note:** The exact OWS return types and `createWallet` shape will be confirmed after `npm install`. The adapter isolates all OWS-specific logic so adjustments stay contained. `signTypedData` uses `signMessage` as a stopgap — replace with native OWS support when available. All OWS calls use `await` since the SDK may return Promises (Rust FFI via napi).

- [ ] **Step 4: Add `./identity` to SDK exports map**

In `packages/sdk/package.json`, add a new export entry so CLI and examples can import the adapter:

```json
"./identity": {
  "types": "./src/identity/index.ts",
  "bun": "./src/identity/index.ts",
  "import": "./dist/identity/index.js"
}
```

Then create or update `packages/sdk/src/identity/index.ts` to re-export:

```ts
export { createOwsAdapter, type OwsAdapter } from "./ows-adapter.js";
```

After this, the import `from "@orbitmem/sdk/identity"` will work from CLI and examples.

- [ ] **Step 5: Run tests**

Run: `bun test packages/sdk/src/identity/__tests__/ows-adapter.test.ts`

Expected: PASS (requires OWS CLI installed: `npm install -g @open-wallet-standard/core`).

- [ ] **Step 6: Commit**

```bash
git add packages/sdk/src/identity/ows-adapter.ts packages/sdk/src/identity/__tests__/ows-adapter.test.ts
git commit -m "feat(sdk): add OWS wallet adapter for identity layer"
```

---

### Task 3: Update SDK Types — Remove `privateKey`, Add `owsWallet`

**Files:**
- Modify: `packages/sdk/src/types.ts:63-98`

- [ ] **Step 1: Edit IdentityConfig**

In `packages/sdk/src/types.ts`, replace:

```ts
  /** EVM private key for CLI / server-side usage (hex string) */
  privateKey?: string;
```

with:

```ts
  /** OWS wallet name for CLI / server-side usage */
  owsWallet?: string;
  /** CAIP-2 chain ID for OWS signing (e.g., "eip155:84532"). Defaults to "eip155:84532" (Base Sepolia) */
  owsChain?: string;
```

- [ ] **Step 2: Verify typecheck catches downstream breakage**

Run: `cd /Users/yujiym/GitHub/@oboroxyz/orbitmem && bun run typecheck 2>&1 | head -40`

Expected: Type errors in `identity-layer.ts`, `client.ts`, etc. referencing `config.privateKey`. This confirms the type change propagated.

- [ ] **Step 3: Commit**

```bash
git add packages/sdk/src/types.ts
git commit -m "feat(sdk): replace privateKey with owsWallet in IdentityConfig"
```

---

### Task 4: Update Identity Layer to Use OWS Adapter

**Files:**
- Modify: `packages/sdk/src/identity/identity-layer.ts:22-48`

- [ ] **Step 1: Replace the privateKey code path**

In `packages/sdk/src/identity/identity-layer.ts`, replace:

```ts
      // If a private key was provided (CLI / server usage), auto-connect via viem
      if (config.privateKey && opts.method === "evm") {
        const { privateKeyToAccount } = await import("viem/accounts");
        const account = privateKeyToAccount(config.privateKey as `0x${string}`);

        connection = {
          address: account.address,
          family: "evm",
          signatureAlgorithm: "ecdsa-secp256k1",
          connectedAt: Date.now(),
        };

        signFn = async (message: string) => {
          const sig = await account.signMessage({ message });
          const bytes = new Uint8Array(
            sig
              .slice(2)
              .match(/.{2}/g)!
              .map((b) => Number.parseInt(b, 16)),
          );
          return { signature: bytes, algorithm: "ecdsa-secp256k1" as const };
        };

        for (const cb of listeners) cb(connection);
        return connection;
      }
```

with:

```ts
      // If an OWS wallet was provided (CLI / server usage), auto-connect via OWS adapter
      if (config.owsWallet) {
        const { createOwsAdapter } = await import("./ows-adapter.js");
        const owsChain = config.owsChain ?? "eip155:84532";
        const adapter = createOwsAdapter(config.owsWallet, owsChain);
        const address = await adapter.getAddress();

        connection = {
          address,
          family: "evm",
          signatureAlgorithm: "ecdsa-secp256k1",
          connectedAt: Date.now(),
        };

        signFn = async (message: string) => {
          return adapter.signMessage(message);
        };

        for (const cb of listeners) cb(connection);
        return connection;
      }
```

- [ ] **Step 2: Update the error message**

Replace:

```ts
      throw new Error(
        `connect(${opts.method}) requires a wallet adapter or privateKey config. ` +
          "Use setConnection() for testing or integrate a wallet provider.",
      );
```

with:

```ts
      throw new Error(
        `connect(${opts.method}) requires a wallet adapter or owsWallet config. ` +
          "Use setConnection() for testing or integrate a wallet provider.",
      );
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/yujiym/GitHub/@oboroxyz/orbitmem && bun run typecheck 2>&1 | head -40`

Expected: No errors in identity-layer.ts. Remaining errors should be in CLI files only.

- [ ] **Step 4: Commit**

```bash
git add packages/sdk/src/identity/identity-layer.ts
git commit -m "feat(sdk): wire identity layer to OWS adapter"
```

---

### Task 5: Update CLI Config — Remove `saveKey`/`loadKey`, Add `walletName`

**Files:**
- Modify: `packages/cli/src/config.ts`

- [ ] **Step 1: Add `walletName` to CliConfig and remove key functions**

Replace the entire `packages/cli/src/config.ts` with:

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { getNetwork, type NetworkId } from "@orbitmem/sdk/contracts";

export interface CliConfig {
  walletName: string;
  network: NetworkId;
  relay: string;
  chain: string;
  registryAddress: string;
  reputationAddress: string;
}

function defaultConfig(network?: NetworkId): Omit<CliConfig, "walletName"> {
  const net = getNetwork(network);
  return {
    network: network ?? "base-sepolia",
    relay: net.relayUrl,
    chain: net.chain,
    registryAddress: net.dataRegistry,
    reputationAddress: net.feedbackRegistry,
  };
}

export function getConfigDir(): string {
  return process.env.ORBITMEM_HOME ?? join(homedir(), ".orbitmem");
}

function ensureDir(): void {
  const dir = getConfigDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function loadConfig(): CliConfig {
  const configPath = join(getConfigDir(), "config.json");
  const defaults = defaultConfig();
  if (!existsSync(configPath)) return { walletName: "", ...defaults };
  const raw = JSON.parse(readFileSync(configPath, "utf-8"));
  const base = raw.network ? defaultConfig(raw.network) : defaults;
  return { walletName: "", ...base, ...raw };
}

export function saveConfig(config: Partial<CliConfig>): void {
  ensureDir();
  const configPath = join(getConfigDir(), "config.json");
  const existing = loadConfig();
  const merged = { ...existing, ...config };
  writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`);
}
```

- [ ] **Step 2: Typecheck — expect downstream errors**

Run: `cd /Users/yujiym/GitHub/@oboroxyz/orbitmem && bun run typecheck 2>&1 | grep "loadKey\|saveKey" | head -20`

Expected: Errors in `init.ts`, `vault.ts`, `register.ts`, `discover.ts`, `snapshot.ts`, `status.ts` for missing `loadKey`/`saveKey` imports.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/config.ts
git commit -m "feat(cli): remove saveKey/loadKey, add walletName to CliConfig"
```

---

### Task 6: Update CLI `init` Command

**Files:**
- Modify: `packages/cli/src/commands/init.ts`

- [ ] **Step 1: Rewrite init to use OWS**

Replace the entire `packages/cli/src/commands/init.ts` with:

```ts
import { existsSync } from "node:fs";
import { join } from "node:path";

import type { NetworkId } from "@orbitmem/sdk/contracts";
import { createWallet } from "@open-wallet-standard/core";

import { getConfigDir, loadConfig, saveConfig } from "../config.js";
import { output } from "../utils/output.js";

export async function init(_args: string[], flags: Record<string, string>): Promise<void> {
  const configDir = getConfigDir();
  const configPath = join(configDir, "config.json");

  if (existsSync(configPath) && flags.force === undefined) {
    const existing = loadConfig();
    if (existing.walletName) {
      process.stderr.write(
        `Already initialized at ${configDir}. Use --force to reinitialize.\n`,
      );
      process.exit(1);
    }
  }

  const walletName = flags.name ?? "orbitmem";
  await createWallet(walletName);

  const network = (flags.network ?? "base-sepolia") as NetworkId;
  saveConfig({ walletName, network });

  const config = loadConfig();
  const info = {
    wallet: walletName,
    configDir,
    network: config.network,
    relay: config.relay,
    chain: config.chain,
    dataRegistry: config.registryAddress,
    feedbackRegistry: config.reputationAddress,
  };

  if (flags.json !== undefined) {
    output(info, true);
  } else {
    process.stdout.write(`\nOrbitMem initialized!\n\n`);
    process.stdout.write(`  Wallet:            ${info.wallet}\n`);
    process.stdout.write(`  Config:            ${info.configDir}\n`);
    process.stdout.write(`  Network:           ${info.network}\n`);
    process.stdout.write(`  Relay:             ${info.relay}\n`);
    process.stdout.write(`  Chain:             ${info.chain}\n`);
    process.stdout.write(`  DataRegistry:      ${info.dataRegistry}\n`);
    process.stdout.write(`  FeedbackRegistry:  ${info.feedbackRegistry}\n\n`);
  }
}
```

- [ ] **Step 2: Typecheck init**

Run: `cd /Users/yujiym/GitHub/@oboroxyz/orbitmem && bunx tsc --noEmit -p packages/cli/tsconfig.json 2>&1 | grep init`

Expected: No errors for `init.ts`.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/commands/init.ts
git commit -m "feat(cli): init creates OWS wallet instead of raw private key"
```

---

### Task 7: Update CLI Client Builder

**Files:**
- Modify: `packages/cli/src/utils/client.ts`

- [ ] **Step 1: Rewrite client.ts to use OWS**

Replace the entire `packages/cli/src/utils/client.ts` with:

```ts
import { createOrbitMem, getNetwork } from "@orbitmem/sdk";
import type { EncryptionConfig } from "@orbitmem/sdk/types";
import { createPublicClient, createWalletClient, http } from "viem";
import { base, baseSepolia } from "viem/chains";
import { createOwsAdapter } from "@orbitmem/sdk/identity";

import type { CliConfig } from "../config.js";

const CHAINS = {
  "base-sepolia": baseSepolia,
  base: base,
} as const;

export type LitNetwork = "cayenne" | "manzano" | "habanero";

export interface CreateClientOpts {
  litNetwork?: LitNetwork;
}

export async function createClient(config: CliConfig, opts?: CreateClientOpts) {
  const network = getNetwork(config.network);
  const chain = CHAINS[config.network] ?? baseSepolia;
  const transport = http(network.rpcUrl);

  const adapter = createOwsAdapter(config.walletName, `eip155:${chain.id}`);
  const viemAccount = await adapter.toViemAccount();

  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ chain, transport, account: viemAccount });

  const encryption: EncryptionConfig = {
    defaultEngine: "aes",
    aes: { kdf: "hkdf-sha256" },
  };
  if (opts?.litNetwork) {
    encryption.lit = { network: opts.litNetwork };
  }

  const client = await createOrbitMem({
    network: config.network,
    identity: { owsWallet: config.walletName },
    vault: { dbName: "orbitmem-cli" },
    encryption,
    persistence: {
      relayUrl: config.relay,
    },
    discovery: {
      dataRegistry: network.dataRegistry,
      reputationRegistry: network.feedbackRegistry,
      registryChain: network.chain,
      publicClient: publicClient as any,
      walletClient: walletClient as any,
    },
  });

  await client.connect({ method: "evm" });
  return client;
}
```

> **Note:** The `createOwsAdapter` is exported via `@orbitmem/sdk/identity` (added in Task 2, Step 4).

- [ ] **Step 2: Typecheck**

Run: `cd /Users/yujiym/GitHub/@oboroxyz/orbitmem && bunx tsc --noEmit -p packages/cli/tsconfig.json 2>&1 | grep client`

Expected: No errors for `client.ts`. The signature change (`privateKey` param removed) will cause errors in callers — that's expected and fixed in the next task.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/utils/client.ts
git commit -m "feat(cli): build client from OWS wallet via adapter"
```

---

### Task 8: Update All CLI Commands — Drop `loadKey()`

**Files:**
- Modify: `packages/cli/src/commands/status.ts`
- Modify: `packages/cli/src/commands/vault.ts`
- Modify: `packages/cli/src/commands/register.ts`
- Modify: `packages/cli/src/commands/discover.ts`
- Modify: `packages/cli/src/commands/snapshot.ts`

All commands follow the same pattern: remove `loadKey()` import, change `createClient(config, loadKey(), ...)` to `createClient(config, ...)`.

- [ ] **Step 1: Update `status.ts`**

Replace the entire `packages/cli/src/commands/status.ts` with:

```ts
import { getNetwork } from "@orbitmem/sdk";
import { createOwsAdapter } from "@orbitmem/sdk/identity";

import { getConfigDir, loadConfig } from "../config.js";
import { error, output } from "../utils/output.js";

const CAIP2: Record<string, string> = {
  "base-sepolia": "eip155:84532",
  base: "eip155:8453",
};

export async function status(_args: string[], flags: Record<string, string>): Promise<void> {
  const config = loadConfig();
  if (!config.walletName) {
    error("Not initialized. Run `orbitmem init` first.");
  }

  const caip2 = CAIP2[config.network] ?? "eip155:84532";
  const adapter = createOwsAdapter(config.walletName, caip2);
  const address = await adapter.getAddress();

  const info = {
    wallet: config.walletName,
    address,
    configDir: getConfigDir(),
    relay: flags.relay ?? config.relay,
    chain: flags.chain ?? config.chain,
    registryAddress: config.registryAddress ?? "(not set)",
    reputationAddress: config.reputationAddress ?? "(not set)",
  };

  output(info, flags.json !== undefined);
}
```

- [ ] **Step 2: Update `vault.ts`**

In `packages/cli/src/commands/vault.ts`:

- Remove: `import { loadConfig, loadKey } from "../config.js";`
- Add: `import { loadConfig } from "../config.js";`
- Replace every `createClient(config, loadKey(), ...)` with `createClient(config, ...)`
- Replace every `createClient(config, loadKey())` with `createClient(config)`

There are 7 call sites in vault.ts (lines 42, 120, 136, 176, 197, 220, 244). Each one follows the same pattern.

- [ ] **Step 3: Update `register.ts`**

In `packages/cli/src/commands/register.ts`:

- Remove `loadKey` from the import: `import { loadConfig } from "../config.js";`
- Line 14: Replace `createClient(config, loadKey())` with `createClient(config)`

- [ ] **Step 4: Update `discover.ts`**

In `packages/cli/src/commands/discover.ts`:

- Remove `loadKey` from the import: `import { loadConfig } from "../config.js";`
- Line 11: Replace `createClient(config, loadKey())` with `createClient(config)`

- [ ] **Step 5: Update `snapshot.ts`**

In `packages/cli/src/commands/snapshot.ts`:

- Remove `loadKey` from the import: `import { loadConfig } from "../config.js";`
- Line 8: Replace `createClient(config, loadKey())` with `createClient(config)`

- [ ] **Step 6: Typecheck all CLI**

Run: `cd /Users/yujiym/GitHub/@oboroxyz/orbitmem && bunx tsc --noEmit -p packages/cli/tsconfig.json`

Expected: PASS — no type errors.

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/commands/status.ts packages/cli/src/commands/vault.ts packages/cli/src/commands/register.ts packages/cli/src/commands/discover.ts packages/cli/src/commands/snapshot.ts
git commit -m "feat(cli): drop loadKey() from all commands, use OWS via config"
```

---

### Task 9: Update Agent Research Example

**Files:**
- Modify: `examples/agent-research/tools/shared.ts`

- [ ] **Step 1: Rewrite shared.ts**

Replace the entire `examples/agent-research/tools/shared.ts` with:

```ts
/**
 * Shared utilities for agent-research tool scripts.
 * Bootstraps an OrbitMem client from ~/.orbitmem config (same as CLI).
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { createOrbitMem, getNetwork, type NetworkId } from "@orbitmem/sdk";
import { createOwsAdapter } from "@orbitmem/sdk/identity";
import { createPublicClient, createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";

interface Config {
  walletName: string;
  network: NetworkId;
  relay: string;
}

function getConfigDir(): string {
  return process.env.ORBITMEM_HOME ?? join(homedir(), ".orbitmem");
}

function loadConfig(): Config {
  const configPath = join(getConfigDir(), "config.json");
  const network = getNetwork();
  const defaults: Config = { walletName: "", network: "base-sepolia", relay: network.relayUrl };
  if (!existsSync(configPath)) return defaults;
  const raw = JSON.parse(readFileSync(configPath, "utf-8"));
  return { ...defaults, ...raw };
}

export async function createAgentClient() {
  const config = loadConfig();
  if (!config.walletName) {
    throw new Error("No wallet configured. Run `bun run cli init` first.");
  }

  const network = getNetwork(config.network);
  const transport = http(network.rpcUrl);

  const adapter = createOwsAdapter(config.walletName, `eip155:${baseSepolia.id}`);
  const viemAccount = await adapter.toViemAccount();

  const publicClient = createPublicClient({ chain: baseSepolia, transport });
  const walletClient = createWalletClient({
    chain: baseSepolia,
    transport,
    account: viemAccount,
  });

  const client = await createOrbitMem({
    network: config.network,
    identity: { owsWallet: config.walletName },
    vault: { dbName: "orbitmem-agent-research" },
    encryption: { defaultEngine: "aes", aes: { kdf: "hkdf-sha256" } },
    persistence: { relayUrl: config.relay },
    discovery: {
      dataRegistry: network.dataRegistry,
      reputationRegistry: network.feedbackRegistry,
      registryChain: network.chain,
      publicClient: publicClient as any,
      walletClient: walletClient as any,
    },
  });

  await client.connect({ method: "evm" });
  return { client, config };
}

/** Pretty-print JSON to stdout */
export function printJson(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}
```

- [ ] **Step 2: Commit**

```bash
git add examples/agent-research/tools/shared.ts
git commit -m "feat(examples): use OWS wallet in agent-research"
```

---

### Task 10: Rewrite CLI Tests

**Files:**
- Rewrite: `packages/cli/src/__tests__/config.test.ts`
- Rewrite: `packages/cli/src/__tests__/init.test.ts`

- [ ] **Step 1: Rewrite config.test.ts**

Replace the entire `packages/cli/src/__tests__/config.test.ts` with:

```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { loadConfig, saveConfig } from "../config.js";

const TEST_DIR = join(import.meta.dir, ".test-orbitmem");

describe("config", () => {
  beforeEach(() => {
    process.env.ORBITMEM_HOME = TEST_DIR;
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    delete process.env.ORBITMEM_HOME;
  });

  test("saveConfig and loadConfig roundtrip", () => {
    saveConfig({ relay: "http://localhost:3000", chain: "base" as any });
    const loaded = loadConfig();
    expect(loaded.relay).toBe("http://localhost:3000");
    expect(loaded.chain).toBe("base");
  });

  test("loadConfig returns defaults when no file exists", () => {
    const config = loadConfig();
    expect(config.relay).toBe("https://orbitmem-relay.fly.dev");
    expect(config.chain).toBe("base-sepolia");
    expect(config.walletName).toBe("");
  });

  test("saveConfig persists walletName", () => {
    saveConfig({ walletName: "test-wallet" });
    const loaded = loadConfig();
    expect(loaded.walletName).toBe("test-wallet");
  });
});
```

- [ ] **Step 2: Rewrite init.test.ts**

Replace the entire `packages/cli/src/__tests__/init.test.ts` with:

```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { init } from "../commands/init.js";
import { loadConfig } from "../config.js";

const TEST_DIR = join(import.meta.dir, ".test-orbitmem-init");

describe("init", () => {
  beforeEach(() => {
    process.env.ORBITMEM_HOME = TEST_DIR;
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    delete process.env.ORBITMEM_HOME;
  });

  test("creates config file with walletName", async () => {
    await init([], {});
    expect(existsSync(join(TEST_DIR, "config.json"))).toBe(true);
    const config = loadConfig();
    expect(config.walletName).toBe("orbitmem");
  });

  test("key.json is NOT created", async () => {
    await init([], {});
    expect(existsSync(join(TEST_DIR, "key.json"))).toBe(false);
  });

  test("config has default network and relay", async () => {
    await init([], {});
    const config = loadConfig();
    expect(config.network).toBe("base-sepolia");
    expect(config.relay).toBe("https://orbitmem-relay.fly.dev");
    expect(config.registryAddress).toBe("0x9eE44938ED77227470CaA2DbCC0459F49d249B7A");
    expect(config.reputationAddress).toBe("0x1Bce77f90C33A5f8faCa54782Ce3a17d1AD7109a");
  });

  test("custom wallet name via --name flag", async () => {
    await init([], { name: "my-agent" });
    const config = loadConfig();
    expect(config.walletName).toBe("my-agent");
  });
});
```

- [ ] **Step 3: Run CLI tests**

Run: `cd /Users/yujiym/GitHub/@oboroxyz/orbitmem && bun test packages/cli`

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/__tests__/config.test.ts packages/cli/src/__tests__/init.test.ts
git commit -m "test(cli): rewrite config and init tests for OWS"
```

---

### Task 11: Full Verification

- [ ] **Step 1: Typecheck all packages**

Run: `cd /Users/yujiym/GitHub/@oboroxyz/orbitmem && bun run typecheck`

Expected: PASS — no type errors across the monorepo.

- [ ] **Step 2: Run all tests**

Run: `cd /Users/yujiym/GitHub/@oboroxyz/orbitmem && bun test`

Expected: All tests PASS.

- [ ] **Step 3: Lint check**

Run: `cd /Users/yujiym/GitHub/@oboroxyz/orbitmem && bun run lint`

Expected: PASS or only pre-existing warnings.

- [ ] **Step 4: Manual smoke test**

Run:
```bash
cd /Users/yujiym/GitHub/@oboroxyz/orbitmem
ORBITMEM_HOME=/tmp/orbitmem-smoke bun run cli init
ORBITMEM_HOME=/tmp/orbitmem-smoke bun run cli status
rm -rf /tmp/orbitmem-smoke
```

Expected: `init` creates wallet via OWS, `status` shows wallet name and address.

- [ ] **Step 5: Final commit (if any lint fixes needed)**

```bash
git add -A
git commit -m "style: fix formatting for OWS integration"
```
