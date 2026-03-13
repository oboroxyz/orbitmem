# OrbitMem — Decentralized data layer for agentic web

[PL_Genesis: Frontiers of Collaboration Hackathon](https://pl-genesis-frontiers-of-collaboration-hackathon.devspot.app/)

---

## 🗣️ TL;DR

**`OrbitMem` is a decentralized data layer for the agentic web — encrypted vaults, on-chain discovery, and verifiable data trust, designed for both humans and AI agents.**

Built on OrbitDB with AES/Lit Protocol encryption, ERC-8128 signed transport, and ERC-8004 for data discovery and reputation.

[📝 Submission](https://pl-genesis-frontiers-of-collaboration-hackathon.devspot.app/projects/1101) | [▶️ Video](https://youtube.com) | [🎬 Slides](https://raw.githack.com/oboroxyz/orbitmem/main/docs/submissions/202603_PL_Genesis/slides.html)

---

## 🤔 Problem

IPFS gives you content-addressable storage — but not a database. Three things are missing:

- **No Encryption.** IPFS stores data in the open. There's no built-in per-record encryption or fine-grained access control. If you want to store private data on a P2P network, you're on your own.
- **No Authentication.** There's no identity layer, no signed requests, no way to verify who is reading or writing data. Any node can access any content if it has the CID.
- **No Discovery.** No search, no quality signal. You need a CID to find anything — decentralized data is invisible.

---

## 💡 Solution

`OrbitMem` is a sovereign data layer that sits between users and AI agents. Users store personal data locally in an encrypted P2P vault. Agents discover and consume data through an on-chain trust protocol — never touching a centralized server.

```
┌─────────────────────────────────────────────────────────┐
│  Interface          SDK + CLI (Skills)                   │
└─────────────────────────────────────────────────────────┘
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│    Identity      │ │   Encryption    │ │ Discovery &     │
│ Passkeys + EVM  │ │  Lit + AES-256  │ │ Trust           │
│   + Solana      │ │                 │ │ ERC-8004        │
└─────────────────┘ └─────────────────┘ └─────────────────┘
┌─────────────────────────────────────────────────────────┐
│  Data Vault       OrbitDB Nested — local-first P2P      │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  Persistence      Storacha → Filecoin/IPFS              │
└─────────────────────────────────────────────────────────┘
```

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Interface** | SDK + CLI (Skills) | One-call lifecycle for users and AI agents |
| **Identity** | Porto Passkeys + EVM + Solana | Biometric-first auth, multi-chain wallet support |
| **Encryption** | Lit Protocol + AES-256-GCM | Reputation-gated access control, per-path encryption |
| **Discovery & Trust** | ERC-8004 (ERC-721 + Reputation) | On-chain data discovery & quality scoring |
| **Data Vault** | OrbitDB Nested | Local-first P2P storage with hierarchical JSON paths |
| **Persistence** | Storacha (Filecoin/IPFS) | Immutable archival snapshots, disaster recovery |

---

## ✨ Features

### Fully Decentralized

Built on IPFS and OrbitDB — no central servers, no single point of failure. Local-first, offline-capable, censorship resistant.

### Encrypted Vaults

P2P data vaults with per-path visibility control. The same data tree can have different access levels:

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

### Signed Transport

ERC-8128 signed HTTP with Passkey, EVM, or Solana wallets. Every request is cryptographically verified — no OAuth, no API keys.

### Discovery & Trust

On-chain data discovery and quality scoring via ERC-8004. Every data entry is rated by humans and agents, building a decentralized reputation layer.

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

High-quality data attracts more agent consumption → more feedback → higher scores. A **virtuous cycle**.

---

## Example apps using OrbitMem

### 1. Decentralized Memo App - [Demo](https://exammple.com), [Source Code](../../examples/memo/)


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

### 2. Agent Research & Data Trust - [Demo](https://exammple.com), [Source Code](../../examples/agent-researh/)

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

---

## [Submitted Challenges](https://pl-genesis-frontiers-of-collaboration-hackathon.devspot.app/hackathons/52?activeTab=challenges)

### 1. Fresh Code

> Build new solutions

OrbitMem is built from scratch for this hackathon — SDK, relay, contracts, CLI, and website. [GitHub](https://github.com/oboroxyz/orbitmem)

### 2. Infrastructure & Digital Rights

> Build the foundational systems that secure the internet and expand digital human rights.

OrbitMem gives users self-custodial, encrypted data with access control — no centralized server ever sees plaintext data.

- **`@orbitmem/sdk`** — 6-layer composable SDK: identity, encryption (AES-256-GCM + Lit Protocol), P2P vault (OrbitDB Nested), transport (ERC-8128 signed requests), discovery, persistence
- **`@orbitmem/cli`** — `npx orbitmem init` generates EVM identity, `vault store/get/ls` manages encrypted data, all commands support `--json` for machine consumption
- **Per-path visibility** — same vault tree with `public`, `shared` (reputation-gated via Lit), and `private` (AES encrypted) paths

### 3. AI & Robotics

> Verifiable AI, agent coordination, and autonomous systems.

OrbitMem provides the data layer for autonomous AI agents — on-chain data discovery, verifiable quality scores, and auditable receipts for every interaction.

- **Client** — `createOrbitMemClient()` provides a one-call lifecycle: `discoverData` → `readPublicData` → `getDataScore` → `rateData`
- **`ERC-`8004` on-chain trust** — `DataRegistry` (ERC-721) mints data as discoverable assets; `FeedbackRegistry` scores data quality with per-tag reputation (`accurate`, `fresh`)
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
| **Agent-Generated Data Marketplace** | Client lifecycle: discover → evaluate → consume → rate |
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

OrbitMem is built for agent-first consumption. The CLI, SDK, and Skills provide everything an autonomous agent needs:

- **`@orbitmem/cli`** — every command supports `--json` for machine-readable output, `--relay`/`--chain` overrides
- **`createOrbitMemClient()`** — one-call lifecycle: discover → read → score → rate, no UI required
- **Skills** — AI agents operate OrbitMem via natural language (e.g. "store my travel preferences in the vault")
- **ERC-8128 transport auth** — agents sign their own requests with wallet keys, no OAuth or API keys

### 8. Agents With Receipts — ERC-8004

> Every agent interaction produces an auditable on-chain receipt.

ERC-8004 is OrbitMem's core on-chain primitive. `DataRegistry` mints ERC-721 NFTs as data receipts; `FeedbackRegistry` records per-tag quality scores (`accurate`, `fresh`) for every consumption event. Agents don't just use data — they leave verifiable proof of what they used and how they rated it.

- **`npx orbitmem register`** — register data on-chain, minting a receipt NFT
- **`npx orbitmem discover`** — search by schema, tags, and minimum quality scores
- **Interface** — `discoverData` → `getDataScore` → `rateData` lifecycle, all scored on-chain

### 9. Funding the Commons

> Opportunity to become EIR

---

## What We've Built

| Package | Description |
| :--- | :--- |
| **`@orbitmem/sdk`** | Composable SDK — identity, encryption, vault, transport, discovery, persistence + client |
| **`@orbitmem/contracts`** | `ERC-8004` Solidity contracts — DataRegistry (ERC-721) + FeedbackRegistry (reputation) on Base Sepolia |
| **`@orbitmem/relay`** | Hono HTTP relay with `ERC-8128` auth middleware, vault/data/snapshot routes |
| **`@orbitmem/web`** | React dashboard — vault explorer, data registry, metrics, wallet integration (Cloudflare Workers) |
| **`@orbitmem/cli`** | CLI for users and agents — `npx orbitmem init/vault/register/discover/snapshot` with `--json` output. Includes Claude Code skill for natural language operation |

---

## Future Work

- Advanced Lit Protocol reputation conditions — fully wire reputation-gated decryption in vault
- Passkey/WebAuthn browser integration for biometric-first UX
- Solana end-to-end testing and deployment
- Filecoin deal status tracking (live Storacha integration)
- Backup/restore UI in the web dashboard
- Multi-signature vault support and delegation patterns
