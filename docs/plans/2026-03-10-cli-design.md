# OrbitMem CLI Design

## Overview

A CLI package (`@orbitmem/cli`) enabling `npx orbitmem <command>` for both users and agent developers. Unified CLI with vault management, on-chain registration, discovery, persistence, and a local dev relay.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Package location | `packages/cli/` as `@orbitmem/cli` | Consistent with monorepo structure |
| Bin entry | Root `package.json` gets `"bin"` field | Enables `npx orbitmem` via the `orbitmem` package name |
| CLI framework | Plain `process.argv` parsing | No heavy deps, fast `npx` startup |
| Identity | Generated EVM private key in `~/.orbitmem/key.json` | Simplest MVP path |
| Config location | `~/.orbitmem/` | Standard dotfile convention |
| Default relay | `https://relay.orbitmem.xyz` | Hosted default, `orbitmem dev` for local |

## Config Structure

```
~/.orbitmem/
├── config.json    # relay URL, chain config, defaults
├── key.json       # generated EVM private key
└── vault/         # local OrbitDB data directory
```

### config.json

```json
{
  "relay": "https://relay.orbitmem.xyz",
  "chain": "base",
  "registryAddress": "0x...",
  "reputationAddress": "0x..."
}
```

## Commands

### User Commands

| Command | Description |
|---------|-------------|
| `orbitmem init` | Generate keys, create `~/.orbitmem/config.json` |
| `orbitmem vault store <path> <value>` | Store data (encrypted by default, `--public` for plaintext) |
| `orbitmem vault get <path>` | Read data from vault |
| `orbitmem vault ls [prefix]` | List vault keys |
| `orbitmem register <path>` | Mint ERC-8004 NFT pointing to vault data |
| `orbitmem snapshot` | Persist vault to Storacha, print CID |
| `orbitmem status` | Show address, relay URL, vault info, chain config |

### Agent Commands

| Command | Description |
|---------|-------------|
| `orbitmem discover [query]` | Search on-chain registries for data |

### Dev Commands

| Command | Description |
|---------|-------------|
| `orbitmem dev` | Start local `@orbitmem/relay` on `localhost:3000` |

### Shared Flags

| Flag | Description |
|------|-------------|
| `--relay <url>` | Override relay URL |
| `--chain <name>` | Override chain |
| `--json` | Machine-readable JSON output |

## Data Flow

### `orbitmem init`
1. Generate random EVM private key via `viem/accounts`
2. Save to `~/.orbitmem/key.json`
3. Create `~/.orbitmem/config.json` with defaults
4. Print address and config summary

### `orbitmem vault store <path> <value>`
1. Load key from config
2. Call `createOrbitMem()` → `vault.put(path, value)`
3. Default: private visibility (AES encrypted)
4. `--public`: plaintext, discoverable by agents
5. Sync to relay via transport layer

### `orbitmem vault get <path>` / `vault ls [prefix]`
1. Read from local vault
2. Fallback: fetch from relay if not available locally

### `orbitmem register <path>`
1. Call discovery layer → mint ERC-8004 NFT
2. Requires on-chain config (registry address, RPC URL in config)

### `orbitmem discover [query]`
1. Query on-chain registries via discovery layer
2. Print results as table (or JSON with `--json`)

### `orbitmem snapshot`
1. Call persistence layer → upload encrypted vault to Storacha
2. Print CID

### `orbitmem dev`
1. Import and spawn `@orbitmem/relay` server
2. Bind to `localhost:3000`
3. Override relay URL to localhost for the session

## Package Structure

```
packages/cli/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts          # bin entry, argv router
    ├── config.ts         # load/save ~/.orbitmem config
    ├── commands/
    │   ├── init.ts
    │   ├── vault.ts      # store, get, ls subcommands
    │   ├── register.ts
    │   ├── discover.ts
    │   ├── snapshot.ts
    │   ├── dev.ts
    │   └── status.ts
    └── utils/
        ├── output.ts     # table/json formatting
        └── client.ts     # shared createOrbitMem() bootstrap
```
