# Lit Protocol SessionSigs Integration

**Date:** 2026-03-04
**Status:** Approved
**Approach:** A — Encryption layer owns Lit sessions

## Problem

`LitEngine.decrypt()` requires Lit `sessionSigs`, but the encryption layer throws instead of obtaining them. Private/shared vault reads with Lit encryption are broken. The `DecryptOptions` type has no field for Lit auth.

## Goal

Owner and authorized agents can decrypt Lit-encrypted vault data end-to-end. The encryption layer internally resolves `sessionSigs` from a wallet `authSig`.

## Design

### Type Changes (`types.ts`)

Add `LitAuthSig` type and extend `DecryptOptions`:

```typescript
export interface LitAuthSig {
  sig: string;
  derivedVia: string;
  signedMessage: string;
  address: string;
}

export interface DecryptOptions {
  keySource?: AESKeySource;
  authSig?: LitAuthSig;
}
```

No changes to `IEncryptionLayer` — `DecryptOptions` is already the opts param.

### `LitEngine` (`encryption/lit.ts`)

Add `getSessionSigs(authSig, chain, resourceIds)` method:
- Takes an `authSig` (wallet signature proving ownership)
- Builds `LitAccessControlConditionResource` objects from resource IDs
- Calls `litClient.getSessionSigs()` with an `authNeededCallback` that creates a SIWE message and signs it using the provided authSig
- Returns Lit sessionSigs

Update `decrypt()` to accept either raw sessionSigs or an `authSig` object. If authSig is detected, resolve sessionSigs internally via `getSessionSigs()`.

### `encryption-layer.ts`

Replace the throw on line 63 with:

```typescript
if (encrypted.engine === "lit") {
  if (!lit) throw new Error("Lit Protocol not configured");
  if (!opts?.authSig) throw new Error("Lit decryption requires authSig in DecryptOptions");
  return lit.decrypt(encrypted as LitEncryptedData, opts.authSig);
}
```

### Vault (`data/vault.ts`)

- Add `authSig` field alongside `defaultKey` (set after wallet connect)
- `tryDecrypt()` uses stored `authSig` for Lit-encrypted entries
- `setAuthSig(authSig)` method added to vault interface
- Vault `get()` and `query()` automatically use stored authSig for Lit data

### Client wiring (`client.ts`)

In `createOrbitMem.connect()`, after deriving the AES key:
- Generate a Lit-compatible `authSig` from the wallet connection
- Call `vault.setAuthSig(authSig)`

### Testing

- Unit test `LitEngine.getSessionSigs` with mocked Lit client
- Unit test encryption layer Lit decrypt path with mock LitEngine
- Unit test vault `tryDecrypt` with Lit data + authSig
- Existing AES tests unchanged

## Files Changed

1. `packages/sdk/src/types.ts` — Add `LitAuthSig`, extend `DecryptOptions`
2. `packages/sdk/src/encryption/lit.ts` — Add `getSessionSigs()`, update `decrypt()`
3. `packages/sdk/src/encryption/encryption-layer.ts` — Replace throw with real decrypt
4. `packages/sdk/src/data/vault.ts` — Add `authSig` storage, wire into `tryDecrypt`
5. `packages/sdk/src/client.ts` — Generate authSig on connect, pass to vault
6. `packages/sdk/src/encryption/__tests__/lit.test.ts` — Test getSessionSigs
7. `packages/sdk/src/encryption/__tests__/encryption-layer.test.ts` — Test Lit decrypt path

## Non-Goals

- Key rotation
- Time-locked access
- Multi-sig collaborative encryption
- Passkey/Solana authSig (EVM only for now)
