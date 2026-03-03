# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

OrbitMem is a sovereign data layer for AI agents — encrypted P2P vaults, multi-chain identity, and bidirectional trust. It's a Bun monorepo with three packages:

- `@orbitmem/sdk` — Core SDK with six composable layers (identity, encryption, data, transport, discovery, persistence) plus an agent adapter
- `@orbitmem/relay` — Hono HTTP server with ERC-8128 auth middleware, vault/discovery/snapshot routes
- `@orbitmem/contracts` — Foundry/Solidity smart contracts implementing on-chain registries for agents, data, and reputation

## Commands

```bash
bun install              # Install dependencies
bun test                 # Run all tests across all packages
bun run lint             # Lint check (biome check .)
bun run lint:fix         # Lint autofix (biome check --write .)
bun run format           # Format (biome format --write .)
bun run typecheck        # Typecheck all packages (tsc --noEmit)
bun run build            # Build all packages
bun run dev:relay        # Start relay server with hot reload
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
forge script script/Deploy.s.sol --broadcast --rpc-url <RPC_URL> --private-key <KEY>  # Deploy
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
| Discovery | `createDiscoveryLayer` | `discovery/discovery-layer.ts`, `discovery/mock-registry.ts` |
| Persistence | `createPersistenceLayer` | `persistence/persistence-layer.ts` |
| Agent Adapter | `createOrbitMemAgentAdapter` | `agent/agent-adapter.ts` |

All layers implement `I*` interfaces defined in `types.ts`.

### Relay Structure (`packages/relay/src/`)

- `app.ts` — Hono app setup with CORS/logger, mounts route groups under `/v1`
- `index.ts` — Server entry point
- `middleware/erc8128.ts` — ERC-8128 signed request verification (extracts `X-OrbitMem-*` headers, checks timestamp ±30s, nonce replay)
- `routes/` — `health.ts`, `vault.ts`, `data.ts`, `snapshots.ts`
- `services/orbitdb-peer.ts` — OrbitDB peer service for relay

### Contracts Structure (`packages/contracts/`)

Three Solidity 0.8.28 contracts implementing the ERC-8004 on-chain registry system:

| Contract | Token | Purpose |
|----------|-------|---------|
| `AgentRegistry` | ERC-721 "OMA" | AI agent identity NFTs with wallet binding and active/inactive toggle |
| `DataRegistry` | ERC-721 "OMD" | Data/memory entry NFTs with active/inactive toggle |
| `FeedbackRegistry` | (no token) | Registry-agnostic reputation ledger — works against any ERC-721 registry |

`FeedbackRegistry` is the most complex: it accepts any ERC-721 registry address as a parameter, enabling the same contract to score both agents and data. Scores are tracked globally and per-tag (e.g. `"accurate"`, `"reliable"`), with `feedbackURI` + `feedbackHash` fields for anchoring off-chain data on-chain.

- `script/Deploy.s.sol` — Foundry deploy script for all three contracts
- Tests in `test/*.t.sol` using `forge-std/Test.sol` with `vm.prank()` and `makeAddr()` cheatcodes
- Dependencies: OpenZeppelin Contracts v5 (ERC721URIStorage), forge-std

### ERC-8128 Transport Auth

Signed HTTP requests use headers: `X-OrbitMem-Signer`, `-Family`, `-Algorithm`, `-Timestamp`, `-Nonce`, `-Signature`. The signed payload format is `METHOD\nURL\ntimestamp\nnonce\nSHA256(body_hex)`.

### Key Patterns

- **Factory functions over classes** — layers are created by factory functions, not class constructors (except `AESEngine`, `LitEngine`, `MockRegistry`)
- **Mock-first development** — external dependencies (Storacha, Lit Protocol, on-chain registries) have in-memory mocks for testing; persistence has a `mock: true` flag
- **Lazy imports** — Lit Protocol uses dynamic `import()` for heavy dependencies
- **Dual-database vault** — each vault has a primary `nested` OrbitDB for data and a `-meta` OrbitDB for visibility/encryption metadata
- **Nonce-based replay protection** — both SDK transport and relay middleware maintain in-memory nonce caches with 5-minute TTL

## Code Conventions

- **TypeScript strict mode** with `noUnusedLocals` and `noUnusedParameters`
- **Biome** for linting and formatting: 2-space indent, 100-char line width, organized imports
- **Interface prefix** — all layer interfaces use `I` prefix (e.g., `IDataLayer`, `IEncryptionLayer`)
- **ESM imports** — use `.js` extension in import paths (bundler module resolution)
- **`export type` / `import type`** for type-only imports
- **Test files** live in `src/**/__tests__/*.test.ts` using `bun:test` (`describe`, `test`, `expect`)
- **Integration tests** in relay use Hono's `app.request()` without starting an HTTP server
- **SDK exports** three entry points: `.` (main), `./agent`, `./types`
