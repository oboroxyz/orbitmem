# OrbitMem

Sovereign data layer for AI agents — encrypted P2P vaults, multi-chain identity, and bidirectional trust.

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
```

## Quick Start

```bash
# Install dependencies
bun install

# Run tests
bun test

# Start relay server
bun run dev:relay
```

## SDK Usage

```typescript
import { createOrbitMem } from '@orbitmem/sdk';

const orbit = await createOrbitMem({
  wallet: {
    address: '0xYourAddress',
    family: 'evm',
    sign: async (payload) => ({
      signature: await wallet.signMessage(payload),
      algorithm: 'ecdsa-secp256k1',
    }),
  },
  encryption: { defaultEngine: 'aes' },
  relay: { url: 'http://localhost:3000' },
});

// Write data to vault
await orbit.data.put('travel/dietary', { vegan: true }, {
  visibility: 'public',
  encrypted: false,
});

// Read data
const prefs = await orbit.data.get('travel/dietary');
```

## Agent Adapter

```typescript
import { createOrbitMemAgentAdapter } from '@orbitmem/sdk/agent';

const agent = createOrbitMemAgentAdapter({
  orbit,
  agentId: 'booking-agent-001',
});

// Full lifecycle: discover → evaluate → fetch → decrypt → rate
const datasets = await agent.discoverData({ schema: 'orbitmem:dietary:v1' });
const score = await agent.evaluateData(datasets[0].dataId);
const data = await agent.fetchUserData({ dataId: datasets[0].dataId, userAddress: '0x...' });
await agent.rateData(datasets[0].dataId, 95);
```

## Packages

| Package | Description |
|---------|-------------|
| `@orbitmem/sdk` | Core SDK — encryption, vault, identity, transport, discovery, persistence |
| `@orbitmem/relay` | Hono relay server — vault routes, discovery, snapshots, ERC-8128 auth |

## Tech Stack

- **Runtime:** Bun
- **Data:** OrbitDB + @orbitdb/nested-db (CRDT P2P)
- **Encryption:** AES-256-GCM (Web Crypto) + Lit Protocol v7
- **Transport:** ERC-8128 signed HTTP requests
- **Discovery:** ERC-8004 bidirectional trust (mock registries)
- **Persistence:** Storacha (Filecoin/IPFS)
- **Server:** Hono
- **Identity:** EVM + Solana multi-chain

## License

MIT
