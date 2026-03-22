# OrbitMem — Review FAQ

Anticipated questions for PL_Genesis: Frontiers of Collaboration Hackathon judging.

---

## Hackathon Context

### Structure
- **Total prize pool**: $150K+ (USD/USDC)
- **Tracks**: Fresh Code ($50K, 10 × $5K) + Existing Code ($50K, 10 × $5K) + Sponsor Bounties ($50K+)
- **Track prizes**: Infrastructure & Digital Rights / Crypto / AI & Robotics / Neurotech — $6K each (1st $3K, 2nd $2K, 3rd $1K)
- **Submitted challenges**: Fresh Code, Infrastructure & Digital Rights, AI & Robotics, Filecoin ($2.5K bounty), Storacha ($500 + credits), Lit Protocol ($1K), Agent Only, Agents With Receipts (ERC-8004), Funding the Commons (EIR residency)

### Judging Process
Two rounds:
1. **Round 1 (Sponsor Judging)**: Individual sponsor teams verify meaningful bounty integration and basic viability
2. **Round 2 (Protocol Labs)**: PL judging panel scores semi-finalists on published criteria, selects winners

### Official Judging Criteria (5 axes, equal weight)
| Criterion | What judges look for |
|-----------|---------------------|
| **Technical Excellence** | Code quality, architecture, test coverage, security |
| **Integration Depth** | How meaningfully sponsor APIs/SDKs are used (not just surface-level) |
| **Utility & Impact** | Real-world usefulness, problem significance, potential scale |
| **Innovation** | Novel approach, creative use of technology, originality |
| **Presentation & Documentation** | Demo video quality, README clarity, architecture explanation |

### Requirements
- Public open-source repo (MIT/Apache-2)
- Demo video ≤ 3 minutes (YouTube)
- 250–500 word project summary
- Must integrate ≥ 1 sponsor API/SDK
- Team max 5 people
- English or English subtitles

### Post-hackathon
Top teams advance to **Founders Forge** pre-accelerator (mentorship, grants, Protocol Labs network). Selection based on: technical excellence, integration depth, long-term potential, team commitment

---

## Per-Criterion Talking Points

### Technical Excellence
- 5 packages + 1 example app, all from scratch
- 6-layer composable SDK architecture (factory functions, interface-driven)
- 2 deployed Solidity contracts on Base Sepolia (OpenZeppelin v5)
- 70+ TypeScript test cases + 32 Foundry test functions
- ERC-8128 replay protection (timestamp ±30s, nonce TTL 5 min)
- Dual-database vault architecture (data + metadata separation)
- Lazy imports for heavy dependencies (Lit Protocol)

### Integration Depth
- **Filecoin/Storacha**: 3-mode persistence layer (Direct UCAN, Managed relay, Mock). Encrypted before upload. CLI `snapshot` command
- **Lit Protocol**: `LitEngine` class with reputation-gated decryption conditions tied to on-chain `FeedbackRegistry` scores. Dynamic access revocation
- **IPFS/OrbitDB**: Core data layer — every vault entry is content-addressed P2P storage
- **Base L2**: Contracts deployed and operational on Base Sepolia

### Utility & Impact
- Solves real problem: IPFS lacks encryption, auth, and discovery
- Two concrete user personas: AI agent developers + privacy-conscious users
- Working demo app (Memo) showing full encrypt → store → discover → archive flow
- CLI with `--json` output enables autonomous agent workflows
- Virtuous cycle: quality data → more consumption → higher reputation → more discovery

### Innovation
- ERC-8004 proposal: First on-chain data discovery + reputation standard (registry-agnostic FeedbackRegistry)
- ERC-8128 proposal: Multi-chain signed HTTP (EVM, Solana, Passkeys in one protocol)
- Reputation-gated encryption: Lit Protocol conditions tied to on-chain quality scores — access automatically revoked when reputation drops
- Per-path visibility in same data tree (public + shared + private coexisting)

### Presentation & Documentation
- Slides (HTML, 7 slides), demo video, project summary
- CLAUDE.md with full architecture, commands, conventions
- Design docs in `docs/design/`
- This FAQ document for judge preparation

---

## General

### Q1. What is OrbitMem in one sentence?

A decentralized data layer for AI agents and humans — encrypted P2P vaults, on-chain data discovery, and verifiable data trust built on IPFS/OrbitDB. It fills the three gaps IPFS leaves open: encryption, authentication, and discovery.

### Q2. How does OrbitMem differ from Ceramic, Tableland, WeaveDB, etc.?

| Axis | Existing Solutions | OrbitMem |
|------|-------------------|----------|
| Storage | Server-dependent or single-chain | OrbitDB (P2P local-first) + Filecoin (persistence) |
| Encryption | Delegated to app layer | Protocol-native (AES-256-GCM + Lit Protocol) |
| Authentication | DID/session | ERC-8128 signed HTTP (multi-chain) |
| Data trust | None | ERC-8004 on-chain reputation |
| AI agent support | Limited | CLI `--json`, Client facade, Skills for autonomous operation |

The key differentiator is the **data trust layer** — data isn't just stored and discovered, but scored by consumers, building on-chain reputation as a protocol primitive.

### Q3. How much was built during the hackathon? Is it from scratch?

Everything is built from scratch during the hackathon period:

- `@orbitmem/sdk` — 6-layer composable SDK (identity, encryption, data, transport, discovery, persistence) + client facade
- `@orbitmem/contracts` — 2 Solidity contracts (DataRegistry + FeedbackRegistry), deployed to Base Sepolia
- `@orbitmem/relay` — Hono HTTP relay server with ERC-8128 auth middleware
- `@orbitmem/cli` — CLI tool (`npx orbitmem`) with `--json` output for agent consumption
- `@orbitmem/web` — React dashboard (Cloudflare Workers deployment)
- `examples/memo` — Fully functional demo app

Tests include 30 TypeScript test files + 3 Solidity test files (70+ test cases total).

### Q4. What was the hardest technical challenge?

Designing the dual-database vault architecture — each vault needs a primary encrypted store and a separate metadata store for visibility flags. Getting OrbitDB Nested to work with per-path encryption while keeping metadata queryable in plaintext required careful separation of concerns. The second challenge was implementing ERC-8128 multi-chain signature verification (ECDSA, Ed25519, P256) with a unified payload format.

---

## Challenge-Specific Questions

### Fresh Code

#### Q5. Can you prove this was built during the hackathon?

Yes — the GitHub repository commit history starts within the hackathon period. All packages, contracts, tests, and the demo app were developed from Feb 10 onward. The repo is at [github.com/oboroxyz/orbitmem](https://github.com/oboroxyz/orbitmem).

### Infrastructure & Digital Rights

#### Q6. How does OrbitMem protect digital rights?

- **Self-custodial data**: Users own their encryption keys; no server ever sees plaintext
- **Per-path visibility**: Same vault tree with `public`, `shared` (reputation-gated via Lit), and `private` (AES encrypted) paths
- **No platform lock-in**: Data lives in P2P OrbitDB, replicable across nodes without any central authority
- **Censorship resistance**: Local-first, offline-capable, no single point of failure

#### Q7. What does "sovereign data" mean in practice?

The user's wallet generates encryption keys. Data is encrypted client-side before being stored in OrbitDB. The relay server only handles encrypted blobs — it never has access to plaintext. Users can revoke shared access dynamically via Lit Protocol reputation conditions.

### AI & Robotics

#### Q8. How do AI agents actually use OrbitMem?

Three interfaces, all designed for autonomous operation:

1. **SDK Client** — `createOrbitMemClient()` provides a one-call lifecycle: `discoverData` → `readPublicData` → `getDataScore` → `rateData`
2. **CLI** — Every command supports `--json` for machine-readable output. Agents can `vault store`, `register`, `discover`, `snapshot` without human intervention
3. **Skills** — Claude Code skills let agents operate OrbitMem via natural language (e.g. "store my travel preferences in the vault")

#### Q9. What makes this "verifiable AI"?

Every data interaction produces an on-chain receipt:
- `DataRegistry.register()` mints an ERC-721 NFT for the data entry
- `FeedbackRegistry.giveFeedback()` records the score, tag, and optional `feedbackHash` on-chain
- Agents can verify data quality before consumption by querying `getAverageScore()` and `getTagScore()`

The entire discover → consume → rate cycle is auditable on-chain.

### Filecoin

#### Q10. Which of the 7 Filecoin challenge ideas does OrbitMem address?

4 of 7:

| Challenge Idea | OrbitMem Implementation |
|----------------|------------------------|
| **Onchain Agent Registry** | `DataRegistry` (ERC-721) — `register(dataURI)` mints on-chain pointers |
| **Agent Reputation & Portable Identity** | `FeedbackRegistry` — registry-agnostic, per-tag scoring, bidirectional |
| **Agent-Generated Data Marketplace** | Client lifecycle: discover → evaluate → consume → rate |
| **Agent Storage SDK** | `@orbitmem/sdk` + `@orbitmem/cli` — encrypted vault, Storacha persistence, `--json` output |

#### Q11. How is Filecoin/IPFS used beyond just storage?

- **OrbitDB** runs on IPFS — every vault entry is content-addressed
- **Storacha** archives encrypted snapshots to Filecoin — immutable backup with CID-based retrieval
- **Encryption before upload** — no plaintext on Filecoin; encrypted blobs only
- **P2P replication** — vault data syncs across IPFS peers without a central coordinator

### Storacha

#### Q12. How meaningful is the Storacha integration?

Three concrete touchpoints:

1. **`createPersistenceLayer()`** — Wraps `@storacha/client` with UCAN proof delegation for direct Filecoin uploads
2. **`npx orbitmem snapshot`** — One-command vault archive from CLI
3. **`POST /v1/snapshots/archive`** — Relay endpoint for programmatic snapshots

The persistence layer supports 3 modes: Direct (BYOS with UCAN), Managed (relay-backed), and Mock (dev/test). All data is encrypted before upload — Storacha never sees plaintext.

### Lit Protocol

#### Q13. How is Lit Protocol used beyond basic encryption?

Lit Protocol enables **reputation-gated decryption** — a unique pattern:

- Data is encrypted with Lit, and access conditions reference the on-chain `FeedbackRegistry`
- Only agents with a quality score ≥ threshold can decrypt
- If an agent's reputation drops below the minimum, access is **automatically revoked** — no manual intervention
- This creates a direct link between on-chain reputation and data access

Implementation: `LitEngine` class in `@orbitmem/sdk` with lazy-loaded client, session signatures, and configurable network (`datil-dev`/`datil-test`/`datil`).

#### Q14. Is the Lit integration production-ready?

The `LitEngine` is fully implemented (162 lines) with support for real Lit networks, session signatures, and access condition-based decryption. Tests use mock encryption (AES fallback) to avoid network dependencies. Live E2E testing against Lit nodes is listed as future work. The lazy import pattern ensures Lit's heavy dependencies don't impact bundle size when not used.

### Agent Only: Let the Agent Cook

#### Q15. Can an agent operate OrbitMem with zero human intervention?

Yes. The full lifecycle is machine-operable:

```bash
# Initialize identity
npx orbitmem init --json

# Store data
npx orbitmem vault store research/q1 '{"topic":"AI"}' --json

# Register on-chain
npx orbitmem register --json

# Discover data
npx orbitmem discover --schema research --min-score 70 --json

# Archive to Filecoin
npx orbitmem snapshot --json
```

Every command returns structured JSON. ERC-8128 transport auth uses wallet keys directly — no OAuth flows, no API keys, no browser required.

### Agents With Receipts (ERC-8004)

#### Q16. What exactly is ERC-8004?

ERC-8004 is our proposed standard for "Data" — on-chain data discovery and reputation. Two contracts:

- **DataRegistry** (ERC-721): Mints data entries as NFTs with `dataURI`, schema tags, and active/inactive toggle
- **FeedbackRegistry** (registry-agnostic): Records per-tag quality scores (`accurate`, `fresh`, `complete`) with `feedbackURI` + `feedbackHash` for anchoring off-chain evidence

The FeedbackRegistry works against **any** ERC-721 registry, not just OrbitMem's DataRegistry.

#### Q17. How do "receipts" work?

Every interaction leaves a verifiable on-chain trace:

```
Agent A stores data → register() → NFT minted (receipt #1)
Agent B discovers data → checks FeedbackRegistry score
Agent B consumes data → giveFeedback(score: 90, tag: "accurate") → on-chain receipt #2
Agent A's reputation increases → more discoverable
```

Both the data registration and the feedback are immutable on-chain records.

---

## Technical Deep Dive

### Q18. Are ERC-8004 and ERC-8128 official Ethereum standards?

Both are **proposed standards by this project**, not finalized ERCs.

- **ERC-8004** — On-chain data discovery & reputation primitive. Implemented in Solidity and deployed to Base Sepolia
- **ERC-8128** — Multi-chain signed HTTP requests (ECDSA/Ed25519/P256). Implemented as `@slicekit/erc8128`

### Q19. Why OrbitDB over other databases?

- **Local-first**: Data lives on the user's device first, syncs P2P
- **IPFS-native**: Content-addressable, data integrity guaranteed
- **Offline-capable**: Read/write without network connectivity
- **Nested stores**: Hierarchical JSON paths for structured vault data
- **No central server**: True user sovereignty over data

### Q20. Explain the encryption architecture.

Two engines, selected per path:

| Engine | Use case | Mechanism |
|--------|----------|-----------|
| **AES-256-GCM** | `private` data | Key derived from wallet signature. Fast, offline-capable |
| **Lit Protocol** | `shared` data | On-chain conditions (reputation score ≥ N) gate decryption. Dynamic access control |

Each vault path has a `visibility` flag (`public` / `shared` / `private`), allowing mixed access levels within the same data tree.

### Q21. How do you prevent replay attacks?

ERC-8128 middleware implements:

- **Timestamp validation**: ±30 second tolerance window
- **Nonce cache**: In-memory TTL (5 min) nonce cache prevents reuse
- **Signed payload**: `METHOD\nURL\ntimestamp\nonce\nSHA256(body_hex)` — any tampering invalidates the signature

### Q22. What does "registry-agnostic" mean for FeedbackRegistry?

`FeedbackRegistry` accepts **any** ERC-721 registry address as a parameter. It can score data entries from OrbitMem's `DataRegistry` or any other project's ERC-721 contract. This makes it a reusable reputation primitive for the broader ecosystem.

### Q23. Why the dual-database vault architecture (primary + meta)?

Each vault has two OrbitDB instances:

1. **Primary (nested)** — Actual data (encrypted when private/shared)
2. **Meta DB (`-meta`)** — Visibility flags and encryption metadata

Separation reasons:
- Metadata must be readable in plaintext (to determine visibility before attempting decryption)
- Separating encrypted data from access control info simplifies the security model
- Meta-only sync avoids transferring large data payloads when only checking permissions

### Q24. How does multi-chain auth work in ERC-8128?

The `X-OrbitMem-Family` header specifies the signature family:

- `evm` — secp256k1 ECDSA (Ethereum, Base)
- `solana` — Ed25519
- `passkey` — P-256 (WebAuthn/FIDO2)

The signed payload format is identical across chains (`METHOD\nURL\timestamp\nnonce\nSHA256(body)`). Verification logic branches by family.

---

## Business & Ecosystem

### Q25. What's the business model?

Three monetization paths:

1. **MPP (Micropayment Protocol)** — Pay-per-read data pricing. Relay middleware implemented, payment verification integration in progress
2. **Relay operator fees** — Relay operators charge transit fees (PaymentSplitter contract is future work)
3. **Tiered storage plans** — PlanService manages free/starter/pro/enterprise quotas

### Q26. Who are the target users?

Two personas:

1. **AI agent developers** — Need infrastructure for agents to autonomously publish, discover, consume, and rate data. Integrate via SDK/CLI/Skills
2. **Privacy-conscious individuals** — Want sovereignty over personal data. Encrypted vaults with selective sharing via Lit Protocol

### Q27. How does the network effect emerge?

ERC-8004's reputation system creates a virtuous cycle:

```
High-quality data → agents consume → feedback (score rises)
    → higher discovery ranking → more agents consume → ...
```

Data providers become more discoverable as scores increase, driving more consumption and more feedback — a positive reinforcement loop.

### Q28. How do you handle the decentralization/UX tradeoff?

- **Session tokens**: ERC-8128 signature happens once. The relay issues an HMAC-SHA256 bearer token cached in `sessionStorage` — zero wallet prompts after initial auth
- **Relay server**: Mitigates P2P latency with HTTP API while only handling encrypted data (never plaintext)
- **Mock/live switching**: Seamless swap between mock (dev) and live (production) implementations

---

## Demo & Completeness

### Q29. What works in the Memo demo app?

`examples/memo/` is a fully functional decentralized note-taking app:

- Wallet connect (Passkey / EVM via wagmi)
- Vault creation and key derivation from wallet signature
- Public memos — viewable by anyone, registered on-chain
- Private memos — AES-256-GCM encrypted, owner-only
- Markdown editor with live preview and GFM support
- Session token caching (no re-signing on reload)
- Storacha snapshot backup to Filecoin

### Q30. What is NOT yet complete? (Honest disclosure)

| Feature | Status |
|---------|--------|
| Lit Protocol live connection tests | Code implemented, E2E tests not yet run against live nodes |
| MPP payment verification | Middleware implemented, external SDK integration pending |
| Passkey/WebAuthn browser UI | SDK supports it, UI not yet built |
| Solana E2E tests | Signing logic implemented, chain tests not yet run |
| Filecoin deal status tracking | Storacha uploads work, status UI not built |
| PaymentSplitter contract | Design only |

### Q31. What's the test coverage?

- **TypeScript**: 30 test files, 70+ test cases across SDK, relay, and CLI
- **Solidity**: 3 test files, 32+ test functions (Foundry `forge test`)
- **Integration tests**: Hono `app.request()` — no HTTP server needed
- **Mock-first**: All external dependencies (Storacha, Lit, on-chain) have in-memory mock implementations

### Q32. What's on the roadmap post-hackathon?

- Advanced Lit Protocol reputation conditions — fully wired reputation-gated decryption
- Passkey/WebAuthn browser integration for biometric-first UX
- Solana E2E testing and deployment
- Live Filecoin deal status tracking
- Backup/restore UI in web dashboard
- Multi-signature vault support and delegation patterns
- MPP session billing for streaming vault access
- PaymentSplitter contract for relay operator revenue
- Web dashboard earnings visualization and payment history
