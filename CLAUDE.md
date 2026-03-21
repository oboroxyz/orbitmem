# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

OrbitMem is a sovereign data layer for AI agents — encrypted P2P vaults, multi-chain identity, and on-chain data trust. It's a Bun monorepo with four packages, one app, and examples:

- `@orbitmem/sdk` — Core SDK with six composable layers (identity, encryption, data, transport, discovery, persistence) plus a client facade
- `@orbitmem/relay` — Hono HTTP server with ERC-8128 auth + session token middleware, vault/discovery/snapshot routes
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

