# OrbitMem Build Design

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo tooling | bun + bun workspaces | All-in-one runtime, fastest |
| Relay framework | Hono | Lightweight, edge-ready, stateless relay fit |
| Repo structure | `packages/relay` + `packages/sdk` | Monorepo, shared types |
| Smart contracts | Mock/stub for now | Get SDK + relay working first |
| OrbitDB | Real `@orbitdb/nested-db` | Core value prop |
| Build approach | Bottom-up, layer by layer | Testable layers, clean composition |
| Relay UI | None | Stateless API server, no dashboard needed |

## Repo Structure

```
orbitmem/
├── package.json              # root workspace config
├── tsconfig.base.json        # shared TS config
├── packages/
│   ├── sdk/                  # @orbitmem/sdk
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts              # createOrbitMem() entry
│   │       ├── types.ts              # from sdk-types.ts
│   │       ├── identity/             # wallet auth
│   │       ├── data/                 # OrbitDB nested vault
│   │       ├── encryption/           # Lit + AES-256-GCM
│   │       ├── transport/            # ERC-8128 signed HTTP
│   │       ├── discovery/            # mock registries
│   │       ├── persistence/          # Storacha
│   │       └── agent/                # createOrbitMemAgentAdapter()
│   └── relay/                # @orbitmem/relay
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts              # Hono app entry
│           ├── routes/               # /v1/auth, /v1/vault, /v1/data
│           ├── middleware/           # ERC-8128 verification, logging
│           ├── services/             # OrbitDB peer, archival
│           └── mock/                 # in-memory registry stubs
├── docs/design/              # existing spec, types, architecture
└── examples/                 # later
```

## SDK Layers

Each layer: factory function + interface from `sdk-types.ts`.

### Layer 1: Data Vault (`data/`)
- Real `@orbitdb/nested-db` with Helia
- Path-based CRUD: `put()`, `get()`, `del()`, `insert()`, `keys()`, `all()`, `query()`
- Stores visibility + encryption metadata per entry
- Delegates encryption/decryption to Encryption layer
- CRDT sync via OrbitDB replication

### Layer 2: Encryption (`encryption/`)
- **AES engine:** `crypto.subtle`, HKDF-SHA256 key derivation, AES-256-GCM
- **Lit engine:** `@lit-protocol/lit-node-client`, on-chain access conditions
- Unified `IEncryptionLayer` interface

### Layer 3: Identity (`identity/`)
- Porto (WebAuthn P256), EVM (viem), Solana (wallet-adapter)
- Session key derivation from wallet signatures
- `IIdentityLayer` interface

### Layer 4: Transport (`transport/`)
- ERC-8128 request signing + verification
- P256 / ECDSA / Ed25519 support
- Uses identity session keys

### Layer 5: Discovery (`discovery/`)
- In-memory mock: Agent Registry, Data Registry, Reputation Registry
- Same `IDiscoveryLayer` interface — swap to on-chain later

### Layer 6: Persistence (`persistence/`)
- `@storacha/client` for Filecoin/IPFS archival
- Encrypted snapshot upload/retrieve

### Composition
- `createOrbitMem(config)` wires all layers with dependency injection
- `createOrbitMemAgentAdapter(config)` for agent-side lifecycle

## Relay Node

Stateless Hono server. OrbitDB gossip peer + API gateway. Never decrypts.

### Routes

| Route | Auth | Purpose |
|-------|------|---------|
| `POST /v1/auth/challenge` | None | Generate challenge |
| `GET /v1/vault/public/:address/:key` | None | Read plaintext |
| `GET /v1/vault/public/:address/keys` | None | List public keys |
| `POST /v1/vault/read` | ERC-8128 | Read encrypted entry |
| `GET /v1/data/search` | None | Query Data Registry |
| `GET /v1/data/:dataId/score` | None | Get data score |
| `POST /v1/data/:dataId/feedback` | ERC-8128 | Submit feedback |
| `POST /v1/vault/sync` | ERC-8128 | Trigger CRDT sync |
| `GET /v1/snapshots` | ERC-8128 | List snapshots |
| `POST /v1/snapshots/archive` | ERC-8128 | Trigger archival |
| `GET /v1/health` | None | Health check |

### Middleware
- ERC-8128 verifier (reuses SDK transport verification)
- Nonce cache (in-memory Map, 5-min sliding window)
- Hono built-in logger

### Services
- OrbitDB peer (Helia + OrbitDB, vault replication)
- Mock registries (shared with SDK discovery mocks)
- Storacha archival trigger

## Build Order

### Phase 1: Foundation
1. Monorepo scaffold (root package.json, tsconfig, bun)
2. Types (sdk-types.ts into packages/sdk/src/types.ts)

### Phase 2: Core SDK Layers
3. Encryption layer (AES first, then Lit)
4. Data layer (OrbitDB nested-db, wired to encryption)
5. Identity layer (EVM, Solana, Porto adapters + session keys)
6. Transport layer (ERC-8128 signing/verification)

### Phase 3: Additive Layers
7. Discovery layer (mock registries)
8. Persistence layer (Storacha)

### Phase 4: Composition
9. SDK entry (`createOrbitMem()`)
10. Agent adapter (`createOrbitMemAgentAdapter()`)

### Phase 5: Relay Node
11. Hono server scaffold
12. OrbitDB peer service
13. ERC-8128 middleware
14. Route handlers
15. Storacha archival service

### Phase 6: Integration
16. SDK <-> Relay end-to-end test

### Dependency Graph
```
Encryption <- Data (vault needs encrypt/decrypt)
Identity <- Transport (signing needs session keys)
Transport <- Relay middleware (verification)
Data + Discovery + Persistence <- SDK entry (composition)
SDK <- Relay (shared types, transport verification)
```
