# OrbitMem

Sovereign data layer for AI agents — encrypted P2P vaults, multi-chain identity, and on-chain data trust.

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
│  │         Agent Adapter                    ││
│  │  discover → evaluate → fetch → rate      ││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  @orbitmem/relay                             │
│  Hono server · ERC-8128 middleware           │
│  Vault routes · Discovery routes · Snapshots │
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

### Contract commands

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
```

## Agent Adapter

```typescript
import { createOrbitMemAgentAdapter } from '@orbitmem/sdk/agent';

const agent = createOrbitMemAgentAdapter({ orbit });

// Full lifecycle: discover → evaluate → fetch → decrypt → rate
const datasets = await agent.discoverData({ schema: 'orbitmem:dietary:v1' });
const score = await agent.evaluateData(datasets[0].dataId);
const data = await agent.fetchUserData({
  dataId: datasets[0].dataId,
  userAddress: '0x...',
});
await agent.rateData(datasets[0].dataId, 95);
```

## Packages

| Package | Description |
|---------|-------------|
| `@orbitmem/sdk` | Core SDK — identity, encryption, vault, transport, discovery, persistence, agent adapter |
| `@orbitmem/relay` | Hono relay server — vault routes, discovery, snapshots, ERC-8128 auth |
| `@orbitmem/contracts` | Solidity contracts — DataRegistry (ERC-721), FeedbackRegistry (reputation) |
| `@orbitmem/web` | React dashboard — data explorer, vault manager, trust graph, wallet connection |

## Tech Stack

- **Runtime:** Bun
- **Data:** OrbitDB + @orbitdb/nested-db (CRDT P2P)
- **Encryption:** AES-256-GCM (Web Crypto), Lit Protocol
- **Transport:** ERC-8128 signed HTTP requests
- **Discovery:** ERC-8004 for Data — on-chain data discovery & reputation
- **Persistence:** Storacha (Filecoin/IPFS)
- **Contracts:** Solidity 0.8.28, Foundry, OpenZeppelin v5
- **Relay Server:** Hono (on fly.io)
- **Web:** React 19, TanStack Router, Tailwind CSS v4, wagmi + viem (on cloudflare worker)
- **Identity:** EVM, Solana multi-chain

## License

[MIT](LICENSE)
