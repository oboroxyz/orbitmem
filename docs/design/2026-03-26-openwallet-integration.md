# OpenWallet (OWS) Integration

**Date:** 2026-03-26
**Status:** Approved

## Goal

Replace direct private key generation and storage in CLI/SDK with OpenWallet Standard (`@open-wallet-standard/core`). Keys are generated, encrypted, and stored by OWS (`~/.ows/wallets/`). OrbitMem never touches raw key material.

## Scope

- CLI and SDK (Node.js) only
- Browser (web app, memo example) is out of scope — continues using wagmi/passkey

## Changes

### 1. Dependency

Add `@open-wallet-standard/core` to root workspace, `packages/cli`, and `packages/sdk`.

### 2. SDK Types — `packages/sdk/src/types.ts`

Remove `privateKey` from `IdentityConfig`. Add `owsWallet?: string` (wallet name). The `passkey` field is unchanged (browser-only).

### 3. Identity Layer — `packages/sdk/src/identity/identity-layer.ts`

Remove the `config.privateKey` code path. Add a `config.owsWallet` code path that:

- Imports OWS SDK
- Calls `getWalletAddress(walletName, "eip155:84532")` for the connection address (CAIP-2 chain ID format)
- Wraps `signMessage(walletName, "eip155:84532", message)` as the signer function
- The `opts.method === "evm"` guard is replaced by OWS's native multi-chain support; chain selection is determined by the CAIP-2 identifier
- OWS `signMessage` returns a hex signature; the existing hex-to-`Uint8Array` conversion is retained

### 4. CLI Init — `packages/cli/src/commands/init.ts`

Replace `generatePrivateKey()` + `saveKey()` with:

- `createWallet("orbitmem")` via OWS SDK
- Save `{ walletName: "orbitmem", network }` to `~/.orbitmem/config.json`
- The `--force` guard now checks for an existing `walletName` in `config.json` and whether the OWS wallet `"orbitmem"` already exists

### 5. CLI Config — `packages/cli/src/config.ts`

- Remove `saveKey()` and `loadKey()` functions
- `~/.orbitmem/key.json` is no longer created or read
- Config only stores `{ walletName, network }`

### 6. CLI Client — `packages/cli/src/utils/client.ts`

- Remove `privateKeyToAccount()` usage
- Get address from OWS `getWalletAddress()`
- Build signer from OWS `signMessage()`
- For on-chain writes: create a viem custom account via `toAccount({ address, signMessage, signTransaction, signTypedData })` where each callback delegates to OWS SDK. This account is used to construct the `walletClient` for the discovery layer's `OnChainRegistry`.

### 7. All CLI Commands Using `loadKey()`

Every command that currently calls `loadKey()` switches to loading `walletName` from config and passing it through the OWS-based `createClient`:

- `commands/vault.ts`
- `commands/register.ts`
- `commands/discover.ts`
- `commands/snapshot.ts`
- `commands/status.ts` — special case: currently calls `privateKeyToAccount(loadKey())` directly to display the address. Replace with `getWalletAddress(walletName, chain)` from OWS.

### 8. Agent Research Example — `examples/agent-research/tools/shared.ts`

Same pattern as CLI client: load wallet name from config, use OWS for address and signing.

### 9. Test Updates

These test files will break when `saveKey`/`loadKey` are removed and must be rewritten:

- `cli/src/__tests__/config.test.ts` — tests `saveKey()`/`loadKey()` roundtrip; remove and replace with config-only tests
- `cli/src/__tests__/init.test.ts` — calls `loadKey()` after init to verify key creation; rewrite to verify OWS wallet creation and config.json content

## Unchanged

| Component | Reason |
|-----------|--------|
| `encryption/aes.ts` | Symmetric key derivation; input signature source changes, not the derivation logic |
| `encryption/vault-key.ts` | Derives key from wallet signature; the signature now comes via OWS signer |
| `transport/` | Uses signer interface; automatically works with OWS-backed signer |
| `relay/` | Server-side signature verification; unrelated to client key management |
| Browser apps | Out of scope; wagmi/passkey |

## Data Flow

```
orbitmem init
  -> OWS createWallet("orbitmem")
  -> ~/.orbitmem/config.json = { walletName: "orbitmem", network: "base-sepolia" }
  -> Private key lives in ~/.ows/wallets/ (OWS-managed, encrypted at rest)

orbitmem vault store / register / discover / ...
  -> Load walletName from config.json
  -> OWS getWalletAddress("orbitmem", "eip155:84532") -> 0x...
  -> identity-layer signer = (msg) => OWS signMessage("orbitmem", "eip155:84532", msg)
  -> transport-layer builds ERC-8128 signed requests via signer
```

## Migration

No migration needed — the project has no existing users. `key.json` support is removed entirely.
