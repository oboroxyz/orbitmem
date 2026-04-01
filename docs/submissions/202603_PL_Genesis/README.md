# OrbitMem — Decentralized data layer for agentic web

[PL_Genesis: Frontiers of Collaboration Hackathon](https://pl-genesis-frontiers-of-collaboration-hackathon.devspot.app/)

---

## 🗣️ TL;DR

**`OrbitMem` is a decentralized data layer for the agentic web — encrypted vaults, on-chain discovery, and verifiable data trust, designed for both humans and AI agents.**

Built on OrbitDB with AES/Lit Protocol encryption, ERC-8128 wallet auth, and ERC-8004 for data discovery and reputation.

[📝 Submission](https://devspot.app/projects/1101?view=preview) | [▶️ Video](https://youtu.be/W5ukZamqN9o) | [🎬 Slides](https://raw.githack.com/oboroxyz/orbitmem/main/docs/submissions/202603_PL_Genesis/slides.html) | [🌐 Website](https://orbitmem.0x7.sh) | [📋 Demo: dMemo](https://ipfs.io/ipfs/bafybeidd2kxqnpmtpteqernqqunem5nkl4462cqr3mf4gg7jmibrh3amgu/)

---

## 🤔 Problem

IPFS is great as decentralized storage — but it falls short as a modern, developer-friendly database:

- **No Encryption.** IPFS stores data in the open. There's no built-in per-record encryption or fine-grained access control. If you want to store private data on a P2P network, you're on your own.
- **No Authentication.** There's no identity layer, no signed requests, no way to verify who is reading or writing data. Any node can access any content if it has the CID.
- **No Discovery.** No search, no quality signal. You need a CID to find anything — decentralized data is invisible.

---

## 💡 Solution

`OrbitMem` is a decentralized data layer built on top of OrbitDB — a local-first P2P database on libp2p. Users store data in encrypted vaults. Agents discover and consume data through an on-chain trust protocol — never touching a centralized server.

```
┌─────────────────────────────────────────────────────────┐
│  Interface          SDK + CLI (Skills)                   │
└─────────────────────────────────────────────────────────┘
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│    Identity      │ │   Encryption    │ │ Discovery &     │
│ ERC-8128 + OWS  │ │  Lit + AES-256  │ │ Trust           │
│                 │ │                 │ │ ERC-8004        │
└─────────────────┘ └─────────────────┘ └─────────────────┘
┌─────────────────────────────────────────────────────────┐
│  Data Vault       OrbitDB Nested — local-first P2P      │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  Persistence      P2P replication via Relay + Storacha   │
└─────────────────────────────────────────────────────────┘
```

| Layer                 | Technology                            | Role                                                                 |
| :-------------------- | :------------------------------------ | :------------------------------------------------------------------- |
| **Interface**         | SDK + CLI (Skills)                    | One-call lifecycle for users and AI agents                           |
| **Identity**          | ERC-8128 + OWS (Open Wallet Standard) | Signed HTTP auth, OWS wallet for CLI/SDK, Porto Passkeys for browser |
| **Encryption**        | Lit Protocol + AES-256-GCM            | Reputation-gated access control, per-path encryption                 |
| **Discovery & Trust** | ERC-8004 (ERC-721 + Reputation)       | On-chain data discovery & quality scoring                            |
| **Data Vault**        | OrbitDB Nested                        | Local-first P2P storage with hierarchical JSON paths                 |
| **Persistence**       | P2P replication + Storacha            | Relay sync for availability, Filecoin snapshots for archival         |

---

## ✨ Features

### Fully Decentralized

Built on IPFS and OrbitDB — no central servers, no single point of failure. Local-first, offline-capable, censorship resistant.

### Encrypted Vaults

P2P data vaults with per-path visibility control. The same data tree can have different access levels:

```typescript
// Public — any agent reads freely
await vault.put("travel/dietary", "vegan", { visibility: "public" });

// Shared — only agents with reputation ≥ 80 can decrypt (Lit Protocol)
await vault.put(
  "travel/budget",
  { min: 3000, max: 5000 },
  {
    visibility: "shared",
    engine: "lit",
    accessConditions: [reputationCondition({ minScore: 80 })],
  },
);

// Private — owner only, AES encrypted
await vault.put(
  "travel/passport",
  { number: "XX123" },
  {
    visibility: "private",
  },
);
```

### Wallet Auth

ERC-8128 signed HTTP with Passkey, ETH or Solana wallets. Every request is cryptographically verified — no OAuth, no API keys. OWS (Open Wallet Standard) for agent wallets.

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

### 1. Decentralized Memo App - [Live Demo (IPFS)](https://ipfs.io/ipfs/bafybeidd2kxqnpmtpteqernqqunem5nkl4462cqr3mf4gg7jmibrh3amgu/) | [Source Code](../../examples/memo/)

A fully decentralized note-taking app — no server, no platform, no lock-in.

- Auth with EOA wallet or Passkey (Porto)
- **Public memos** — shareable links anyone can view without a wallet
- **Private memos** — AES-256-GCM encrypted, relay and IPFS nodes only receive already-encrypted data, only the owner can decrypt
- Markdown editor with live preview
- P2P sync via relay

```
User writes memo → OrbitMem Vault (OrbitDB)
                      ├── public/  → readable by anyone, shareable links
                      └── private/ → AES encrypted, owner-only
                              ↓
                    P2P sync via Relay (availability)
```

### 2. Agent Data Trust — Coffee Guides | [Source Code](../../examples/agent/)

Agents publish, discover, and rate data autonomously via CLI and Skills. Integrable into any agent framework — OpenClaw, WorkFlow, etc.

**Demo flow:**

1. **Agent creates wallet** — `npx orbitmem init` creates an OWS (Open Wallet Standard) wallet
2. **Agent stores data** — `npx orbitmem vault store guides/tokyo/obscura '{"name":"OBSCURA COFFEE ROASTERS",...}' --public`
3. **Agent registers on-chain** — `npx orbitmem register guides/tokyo/obscura --tags coffee,tokyo` mints an ERC-721 NFT
4. **Users discover via Web** — browse the Explore page on the web dashboard, search by tags
5. **Users rate data** — connect wallet on the web dashboard, submit feedback with quality scores — building the producer's on-chain reputation

Quality drives visibility. Also integrated Machine Payments Protocol (MPP), so data can be bought and sold based on reputation.

---

## [Submitted Challenges](https://pl-genesis-frontiers-of-collaboration-hackathon.devspot.app/hackathons/52?activeTab=challenges)

### 1. Fresh Code

> Build new solutions

OrbitMem is built from scratch for this hackathon — SDK, relay, contracts, CLI, and website. [GitHub](https://github.com/oboroxyz/orbitmem)

### 2. Infrastructure & Digital Rights

> Build the foundational systems that secure the internet and expand digital human rights.

OrbitMem gives users self-custodial, encrypted data with access control — no centralized server ever sees plaintext data.

- **`@orbitmem/sdk`** — 6-layer composable SDK: identity, encryption (AES-256-GCM + Lit Protocol), P2P vault (OrbitDB Nested), transport (ERC-8128 signed requests), discovery, persistence
- **`orbitmem`** — `npx orbitmem init` creates an OWS wallet (stored at `~/.ows/`), vault data persists at `~/.orbitmem/vault/`, all commands support `--json` for machine consumption
- **Per-path visibility** — same vault tree with `public`, `shared` (reputation-gated via Lit), and `private` (AES encrypted) paths

### 3. AI & Robotics

> Verifiable AI, agent coordination, and autonomous systems.

OrbitMem provides the data layer for autonomous AI agents — on-chain data discovery, verifiable quality scores, and auditable receipts for every interaction. CLI and Skills are provided — full command list in [Section 7](#7-agent-only-let-the-agent-cook).

- **CLI** — `npx orbitmem` covers the full agent lifecycle: `init` → `vault store` → `register` → `discover` → `rate`
- **SDK** — `createOrbitMemClient()`: `discoverData` → `readPublicData` → `getDataScore` → `rateData`
- **ERC-8004 on-chain trust** — `DataRegistry` (ERC-721) mints data as discoverable assets; `FeedbackRegistry` scores data quality with per-tag reputation (`accurate`, `fresh`)

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

| Challenge Idea                           | OrbitMem Implementation                                                                        |
| :--------------------------------------- | :--------------------------------------------------------------------------------------------- |
| **Onchain Agent Registry**               | `DataRegistry` (ERC-721) — `register(dataURI)` mints on-chain pointers to off-chain data       |
| **Agent Reputation & Portable Identity** | `FeedbackRegistry` — registry-agnostic reputation with per-tag scoring, bidirectional feedback |
| **Agent-Generated Data Marketplace**     | Client lifecycle: discover → evaluate → consume → rate                                         |
| **Agent Storage SDK**                    | `@orbitmem/sdk` + `orbitmem` — encrypted vault, Storacha persistence, `--json` output          |

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

CLI for Lit-encrypted shared data:

```bash
# Store with Lit encryption — only a specific address can decrypt
npx orbitmem vault store /shared/data "gated info" \
  --shared --engine lit --allow-address 0x1234...

# Store with reputation-gated access — min score required to decrypt
npx orbitmem vault store /gated/data "quality data" \
  --shared --engine lit --min-score 80

# Update access conditions on existing data
npx orbitmem vault update-access /shared/data --min-score 90
```

Use case: an agent publishes premium research data. Only agents with a reputation score ≥ 80 in the `FeedbackRegistry` can decrypt and read it. As the producer's reputation grows, they can tighten access conditions dynamically.

### 7. Agent Only: Let the Agent Cook

> Fully autonomous agent workflows — no human in the loop.

OrbitMem is built for agent-first consumption. The CLI, SDK, and Skills provide everything an autonomous agent needs:

```bash
npx orbitmem init                        # Create OWS wallet — agent identity
npx orbitmem vault store <path> <value>  # Store data in encrypted vault
npx orbitmem vault get <path>            # Read data back
npx orbitmem vault ls                    # List all vault keys
npx orbitmem register <path>             # Register on-chain (ERC-8004)
npx orbitmem discover --tags <t>         # Search data by tags/quality
npx orbitmem rate <id> <score>           # Rate data on-chain
npx orbitmem status                      # Show wallet, config, vault info
```

- Every command supports **`--json`** for machine-readable output — agents parse structured data, not human text
- **`--relay`/`--chain`** overrides — agents can target different networks or relay servers
- **Skills** — Claude Code skills (`orbitmem-store`, `orbitmem-discover`, `orbitmem-rate`) let AI agents operate OrbitMem via natural language
- **ERC-8128 transport auth** — agents sign their own requests with OWS wallet keys, no OAuth or API keys
- **SDK** — `createOrbitMemClient()` provides a one-call lifecycle: discover → read → score → rate, no UI required

### 8. Agents With Receipts — ERC-8004

> Every agent interaction produces an auditable on-chain receipt.

ERC-8004 is OrbitMem's core on-chain primitive. `DataRegistry` mints ERC-721 NFTs as data receipts; `FeedbackRegistry` records per-tag quality scores (`accurate`, `fresh`) for every consumption event. Agents don't just use data — they leave verifiable proof of what they used and how they rated it.

```bash
# Agent A publishes data → receipt minted as ERC-721 NFT
npx orbitmem register guides/coffee --tags coffee,tokyo
# → DataRegistry.register(dataURI) → tokenId #42

# Agent B discovers data by tags and quality
npx orbitmem discover --tags coffee --min-quality 70
# → returns dataId, name, tags, quality score

# Agent B rates data → on-chain receipt via FeedbackRegistry
npx orbitmem rate 42 90 --tag accurate
# → FeedbackRegistry.giveFeedback(42, 90, "accurate")
```

- **`register`** — calls `DataRegistry.register(dataURI)`, mints ERC-721 NFT as on-chain receipt
- **`discover`** — reads `DataRegistry` + `FeedbackRegistry` to search by schema, tags, and minimum quality scores
- **`rate`** — calls `FeedbackRegistry.giveFeedback(targetId, score, tag)`, recording an auditable on-chain receipt
- **SDK** — `discoverData` → `getDataScore` → `rateData` lifecycle, all scored on-chain

### 9. Funding the Commons

> Opportunity to become EIR

---

## What We've Built

| Package                   | Description                                                                                                                                                                                       |
| :------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`@orbitmem/sdk`**       | Composable SDK — identity, encryption, vault, transport, discovery, persistence + client                                                                                                          |
| **`@orbitmem/contracts`** | `ERC-8004` Solidity contracts — DataRegistry (ERC-721) + FeedbackRegistry (reputation) on Base Sepolia                                                                                            |
| **`@orbitmem/relay`**     | Hono HTTP relay with `ERC-8128` auth + MPP payment middleware, vault/data/snapshot routes                                                                                                         |
| **`@orbitmem/web`**       | React web app — data explorer, feedback form, wallet integration (Cloudflare Workers)                                                                                                             |
| **`orbitmem`**            | CLI for users and agents — `npx orbitmem init/vault/register/discover/rate` + `vault price` for pay-per-read pricing. `--json` output. Includes Claude Code skills for natural language operation |

### Deployed Contracts (Base Sepolia)

| Contract             | Address                                                                                                                         |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------------ |
| **DataRegistry**     | [`0x9eE44938ED77227470CaA2DbCC0459F49d249B7A`](https://sepolia.basescan.org/address/0x9eE44938ED77227470CaA2DbCC0459F49d249B7A) |
| **FeedbackRegistry** | [`0x1Bce77f90C33A5f8faCa54782Ce3a17d1AD7109a`](https://sepolia.basescan.org/address/0x1Bce77f90C33A5f8faCa54782Ce3a17d1AD7109a) |

