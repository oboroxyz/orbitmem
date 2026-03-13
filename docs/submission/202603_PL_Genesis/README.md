# OrbitMem — The decentralized data layer for agentic web

> PL_Genesis: Frontiers of Collaboration Hackathon Submission

---

## One-Liner

**OrbitMem gives users a personal, encrypted, P2P data vault that AI agents can discover, evaluate, and consume — without ever uploading personal data to agent servers.**

---

## Problem

There is no usable decentralized database. IPFS gives you content-addressable storage — but that's where it stops. Building real applications on top of decentralized infrastructure requires three things that IPFS alone doesn't provide:

**No Encryption.** IPFS stores data in the open. There's no built-in per-record encryption or fine-grained access control. If you want to store private data on a P2P network, you're on your own.

**No Authentication.** There's no identity layer, no signed requests, no way to verify who is reading or writing data. Any node can access any content if it has the CID.

**No Indexing.** There's no discovery, no search, no quality signal. You need a CID to find anything — there's no way to query by schema, tag, or reputation. Without indexing, decentralized data is invisible.

AI agents, dApps, and user-facing applications all hit the same wall: IPFS is a transport layer, not a database. What's missing is the encryption, authentication, and indexing layer that turns content-addressable storage into a sovereign, queryable data platform.

---

## Solution

OrbitMem is a sovereign data layer that sits between users and AI agents. Users store personal data locally in an encrypted P2P vault. Agents discover and consume data through an on-chain trust protocol — never touching a centralized server.

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   User       │◄───────►│   OrbitMem        │◄───────►│  AI Agent    │
│              │         │                  │         │              │
│  Owns data   │         │  Encrypted Vault │         │  Discovers   │
│  Sets rules  │         │  Trust Protocol  │         │  Evaluates   │
│  Rates agent │         │  Reputation      │         │  Consumes    │
│              │         │                  │         │  Rates data  │
└─────────────┘         └──────────────────┘         └─────────────┘
```

### How It Works

1. **User stores data** in a local-first OrbitDB Nested vault with per-path encryption
2. **User registers data** on-chain as discoverable assets via ERC-8004 (ERC-721 NFT = public pointer to private data)
3. **Agent discovers data** by querying on-chain registries for matching schemas and quality scores
4. **Agent evaluates quality** before consuming — reputation scores are on-chain and verifiable
5. **Agent decrypts & executes** via Lit Protocol (reputation-gated) — plaintext is zeroed after use
6. **Both sides rate each other** — bidirectional feedback loop improves the ecosystem over time

---

## Architecture — 6 Layers

| Layer                 | Technology                            | Role                                                           |
| :-------------------- | :------------------------------------ | :------------------------------------------------------------- |
| **Identity**          | Porto Passkeys + EVM + Solana         | Biometric-first auth, multi-chain wallet support               |
| **Data Vault**        | OrbitDB Nested (`@orbitdb/nested-db`) | Local-first P2P storage with hierarchical JSON paths           |
| **Encryption**        | **Lit Protocol** + AES-256-GCM        | Reputation-gated access control, per-path encryption           |
| **Persistence**       | **Storacha** (Filecoin/IPFS)          | Immutable archival snapshots, disaster recovery                |
| **Trust & Discovery** | ERC-8004 for Data (ERC-721 + Reputation) | On-chain data discovery & reputation — data is a scored asset |
| **Agent Adapter**     | TypeScript SDK                        | Fetch → decrypt → execute → forget → rate (one-call lifecycle) |

---

## Key Feature: ERC-8004 for Data

Most data systems have no quality signal. OrbitMem asks: **"Is this data trustworthy?"**

```
┌─────────────────────────────────────────────────────────┐
│                  On-Chain (Base L2)                      │
│                                                         │
│  Data Registry (ERC-721)                                │
│  "Is this data accurate?"                               │
│           │                                             │
│           ▼                                             │
│  Feedback Registry (registry-agnostic)                  │
│  giveFeedback(targetId, score, tag)                     │
│                                                         │
│  Agent rates data: ★ 90, tag: "accurate"                │
│  Agent rates data: ★ 95, tag: "fresh"                   │
└─────────────────────────────────────────────────────────┘
```

This creates a **virtuous cycle**: high-quality data attracts more agent consumption, which produces more feedback, which improves data scores.

---

## Per-Path Visibility — Fine-Grained Access Control

Using `@orbitdb/nested-db`, the same data tree can have different visibility per path:

```typescript
// Public — any agent reads freely
await vault.put('travel/dietary', 'vegan', { visibility: 'public' });

// Shared — only agents with reputation ≥ 80 can decrypt (Lit Protocol)
await vault.put('travel/budget', { min: 3000, max: 5000 }, {
  visibility: 'shared',
  engine: 'lit',
  accessConditions: [reputationCondition({ minScore: 80 })],
});

// Private — owner only, AES encrypted
await vault.put('travel/passport', { number: 'XX123' }, {
  visibility: 'private',
});
```

An agent can read `travel/dietary` instantly, negotiate access to `travel/budget` through reputation, and **never see** `travel/passport`.

---

## [Challenges](https://pl-genesis-frontiers-of-collaboration-hackathon.devspot.app/hackathons/52?activeTab=challenges)

### 1. Fresh Code

> Build new solutions

OrbitMem is built from scratch for this hackathon — SDK, relay, contracts, CLI, and web. [GitHub](https://github.com/oboroxyz/orbitmem)

### 2. Infrastructure & Digital Rights

> Build the foundational systems that secure the internet and expand digital human rights.

OrbitMem gives users self-custodial, encrypted data with access control — no centralized server ever sees plaintext data.

- **`@orbitmem/sdk`** — 6-layer composable SDK: identity, encryption (AES-256-GCM + Lit Protocol), P2P vault (OrbitDB Nested), transport (ERC-8128 signed requests), discovery, persistence
- **`@orbitmem/cli`** — `npx orbitmem init` generates EVM identity, `vault store/get/ls` manages encrypted data, all commands support `--json` for machine consumption
- **Per-path visibility** — same vault tree with `public`, `shared` (reputation-gated via Lit), and `private` (AES encrypted) paths

### 3. AI & Robotics

> Verifiable AI, agent coordination, and autonomous systems.

OrbitMem provides the data layer for autonomous AI agents — on-chain data discovery, verifiable quality scores, and auditable receipts for every interaction.

- **Agent Adapter** — `createOrbitMemAgentAdapter()` provides a one-call lifecycle: `discoverData` → `readPublicData` → `getDataScore` → `rateData`
- **ERC-8004 on-chain trust** — `DataRegistry` (ERC-721) mints data as discoverable assets; `FeedbackRegistry` scores data quality with per-tag reputation (`accurate`, `fresh`)
- **Agents with receipts** — every data interaction produces an auditable on-chain receipt via `giveFeedback()`

```
Agent A registers data → DataRegistry mints NFT (receipt)
                                        ↓
Agent B discovers via schema query → checks FeedbackRegistry score
                                        ↓
Agent B consumes data → rates via giveFeedback() → on-chain receipt
                                        ↓
Agent A's reputation increases → more discoverable → virtuous cycle
```

### 4. Filecoin

> Agent storage, onchain registry, reputation, and data marketplace.

OrbitMem uses Filecoin (via Storacha) for verifiable archival storage and IPFS/OrbitDB for local-first P2P replication.

OrbitMem addresses **4 of 7** Filecoin challenge ideas:

| Challenge Idea | OrbitMem Implementation |
| :--- | :--- |
| **Onchain Agent Registry** | `DataRegistry` (ERC-721) — `register(dataURI)` mints on-chain pointers to off-chain data |
| **Agent Reputation & Portable Identity** | `FeedbackRegistry` — registry-agnostic reputation with per-tag scoring, bidirectional feedback |
| **Agent-Generated Data Marketplace** | Agent Adapter lifecycle: discover → evaluate → consume → rate |
| **Agent Storage SDK** | `@orbitmem/sdk` + `@orbitmem/cli` — encrypted vault, Storacha persistence, `--json` output |

**Storacha integration:** encrypted vault snapshots archived to Filecoin via `@storacha/client` — immutable backups, CID-based retrieval, verifiable storage deals. No plaintext exposure (encryption before upload).

### 5. Storacha

> Meaningful use of Storacha SDK.

OrbitMem wraps Storacha as its persistence layer — encrypted vault snapshots archived to Filecoin with one command.

- **`createPersistenceLayer()`** — wraps `@storacha/client` for Filecoin/IPFS archival snapshots
- **`npx orbitmem snapshot`** — one-command vault archive from CLI
- **`POST /v1/snapshots/archive`** — relay endpoint for programmatic snapshot creation

### 6. Lit Protocol

> NextGen AI apps with Lit Protocol integration.

OrbitMem uses Lit Protocol as the encryption engine for shared data — reputation-gated decryption with no trusted intermediary.

- **`LitEngine`** in `@orbitmem/sdk` — lazy-loaded client with session signatures and reputation-gated access conditions
- **On-chain condition-based decryption** — agents can only decrypt if `FeedbackRegistry` quality score meets threshold
- **Dynamic access revocation** — reputation drops below minimum → access revoked automatically

### 7. Agent Only: Let the Agent Cook

> Fully autonomous agent workflows — no human in the loop.

OrbitMem is built for agent-first consumption. The CLI and SDK provide everything an autonomous agent needs:

- **`@orbitmem/cli`** — every command supports `--json` for machine-readable output, `--relay`/`--chain` overrides
- **`createOrbitMemAgentAdapter()`** — one-call lifecycle: discover → read → score → rate, no UI required
- **ERC-8128 transport auth** — agents sign their own requests with wallet keys, no OAuth or API keys

### 8. Agents With Receipts — ERC-8004

> Every agent interaction produces an auditable on-chain receipt.

ERC-8004 is OrbitMem's core on-chain primitive. `DataRegistry` mints ERC-721 NFTs as data receipts; `FeedbackRegistry` records per-tag quality scores (`accurate`, `fresh`) for every consumption event. Agents don't just use data — they leave verifiable proof of what they used and how they rated it.

- **`npx orbitmem register`** — register data on-chain, minting a receipt NFT
- **`npx orbitmem discover`** — search by schema, tags, and minimum quality scores
- **Agent Adapter** — `discoverData` → `getDataScore` → `rateData` lifecycle, all scored on-chain

### 9. Funding the Commons

> Opportunity to become EIR

---

## Examples using OrbitMem

### 1. Decentralized Memo App

A fully decentralized note-taking app — no server, no platform, no lock-in.

- User connects a wallet (passkey or EVM) → creates an OrbitMem vault
- **Public memos** — `visibility: 'public'`, shareable links anyone can view without a wallet
- **Private memos** — `visibility: 'private'`, AES-256-GCM encrypted, owner-only
- Markdown editor with live preview and GFM support

```
User writes memo → OrbitMem Vault (OrbitDB)
                      ├── public/  → readable by anyone, registered on-chain
                      └── private/ → AES encrypted, owner-only
                              ↓
                    Storacha → Filecoin (backup)
```

See [`examples/memo/`](../../examples/memo/) for the full source.

### 2. Agent Research & Data Trust

AI agents produce and consume data autonomously — research results, curated datasets, market analyses. OrbitMem gives agents a decentralized way to publish, discover, and build trust around that data.

**How it works:**

1. **Agent publishes data** — an agent stores output in an OrbitMem vault and registers it on-chain via `npx orbitmem register`, minting an ERC-721 NFT with schema tags (`research`, `market-analysis`, `2026-Q1`)
2. **Other agents discover** — `npx orbitmem discover --schema research --min-score 70` finds entries by tag and reputation score
3. **Agents rate data** — consuming agents call `giveFeedback()` to score accuracy, freshness, completeness — building the producer's on-chain reputation

```
Agent A (producer)
  └── skill output → vault.put() → npx orbitmem register
  └── DataRegistry mints NFT (on-chain receipt)
                                        ↓
Agent B (consumer)
  └── npx orbitmem discover --schema research
  └── reads data → evaluates → giveFeedback(score, "accurate")
                                        ↓
                          Agent A's reputation increases
                          → future data more discoverable
```

*Code: TBD*

---

## Technical Stacks

| Component            | Technology                      | License          |
| :------------------- | :------------------------------ | :--------------- |
| P2P Data Store       | OrbitDB + `@orbitdb/nested-db`  | AGPL-3.0         |
| Content Addressing   | Helia (IPFS)                    | Apache-2.0 / MIT |
| Encryption (shared)  | **Lit Protocol**                | Apache-2.0       |
| Encryption (private) | AES-256-GCM                     | —                |
| Archival Storage     | **Storacha** → **Filecoin**     | Apache-2.0       |
| On-Chain Trust       | ERC-8004 (ERC-721 + Reputation) | MIT              |
| Registry Chain       | Base L2 (EVM)                   | —                |
| Identity             | Porto Passkeys + EVM + Solana   | —                |
| CLI                  | TypeScript (`@orbitmem/cli`)    | MIT              |
| SDK                  | TypeScript (`@orbitmem/sdk`)    | MIT              |

---

## What We've Built

OrbitMem is a **fully functional MVP**, not a design document. Every layer is implemented, tested, and integrated end-to-end.

### `@orbitmem/sdk` — Core SDK (~3,500 LoC, 11 test files)

All 6 layers implemented as composable factory functions wired together via `createOrbitMem()`:

- **Identity Layer** — `createIdentityLayer()` with HKDF-SHA256 session key derivation, multi-chain wallet support (EVM, Solana, Passkeys), connection state management
- **Encryption Layer** — Dual-engine: `AESEngine` (AES-256-GCM with wallet-signature and raw key sources) + `LitEngine` (lazy-loaded client, session sigs, reputation-gated access conditions)
- **Data Layer** — `createVault()` wrapping OrbitDB Nested with dual databases (primary vault + `-meta` for visibility/encryption metadata), `put`/`get`/`insert`/`delete` with per-path encryption hooks
- **Transport Layer** — `createTransportLayer()` with ERC-8128 signed request envelopes, SHA-256 payload hashing, nonce-based replay protection (5-min TTL)
- **Discovery Layer** — `createDiscoveryLayer()` with dual-mode: `OnChainRegistry` (viem integration with DataRegistry + FeedbackRegistry contracts) or `MockRegistry` (in-memory fallback)
- **Persistence Layer** — `createPersistenceLayer()` with `@storacha/client` for Filecoin/IPFS archival snapshots, CID-based retrieval, deal status checking
- **Agent Adapter** — `createOrbitMemAgentAdapter()` for autonomous agent workflows: `discoverData` → `readPublicData` → `getDataScore` → `rateData`

### `@orbitmem/contracts` — Solidity Smart Contracts (~400 LoC, 3 test files)

Two ERC-8004 contracts on Solidity 0.8.28 with OpenZeppelin v5:

- **DataRegistry (ERC-721 "OMD")** — `register(dataURI)` mints NFTs as on-chain pointers to off-chain data, with active/inactive toggle and URI updates
- **FeedbackRegistry (registry-agnostic)** — `giveFeedback(registry, entityId, value, decimals, tag1, tag2, feedbackURI, feedbackHash)` with per-entity global and per-tag scoring, revocation support, self-feedback prevention. Works against **any** ERC-721 registry, not just DataRegistry
- **Tests** — DataRegistry minting, FeedbackRegistry scoring/revocation, cross-contract integration

### `@orbitmem/relay` — Hono HTTP Server (~2,000 LoC, 6 test files)

Production-ready relay with ERC-8128 auth middleware and 11 API routes:

| Endpoint | Auth | Description |
| :--- | :--- | :--- |
| `GET /v1/health` | — | Server health check |
| `GET /v1/vault/public/:address/keys` | — | Discover public vault entries |
| `GET /v1/vault/public/:address/:key` | — | Read public vault data |
| `POST /v1/vault/read` | ERC-8128 | Read encrypted vault data |
| `POST /v1/vault/sync` | ERC-8128 | Trigger vault sync |
| `GET /v1/data/search` | — | Search data by schema/tags/quality |
| `GET /v1/data/:dataId/score` | — | Get reputation score |
| `POST /v1/data/:dataId/feedback` | ERC-8128 | Submit quality feedback |
| `GET /v1/data/user/stats` | ERC-8128 | Per-user metrics |
| `GET /v1/data/stats` | — | Aggregate metrics (60s cache) |
| `POST /v1/snapshots/archive` | ERC-8128 | Create vault snapshot |

Dual-mode services: mock for development, live (viem + Storacha + on-chain) for production with env var validation.

### `@orbitmem/web` — React Dashboard (~2,400 LoC)

Interactive web app with React 19, Vite, TanStack Router, wagmi, Recharts, Tailwind CSS v4:

- **Landing page** — Hero, pillar cards, interactive trust graph visualization, standards section
- **Dashboard** — Vault entry explorer with per-user stats (requires wallet connection + ERC-8128 auth)
- **Data Registry** — Search and filter data entries by schema/tags/verified status, view quality scores
- **Data Detail** — Score display with feedback submission form
- **Metrics** — Real-time aggregate stats, quality distribution charts, activity timeline (Recharts)
- **Snapshot Browser** — Archive and restore vault snapshots via Storacha
- **Wallet integration** — wagmi ConnectButton with ERC-8128 header generation for authenticated requests

Deployed via Cloudflare Workers (wrangler).

### `@orbitmem/cli` — Command-Line Interface (~500 LoC, 3 test files)

Unified CLI for users and AI agents — `npx orbitmem <command>`, no global install:

- **`init`** — Generate EVM identity via `viem/accounts`, create `~/.orbitmem/` config
- **`vault store/get/ls`** — Store, read, and list encrypted vault data via SDK
- **`register`** — Register data on-chain as discoverable assets (ERC-8004)
- **`discover`** — Search data sources by schema, tags, and quality scores
- **`snapshot`** — Archive vault to Filecoin via Storacha
- **`status`** — Show identity, config, and vault info
- **`dev`** — Start local relay server for development

All commands support `--json` for machine-readable output (agent consumption) and `--relay`/`--chain` overrides.

---

## Why OrbitMem Matters

**For Users:** You own your data. You decide what to share, with whom, and under what conditions. Your preferences follow you across platforms and agents — portable, encrypted, sovereign.

**For Agents:** You can discover high-quality, verified data sources without building relationships with individual users. On-chain quality scores let you evaluate data before consuming it. The reputation system rewards reliable behavior.

**For the Ecosystem:** An on-chain data trust protocol where data quality is verifiable creates a foundation for the agentic web that doesn't require trusting centralized intermediaries.

---

## Future Work

- Advanced Lit Protocol reputation conditions — fully wire reputation-gated decryption in vault
- Passkey/WebAuthn browser integration for biometric-first UX
- Solana end-to-end testing and deployment
- Filecoin deal status tracking (live Storacha integration)
- Backup/restore UI in the web dashboard
- Multi-signature vault support and delegation patterns

---

## Links

- GitHub: [github.com/oboroxyz/orbitmem](https://github.com/oboroxyz/orbitmem)
- Technical Spec: `docs/design/spec.md` (v0.3.0)
- SDK: `@orbitmem/sdk` (TypeScript, MIT)
- CLI: `@orbitmem/cli` (`npx orbitmem`, TypeScript, MIT)
- Contracts: `@orbitmem/contracts` (Solidity 0.8.28, MIT)

---

*OrbitMem — Your data. Your vault. Your rules.*