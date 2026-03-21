# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

OrbitMem is a sovereign data layer for AI agents — encrypted P2P vaults, multi-chain identity, and on-chain data trust. It's a Bun monorepo with four packages, one app, and examples:

- `@orbitmem/sdk` — Core SDK with six composable layers (identity, encryption, data, transport, discovery, persistence) plus a client facade
- `@orbitmem/relay` — Hono HTTP server with ERC-8128 auth middleware, vault/discovery/snapshot routes
- `@orbitmem/contracts` — Foundry/Solidity smart contracts implementing ERC-8004 for Data — on-chain data discovery & reputation
- `@orbitmem/cli` — CLI tool (`bun run cli`) — vault management, data discovery, identity, snapshots
- `@orbitmem/web` — React dashboard (Vite + TanStack Router + wagmi + Tailwind) deployed via Cloudflare Workers
- `examples/memo` — Example app demonstrating OrbitMem usage

## Commands

```bash
bun install              # Install dependencies
bun test                 # Run all tests across all packages
bun run lint             # Lint check (Vite+ / Oxlint)
bun run lint:fix         # Lint autofix + format write (Vite+)
bun run format           # Format write (Vite+ / Oxfmt)
bun run format:check     # Format check without writing
bun run typecheck        # Typecheck all packages (tsc --noEmit)
bun run build            # Build all packages
bun run dev              # Start relay + web concurrently
bun run dev:relay        # Start relay server with hot reload
bun run dev:web          # Start web dashboard with hot reload
```

Run a single test file:
```bash
bun test packages/sdk/src/encryption/__tests__/aes.test.ts
```

Run tests for one package:
```bash
bun test --filter @orbitmem/sdk
```

### Contracts Commands

```bash
cd packages/contracts
forge build              # Compile contracts
forge test -vvv          # Run all contract tests (verbose)
forge test --gas-report  # Run tests with gas reporting
forge fmt                # Format Solidity files
forge fmt --check        # Check Solidity formatting
OWNER=<SAFE_ADDRESS> forge script script/Deploy.s.sol --broadcast --rpc-url <RPC_URL> --private-key <KEY>  # Deploy
```

### Deployed Contracts (Base Sepolia)

| Contract | Address |
|----------|---------|
| DataRegistry | `0x9eE44938ED77227470CaA2DbCC0459F49d249B7A` |
| FeedbackRegistry | `0x1Bce77f90C33A5f8faCa54782Ce3a17d1AD7109a` |

### CLI Commands

```bash
bun run cli init              # Initialize OrbitMem (generate keys, create config)
bun run cli status            # Show identity, config, and vault info
bun run cli vault store <p> <v>  # Store data in vault
bun run cli vault get <path>  # Read data from vault
bun run cli vault ls          # List vault keys
bun run cli register          # Register data on-chain (ERC-8004)
bun run cli discover          # Search data sources by schema/tags/quality
bun run cli snapshot          # Archive vault to Filecoin via Storacha
bun run cli dev               # Start local relay server
bun run cli --help            # Show all commands
```

## Architecture

### SDK Layer Structure (`packages/sdk/src/`)

The SDK is composed of six independent layers, each created by a factory function and wired together in `client.ts` via `createOrbitMem()`:

| Layer | Factory | Key Files |
|-------|---------|-----------|
| Identity | `createIdentityLayer` | `identity/identity-layer.ts`, `identity/session.ts` |
| Encryption | `createEncryptionLayer` | `encryption/encryption-layer.ts`, `encryption/aes.ts`, `encryption/lit.ts` |
| Data | `createOrbitDBInstance` + `createVault` | `data/orbitdb.ts`, `data/vault.ts` |
| Transport | `createTransportLayer` | `transport/transport-layer.ts` |
| Discovery | `createDiscoveryLayer` | `discovery/discovery-layer.ts`, `discovery/on-chain-registry.ts`, `discovery/mock-registry.ts` |
| Persistence | `createPersistenceLayer` | `persistence/persistence-layer.ts` |
| Client | `createOrbitMemClient` | `agent/client.ts` |

All layers implement `I*` interfaces defined in `types.ts`.

### Relay Structure (`packages/relay/src/`)

- `app.ts` — Hono app setup with CORS/logger, mounts route groups under `/v1`
- `index.ts` — Server entry point
- `middleware/erc8128.ts` — ERC-8128 signed request verification (extracts `X-OrbitMem-*` headers, checks timestamp ±30s, nonce replay)
- `routes/` — `health.ts`, `vault.ts`, `data.ts`, `snapshots.ts`
- `services/` — Service layer with interface-driven live/mock pairs:
  - `types.ts` — Service interfaces (`IVaultService`, `ISnapshotService`, `IDiscoveryService`, `IPlanService`, `RelayServices`)
  - `live-vault.ts` / `mock-vault.ts` — Vault read/write/sync/seed operations
  - `live-discovery.ts` / `mock-discovery.ts` — Data search, scoring, and stats
  - `live-snapshot.ts` / `mock-snapshot.ts` — Snapshot archival and listing
  - `plan.ts` — `PlanService` — tiered storage quotas (free/starter/pro/enterprise)
  - `orbitdb-peer.ts` — OrbitDB peer service for relay
  - `index.ts` — Barrel export

### Web App Structure (`apps/web/`)

- React + Vite + TanStack Router + Tailwind CSS
- `app/routes/` — file-based routing: landing (`/`), dashboard (`/dashboard`), explore (`/explore`, `/explore/$dataId`, `/explore/snapshots`)
- `app/components/` — ConnectButton, DataTable, FeedbackForm, Layout, ScoreBadge, ScoreCard, SearchBar, TrustGraph
- wagmi + viem for wallet connection and on-chain interactions
- Deployed via Cloudflare Workers (wrangler)

### Contracts Structure (`packages/contracts/`)

Two Solidity 0.8.28 contracts implementing ERC-8004 for Data — on-chain data discovery & reputation:

| Contract | Token | Purpose |
|----------|-------|---------|
| `DataRegistry` | ERC-721 "OMD" | Data/memory entry NFTs with active/inactive toggle |
| `FeedbackRegistry` | (no token) | Registry-agnostic reputation ledger — works against any ERC-721 registry |

`FeedbackRegistry` is the most complex: it accepts any ERC-721 registry address as a parameter, enabling it to score data entries across registries. Scores are tracked globally and per-tag (e.g. `"accurate"`, `"fresh"`), with `feedbackURI` + `feedbackHash` fields for anchoring off-chain data on-chain.

- `abi/` — TypeScript ABI exports generated by `scripts/generate-abi.sh` after `forge build`; consumed by SDK via `@orbitmem/contracts` workspace dependency
- `script/Deploy.s.sol` — Foundry deploy script for both contracts
- Tests in `test/*.t.sol` using `forge-std/Test.sol` with `vm.prank()` and `makeAddr()` cheatcodes
- Dependencies: OpenZeppelin Contracts v5 (ERC721URIStorage), forge-std

### CLI Structure (`packages/cli/src/`)

- `index.ts` — Entry point, argv parser, command router
- `config.ts` — Load/save `~/.orbitmem/` config and key files
- `commands/` — One file per command (init, vault, status, register, discover, snapshot, dev)
- `utils/output.ts` — Table/JSON output formatting
- `utils/client.ts` — Shared `createOrbitMem()` bootstrap

### ERC-8128 Transport Auth

Signed HTTP requests use headers: `X-OrbitMem-Signer`, `-Family`, `-Algorithm`, `-Timestamp`, `-Nonce`, `-Signature`. The signed payload format is `METHOD\nURL\ntimestamp\nnonce\nSHA256(body_hex)`.

### Key Patterns

- **Factory functions over classes** — layers are created by factory functions, not class constructors (except `AESEngine`, `LitEngine`, `MockRegistry`, `OnChainRegistry` for discovery)
- **Dual-mode discovery** — `createDiscoveryLayer` auto-selects `OnChainRegistry` (viem `PublicClient`/`WalletClient` provided) or `MockRegistry` (fallback); both implement `IDiscoveryLayer`
- **Contracts → SDK bridge** — `@orbitmem/contracts` exports TypeScript ABIs (`abi/`) consumed by the SDK's `OnChainRegistry` via workspace dependency
- **Mock-first development** — external dependencies (Storacha, Lit Protocol, on-chain registries) have in-memory mocks for testing; persistence has a `mock: true` flag
- **Interface-driven relay services** — relay uses `IVaultService`/`ISnapshotService`/`IDiscoveryService`/`IPlanService` interfaces with live/mock implementations, wired via `RelayServices`
- **Lazy imports** — Lit Protocol uses dynamic `import()` for heavy dependencies
- **Dual-database vault** — each vault has a primary `nested` OrbitDB for data and a `-meta` OrbitDB for visibility/encryption metadata
- **Nonce-based replay protection** — both SDK transport and relay middleware maintain in-memory nonce caches with 5-minute TTL

## Code Conventions

- **TypeScript strict mode** with `noUnusedLocals` and `noUnusedParameters`
- **Vite+** for linting and formatting (Oxlint + Oxfmt): 2-space indent, 100-char line width, organized imports
- **Interface prefix** — all layer interfaces use `I` prefix (e.g., `IDataLayer`, `IEncryptionLayer`)
- **ESM imports** — use `.js` extension in import paths (bundler module resolution)
- **`export type` / `import type`** for type-only imports
- **Test files** live in `src/**/__tests__/*.test.ts` using `bun:test` (`describe`, `test`, `expect`)
- **Integration tests** in relay use Hono's `app.request()` without starting an HTTP server
- **SDK exports** six entry points: `.` (main), `./agent`, `./discovery`, `./transport`, `./contracts`, `./types`
- **Solidity** uses `forge fmt` (4-space indent, 100-char line width), optimizer enabled with 200 runs
- **Contract tests** in `test/*.t.sol` follow Foundry conventions (`test_` prefix, `setUp()`, `vm.expectRevert`)
- **CI** runs 4 parallel jobs: lint (Vite+ / Oxlint + Oxfmt), test (bun test), contracts (forge build/test/fmt --check), typecheck (tsc --noEmit)

## Documentation

- **Design specs** go in `docs/design/`
- **Implementation plans** go in `docs/plans/` (not `docs/superpowers/plans/`)

## Worktrees

Worktree directory: .worktrees/
