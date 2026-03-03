# OrbitMem — The Sovereign Data Layer for the Agentic Web

> PL_Genesis: Frontiers of Collaboration Hackathon Submission

---

## One-Liner

**OrbitMem gives users a personal, encrypted, P2P data vault that AI agents can discover, evaluate, and consume — without ever uploading personal data to agent servers.**

---

## The Problem

Today's AI agents require users to surrender personal data to centralized servers. Every booking agent, healthcare assistant, and financial advisor demands you re-enter your preferences, upload documents, and trust a third party with your most sensitive information. This creates three critical failures:

**No Data Sovereignty.** Users don't own their data — platforms do. When a service shuts down, your preferences, history, and context disappear with it.

**No Trust Signal.** Users can't verify if an agent is trustworthy before sharing data. Agents can't verify if user data is accurate before consuming it. There's no shared reputation layer.

**No Selective Disclosure.** It's all-or-nothing. You can't share your dietary preferences with a booking agent while keeping your passport number private — even when both live in the same data set.

---

## The Solution

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

## Key Innovation: ERC-8004 for Data

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

## Sponsor Technology Integration

### Storacha — Decentralized Hot Storage (Filecoin/IPFS)

OrbitMem uses Storacha as the **persistence and archival layer**. All vault data is periodically snapshotted and stored on the Filecoin network via Storacha, providing:

- **Immutable backups** — encrypted vault snapshots archived to Filecoin via Storacha upload
- **Disaster recovery** — restore full vault state from any snapshot CID
- **Verifiable storage** — Filecoin deals provide cryptographic proof that data is stored
- **No plaintext exposure** — Storacha only sees encrypted blobs (encryption happens before upload)

```
OrbitDB Nested Vault → Export Snapshot → Already Encrypted → Storacha Upload
                                                              ↓
                                                         Filecoin Deal
                                                         (verifiable storage)
```

### Lit Protocol — Reputation-Gated Encryption

Lit Protocol is OrbitMem's **primary encryption engine for shared data**. It enables:

- **On-chain condition-based decryption** — agents can only decrypt if data quality conditions are met
- **No trusted intermediary** — Lit's distributed key management means no single party holds decryption keys
- **Dynamic access** — if an agent's reputation drops below threshold, they lose access automatically
- **Composable conditions** — combine reputation score, token holdings, time windows, and more

```typescript
// Lit encrypts data with on-chain access conditions
const accessConditions = [
  orbitmem.discovery.createDataQualityCondition({
    minQuality: 80,        // Feedback Registry quality check
    verifiedOnly: true,    // Require verified data sources
  }),
];
```

### Filecoin Ecosystem — Sovereign Data Layer

OrbitMem directly advances the **"Sovereign Data Layer"** vision from the Protocol Labs ecosystem:

- IPFS for content-addressable data transport
- Filecoin (via Storacha) for verifiable long-term storage
- OrbitDB (built on Helia/IPFS) for local-first P2P replication
- ERC-721 NFTs as on-chain pointers to off-chain data

---

## Use Cases

### 1. AI Travel Agent — Selective Data Sharing

**Scenario:** A user wants an AI agent to book flights based on dietary restrictions and budget, without exposing passport details.

**With OrbitMem:**
- `travel/dietary` → public, agent reads freely
- `travel/budget` → shared, reputation-gated via Lit (score ≥ 80)
- `travel/passport` → private, agent never sees it
- Agent evaluates data quality score before consuming
- After booking, user rates agent; agent rates data accuracy
- Vault snapshot archived to Filecoin via Storacha

### 2. Decentralized Health Records — Patient-Controlled Access

**Scenario:** A patient wants to share allergy information with a telemedicine AI, but not their full medical history.

**With OrbitMem:**
- `health/allergies` → shared with verified medical agents (Lit + KYC tag)
- `health/medications` → shared with higher reputation threshold
- `health/records/full` → private, patient-only
- Medical AI checks data quality score — verified, KYC-backed data scores higher
- All data archived on Filecoin — immutable, patient-owned medical record

### 3. DeFi Portfolio Agent — Trustless Financial Data

**Scenario:** A DeFi optimization agent needs access to a user's risk tolerance and portfolio preferences, but not private keys or wallet balances.

**With OrbitMem:**
- `finance/risk-profile` → shared, reputation-gated
- `finance/preferences` → shared, lower threshold
- `finance/keys/*` → private, never accessible
- Agent reputation includes on-chain validation history
- Bidirectional trust: user rates execution quality; agent rates data completeness

### 4. Cross-Platform Data Portability

**Scenario:** A user switches from one booking platform to another. Today, they lose all preferences and history.

**With OrbitMem:**
- All preferences stored in user-owned OrbitDB vault, not on any platform
- New agent discovers existing data via ERC-8004 Data Registry
- Data quality scores transfer — new agent trusts data with 94/100 quality score
- Zero re-entry of information, zero platform lock-in

---

## Hackathon Track Alignment

### Primary: AI/AGI and Robotics

OrbitMem solves the **data access problem for autonomous AI agents** — how agents get the personal context they need to act on behalf of users, without compromising privacy or requiring centralized data brokers.

### Secondary: Web3 and Digital Human Rights

OrbitMem establishes **data sovereignty as a protocol-level right**: users own their data in a P2P vault, control who accesses what through on-chain conditions, and maintain a verifiable reputation system that holds both users and agents accountable.

### Secondary: Crypto and Economic Systems

The bidirectional ERC-8004 trust model creates a **new economic primitive**: data-as-a-scored-asset. Quality data is discoverable and valuable. A reputation economy emerges where both data providers and consumers are incentivized to maintain high standards.

---

## Technical Stack Summary

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
| SDK                  | TypeScript (`@orbitmem/sdk`)    | MIT              |

---

## What We've Built

- **Full TypeScript SDK type definitions** — `@orbitmem/sdk` with 1600+ lines of typed interfaces covering all 6 layers
- **Technical specification** — v0.3.0 with contract architecture, sequence diagrams, security model, and API design
- **Architecture visualization** — Interactive React component showing the full stack
- **ERC-8004 for Data design** — Novel application of on-chain discovery and reputation to data quality scoring
- **Nested vault design** — Per-path visibility/encryption using `@orbitdb/nested-db`

---

## Why OrbitMem Matters

**For Users:** You own your data. You decide what to share, with whom, and under what conditions. Your preferences follow you across platforms and agents — portable, encrypted, sovereign.

**For Agents:** You can discover high-quality, verified data sources without building relationships with individual users. On-chain quality scores let you evaluate data before consuming it. The reputation system rewards reliable behavior.

**For the Ecosystem:** An on-chain data trust protocol where data quality is verifiable creates a foundation for the agentic web that doesn't require trusting centralized intermediaries.

---

## Links

- SDK Types: `@orbitmem/sdk` (TypeScript)
- Technical Spec: OrbitMem v0.3.0
- Architecture: React visualization

---

*OrbitMem — Your data. Your vault. Your rules.*