# OrbitMem CLI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create `packages/cli/` enabling `npx orbitmem <command>` for vault management, on-chain registration, discovery, persistence, and local dev.

**Architecture:** Thin CLI wrapper over `@orbitmem/sdk`. Plain `process.argv` parsing (no framework deps). Config stored in `~/.orbitmem/`. Each command is a separate file with shared config/client utilities.

**Tech Stack:** TypeScript, bun, viem (key generation), @orbitmem/sdk, @orbitmem/relay

---

### Task 1: Package Scaffold

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Modify: `package.json` (root — add `bin` field)

**Step 1: Create `packages/cli/package.json`**

```json
{
  "name": "@orbitmem/cli",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "bin": {
    "orbitmem": "./src/index.ts"
  },
  "scripts": {
    "build": "bun build ./src/index.ts --outdir ./dist --target node",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@orbitmem/sdk": "workspace:*",
    "@orbitmem/relay": "workspace:*",
    "viem": "^2.0.0"
  },
  "devDependencies": {
    "bun-types": "latest",
    "typescript": "^5.5.0"
  }
}
```

**Step 2: Create `packages/cli/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Add `bin` to root `package.json`**

Add to root `package.json`:
```json
"bin": {
  "orbitmem": "./packages/cli/src/index.ts"
}
```

**Step 4: Run `bun install` to link workspace**

Run: `bun install`
Expected: No errors, workspace linked

**Step 5: Commit**

```bash
git add packages/cli/package.json packages/cli/tsconfig.json package.json bun.lock
git commit -m "feat(cli): scaffold CLI package with workspace deps"
```

---

### Task 2: Config Module

**Files:**
- Create: `packages/cli/src/config.ts`
- Create: `packages/cli/src/__tests__/config.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/cli/src/__tests__/config.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { loadConfig, saveConfig, loadKey, saveKey, CONFIG_DIR } from "../config.js";

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
    const config = { relay: "http://localhost:3000", chain: "base" as const };
    saveConfig(config);
    const loaded = loadConfig();
    expect(loaded.relay).toBe("http://localhost:3000");
    expect(loaded.chain).toBe("base");
  });

  test("loadConfig returns defaults when no file exists", () => {
    const config = loadConfig();
    expect(config.relay).toBe("https://relay.orbitmem.xyz");
    expect(config.chain).toBe("base");
  });

  test("saveKey and loadKey roundtrip", () => {
    saveKey("0xabc123");
    const key = loadKey();
    expect(key).toBe("0xabc123");
  });

  test("loadKey throws when no key exists", () => {
    expect(() => loadKey()).toThrow("No key found");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/cli/src/__tests__/config.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

```typescript
// packages/cli/src/config.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface CliConfig {
  relay: string;
  chain: string;
  registryAddress?: string;
  reputationAddress?: string;
}

const DEFAULT_CONFIG: CliConfig = {
  relay: "https://relay.orbitmem.xyz",
  chain: "base",
};

export function getConfigDir(): string {
  return process.env.ORBITMEM_HOME ?? join(homedir(), ".orbitmem");
}

export const CONFIG_DIR = getConfigDir();

function ensureDir(): void {
  const dir = getConfigDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function loadConfig(): CliConfig {
  const configPath = join(getConfigDir(), "config.json");
  if (!existsSync(configPath)) return { ...DEFAULT_CONFIG };
  const raw = readFileSync(configPath, "utf-8");
  return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
}

export function saveConfig(config: Partial<CliConfig>): void {
  ensureDir();
  const configPath = join(getConfigDir(), "config.json");
  const existing = loadConfig();
  const merged = { ...existing, ...config };
  writeFileSync(configPath, JSON.stringify(merged, null, 2) + "\n");
}

export function loadKey(): string {
  const keyPath = join(getConfigDir(), "key.json");
  if (!existsSync(keyPath)) {
    throw new Error("No key found. Run `orbitmem init` first.");
  }
  const raw = JSON.parse(readFileSync(keyPath, "utf-8"));
  return raw.privateKey;
}

export function saveKey(privateKey: string): void {
  ensureDir();
  const keyPath = join(getConfigDir(), "key.json");
  writeFileSync(keyPath, JSON.stringify({ privateKey }, null, 2) + "\n");
}
```

**Step 4: Run test to verify it passes**

Run: `bun test packages/cli/src/__tests__/config.test.ts`
Expected: PASS (all 4 tests)

**Step 5: Commit**

```bash
git add packages/cli/src/config.ts packages/cli/src/__tests__/config.test.ts
git commit -m "feat(cli): add config module with load/save for config and keys"
```

---

### Task 3: Output Utility

**Files:**
- Create: `packages/cli/src/utils/output.ts`

**Step 1: Write implementation**

```typescript
// packages/cli/src/utils/output.ts
export function output(data: unknown, json: boolean): void {
  if (json) {
    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
  } else if (typeof data === "string") {
    process.stdout.write(data + "\n");
  } else if (Array.isArray(data)) {
    printTable(data);
  } else if (typeof data === "object" && data !== null) {
    for (const [key, value] of Object.entries(data)) {
      process.stdout.write(`${key}: ${value}\n`);
    }
  }
}

function printTable(rows: Record<string, unknown>[]): void {
  if (rows.length === 0) {
    process.stdout.write("(empty)\n");
    return;
  }
  const keys = Object.keys(rows[0]);
  const widths = keys.map((k) =>
    Math.max(k.length, ...rows.map((r) => String(r[k] ?? "").length)),
  );
  const header = keys.map((k, i) => k.padEnd(widths[i])).join("  ");
  const sep = widths.map((w) => "─".repeat(w)).join("──");
  process.stdout.write(`${header}\n${sep}\n`);
  for (const row of rows) {
    const line = keys.map((k, i) => String(row[k] ?? "").padEnd(widths[i])).join("  ");
    process.stdout.write(`${line}\n`);
  }
}

export function error(msg: string): never {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(1);
}
```

**Step 2: Commit**

```bash
git add packages/cli/src/utils/output.ts
git commit -m "feat(cli): add output utility with table and JSON formatting"
```

---

### Task 4: Init Command

**Files:**
- Create: `packages/cli/src/commands/init.ts`
- Create: `packages/cli/src/__tests__/init.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/cli/src/__tests__/init.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { init } from "../commands/init.js";
import { loadConfig, loadKey } from "../config.js";

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

  test("creates config and key files", async () => {
    await init([], {});
    expect(existsSync(join(TEST_DIR, "config.json"))).toBe(true);
    expect(existsSync(join(TEST_DIR, "key.json"))).toBe(true);
  });

  test("generated key is a valid hex private key", async () => {
    await init([], {});
    const key = loadKey();
    expect(key).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("config has default relay", async () => {
    await init([], {});
    const config = loadConfig();
    expect(config.relay).toBe("https://relay.orbitmem.xyz");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/cli/src/__tests__/init.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

```typescript
// packages/cli/src/commands/init.ts
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getConfigDir, loadConfig, saveConfig, saveKey } from "../config.js";
import { output } from "../utils/output.js";

export async function init(args: string[], flags: Record<string, string>): Promise<void> {
  const configDir = getConfigDir();
  const keyPath = join(configDir, "key.json");

  if (existsSync(keyPath) && !flags.force) {
    process.stderr.write(
      `Already initialized at ${configDir}. Use --force to reinitialize.\n`,
    );
    process.exit(1);
  }

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  saveKey(privateKey);
  saveConfig({
    relay: flags.relay ?? "https://relay.orbitmem.xyz",
    chain: flags.chain ?? "base",
  });

  const info = {
    address: account.address,
    configDir,
    relay: loadConfig().relay,
    chain: loadConfig().chain,
  };

  if (flags.json !== undefined) {
    output(info, true);
  } else {
    process.stdout.write(`\nOrbitMem initialized!\n\n`);
    process.stdout.write(`  Address:  ${info.address}\n`);
    process.stdout.write(`  Config:   ${info.configDir}\n`);
    process.stdout.write(`  Relay:    ${info.relay}\n`);
    process.stdout.write(`  Chain:    ${info.chain}\n\n`);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test packages/cli/src/__tests__/init.test.ts`
Expected: PASS (all 3 tests)

**Step 5: Commit**

```bash
git add packages/cli/src/commands/init.ts packages/cli/src/__tests__/init.test.ts
git commit -m "feat(cli): add init command with key generation"
```

---

### Task 5: Status Command

**Files:**
- Create: `packages/cli/src/commands/status.ts`

**Step 1: Write implementation**

```typescript
// packages/cli/src/commands/status.ts
import { privateKeyToAccount } from "viem/accounts";
import { getConfigDir, loadConfig, loadKey } from "../config.js";
import { output, error } from "../utils/output.js";

export async function status(_args: string[], flags: Record<string, string>): Promise<void> {
  let key: string;
  try {
    key = loadKey();
  } catch {
    error("Not initialized. Run `orbitmem init` first.");
  }

  const config = loadConfig();
  const account = privateKeyToAccount(key as `0x${string}`);

  const info = {
    address: account.address,
    configDir: getConfigDir(),
    relay: flags.relay ?? config.relay,
    chain: flags.chain ?? config.chain,
    registryAddress: config.registryAddress ?? "(not set)",
    reputationAddress: config.reputationAddress ?? "(not set)",
  };

  output(info, flags.json !== undefined);
}
```

**Step 2: Commit**

```bash
git add packages/cli/src/commands/status.ts
git commit -m "feat(cli): add status command"
```

---

### Task 6: Entry Point & Router

**Files:**
- Create: `packages/cli/src/index.ts`

**Step 1: Write implementation**

```typescript
#!/usr/bin/env bun
// packages/cli/src/index.ts

function parseArgs(argv: string[]): { command: string; args: string[]; flags: Record<string, string> } {
  const raw = argv.slice(2);
  const flags: Record<string, string> = {};
  const positional: string[] = [];

  for (let i = 0; i < raw.length; i++) {
    if (raw[i].startsWith("--")) {
      const key = raw[i].slice(2);
      const next = raw[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = "";
      }
    } else {
      positional.push(raw[i]);
    }
  }

  return {
    command: positional[0] ?? "help",
    args: positional.slice(1),
    flags,
  };
}

function printUsage(): void {
  process.stdout.write(`
Usage: orbitmem <command> [options]

Commands:
  init                       Generate keys and create config
  status                     Show identity, config, and vault info
  vault store <path> <value> Store data in vault
  vault get <path>           Read data from vault
  vault ls [prefix]          List vault keys
  register <path>            Register data on-chain (ERC-8004)
  discover [query]           Search on-chain registries
  snapshot                   Persist vault to Storacha
  dev                        Start local relay server

Options:
  --relay <url>     Override relay URL
  --chain <name>    Override chain
  --json            Output as JSON
  --help            Show this help

`);
}

async function main(): Promise<void> {
  const { command, args, flags } = parseArgs(process.argv);

  if (flags.help !== undefined || command === "help") {
    printUsage();
    return;
  }

  switch (command) {
    case "init": {
      const { init } = await import("./commands/init.js");
      await init(args, flags);
      break;
    }
    case "status": {
      const { status } = await import("./commands/status.js");
      await status(args, flags);
      break;
    }
    case "vault": {
      const { vault } = await import("./commands/vault.js");
      await vault(args, flags);
      break;
    }
    case "register": {
      const { register } = await import("./commands/register.js");
      await register(args, flags);
      break;
    }
    case "discover": {
      const { discover } = await import("./commands/discover.js");
      await discover(args, flags);
      break;
    }
    case "snapshot": {
      const { snapshot } = await import("./commands/snapshot.js");
      await snapshot(args, flags);
      break;
    }
    case "dev": {
      const { dev } = await import("./commands/dev.js");
      await dev(args, flags);
      break;
    }
    default:
      process.stderr.write(`Unknown command: ${command}\n`);
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`error: ${err.message}\n`);
  process.exit(1);
});
```

**Step 2: Test the entry point**

Run: `bun packages/cli/src/index.ts --help`
Expected: Prints usage info

Run: `bun packages/cli/src/index.ts init --json`
Expected: Creates `~/.orbitmem/` and prints JSON with address

**Step 3: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "feat(cli): add entry point with command router"
```

---

### Task 7: Vault Command (store/get/ls)

**Files:**
- Create: `packages/cli/src/commands/vault.ts`
- Create: `packages/cli/src/utils/client.ts`

**Step 1: Write client utility**

```typescript
// packages/cli/src/utils/client.ts
import { createOrbitMem } from "@orbitmem/sdk";
import type { CliConfig } from "../config.js";

export async function createClient(config: CliConfig, privateKey: string) {
  const client = await createOrbitMem({
    identity: { family: "evm", privateKey },
    vault: { dbName: "orbitmem-cli" },
    encryption: { defaultEngine: "aes", aes: { kdf: "hkdf-sha256" } },
    persistence: {
      relayUrl: config.relay,
    },
    discovery: config.registryAddress
      ? {
          dataRegistry: config.registryAddress as `0x${string}`,
          reputationRegistry: (config.reputationAddress ?? "0x0") as `0x${string}`,
          registryChain: config.chain as "base",
        }
      : undefined,
  });

  // Auto-connect with the private key
  await client.connect({ method: "evm" });

  return client;
}
```

**Step 2: Write vault command**

```typescript
// packages/cli/src/commands/vault.ts
import { loadConfig, loadKey } from "../config.js";
import { createClient } from "../utils/client.js";
import { output, error } from "../utils/output.js";
import type { Visibility } from "@orbitmem/sdk";

export async function vault(args: string[], flags: Record<string, string>): Promise<void> {
  const sub = args[0];
  switch (sub) {
    case "store":
      return vaultStore(args.slice(1), flags);
    case "get":
      return vaultGet(args.slice(1), flags);
    case "ls":
      return vaultLs(args.slice(1), flags);
    default:
      error(`Unknown vault command: ${sub}. Use: store, get, ls`);
  }
}

async function vaultStore(args: string[], flags: Record<string, string>): Promise<void> {
  const [path, ...valueParts] = args;
  const value = valueParts.join(" ");
  if (!path || !value) error("Usage: orbitmem vault store <path> <value>");

  const config = loadConfig();
  if (flags.relay) config.relay = flags.relay;
  const client = await createClient(config, loadKey());

  try {
    const visibility: Visibility = flags.public !== undefined ? "public" : "private";
    const entry = await client.vault.put(path, value, { visibility });
    const result = {
      path,
      visibility,
      encrypted: entry.encrypted,
      timestamp: entry.timestamp,
    };
    if (flags.json !== undefined) {
      output(result, true);
    } else {
      process.stdout.write(`Stored "${path}" (${visibility})\n`);
    }
  } finally {
    await client.destroy();
  }
}

async function vaultGet(args: string[], flags: Record<string, string>): Promise<void> {
  const [path] = args;
  if (!path) error("Usage: orbitmem vault get <path>");

  const config = loadConfig();
  if (flags.relay) config.relay = flags.relay;
  const client = await createClient(config, loadKey());

  try {
    const entry = await client.vault.get(path);
    if (!entry) error(`Not found: ${path}`);
    output(flags.json !== undefined ? entry : entry.value, flags.json !== undefined);
  } finally {
    await client.destroy();
  }
}

async function vaultLs(args: string[], flags: Record<string, string>): Promise<void> {
  const [prefix] = args;

  const config = loadConfig();
  if (flags.relay) config.relay = flags.relay;
  const client = await createClient(config, loadKey());

  try {
    const keys = await client.vault.keys(prefix);
    if (flags.json !== undefined) {
      output(keys, true);
    } else if (keys.length === 0) {
      process.stdout.write("(no entries)\n");
    } else {
      for (const key of keys) {
        process.stdout.write(`${key}\n`);
      }
    }
  } finally {
    await client.destroy();
  }
}
```

**Step 3: Commit**

```bash
git add packages/cli/src/commands/vault.ts packages/cli/src/utils/client.ts
git commit -m "feat(cli): add vault command with store/get/ls subcommands"
```

---

### Task 8: Register, Discover, Snapshot Commands

**Files:**
- Create: `packages/cli/src/commands/register.ts`
- Create: `packages/cli/src/commands/discover.ts`
- Create: `packages/cli/src/commands/snapshot.ts`

**Step 1: Write register command**

```typescript
// packages/cli/src/commands/register.ts
import { loadConfig, loadKey } from "../config.js";
import { createClient } from "../utils/client.js";
import { output, error } from "../utils/output.js";

export async function register(args: string[], flags: Record<string, string>): Promise<void> {
  const [path] = args;
  if (!path) error("Usage: orbitmem register <path>");

  const config = loadConfig();
  if (flags.relay) config.relay = flags.relay;
  if (!config.registryAddress) error("No registry address configured. Set registryAddress in ~/.orbitmem/config.json");

  const client = await createClient(config, loadKey());

  try {
    const entry = await client.vault.get(path);
    if (!entry) error(`Vault entry not found: ${path}`);

    const result = await client.discovery.registerData({
      vaultKey: path,
      name: flags.name ?? path,
      description: flags.description ?? "",
      schema: flags.schema,
      tags: flags.tags ? flags.tags.split(",") : [],
    });

    if (flags.json !== undefined) {
      output(result, true);
    } else {
      process.stdout.write(`Registered "${path}" on-chain\n`);
      process.stdout.write(`  Data ID: ${result.dataId}\n`);
    }
  } finally {
    await client.destroy();
  }
}
```

**Step 2: Write discover command**

```typescript
// packages/cli/src/commands/discover.ts
import { loadConfig, loadKey } from "../config.js";
import { createClient } from "../utils/client.js";
import { output, error } from "../utils/output.js";

export async function discover(args: string[], flags: Record<string, string>): Promise<void> {
  const config = loadConfig();
  if (flags.relay) config.relay = flags.relay;
  if (!config.registryAddress) error("No registry address configured. Set registryAddress in ~/.orbitmem/config.json");

  const client = await createClient(config, loadKey());

  try {
    const query: Record<string, unknown> = {};
    if (args[0]) query.schema = args[0];
    if (flags.tags) query.tags = flags.tags.split(",");
    if (flags["min-quality"]) query.minQuality = Number(flags["min-quality"]);

    const results = await client.discovery.findData(query);

    if (flags.json !== undefined) {
      output(results, true);
    } else if (results.length === 0) {
      process.stdout.write("No data found\n");
    } else {
      const rows = results.map((r: any) => ({
        id: r.dataId,
        name: r.name,
        quality: r.quality,
        vault: r.vaultAddress?.slice(0, 10) + "...",
      }));
      output(rows, false);
    }
  } finally {
    await client.destroy();
  }
}
```

**Step 3: Write snapshot command**

```typescript
// packages/cli/src/commands/snapshot.ts
import { loadConfig, loadKey } from "../config.js";
import { createClient } from "../utils/client.js";
import { output, error } from "../utils/output.js";

export async function snapshot(args: string[], flags: Record<string, string>): Promise<void> {
  const config = loadConfig();
  if (flags.relay) config.relay = flags.relay;
  const client = await createClient(config, loadKey());

  try {
    const snap = await client.vault.exportSnapshot();
    const result = await client.persistence.archive({
      data: snap.data,
      entryCount: snap.entryCount,
      label: flags.label,
    });

    if (flags.json !== undefined) {
      output(result, true);
    } else {
      process.stdout.write(`Snapshot archived!\n`);
      process.stdout.write(`  CID:     ${result.cid}\n`);
      process.stdout.write(`  Size:    ${result.size} bytes\n`);
      process.stdout.write(`  Entries: ${result.entryCount}\n`);
    }
  } finally {
    await client.destroy();
  }
}
```

**Step 4: Commit**

```bash
git add packages/cli/src/commands/register.ts packages/cli/src/commands/discover.ts packages/cli/src/commands/snapshot.ts
git commit -m "feat(cli): add register, discover, and snapshot commands"
```

---

### Task 9: Dev Command

**Files:**
- Create: `packages/cli/src/commands/dev.ts`

**Step 1: Write implementation**

```typescript
// packages/cli/src/commands/dev.ts
export async function dev(_args: string[], flags: Record<string, string>): Promise<void> {
  const port = flags.port ? Number(flags.port) : 3000;

  process.stdout.write(`Starting OrbitMem relay on http://localhost:${port}...\n`);

  // Dynamic import to avoid loading relay deps unless needed
  const { buildApp, createServices } = await import("@orbitmem/relay");
  const services = await createServices();
  const app = buildApp(services);

  const server = Bun.serve({
    port,
    fetch: app.fetch,
  });

  process.stdout.write(`Relay running at http://localhost:${server.port}\n`);
  process.stdout.write(`Press Ctrl+C to stop\n\n`);

  // Keep alive until SIGINT
  process.on("SIGINT", () => {
    process.stdout.write("\nShutting down...\n");
    server.stop();
    process.exit(0);
  });
}
```

**Note:** This task depends on `@orbitmem/relay` exporting `buildApp` and `createServices`. If the relay doesn't export these, adapt the import to match actual exports (check `packages/relay/src/index.ts`).

**Step 2: Commit**

```bash
git add packages/cli/src/commands/dev.ts
git commit -m "feat(cli): add dev command to start local relay"
```

---

### Task 10: Integration Test & Smoke Test

**Files:**
- Create: `packages/cli/src/__tests__/cli.test.ts`

**Step 1: Write integration test**

```typescript
// packages/cli/src/__tests__/cli.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { $ } from "bun";

const TEST_DIR = join(import.meta.dir, ".test-orbitmem-cli");
const CLI = join(import.meta.dir, "..", "index.ts");

describe("CLI integration", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test("--help prints usage", async () => {
    const result = await $`ORBITMEM_HOME=${TEST_DIR} bun ${CLI} --help`.text();
    expect(result).toContain("Usage: orbitmem");
    expect(result).toContain("init");
    expect(result).toContain("vault");
  });

  test("init --json creates config and returns address", async () => {
    const result = await $`ORBITMEM_HOME=${TEST_DIR} bun ${CLI} init --json`.json();
    expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(result.relay).toBe("https://relay.orbitmem.xyz");
  });

  test("status --json after init shows config", async () => {
    await $`ORBITMEM_HOME=${TEST_DIR} bun ${CLI} init --json`.quiet();
    const result = await $`ORBITMEM_HOME=${TEST_DIR} bun ${CLI} status --json`.json();
    expect(result.address).toMatch(/^0x/);
    expect(result.chain).toBe("base");
  });

  test("unknown command exits with error", async () => {
    const proc = Bun.spawn(["bun", CLI, "nonexistent"], {
      env: { ...process.env, ORBITMEM_HOME: TEST_DIR },
      stderr: "pipe",
    });
    const code = await proc.exited;
    expect(code).not.toBe(0);
  });
});
```

**Step 2: Run all tests**

Run: `bun test packages/cli/`
Expected: All tests pass

**Step 3: Run lint and typecheck**

Run: `bun run lint:fix && bun run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/cli/src/__tests__/cli.test.ts
git commit -m "test(cli): add integration tests for CLI commands"
```

---

### Task 11: Update CLAUDE.md & Scripts

**Files:**
- Modify: `CLAUDE.md` — add CLI package to docs
- Modify: `package.json` (root) — add `dev:cli` script

**Step 1: Add CLI section to CLAUDE.md**

Add under the Architecture section:
```markdown
### CLI Structure (`packages/cli/src/`)

- `index.ts` — Entry point, argv parser, command router
- `config.ts` — Load/save `~/.orbitmem/` config and key files
- `commands/` — One file per command (init, vault, status, register, discover, snapshot, dev)
- `utils/output.ts` — Table/JSON output formatting
- `utils/client.ts` — Shared `createOrbitMem()` bootstrap
```

**Step 2: Add script to root package.json**

Add to scripts:
```json
"cli": "bun packages/cli/src/index.ts"
```

**Step 3: Commit**

```bash
git add CLAUDE.md package.json
git commit -m "docs: add CLI package to CLAUDE.md and root scripts"
```
