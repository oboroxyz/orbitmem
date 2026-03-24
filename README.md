```
▄████▄ ▄▄▄▄  ▄▄▄▄  ▄▄ ▄▄▄▄▄▄ ██▄  ▄██ ▄▄▄▄▄ ▄▄   ▄▄
██  ██ ██▄█▄ ██▄██ ██   ██   ██ ▀▀ ██ ██▄▄  ██▀▄▀██
▀████▀ ██ ██ ██▄█▀ ██   ██   ██    ██ ██▄▄▄ ██   ██
```

# OrbitMem

Decentralized data layer for agentic web — encrypted vaults, on-chain discovery, and verifiable data trust, designed for both humans and AI agents

## Architecture

```
┌──────────────────────────────────────────────┐
│  @orbitmem/sdk                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Identity  │ │Encryption│ │  Transport   │ │
│  │  Layer    │ │  Layer   │ │ (ERC-8128)   │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │   Data   │ │Discovery │ │ Persistence  │ │
│  │ (OrbitDB)│ │(ERC-8004)│ │ (Storacha)   │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
│  ┌──────────────────────────────────────────┐│
│  │         Client                           ││
│  │  discover → evaluate → fetch → rate      ││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  @orbitmem/relay                             │
│  Hono server · ERC-8128 + MPP middleware     │
│  Vault · Discovery · Snapshots · Plan tiers  │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  @orbitmem/web                               │
│  React dashboard · TanStack Router · wagmi   │
│  Data explorer · Vault manager · Trust graph │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  @orbitmem/contracts                         │
│  DataRegistry (ERC-721) · FeedbackRegistry   │
│  ERC-8004 for Data — on-chain reputation     │
└──────────────────────────────────────────────┘
```

## Quick Start

```bash
# Install dependencies
bun install

# Run tests
bun run test

# Start relay + web
bun run dev

# Or start individually
bun run dev:relay     # Relay server (localhost:3000)
bun run dev:web       # Web (localhost:3001)
```

### CLI

```bash
npx orbitmem init                    # Generate identity, create config
npx orbitmem status                  # Show identity and vault info
npx orbitmem vault store <path> <v>  # Store data in vault
npx orbitmem vault get <path>        # Read data from vault
npx orbitmem vault ls                # List vault keys
npx orbitmem vault price set <p> <a> # Set per-read price (USDC)
npx orbitmem vault price get <path>  # Show current price for path
npx orbitmem vault price ls          # List all priced paths
npx orbitmem vault price rm <path>   # Remove pricing (free access)
npx orbitmem discover --schema dietary  # Search data sources
npx orbitmem --help                  # Show all commands

# Lit Protocol encryption (shared, condition-gated)
npx orbitmem vault store travel/diet vegan --engine lit --allow-address 0xAgentAddr...
npx orbitmem vault store travel/diet vegan --engine lit --allow-address 0xAgentAddr... --lit-network manzano
```

### Contracts

Deployed on **Base, Base Sepolia**:

| Contract | Base | Base Sepolia |
|----------|---------|---------|
| DataRegistry | _TBD_ |  [`0x9eE44938ED77227470CaA2DbCC0459F49d249B7A`](https://sepolia.basescan.org/address/0x9eE44938ED77227470CaA2DbCC0459F49d249B7A) |
| FeedbackRegistry | _TBD_ | [`0x1Bce77f90C33A5f8faCa54782Ce3a17d1AD7109a`](https://sepolia.basescan.org/address/0x1Bce77f90C33A5f8faCa54782Ce3a17d1AD7109a) |

```bash
cd packages/contracts
forge build              # Compile contracts
forge test -vvv          # Run all contract tests
forge fmt                # Format Solidity
```

## SDK Usage

```typescript
import { createOrbitMem } from '@orbitmem/sdk';

const orbit = await createOrbitMem({
  identity: { chains: ['evm'] },
  encryption: { defaultEngine: 'aes' },
  discovery: {
    dataRegistry: '0xDATA_REGISTRY',
    reputationRegistry: '0xFEEDBACK_REGISTRY',
    registryChain: 'base',
  },
});

// Write data to vault
await orbit.vault.put('travel/dietary', { vegan: true }, {
  visibility: 'public',
});

// Read data
const prefs = await orbit.vault.get('travel/dietary');

// Set per-read pricing (MPP pay-per-read)
await orbit.pricing.setPrice('travel/dietary', { amount: '0.005', currency: 'USDC' });
```

## Client

```typescript
import { createOrbitMemClient } from '@orbitmem/sdk/agent';

const client = createOrbitMemClient({ orbit });

// Full lifecycle: discover → evaluate → fetch → decrypt → rate
const datasets = await client.discoverData({ schema: 'orbitmem:dietary:v1' });
const score = await client.evaluateData(datasets[0].dataId);
const data = await client.fetchUserData({
  dataId: datasets[0].dataId,
  userAddress: '0x...',
});
await client.rateData(datasets[0].dataId, 95);
```

## Packages

| Package | Description |
|---------|-------------|
| `@orbitmem/sdk` | Core SDK — identity, encryption, vault, transport, discovery, persistence, client |
| `@orbitmem/relay` | Hono relay server — vault, discovery, snapshots, plan tiers, ERC-8128 auth |
| `@orbitmem/contracts` | Solidity contracts — DataRegistry (ERC-721), FeedbackRegistry (reputation) |
| `@orbitmem/cli` | CLI tool (`npx orbitmem`) — vault management, data discovery, identity, snapshots |
| `@orbitmem/web` | React dashboard — data explorer, vault manager, trust graph, wallet connection |

## Tech Stack

- **Runtime:** Bun
- **Data:** OrbitDB + @orbitdb/nested-db (CRDT P2P)
- **Encryption:** AES-256-GCM (Web Crypto), Lit Protocol
- **Transport:** ERC-8128 signed HTTP requests (ECDSA, Ed25519, P256)
- **Payments:** MPP (Machine Payments Protocol) — per-read vault monetization via HTTP 402
- **Discovery:** ERC-8004 for Data — on-chain data discovery & reputation
- **Persistence:** Storacha (Filecoin/IPFS)
- **Contracts:** Solidity 0.8.28, Foundry, OpenZeppelin v5
- **Relay Server:** Hono (on fly.io)
- **Web:** React 19, TanStack Router, Tailwind CSS v4, wagmi + viem (on cloudflare worker)
- **Identity:** EVM, Solana multi-chain

## License

[MIT](LICENSE)
