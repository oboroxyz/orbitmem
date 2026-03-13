# Decentralized Personal Memo App — Design Spec

## Overview

A minimal decentralized note-taking app under `examples/memo/`. Users connect via Porto Passkey (biometric) or EVM wallet through wagmi's connect modal, create/read/delete memos stored in an OrbitMem vault, and toggle per-memo visibility (public/private). Public memos are plaintext; private memos are AES-256-GCM encrypted client-side. The relay keeps vault data available 24/7 via OrbitDB replication. No server owns the data — the user's OrbitDB address is portable across relays.

## Architecture

```
┌──────────────────────────────────────────┐
│  examples/memo (React + Vite + wagmi)    │
│                                          │
│  wagmi+porto  → Passkey + EVM wallets    │
│  AESEngine    → AES-256-GCM (client)     │
│  relay API    → read/write/delete/list   │
│                                          │
│  All encryption client-side              │
└──────────────┬───────────────────────────┘
               │ HTTP (ERC-8128 signed)
               ▼
┌──────────────────────────────────────────┐
│  @orbitmem/relay                         │
│                                          │
│  POST /v1/vault/write  (new endpoint)    │
│  POST /v1/vault/delete (new endpoint)    │
│  POST /v1/vault/read   (existing)        │
│  POST /v1/vault/keys   (new endpoint)    │
│  GET  /v1/vault/public/:address/:key     │
│  OrbitDB peer (24/7 replication)         │
│  ERC-8128 auth middleware                │
└──────────────────────────────────────────┘
```

### Data flow

1. User connects via wagmi modal — choose Porto Passkey (biometric) or EVM wallet (MetaMask, WalletConnect, injected)
2. App signs "OrbitMem Vault Key v1" message → derives AES-256 key via SHA-256 (raw import, no HKDF)
3. **Write:** App encrypts client-side → `POST /v1/vault/write` (ERC-8128 signed) → relay stores in OrbitDB
4. **Read:** `POST /v1/vault/read` (ERC-8128 signed) → relay returns ciphertext → app decrypts client-side
5. **List:** `POST /v1/vault/keys` (ERC-8128 signed) → relay returns all keys (public + private) for signer's vault
6. Public memos are also readable by anyone via `GET /v1/vault/public/:address/:key`

### Why SDK + relay (not pure browser P2P)

- OrbitDB needs at least one always-on peer for data availability
- Relay is stateless from a trust perspective — it only sees ciphertext for private memos
- User's OrbitDB address is portable — switch relays anytime, same data
- Avoids running OrbitDB/libp2p/Helia in the browser (heavy, needs WebRTC)

### Wallet connection: wagmi + Porto connector

wagmi provides the connect modal with two options:

1. **Porto Passkey** — biometric-first (FaceID/TouchID), zero-install, built on WebAuthn P256. Porto is a wagmi connector (`import { porto } from 'wagmi/connectors'`), so it works natively in the wagmi modal alongside EVM wallets.
2. **EVM wallets** — MetaMask, WalletConnect, injected providers.

Both produce a standard wagmi `walletClient` — the rest of the app (signing, encryption, ERC-8128 headers) works identically regardless of which connector was used.

```typescript
// lib/wagmi.ts
import { porto } from 'wagmi/connectors'

export const config = createConfig({
  chains: [baseSepolia],
  connectors: [porto(), injected(), walletConnect({ projectId })],
  transports: { [baseSepolia.id]: http() },
})
```

The SDK identity layer is not used for connection — wagmi handles it directly (same pattern as `apps/web/`). SDK's `AESEngine` is used for encryption only.

### Vault address mapping

The relay uses the ERC-8128 signer address (EVM wallet address) as the vault identifier. When opening a vault via OrbitDB, the relay uses the signer address as the `dbName` parameter. This means each wallet address maps to exactly one vault. The relay's `IVaultService` methods receive the signer address from the auth middleware — the client never sends a separate `vaultAddress`.

## Relay Changes Required

The relay currently has no vault write, delete, or authenticated list endpoint. These must be added as part of this work.

### 1. `IVaultService` interface additions (`packages/relay/src/services/types.ts`)

```typescript
// Add to IVaultService:
write(address: string, path: string, value: unknown, visibility: string): Promise<{ hash: string }>;
delete(address: string, path: string): Promise<void>;
getKeys(address: string, prefix?: string): Promise<string[]>;
```

### 2. `POST /v1/vault/write` (ERC-8128 authenticated)

```
Request body:
{
  "path": "memos/abc123/title",
  "value": <any>,                    // plaintext (public) or serialized encrypted blob (private)
  "visibility": "public" | "private"
}

Response:
{ "ok": true, "hash": "<orbitdb-hash>" }
```

The relay:
1. Verifies ERC-8128 signature (existing middleware)
2. Gets signer address from `c.get("signer")`
3. Opens the user's vault by signer address (OrbitDB dbName = signer address)
4. Calls `vault.write(signer, path, value, visibility)`
5. Implementation stores value in OrbitDB and visibility in `-meta` companion

### 3. `POST /v1/vault/delete` (ERC-8128 authenticated)

Uses POST instead of DELETE method to avoid issues with request bodies being stripped by proxies/CDNs.

```
Request body:
{ "path": "memos/abc123/title" }

Response:
{ "ok": true }
```

### 4. `POST /v1/vault/keys` (ERC-8128 authenticated)

Returns all keys (public + private) for the authenticated user's vault.

```
Request body:
{ "prefix": "memos/" }    // optional

Response:
{ "keys": ["memos/abc/title", "memos/abc/body", ...] }
```

### 5. Update `POST /v1/vault/read`

The existing endpoint requires `{ vaultAddress, path }` in the body. For the memo app, the signer address from ERC-8128 auth identifies the vault. Two options:

- **(a) Make `vaultAddress` optional** — if omitted, use signer address. Backwards compatible.
- **(b) Keep as-is** — client sends `{ vaultAddress: signerAddress, path }`.

Recommendation: **(a)** — cleaner client code, signer already authenticated.

## Vault Data Structure

```
memos/
  {nanoid}/title    → string     (public or private)
  {nanoid}/body     → string     (public or private)
  {nanoid}/created  → number     (same visibility as title)
  {nanoid}/updated  → number     (same visibility as title)
```

- Each memo is a group of paths under `memos/{id}/`
- Visibility is per-memo (all paths share the same visibility)
- IDs are nanoid (compact, URL-safe, collision-resistant)

## UI

Single-page app with three states:

### 1. Not connected
- App title, description of what OrbitMem Memo is
- "Connect" button → wagmi modal (Porto Passkey, MetaMask, WalletConnect, injected)

### 2. Public memo view (no wallet required)
- Route: `/:address/:memoId`
- Fetches memo via `GET /v1/vault/public/:address/memos/:memoId/*`
- Renders title + markdown body (read-only)
- Shows author address, created date
- If memo is private → "This memo is private" message
- Share button to copy URL

### 3. Connected — memo list
- Header: wallet address (truncated), disconnect button
- "New Memo" button
- List of memos: title, visibility badge (public/private), created date
- Click memo → opens editor
- Share button on public memos → copies `/:address/:memoId` URL
- Delete button per memo

### 4. Memo editor
- Title input
- Body textarea (markdown input, rendered preview)
- Visibility toggle: public / private
- Save button, Back button
- If editing existing memo: shows created/updated timestamps

### Error states
- Relay unreachable → banner "Cannot connect to relay" with retry
- Write failed → toast notification with error message
- Decryption failed → show memo as "[encrypted]" with tooltip

## Tech Stack

| Dependency | Version | Purpose |
|-----------|---------|---------|
| React | 19 | UI framework |
| Vite | 6 | Build tool |
| Tailwind CSS | 4 | Styling |
| wagmi | 2 | Wallet connection (modal, hooks) |
| porto | latest | Porto Passkey wagmi connector |
| viem | 2 | EVM signing, message hashing |
| @orbitmem/sdk | workspace | AESEngine for encryption |
| nanoid | latest | Memo ID generation |
| react-markdown | latest | Markdown rendering |
| remark-gfm | latest | GitHub-flavored markdown support |

### wagmi chain config

Chain: Base Sepolia (matches contract deployments). Connectors: `porto()`, `injected()`, `walletConnect()`.

## File Structure

```
examples/memo/
  index.html
  package.json
  vite.config.ts
  tsconfig.json
  .env.example                — VITE_RELAY_URL
  src/
    main.tsx                  — React root mount
    App.tsx                   — Simple router: / (home) vs /:address/:memoId (public view)
    lib/
      relay.ts                — Relay API client (read/write/delete/list)
      encryption.ts           — AES key derivation + encrypt/decrypt using SDK AESEngine
      erc8128.ts              — ERC-8128 header generation (sign requests with viem)
      wagmi.ts                — wagmi config (chains, connectors)
    hooks/
      useOrbitMem.ts          — React hook: wallet state, memo CRUD operations
    components/
      ConnectButton.tsx       — wagmi connect (Porto Passkey + EVM wallets)
      MemoList.tsx            — List all memos with delete/share
      MemoEditor.tsx          — Create/edit memo with visibility toggle
      PublicMemoView.tsx      — Read-only rendered markdown (no wallet needed)
    styles/
      index.css               — Tailwind base
```

## Client-Side Integration

### Encryption (lib/encryption.ts)

```typescript
import { AESEngine } from "@orbitmem/sdk";
// NOTE: AESEngine must be added to packages/sdk/src/index.ts exports

const aes = new AESEngine();

// Derive vault key from wallet signature.
// Uses SHA-256 of the signature as a raw 256-bit AES key.
// No HKDF — the SHA-256 output is already uniformly distributed.
export async function deriveVaultKey(signature: Uint8Array): Promise<CryptoKey> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", signature));
  return aes.deriveKey({ type: "raw", key: hash });
}

// Encrypt a memo value for private storage
export async function encryptValue(value: unknown, key: CryptoKey): Promise<string> {
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const encrypted = await aes.encrypt(plaintext, key);
  return JSON.stringify(encrypted); // serialized AESEncryptedData
}

// Decrypt a stored value
export async function decryptValue<T>(blob: string, key: CryptoKey): Promise<T> {
  const encrypted = JSON.parse(blob);
  const decrypted = await aes.decrypt(encrypted, key);
  return JSON.parse(new TextDecoder().decode(decrypted));
}
```

### Relay API (lib/relay.ts)

```typescript
const RELAY = import.meta.env.VITE_RELAY_URL ?? "http://localhost:3000";

// Write a vault entry (authenticated)
export async function writeEntry(
  path: string, value: unknown, visibility: string, headers: Record<string, string>
) {
  return fetch(`${RELAY}/v1/vault/write`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ path, value, visibility }),
  }).then(r => r.json());
}

// Read a vault entry (authenticated — reads own vault, including private entries)
export async function readEntry(path: string, headers: Record<string, string>) {
  return fetch(`${RELAY}/v1/vault/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ path }),
  }).then(r => r.json());
}

// List all keys in own vault (authenticated)
export async function listKeys(prefix: string, headers: Record<string, string>) {
  return fetch(`${RELAY}/v1/vault/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ prefix }),
  }).then(r => r.json());
}

// Delete a vault entry (authenticated)
export async function deleteEntry(path: string, headers: Record<string, string>) {
  return fetch(`${RELAY}/v1/vault/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ path }),
  }).then(r => r.json());
}

// Read a public entry (no auth needed)
export async function readPublic(address: string, key: string) {
  return fetch(`${RELAY}/v1/vault/public/${address}/${key}`).then(r => r.json());
}
```

### ERC-8128 Headers (lib/erc8128.ts)

Reuses the same signing pattern as `apps/web/app/lib/erc8128.ts`:
- Sign `METHOD\nURL\ntimestamp\nnonce\nSHA256(body)` with the connected wallet
- Attach `X-OrbitMem-Signer`, `-Family`, `-Algorithm`, `-Timestamp`, `-Nonce`, `-Signature` headers

## SDK Changes Required

1. **Export `AESEngine` from main SDK entry** — add `export { AESEngine } from "./encryption/index.js"` to `packages/sdk/src/index.ts`

## Scope Boundaries

### In scope
- Wallet connection (wagmi: Porto Passkey + EVM wallets)
- Create, read, edit, delete memos
- Per-memo visibility toggle (public/private)
- Markdown editing and rendering (react-markdown + remark-gfm)
- Shareable public memo URL (`/:address/:memoId`) — rendered markdown, no wallet needed
- Client-side AES-256-GCM encryption for private memos
- Relay-backed storage via new write/delete/keys endpoints
- ERC-8128 signed requests for authenticated operations
- Error handling (relay down, write failure, decrypt failure)
- SDK export update (AESEngine)
- Relay endpoint additions (write, delete, keys, read update)

### Out of scope
- Folders, tags, search, filtering
- On-chain registration (ERC-8004)
- Storacha snapshots
- Lit Protocol shared access
- Sharing / collaboration
- Offline-first / service worker
- Real-time sync indicator
