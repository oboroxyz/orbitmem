# MPP Vault Payments — Design Spec

**Date:** 2026-03-20
**Status:** Draft
**Author:** Claude + yujiym

## Summary

Add pay-per-read monetization to OrbitMem vault data using the Machine Payments Protocol (MPP). Data producers set per-path prices on their vault entries. AI agents pay producers directly via HTTP 402 challenge–credential–receipt flow. The relay operator monetizes separately through existing `PlanService` storage tiers.

## Goals

- Enable data producers to earn from their vault data
- Let AI agents pay for vault reads using stablecoins, Stripe, or Lightning
- Keep the integration minimal — no new contracts, no payment splitting
- Maintain backward compatibility — unpriced data stays free

## Non-Goals (Out of Scope)

- Session/streaming billing (MPP sessions) — charge-per-read only
- Web dashboard payment UI (earnings, withdrawal, payment history)
- Multi-chain settlement — Base only (Base Sepolia for testnet)
- Write-gating — only reads are paywalled; writes stay governed by `PlanService` tiers
- PaymentSplitter contract — payments go directly to producers
- Escrow, refunds, or dispute resolution
- Rate limiting by payment — existing ERC-8128 auth + plan tiers handle abuse

## Protocol Choice: MPP over x402

MPP (Machine Payments Protocol) was chosen over x402 for several reasons:

1. **Superset of x402** — MPP is backward-compatible with x402; its charge intent maps directly onto x402's exact payment flow
2. **Native Hono middleware** — `mppx` SDK has built-in Hono support; the relay is Hono-based
3. **Payment method flexibility** — a single endpoint accepts stablecoins (Tempo), Stripe cards, and Lightning; x402 is crypto-only
4. **MCP transport binding** — MPP has JSON-RPC/MCP transport for future agent tool integration
5. **Industry backing** — co-authored by Stripe + Tempo, Visa extending support, Cloudflare native integration

## Design

### 1. Pricing Model & Storage

Producers set per-read prices using the existing `-meta` OrbitDB store attached to each vault.

**Storage format:**

```
Key:   pricing/<path>
Value: { amount: string, currency: string, network: string }
```

Example:

```
pricing/agent/memory  → { amount: "0.005", currency: "USDC", network: "base" }
pricing/agent/context → { amount: "0.001", currency: "USDC", network: "base" }
pricing/_default      → { amount: "0.002", currency: "USDC", network: "base" }
```

**Rules:**

- No price set → free access (backward compatible, existing behavior unchanged)
- Price set → MPP-gated (middleware returns 402 unless valid payment credential)
- `pricing/_default` sets a vault-wide default, overridden by per-path pricing
- Removing a pricing key makes that path free again

### 2. MPP Middleware

A new Hono middleware using the `mppx` SDK, applied to vault read routes.

**Middleware config (set at relay construction):**

```ts
type MPPConfig = {
  acceptedMethods: ("tempo" | "stripe" | "lightning")[];
  network: "base" | "base-sepolia";
}
```

**Request flow:**

1. Request arrives at `GET /v1/vault/public/:address/:key`
2. Middleware looks up `pricing/<key>` from the producer's vault metadata
   - Falls back to `pricing/_default` if no per-path price exists
3. **No price found** → `next()` (free access)
4. **Price found** → Check for `Authorization: Payment` header
   - **No credential** → Return `402 Payment Required` with `WWW-Authenticate: Payment` header containing:
     - Intent: `charge`
     - Amount: producer's set price
     - Recipient: producer's wallet address (from the `:address` route param)
     - Accepted methods: from relay config
   - **Has credential** → Verify payment via `mppx`
     - **Invalid** → `402` with error details
     - **Valid** → Set `c.set("mppPayment", { producer, amount, method })` on Hono context, attach `Payment-Receipt` header to response, call `next()`

**Route integration:**

```ts
// Only vault public reads are MPP-gated
routes.get("/vault/public/:address/keys", mppPricing(), async (c) => { ... })
routes.get("/vault/public/:address/:key{.+}", mppPricing(), async (c) => { ... })

// Encrypted reads require ERC-8128 auth AND MPP payment
routes.post("/vault/read", erc8128(), mppPricing(), async (c) => { ... })
```

**Middleware does NOT apply to:**

- `/vault/sync`, `/vault/write`, `/vault/delete`, `/vault/keys`, `/vault/seed` — write/admin operations
- `/data/*` — discovery and search routes remain free
- `/health` — health check

### 3. Payment Flow

Payments go directly to the data producer's wallet. No intermediary contract.

```
Agent                          Relay                         Producer Wallet
  |                              |                                |
  |  GET /vault/public/0xABC/k   |                                |
  |----------------------------->|                                |
  |                              |  lookup pricing/k from meta    |
  |                              |  price found: 0.005 USDC       |
  |  402 + WWW-Authenticate      |                                |
  |<-----------------------------|                                |
  |                              |                                |
  |  (agent pays 0.005 USDC)     |                                |
  |  ----------------------------------------------------------->|
  |                              |                                |
  |  GET + Authorization: Payment|                                |
  |----------------------------->|                                |
  |                              |  verify via mppx               |
  |  200 + data + Payment-Receipt|                                |
  |<-----------------------------|                                |
```

**Revenue model:**

- **Producers** earn directly from vault reads via MPP
- **Relay operators** earn from `PlanService` storage tiers (free/starter/pro/enterprise)
- Clean separation: tiers for infra costs, MPP for data monetization

### 4. SDK Extensions

New methods on the client facade (`createOrbitMemClient`), implemented as thin wrappers over the existing `-meta` OrbitDB store:

```ts
interface IVaultPricing {
  setPrice(path: string, pricing: { amount: string; currency: string }): Promise<void>;
  getPrice(path: string): Promise<{ amount: string; currency: string } | null>;
  removePrice(path: string): Promise<void>;
  listPrices(): Promise<Array<{ path: string; amount: string; currency: string }>>;
}
```

- `setPrice` writes to `pricing/<path>` in the `-meta` store
- `getPrice` reads `pricing/<path>`, falls back to `pricing/_default`
- `removePrice` deletes the key (makes path free)
- `listPrices` lists all `pricing/*` keys from metadata

No new SDK layer is needed — these methods are added to the existing `IDataLayer` or as a mixin on the client facade.

### 5. CLI Extensions

New subcommands under `vault price`:

```bash
bun run cli vault price set <path> <amount>    # Set per-read price (USDC)
bun run cli vault price get <path>             # Show current price for path
bun run cli vault price ls                     # List all priced paths
bun run cli vault price rm <path>              # Remove pricing (free access)
bun run cli vault earnings                     # Show accumulated earnings
```

`vault earnings` queries the producer's wallet for incoming MPP payment transactions — this is read-only chain data, no new indexing needed.

### 6. Relay Configuration

The relay operator configures MPP at startup via environment variables or config:

```ts
// In relay app construction
const mppConfig: MPPConfig = {
  acceptedMethods: (process.env.MPP_ACCEPTED_METHODS ?? "tempo,stripe").split(","),
  network: (process.env.MPP_NETWORK ?? "base-sepolia") as "base" | "base-sepolia",
};
```

No `relayFeePercent` or `splitterContract` in v1. These will be added when `PaymentSplitter` is introduced — it's a single contract deploy + one config change.

## Files Changed

| Package | File | Change |
|---------|------|--------|
| `@orbitmem/relay` | `src/middleware/mpp.ts` | New MPP pricing middleware |
| `@orbitmem/relay` | `src/routes/vault.ts` | Add `mppPricing()` to read routes |
| `@orbitmem/relay` | `src/app.ts` | Wire MPP config |
| `@orbitmem/sdk` | `src/data/vault.ts` | Add `setPrice`, `getPrice`, `removePrice`, `listPrices` |
| `@orbitmem/sdk` | `src/types.ts` | Add `IVaultPricing` interface |
| `@orbitmem/sdk` | `src/agent/client.ts` | Expose pricing methods on client facade |
| `@orbitmem/cli` | `src/commands/vault.ts` | Add `price` subcommand group |
| `@orbitmem/cli` | `src/commands/vault.ts` | Add `earnings` subcommand |
| root | `package.json` | Add `mppx` dependency |

## Testing Strategy

- **Unit tests** for pricing metadata read/write in SDK (`bun:test`)
- **Unit tests** for MPP middleware — mock `mppx` verification, test free/priced/invalid flows
- **Integration tests** for relay routes using Hono's `app.request()` — test 402 challenge, valid payment, free access
- **CLI tests** for `vault price` subcommands
- **Manual E2E** on Base Sepolia with a real `mppx` client paying for a vault read

## Future Extensions (Post-v1)

- **PaymentSplitter contract** — deploy when relay operators need fee revenue; one config change to enable
- **Session billing** — MPP sessions for streaming vault access (bulk reads)
- **Web dashboard** — earnings visualization, payment history, withdrawal UI
- **Multi-chain** — extend accepted methods and settlement chains
- **MCP transport** — expose vaults as MCP tools with MPP payments built in
