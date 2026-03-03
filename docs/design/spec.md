# OrbitMem — Technical Specification

**The Sovereign Data Layer for the Agentic Web**
Version 0.3.0 · Multi-Chain (Porto + EVM + Solana) · Pluggable Encryption (Lit / AES) · ERC-8004 for Data

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Identity Layer — Multi-Chain Wallet Auth](#3-identity-layer)
4. [Transport Layer — ERC-8128](#4-transport-layer)
5. [Data Layer — OrbitDB Nested P2P Vault](#5-data-layer)
6. [Encryption Layer — Lit Protocol + AES-256-GCM](#6-encryption-layer)
7. [Persistence Layer — Storacha](#7-persistence-layer)
8. [Discovery Layer — ERC-8004 for Data](#8-discovery-layer)
9. [Agent Integration — OpenClaw Demo](#9-agent-integration)
10. [Security Model](#10-security-model)
11. [Relay Node Specification](#11-relay-node)
12. [SDK Quick Start](#12-quick-start)

---

## 1. Overview

OrbitMem is a modular infrastructure toolkit that provides AI agents with **Sovereign Memory** — a local-first, encrypted, and permissioned data layer. Instead of uploading sensitive user data to centralized vector databases, OrbitMem keeps data under the user's control. Agents are granted conditional, time-limited access to read (never own) user data.

### Design Principles

- **User Sovereignty:** The user's wallet (or passkey) is the root of trust. Data is encrypted client-side before it leaves the device.
- **Chain Agnostic:** Supports Porto Passkey Wallets (WebAuthn P256), EVM chains (Ethereum, Base, Arbitrum, Polygon, Optimism), and Solana (mainnet, devnet).
- **Pluggable Encryption:** Developers choose between Lit Protocol (decentralized conditional access) and AES-256-GCM (fast local encryption) per record.
- **ERC-8004 for Data:** User data is registered as on-chain scored assets. Agents evaluate data quality. All ratings are on-chain and composable.
- **Zero Backend:** No centralized server is required. The Relay Node is a thin, stateless proxy for P2P gossip.
- **Framework Agnostic:** While demonstrated with OpenClaw, OrbitMem works with any agent framework.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER DEVICE                               │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Porto Passkey │  │  EVM Wallet   │  │ Solana Wallet│          │
│  │ (FaceID /    │  │  (MetaMask,   │  │ (Phantom,    │          │
│  │  TouchID)    │  │   WC, CB)     │  │  Solflare)   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                  │
│         └──────────────────┼──────────────────┘                  │
│                            │                                     │
│                   ┌────────▼────────┐   ┌──────────────────────┐│
│                   │ Identity Layer   │   │   OrbitMem Client    ││
│                   │ P256·ECDSA·Ed25519│  │                      ││
│                   │ Session Keys     │   │  ┌────────────────┐ ││
│                   └────────┬────────┘   │  │  OrbitDB Nested │ ││
│                            │            │  │  (Local-First)  │ ││
│                            │            │  └───────┬────────┘ ││
│                            │            │  ┌───────▼────────┐ ││
│                            │            │  │Encryption Layer│ ││
│                            │            │  │ Lit ◇ AES-GCM  │ ││
│                            │            │  └───────┬────────┘ ││
│                            └────────────┘──────────┘          ││
│                                │                               ││
└────────────────────────────────┼───────────────────────────────┘│
                                 │                                 │
                     ┌───────────▼───────────┐                     │
                     │    Relay Node (P2P)    │                     │
                     │  ERC-8128 Verification │                     │
                     │  OrbitDB Replication   │                     │
                     └───────────┬───────────┘                     │
                                 │                                 │
                ┌────────────────┼────────────────┐               │
                │                │                │               │
     ┌──────────▼──┐  ┌─────────▼──────┐  ┌─────▼──────────┐    │
     │   Storacha   │  │  Lit Protocol   │  │  Agent (e.g.   │    │
     │  Filecoin /  │  │  MPC Network    │  │  OpenClaw)     │    │
     │    IPFS      │  │                 │  │                │    │
     └─────────────┘  └────────────────┘  └───────┬────────┘    │
                                                    │             │
                                          ┌─────────▼──────────┐  │
                                          │  ERC-8004 Registries│  │
                                          │  Data ·             │  │
                                          │  Reputation ·       │  │
                                          │  Feedback           │  │
                                          └─────────────────────┘  │
```

### Data Flow Summary

1. User authenticates via Porto Passkey (biometric), EVM wallet, or Solana wallet → session key derived
2. User registers data on-chain via ERC-8004 Data Registry for agent discovery
3. User writes preferences into local OrbitDB Nested vault (per-path visibility)
4. Data is encrypted (Lit for reputation-gated access, or AES for local-only)
5. Encrypted blob syncs to Relay Node via CRDT replication
6. Agent fetches blob using ERC-8128 signed HTTP request
7. Agent decrypts (Lit verifies on-chain reputation ≥ threshold / AES if shared key)
8. Agent executes task, zeroes out plaintext, user submits on-chain feedback

---

## 3. Identity Layer

### Three Authentication Paths

| Auth Method       | Technology                               | Signature Algorithm | Session Key Derivation                                 | UX                                     |
| :---------------- | :--------------------------------------- | :------------------ | :----------------------------------------------------- | :------------------------------------- |
| **Porto Passkey** | WebAuthn + EIP-7702                      | P256 (secp256r1)    | `sha256(passkeyAssertion + nonce)` → P256 session key  | FaceID / TouchID — **zero extensions** |
| **EVM Wallet**    | MetaMask, WalletConnect, Coinbase, Rabby | ECDSA secp256k1     | `keccak256(walletSig + nonce)` → secp256k1 private key | Browser extension / mobile             |
| **Solana Wallet** | Phantom, Solflare, Backpack, Glow        | Ed25519             | `sha256(walletSig + nonce)` → Ed25519 keypair seed     | Browser extension / mobile             |

### Porto Passkey Deep Dive

Porto (porto.sh) is a Passkey-native wallet that uses the device's secure enclave for key management. No seed phrases, no browser extensions.

**How it works:**
1. User triggers biometric prompt (FaceID / TouchID / Windows Hello)
2. WebAuthn creates or uses a P256 (secp256r1) credential in the secure enclave
3. Porto derives an EVM-compatible address from the P256 public key
4. Via **EIP-7702**, the P256-backed EOA can delegate to a smart account on any EVM chain
5. Session keys can be granted via **EIP-7715** for scoped agent permissions

**Why Porto is ideal for OrbitMem:**
- **Zero-install onboarding:** No wallet extension needed — works in any modern browser
- **Biometric security:** Private key never leaves the hardware secure enclave
- **EVM interop:** P256 accounts can interact with EVM chains via delegation
- **Session keys:** Native support for scoped, time-limited permissions — perfect for agent delegation

### Connection Flow

```
User → Auth Method Selection → Porto Passkey / EVM Wallet / Solana Wallet
                                          │
                                signMessage(challenge) or
                                passkeyAssertion(challenge)
                                          │
                                ┌─────────▼──────────┐
                                │  SessionKey {       │
                                │    id: string       │
                                │    parentAddress    │
                                │    family: passkey  │
                                │           |evm|sol  │
                                │    permissions[]    │
                                │    expiresAt        │
                                │  }                  │
                                └─────────────────────┘
```

### Session Key Permissions

Sessions are scoped. An agent can only perform actions that the user explicitly granted:

- `vault:read` — Read specific keys (or all)
- `vault:write` — Write to specific keys (or all)
- `encrypt` / `decrypt` — Use specific encryption engines
- `relay:fetch` — Make signed requests to the Relay Node
- `storacha:archive` / `storacha:retrieve` — Archive or restore snapshots

### Challenge Message Format

```
OrbitMem Authentication
Timestamp: {unix_ms}
Nonce: {random_32_bytes_hex}
Chain: {evm|solana}
Permissions: vault:read, decrypt
Session TTL: 3600s
```

---

## 4. Transport Layer — ERC-8128

ERC-8128 replaces API keys with cryptographically signed HTTP requests. Every request from an agent carries a proof of identity. Supports all three signature algorithms: P256 (Porto), ECDSA (EVM), and Ed25519 (Solana).

### Signed Request Structure

```json
{
  "url": "https://relay.orbitmem.xyz/v1/vault/read",
  "method": "POST",
  "headers": {
    "X-OrbitMem-Signer": "0xABC...123",
    "X-OrbitMem-Family": "passkey",
    "X-OrbitMem-Algorithm": "p256",
    "X-OrbitMem-Timestamp": "1708099200000",
    "X-OrbitMem-Nonce": "a1b2c3d4...",
    "X-OrbitMem-Signature": "0xSIG..."
  },
  "body": { "key": "preferences" }
}
```

### Signature Computation

**Porto Passkey (P256):**
```
payload = sha256(method + url + timestamp + nonce + bodyHash)
assertion = navigator.credentials.get({ challenge: payload })
signature = assertion.response.signature  // P256 / secp256r1
```

**EVM (ECDSA):**
```
payload = keccak256(method + url + timestamp + nonce + bodyHash)
signature = ecdsaSign(payload, sessionPrivateKey)
```

**Solana (Ed25519):**
```
payload = sha256(method + url + timestamp + nonce + bodyHash)
signature = ed25519Sign(payload, sessionPrivateKey)
```

### Replay Protection

The Relay Node maintains a sliding-window nonce cache (5 minute TTL). Any nonce seen within the window is rejected. Combined with the timestamp check (±30 seconds), this prevents replay attacks.

---

## 5. Data Layer — OrbitDB Nested P2P Vault

### Architecture

Each user gets a personal OrbitDB `Nested` store (via [`@orbitdb/nested-db`](https://github.com/orbitdb/nested-db)), identified by their wallet address. Unlike a flat `KeyValue` store, `Nested` supports hierarchical JSON-like paths — enabling **per-path visibility and encryption**.

```typescript
import { Nested } from "@orbitdb/nested-db";
useDatabaseType(Nested);
const db = await orbitdb.open({ type: "nested" });
```

The store is CRDT-based (Conflict-free Replicated Data Type), meaning concurrent writes from multiple devices merge automatically without conflicts.

### Three Visibility Modes — Per Path

Every entry in the vault has a **visibility level** that determines encryption and access behavior. With nested-db, **each path in the same tree can have a different visibility**:

| Visibility    | Encrypted? | Who Can Read       | Encryption Engine                    | Use Cases                                         |
| :------------ | :--------- | :----------------- | :----------------------------------- | :------------------------------------------------ |
| **`public`**  | No         | Anyone via Relay   | None                                 | Agent profiles, dietary prefs, discovery metadata |
| **`private`** | Yes        | Owner only         | AES (wallet-derived key)             | Passport info, personal notes, financial data     |
| **`shared`**  | Yes        | Specific addresses | Lit (conditions) or AES (shared key) | Budget ranges, medical records for providers      |

**Default visibility is `private`** — if omitted, data is encrypted with the owner's wallet-derived AES key.

**Per-path example — same `travel` subtree, mixed visibility:**

```typescript
// Public — agents read freely
await vault.put('travel/dietary', 'vegan', { visibility: 'public' });

// Shared — reputation-gated via Lit
await vault.put('travel/budget', { min: 1000, max: 2000, currency: 'USD' }, {
  visibility: 'shared',
  engine: 'lit',
  accessConditions: [reputationCondition({ minScore: 70 })],
});

// Private — owner only
await vault.put('travel/passport', { number: 'XX123', expiry: '2030-01' }, {
  visibility: 'private',
});

// Read entire subtree (decrypts what caller has access to)
await vault.get('travel');
// → { dietary: 'vegan', budget: { min: 1000, ... }, passport: null }
//   (passport returns null for unauthorized callers)

// Read single leaf
await vault.get('travel/dietary');  // → 'vegan'
```

### Bulk Insert

The `insert()` method merges a nested object into the vault, equivalent to calling `put()` for each leaf path:

```typescript
await vault.insert({
  profile: { name: 'Alice', interests: ['travel', 'food'] },
  settings: { theme: 'dark', lang: 'ja' },
}, { visibility: 'public' });

// Equivalent to:
// vault.put('profile/name', 'Alice', { visibility: 'public' })
// vault.put('profile/interests', ['travel', 'food'], { visibility: 'public' })
// vault.put('settings/theme', 'dark', { visibility: 'public' })
// vault.put('settings/lang', 'ja', { visibility: 'public' })
```

### Storage Schema

Each entry in the vault:

```typescript
{
  path: string;                    // Nested path (e.g. "travel/dietary")
  value: T | EncryptedData;        // Plaintext (public) or encrypted blob
  visibility: "public" | "private" | "shared";
  author: WalletAddress;           // Who wrote this
  authorChain: ChainFamily;        // passkey, evm, or solana
  timestamp: number;               // Unix ms
  encrypted: boolean;              // false for public, true for private/shared
  encryptionEngine?: "lit"|"aes";  // undefined for public
  hash: string;                    // OrbitDB entry hash
}
```

### Public Data — Open Discovery

Public entries are stored as plaintext in OrbitDB. Any peer (including agents) can read them via the Relay Node without authentication or decryption. This enables:

- **Agent Profiles:** Agents can publish their capabilities, supported tasks, and trust scores
- **User Discovery:** Users can share public preferences (favorite cuisines, travel interests) for personalized recommendations without exposing sensitive data
- **Protocol Metadata:** Schema versions, supported encryption engines, public keys for key exchange

```typescript
// User: publish public profile subtree
await orbitmem.vault.insert({
  profile: {
    name: 'Alice',
    interests: ['travel', 'food'],
    supportedAgents: ['openclaw:booking', 'openclaw:dining'],
  },
}, { visibility: 'public' });

// Agent: read user's public data (no decryption needed)
const profile = await agentAdapter.readPublicData({
  vaultAddress: userVault,
  path: 'profile',
  relayUrl: RELAY,
});
// → { name: 'Alice', interests: ['travel', 'food'], ... }
```

### Private vs Shared — Encryption Paths

```
vault.put(path, value, { visibility })
         │
         ├── "public"  → store plaintext → sync to Relay → open read
         │
         ├── "private" → AES encrypt (wallet-derived key) → store → sync
         │                only owner can decrypt
         │
         └── "shared"  → choose engine:
                          ├── "lit"  → Lit encrypt + access conditions → store → sync
                          │           agents decrypt if conditions met
                          └── "aes" → AES encrypt + shared key → store → sync
                                      agents decrypt with shared key

Each path in the nested tree can follow a different branch.
```

### Sync Protocol

```
User Device ←──CRDT──→ Relay Node ←──CRDT──→ Other Devices
                              │
                              │ (periodic snapshots)
                              ▼
                         Storacha / IPFS
```

The Relay Node is a "gossip peer" — it participates in OrbitDB replication but never holds decryption keys. It sees only encrypted blobs.

### Offline-First Guarantees

- All reads/writes hit the local store first
- Sync happens in the background when connectivity is available
- CRDT resolution ensures eventual consistency
- If a user is offline for days, re-sync merges cleanly

---

## 6. Encryption Layer

OrbitMem provides two encryption engines. Developers choose per-record based on their threat model and latency requirements.

### Comparison Matrix

| Feature              | Lit Protocol                               | AES-256-GCM                     |
| :------------------- | :----------------------------------------- | :------------------------------ |
| **Key Management**   | MPC network (decentralized)                | Wallet-derived (local)          |
| **Access Control**   | On-chain conditions (address, token, time) | Shared key (out-of-band)        |
| **Network Required** | Yes (Lit nodes for encrypt/decrypt)        | No (fully offline)              |
| **Latency**          | ~500ms–2s (network round-trip)             | <1ms (local crypto)             |
| **Revocation**       | Update conditions → immediate              | Rotate key → re-encrypt all     |
| **Best For**         | Agent delegation, conditional access       | Offline vaults, high-throughput |
| **Chain Support**    | EVM + Solana conditions                    | Chain-agnostic (any wallet sig) |

### Lit Protocol Flow

```
              ┌─────────────┐
              │  User encrypts│
              │  with Lit SDK │
              └──────┬──────┘
                     │
          ┌──────────▼──────────┐
          │  Symmetric key split │
          │  across Lit MPC nodes│
          └──────────┬──────────┘
                     │
          ┌──────────▼──────────┐
          │  Access Conditions   │
          │  stored with blob    │
          └──────────┬──────────┘
                     │
          ┌──────────▼──────────┐
          │  Agent requests      │
          │  decryption          │
          └──────────┬──────────┘
                     │
          ┌──────────▼──────────┐
          │  Lit nodes verify    │
          │  conditions on-chain │
          └──────────┬──────────┘
                     │
          ┌──────────▼──────────┐
          │  If conditions met:  │
          │  reconstruct key     │
          │  → agent decrypts    │
          └─────────────────────┘
```

### Lit Access Condition Examples

**EVM — Allow specific agent address:**
```json
{
  "conditionType": "evmBasic",
  "contractAddress": "",
  "standardContractType": "",
  "chain": "base",
  "method": "",
  "parameters": [":userAddress"],
  "returnValueTest": {
    "comparator": "=",
    "value": "0xAGENT_ADDRESS"
  }
}
```

**Solana — Allow holder of specific NFT:**
```json
{
  "conditionType": "solRpc",
  "method": "getBalance",
  "params": [":userAddress"],
  "chain": "solana",
  "returnValueTest": {
    "comparator": ">=",
    "value": "1000000000"
  }
}
```

### AES-256-GCM Flow

```
Wallet Signature → HKDF-SHA256 (with salt) → AES-256 Key
                                                   │
                                            ┌──────▼──────┐
                                            │  Encrypt:    │
                                            │  AES-GCM     │
                                            │  IV: random  │
                                            │  Tag: 128bit │
                                            └──────────────┘
```

Key derivation:
```
ikm = walletSignature("OrbitMem AES Key Derivation v1")
salt = crypto.getRandomValues(32)
key = HKDF-SHA256(ikm, salt, info="orbitmem-aes-256-gcm", length=32)
```

---

## 7. Persistence Layer — Storacha

Storacha provides the immutable backbone for dynamic agent memory. Encrypted vault snapshots are archived to Filecoin/IPFS for permanence.

### Archive Flow

```
OrbitDB Nested Vault → Export Snapshot → Already Encrypted → Storacha Upload
                                                           │
                                                    ┌──────▼──────┐
                                                    │  IPFS Pin    │
                                                    │  + Filecoin  │
                                                    │  Deal        │
                                                    └─────────────┘
```

Key point: Storacha never sees plaintext. The snapshot is the raw OrbitDB export, which already contains only encrypted blobs.

### Snapshot Metadata

```typescript
{
  cid: "bafy...",
  size: 245760,
  archivedAt: 1708099200000,
  author: "0xUSER_ADDRESS",
  entryCount: 42,
  encrypted: true,
  filecoinStatus: "active"
}
```

### Restore Protocol

1. Fetch snapshot bytes from IPFS via CID
2. Verify integrity (CID hash check)
3. Import into OrbitDB Nested (CRDT merge — no data loss)
4. Decrypt individual entries on-demand

---

## 8. Discovery Layer — ERC-8004 for Data

OrbitMem applies ERC-8004 to **data discovery and reputation**: user data is registered as a scored, discoverable on-chain asset. Agents evaluate data quality before consuming it, and submit quality feedback after consumption.

### Data Registry & Feedback

| Registry              | Entity             | Who Registers       | Who Rates                     | What It Answers             |
| :-------------------- | :----------------- | :------------------ | :---------------------------- | :-------------------------- |
| **Data Registry**     | Vault Data Entries | Users (data owners) | Agents after data consumption | "Is this data trustworthy?" |
| **Feedback Registry** | (shared ledger)    | —                   | Anyone (registry-agnostic)    | Aggregated scores per tag   |

The **Feedback Registry** accepts any ERC-721 registry address, enabling flexible scoring. Agents authenticate via ERC-8128 signed HTTP — no on-chain agent identity is required.

### Data as a First-Class On-Chain Asset

When a user registers a vault entry in the Data Registry, it becomes:
- **Discoverable** — agents can search for data by schema, tags, quality score
- **Scored** — agents who consume the data submit quality feedback
- **Verifiable** — verification methods (KYC, TEE, zkML) are recorded on-chain
- **Composable** — other smart contracts can read data scores

#### Data Registration File

Each nested path can have its own registration. Example for `travel/dietary`:

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#data-registration-v1",
  "name": "Alice's Dietary Preferences",
  "description": "Dietary restrictions for travel booking agents",
  "schema": {
    "id": "orbitmem:dietary:v1",
    "version": "1.0.0",
    "definitionUrl": "https://schemas.orbitmem.xyz/dietary/v1"
  },
  "access": {
    "vaultAddress": "/orbitdb/zdpu.../alice-vault",
    "path": "travel/dietary",
    "visibility": "public",
    "encryptionEngine": null,
    "relayEndpoint": "https://relay.orbitmem.xyz"
  },
  "quality": {
    "updateFrequency": "monthly",
    "provenance": "self-attested",
    "verificationMethod": "kyc"
  },
  "tags": ["verified", "kyc-backed", "human-curated"],
  "active": true,
  "registrations": [
    { "dataId": 1337, "dataRegistry": "eip155:8453:0xDATA_REGISTRY" }
  ]
}
```

### Data Score — What Agents See

```typescript
interface DataScore {
  dataId: 1337,
  quality: 94,               // Aggregate score (0-100)
  freshness: {
    lastUpdated: 1708099200,  // 2 hours ago
    score: 98,                // Decays over time
  },
  accuracy: {
    score: 92,                // Based on agent feedback
    feedbackCount: 23,
  },
  completeness: {
    score: 96,
    feedbackCount: 23,
  },
  verified: true,
  verificationMethod: "kyc",
  consumptionCount: 47,       // Total agent uses
  totalFeedback: 23,
}
```

### Agent-Side Flow: Evaluate Before Consume

```
Agent                      OrbitMem Discovery       Data Registry
 │                              │                        │
 │── discoverData({            │                        │
 │     schema: "dietary",      │                        │
 │     minQuality: 80,         │                        │
 │     verifiedOnly: true,     │                        │
 │   }) ───────────────────────▶│── query ──────────────▶│
 │                              │◀── DataRegistration[] ─│
 │◀── [Alice: 94, Bob: 71] ───│                        │
 │                              │                        │
 │── getDataScore(alice, path)─▶│── getScore ───────────▶│
 │◀── { quality: 94,           │◀── score ──────────────│
 │     accuracy: 92,           │                        │
 │     verified: true } ───────│                        │
 │                              │                        │
 │   [Quality check passes]    │                        │
 │── fetchUserData(alice, path)▶│                        │
 │   [... decrypt, execute ...] │                        │
 │                              │                        │
 │── rateData({                │                        │
 │     dataId: 1337,           │                        │
 │     value: 90,              │                        │
 │     tag1: "accurate",       │                        │
 │   }) ───────────────────────▶│── giveFeedback() ─────▶│
 │                              │◀── tx confirmed ──────│
```

### Agent-Side Code Example

```typescript
const adapter = createOrbitMemAgentAdapter({
  wallet: { family: 'evm', address: AGENT_ADDR, signMessage: ... },
  lit: { network: 'habanero' },
  discovery: {
    dataRegistry: '0xDATA_REGISTRY',
    reputationRegistry: '0xREP_REGISTRY',
    registryChain: 'base',
    minDataQuality: 80,  // Reject low-quality data
  },
});

// 1. Discover high-quality data sources
const dataSources = await adapter.discoverData({
  schema: 'orbitmem:dietary:v1',
  minQuality: 80,
  verifiedOnly: true,
});

// 2. Full lifecycle with quality check built in
const booking = await adapter.withUserData(
  {
    vaultAddress: dataSources[0].vaultAddress,
    path: 'travel/dietary',
    relayUrl: 'https://relay.orbitmem.xyz',
    minQuality: 80,  // Rejects if score drops below threshold
  },
  async (plaintext, dataScore) => {
    console.log(`Data quality: ${dataScore.quality}/100`);
    const prefs = JSON.parse(new TextDecoder().decode(plaintext));
    return await bookTrip(prefs);
  },
  {
    autoRate: { value: 90, qualityDimension: 'accuracy' },
  }
);
// ✅ plaintext zeroed, feedback submitted automatically
```

### User-Side: Register Data Paths for Discovery

```typescript
// Register individual vault paths as on-chain discoverable assets
await orbitmem.discovery.registerData({
  key: 'travel/dietary',
  name: 'Dietary Preferences',
  description: 'Dietary restrictions for travel booking',
  schema: 'orbitmem:dietary:v1',
  tags: ['verified', 'human-curated'],
});

await orbitmem.discovery.registerData({
  key: 'travel/budget',
  name: 'Travel Budget Range',
  description: 'Budget constraints for travel booking agents',
  schema: 'orbitmem:budget:v1',
  tags: ['verified', 'kyc-backed'],
});

// Check how agents have rated your data
const score = await orbitmem.discovery.getDataScore(myVaultAddr, 'travel/dietary');
console.log(`My data quality: ${score.quality}/100 (${score.totalFeedback} ratings)`);
```

### Reputation-Gated Encryption

**User gates access on data quality conditions:**
```typescript
// Only agents meeting quality thresholds can decrypt budget data
await orbitmem.vault.put('travel/budget', { min: 3000, max: 5000 }, {
  visibility: 'shared',
  engine: 'lit',
  accessConditions: [
    orbitmem.discovery.createDataQualityCondition({
      minQuality: 80,
      verifiedOnly: true,
    }),
  ],
});
```

**Agent gates consumption on data quality:**
```typescript
// Agent refuses to process data below quality threshold
const score = await adapter.getDataScore(vaultAddr, key);
if (score.quality < 80 || !score.verified) {
  throw new Error('Data quality insufficient');
}
```

### Feedback Tags for Data Quality

| tag1           | What It Measures                 | Example                  | value |
| :------------- | :------------------------------- | :----------------------- | :---- |
| `accurate`     | Data matched real-world outcome  | Dietary info was correct | 95    |
| `complete`     | All expected fields present      | Missing budget field     | 60    |
| `fresh`        | Data was up-to-date              | Passport expired         | 20    |
| `schema-valid` | Conformed to declared schema     | Valid                    | 100   |
| `useful`       | Data was actionable for the task | Booking succeeded        | 90    |

### The Virtuous Cycle

```
┌─────────────────────────────────────────────────────┐
│                                                       │
│   User registers data ──▶ Agent discovers data       │
│         ▲                        │                   │
│         │                        ▼                   │
│   Data score improves    Agent evaluates score       │
│         ▲                        │                   │
│         │                        ▼                   │
│   Agent rates data ◀── Agent consumes & executes     │
│                                                       │
└─────────────────────────────────────────────────────┘
```

---

## 9. Agent Integration — OpenClaw Demo

### Scenario

A user wants an OpenClaw agent to book a trip based on private preferences (passport info, dietary restrictions), without uploading this data to the agent's server.

### Sequence Diagram

```
User                    OrbitMem Client       ERC-8004        Relay Node         OpenClaw Agent
 │                           │                  │                │                    │
 │── Authenticate ──────────▶│                  │                │                    │
 │   (Porto / MetaMask /     │                  │                │                    │
 │    Phantom)               │                  │                │                    │
 │                           │                  │                │                    │
 │── Register Data Paths ───▶│                  │                │                    │
 │  (travel/dietary, tags)   │── registerData()▶│                │                    │
 │  (travel/budget, tags)    │◀── dataIds ──────│                │                    │
 │                           │                  │                │                    │
 │── Write Preferences ─────▶│                  │                │                    │
 │  put('travel/dietary',    │                  │                │                    │
 │       'vegan', public)    │── store plaintext─────────────────▶│                   │
 │  put('travel/budget',     │                  │                │                    │
 │       {min,max}, shared)  │── Encrypt (Lit, ─▶│               │                    │
 │  put('travel/passport',   │  rep-gated ≥80)  │                │                    │
 │       {num}, private)     │── Sync to Relay ──────────────────▶│                   │
 │                           │                  │                │                    │
 │                           │                  │                │◀── discoverData() ─│
 │                           │                  │◀── findData() ─│── score: 94 ──────▶│
 │                           │                  │                │                    │
 │                           │                  │                │  [Quality ≥ 80 ✓]  │
 │                           │                  │                │◀── fetch paths ───│
 │                           │                  │                │── dietary(plain) ─▶│
 │                           │                  │                │── budget(enc blob)▶│
 │                           │                  │                │                    │
 │                           │                  │                │     ┌──────────────┤
 │                           │                  │                │     │ Lit Decrypt   │
 │                           │                  │                │     │ (agent rep ✓) │
 │                           │                  │                │     │ Execute Task  │
 │                           │                  │                │     │ data.destroy()│
 │                           │                  │                │     └──────────────┤
 │                           │                  │                │                    │
 │◀── Booking Confirmation ──────────────────────────────────────────────────────────│
 │                           │                  │                │                    │
 │                           │                  │◀── rateData(90)────────────────────│
 │                           │                  │                │   (Agent rates data)│
```

### Agent-Side Code

```typescript
import { createOrbitMemAgentAdapter } from '@orbitmem/agent';

const agent = createOrbitMemAgentAdapter({
  wallet: {
    family: 'evm',
    address: '0xAGENT...',
    signMessage: (msg) => agentWallet.signMessage(msg),
  },
  lit: { network: 'habanero' },
});

// Fetch + decrypt + execute + forget (all in one)
const booking = await agent.withUserData(
  { vaultAddress: userVault, path: 'travel/dietary', relayUrl: RELAY },
  async (plaintext) => {
    const dietary = JSON.parse(new TextDecoder().decode(plaintext));
    return await bookFlight({ dietary });
  }
);
// plaintext is now zeroed out — agent cannot access it again
```

---

## 10. Security Model

### Threat Model

| Threat                           | Mitigation                                                                                                                                                                  |
| :------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Relay Node compromise**        | Relay only sees encrypted blobs (private/shared). Public data is intentionally open.                                                                                        |
| **Agent goes rogue**             | Lit conditions can include time limits. User can revoke access instantly. Public data contains no sensitive info by design.                                                 |
| **Accidental public exposure**   | SDK defaults to `private` visibility. Explicit `visibility: 'public'` required.                                                                                             |
| **Replay attack**                | ERC-8128 nonce + timestamp window (±30s)                                                                                                                                    |
| **Reputation gaming (ERC-8004)** | Minimum feedback count thresholds. Validation Registry for high-stakes tasks. Sybil resistance via stake requirements.                                                      |
| **Agent identity spoofing**      | ERC-8128 signed HTTP ensures agent identity is cryptographically verifiable. No on-chain agent registry needed — wallet signature is the proof.                              |
| **Data quality manipulation**    | Data scores are derived from multiple independent agent feedback entries. Outlier detection removes suspicious ratings. Minimum consumption count before score is trusted.  |
| **Fake data registration**       | Data Registry requires wallet ownership proof. Verification tags (kyc-backed, tee-attestation) require external validation. Schema compliance can be checked automatically. |
| **Man-in-the-middle**            | All transport is TLS + signed. Signature verification at Relay.                                                                                                             |
| **Key leakage (AES)**            | Keys derived from wallet sig — never stored, always re-derived.                                                                                                             |
| **Lit network downtime**         | Fallback to AES for critical paths. Lit has multi-network redundancy.                                                                                                       |
| **CRDT data corruption**         | Storacha snapshots provide immutable restore points.                                                                                                                        |

### Data Lifecycle

```
CREATE → vault.put(path, value, { visibility })
          Per-path visibility check:
          ├── public  → store plaintext
          ├── private → AES encrypt (owner key)
          └── shared  → Lit/AES encrypt (conditions)
                              │
                        Store (OrbitDB Nested) → Sync (Relay)
                                                    │
                                              Archive (Storacha)
                                                    │
REGISTER → vault path → ERC-8004 Data Registry (mint ERC-721)
          ├── schema, tags, quality metadata
          ├── registered per-path (e.g. "travel/dietary", "travel/budget")
          └── discoverable by agents on-chain
                                                    │
READ   → Agent discovers data path → checks DataScore
          ├── quality < threshold → REJECT
          ├── public path  → Relay serves plaintext
          ├── private path → only owner wallet can decrypt
          └── shared path  → Agent Request (ERC-8128) → Lit/AES decrypt
                                                    │
                                              Execute → Forget
                                                    │
RATE   → On-chain data quality feedback
          └── Agent → Data path (via rateData)
                                                    │
DELETE → vault.del(path) → CRDT tombstone propagates → Snapshot retains history
         vault.del("travel") deletes entire subtree
```

---

## 11. Relay Node Specification

The Relay Node is a thin, stateless P2P bridge. It is **not** a backend.

### Responsibilities

1. Participate in OrbitDB CRDT replication (gossip peer)
2. Verify ERC-8128 signatures on incoming agent requests
3. Serve encrypted blobs to authorized agents
4. Trigger periodic Storacha archival

### Endpoints

| Method | Path                             | Description                                      |
| :----- | :------------------------------- | :----------------------------------------------- |
| POST   | `/v1/auth/challenge`             | Generate a challenge for wallet auth             |
| GET    | `/v1/vault/public/:address/:key` | Read public entry (no auth required)             |
| GET    | `/v1/vault/public/:address/keys` | List public keys for an address                  |
| POST   | `/v1/vault/read`                 | Read an encrypted entry (ERC-8128 required)      |
| GET    | `/v1/data/search`                | Search registered data sources (query params)    |
| GET    | `/v1/data/:dataId/score`         | Get aggregated data quality score                |
| POST   | `/v1/data/:dataId/feedback`      | Submit data quality feedback (ERC-8128 required) |
| POST   | `/v1/vault/sync`                 | Trigger CRDT sync                                |
| GET    | `/v1/snapshots`                  | List snapshots for an address                    |
| POST   | `/v1/snapshots/archive`          | Trigger archival to Storacha                     |
| GET    | `/v1/health`                     | Health check                                     |

### Infrastructure

- Runtime: Node.js with Helia (IPFS) + OrbitDB
- Deployment: Docker container, stateless, horizontally scalable
- Storage: In-memory CRDT state + periodic Storacha flush
- Auth: All mutation endpoints require ERC-8128 signed requests

---

## 12. SDK Quick Start

### Installation

```bash
npm install @orbitmem/sdk @orbitmem/agent
```

### User Side

```typescript
import { createOrbitMem } from '@orbitmem/sdk';

// Initialize
const orbitmem = await createOrbitMem({
  identity: {
    chains: ['passkey', 'evm', 'solana'],
    passkey: {
      rpId: 'app.orbitmem.xyz',
      rpName: 'OrbitMem',
      delegationChain: 'base',   // EIP-7702 delegation target
      enableSessionKeys: true,    // EIP-7715 agent sessions
    },
    evm: {
      chains: ['base', 'ethereum'],
      adapters: ['metamask', 'walletconnect'],
    },
    solana: {
      cluster: 'mainnet-beta',
      adapters: ['phantom'],
    },
  },
  encryption: {
    defaultEngine: 'lit',
    lit: { network: 'habanero' },
    aes: { kdf: 'hkdf-sha256' },
  },
  persistence: {
    spaceDID: 'did:key:z6Mkr...',
    autoArchiveInterval: 300000, // 5 min
  },
  discovery: {
    dataRegistry: '0xDATA_REGISTRY',
    reputationRegistry: '0xREPUTATION_REGISTRY',
    validationRegistry: '0xVALIDATION_REGISTRY',
    registryChain: 'base',
    minDataScore: 60,
  },
});

// Connect via Porto Passkey (biometric — no wallet extension needed)
const conn = await orbitmem.connect({ method: 'passkey' });
console.log(`Connected via FaceID: ${conn.address}`);

// Or connect via traditional wallet
// const conn = await orbitmem.connect({ method: 'evm' });
// const conn = await orbitmem.connect({ method: 'solana' });

// Store data with per-path visibility (nested-db)

// PUBLIC — agents read freely, no encryption
await orbitmem.vault.put('travel/dietary', 'vegan', { visibility: 'public' });
await orbitmem.vault.insert({
  profile: {
    name: 'Alice',
    interests: ['travel', 'food', 'tech'],
    supportedAgents: ['openclaw:booking'],
  },
}, { visibility: 'public' });

// SHARED — reputation-gated Lit encryption
await orbitmem.vault.put('travel/budget', { min: 3000, max: 5000, currency: 'USD' }, {
  visibility: 'shared',
  engine: 'lit',
  accessConditions: [
    // Reputation-gated: only agents with score ≥ 80 can decrypt
    orbitmem.discovery.createReputationCondition({
      minScore: 80,
      tag: 'starred',
      minFeedbackCount: 50,
    }),
  ],
});

// PRIVATE — AES, owner-only (default if omitted)
await orbitmem.vault.put('travel/passport', {
  number: 'XX123456', expiry: '2030-01-01',
}, { visibility: 'private' });
// Key auto-derived from wallet signature

// Read subtree — returns merged JSON (decrypts what caller has access to)
const travel = await orbitmem.vault.get('travel');
// → { dietary: 'vegan', budget: { min: 3000, max: 5000, ... }, passport: { number: '...' } }

// Register specific paths for agent discovery (ERC-8004 Data Registry)
await orbitmem.discovery.registerData({
  key: 'travel/dietary',
  name: 'Dietary Preferences',
  description: 'Dietary restrictions for booking agents',
  schema: 'orbitmem:dietary:v1',
  tags: ['verified', 'human-curated'],
});
await orbitmem.discovery.registerData({
  key: 'travel/budget',
  name: 'Travel Budget Range',
  description: 'Budget constraints for travel booking agents',
  schema: 'orbitmem:budget:v1',
  tags: ['verified', 'kyc-backed'],
});
// Agents can now discover and evaluate each data path independently

// Archive to Filecoin
const snapshot = await orbitmem.persistence.archive({
  label: 'pre-trip-backup',
});
console.log(`Archived: ${snapshot.cid}`);
```

### Agent Side

```typescript
import { createOrbitMemAgentAdapter } from '@orbitmem/agent';

const adapter = createOrbitMemAgentAdapter({
  wallet: {
    family: 'evm',
    address: AGENT_ADDRESS,
    signMessage: (msg) => agentSigner.signMessage(msg),
  },
  lit: { network: 'habanero' },
  discovery: {
    dataRegistry: '0xDATA_REGISTRY',
    reputationRegistry: '0xREP_REGISTRY',
    registryChain: 'base',
    minDataQuality: 80,  // Reject low-quality data
  },
});

// 1. Discover high-quality data sources
const dataSources = await adapter.discoverData({
  schema: 'orbitmem:dietary:v1',
  minQuality: 80,
  verifiedOnly: true,
});
console.log(`Found ${dataSources.length} verified data sources`);

// 2. Evaluate data score before consuming
const score = await adapter.getDataScore(
  dataSources[0].vaultAddress,
  'travel/dietary'
);
console.log(`Data quality: ${score.quality}/100, accuracy: ${score.accuracy.score}`);

// 3. Full lifecycle: fetch → decrypt → execute → rate
const booking = await adapter.withUserData(
  {
    vaultAddress: dataSources[0].vaultAddress,
    path: 'travel/dietary',
    relayUrl: 'https://relay.orbitmem.xyz',
    minQuality: 80,
  },
  async (plaintext, dataScore) => {
    const prefs = JSON.parse(new TextDecoder().decode(plaintext));
    return await bookTrip(prefs);
  },
  {
    autoRate: { value: 92, qualityDimension: 'accuracy' },
  }
);
// ✅ plaintext zeroed, data quality feedback submitted on-chain

// Data quality feedback (auto-submitted if autoRate is set, or manually)
// Already submitted via autoRate in withUserData() above
```

---

*OrbitMem — Users own the data. Agents are mere visitors.*