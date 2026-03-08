# Storacha Persistence — Design

**Date:** 2026-03-08
**Goal:** Replace the stub Storacha integration with real IPFS/Filecoin persistence, supporting three modes: mock (testing), managed (relay-proxied with tiered plans), and direct (BYOS with user's own Storacha proof).

---

## Architecture

### Three Persistence Modes

```
createPersistenceLayer(config)
  ├─ config.mock       → MockPersistence    (in-memory Map)
  ├─ config.relayUrl   → ManagedPersistence (uploads via relay)
  └─ config.proof      → DirectPersistence  (uploads to Storacha directly)
```

**Usage:**

```typescript
// Mock — testing
createOrbitMem({ persistence: { mock: true } })

// Managed — relay-proxied (free 5MB default, paid for more)
createOrbitMem({ persistence: { relayUrl: "https://relay.orbitmem.xyz" } })

// Direct — BYOS
createOrbitMem({ persistence: { proof: "ucan-delegation-base64..." } })
```

### Mode Details

**MockPersistence** (existing, unchanged)
- In-memory Map store
- Used for testing

**ManagedPersistence** (new)
- `archive()` → `POST relayUrl/v1/snapshots/archive` with ERC-8128 signed request
- `retrieve()` → fetch from IPFS gateway
- `listSnapshots()` → `GET relayUrl/v1/snapshots`
- Relay enforces plan limits server-side
- No `@storacha/client` dependency in SDK for this mode

**DirectPersistence** (fix existing live mode)
- Deserialize UCAN proof → init `@storacha/client` → upload directly
- No relay dependency
- No storage limits (user's own Storacha space)
- `@storacha/client` lazy-loaded on first call, cached after init

---

## SDK Changes

### Config & Types

Replace `StorachaConfig`:

```typescript
export interface StorachaConfig {
  /** Mock mode for testing */
  mock?: boolean;
  /** Relay URL for managed persistence (free/paid tiers) */
  relayUrl?: string;
  /** Serialized UCAN delegation proof for direct Storacha uploads (BYOS) */
  proof?: string;
  /** Optional IPFS gateway URL (default: https://w3s.link) */
  gatewayUrl?: string;
  /** Auto-archive interval in ms (0 = manual only) */
  autoArchiveInterval?: number;
  /** Maximum snapshot size in bytes (default: 10MB) */
  maxSnapshotSize?: number;
}
```

`IPersistenceLayer` interface — unchanged.

### Setup Helper

New export for BYOS users:

```typescript
export async function createStorachaAgent(): Promise<{
  agentDID: string;
  proof: string;
  instructions: string;
}>
```

Creates a Storacha agent, registers it, creates a space, returns serialized proof for the user to store in their config.

### Factory Internals

`createPersistenceLayer()` detects mode from config shape:

| Method | MockPersistence | ManagedPersistence | DirectPersistence |
|--------|----------------|-------------------|-------------------|
| `archive()` | Store in Map | POST to relay | `client.uploadFile()` |
| `retrieve()` | Read from Map | Fetch IPFS gateway | Fetch IPFS gateway |
| `restore()` | Read + return stats | retrieve + deserialize | retrieve + deserialize |
| `listSnapshots()` | Map.values() | GET relay endpoint | `client.capability.upload.list()` |
| `deleteSnapshot()` | Map.delete() | DELETE relay endpoint | `client.capability.upload.remove()` |
| `getDealStatus()` | Return "pending" | GET relay endpoint | `client.capability.filecoin.info()` |

---

## Relay Changes

### Plan Service

```typescript
interface Plan {
  tier: "free" | "starter" | "pro" | "enterprise";
  storageLimit: number;
}

const PLAN_LIMITS: Record<Plan["tier"], number> = {
  free:        5 * 1024 * 1024,         //    5 MB
  starter:    10 * 1024 * 1024 * 1024,  //   10 GB
  pro:        50 * 1024 * 1024 * 1024,  //   50 GB
  enterprise:  Infinity,                //   unlimited
};

interface IPlanService {
  getPlan(signer: string): Promise<Plan>;
  addUsage(signer: string, bytes: number): Promise<void>;
  removeUsage(signer: string, bytes: number): Promise<void>;
  getUsage(signer: string): Promise<{ used: number; limit: number }>;
}
```

In-memory implementation to start. Default: free tier for unknown signers.

### Updated Archive Flow

```
POST /v1/snapshots/archive
  → ERC-8128 auth → extract signer
  → planService.getPlan(signer)
  → if used + body.size > limit → 413 "Storage quota exceeded"
  → upload to Storacha via relay's agent
  → planService.addUsage(signer, size)
  → return snapshot metadata
```

### New Route

```
GET /v1/snapshots/usage  (ERC-8128 protected)
→ { tier: "free", used: 1234567, limit: 5242880 }
```

### Delete Updates Quota

`DELETE /v1/snapshots/:cid` calls `planService.removeUsage()` to free quota.

---

## Testing Strategy

| Layer | What to test | How |
|---|---|---|
| MockPersistence | Already tested | Existing tests |
| ManagedPersistence | Archive, retrieve, list via relay | Mock fetch calls |
| DirectPersistence | Archive, retrieve, list via Storacha | Mock `@storacha/client` |
| PlanService | Quota enforcement, tiers, usage | Unit tests, in-memory |
| Relay archive route | Quota rejection (413), upload, usage | Integration via `app.request()` |
| Relay usage route | Returns correct tier/usage | Integration via `app.request()` |
| `createStorachaAgent` | Returns valid proof structure | Mock Storacha client |

All Storacha calls mocked in CI. Real integration tested manually.

---

## Not In Scope

- Payment/billing integration (manual tier assignment for now)
- On-chain subscription contracts
- Auto-archive scheduling (config field exists but implementation deferred)
