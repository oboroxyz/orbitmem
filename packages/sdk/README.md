# @orbitmem/sdk

Sovereign data layer for AI agents — encrypted P2P vaults, multi-chain identity, and on-chain data trust.

## Install

```bash
npm install @orbitmem/sdk
```

## Quick Start

### For Users (Data Owners)

```typescript
import { createOrbitMem } from "@orbitmem/sdk";

const orbitmem = await createOrbitMem({
  identity: { chains: ["evm"] },
  encryption: { defaultEngine: "aes", aes: { kdf: "hkdf-sha256" } },
});

// Connect wallet
await orbitmem.connect({ method: "evm", adapter: "metamask" });

// Store data with different visibility levels
await orbitmem.vault.put("travel/dietary", "vegan", { visibility: "public" });
await orbitmem.vault.put("travel/passport", { number: "..." }, { visibility: "private" });
await orbitmem.vault.put("travel/preferences", { seat: "window" }, { visibility: "shared" });

// Query and sync
const entries = await orbitmem.vault.query({ prefix: "travel" });
await orbitmem.vault.sync();
```

### For Agents (Data Consumers)

```typescript
import { createOrbitMemClient } from "@orbitmem/sdk/agent";

const client = createOrbitMemClient({
  wallet: { family: "evm", address: "0x...", signMessage: signer.signMessage },
  discovery: {
    dataRegistry: "0x9eE44938ED77227470CaA2DbCC0459F49d249B7A",
    reputationRegistry: "0x1Bce77f90C33A5f8faCa54782Ce3a17d1AD7109a",
    registryChain: "base-sepolia",
  },
});

// Discover data
const results = await client.discoverData({ schema: "travel:v1" });

// Read with quality checks
await client.withUserData(
  { vaultAddress, path: "travel/dietary", minQuality: 70, relayUrl: "..." },
  (data, score) => {
    console.log(data); // "vegan"
  },
);

// Rate data quality
await client.rateData({ vaultAddress, path: "travel/dietary", score: 90, tags: ["accurate"] });
```

## Exports

| Entry Point                | Description                                  |
| -------------------------- | -------------------------------------------- |
| `@orbitmem/sdk`            | `createOrbitMem` — full SDK with all layers  |
| `@orbitmem/sdk/agent`      | `createOrbitMemClient` — agent-side client   |
| `@orbitmem/sdk/discovery`  | Discovery & reputation layer                 |
| `@orbitmem/sdk/transport`  | ERC-8128 signed HTTP requests                |
| `@orbitmem/sdk/encryption` | Lit Protocol & AES-256-GCM engines           |
| `@orbitmem/sdk/identity`   | Multi-chain wallet auth (EVM/Solana/Passkey) |
| `@orbitmem/sdk/types`      | TypeScript type definitions                  |

## Architecture

The SDK is composed of six independent layers, each created by a factory function:

| Layer            | Purpose                                                                         |
| ---------------- | ------------------------------------------------------------------------------- |
| **Identity**     | Multi-chain wallet connection (EVM, Solana, Passkey) and session key management |
| **Encryption**   | Pluggable encryption via AES-256-GCM or Lit Protocol with access conditions     |
| **Data (Vault)** | Local-first P2P storage backed by OrbitDB with nested paths                     |
| **Transport**    | ERC-8128 signed HTTP requests for relay communication                           |
| **Discovery**    | On-chain data registry and reputation scoring via ERC-8004                      |
| **Persistence**  | Snapshot archival to Filecoin/IPFS via Storacha                                 |

## Data Visibility

| Level     | Description                                                       |
| --------- | ----------------------------------------------------------------- |
| `public`  | Plaintext, readable by anyone via relay                           |
| `private` | AES encrypted, only the owner can decrypt                         |
| `shared`  | Encrypted with access conditions (Lit Protocol or shared AES key) |

## Supported Chains

Base, Base Sepolia

## License

MIT
