# Lit Protocol SessionSigs Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable end-to-end Lit Protocol decryption so vault owners and authorized agents can decrypt Lit-encrypted data.

**Architecture:** The encryption layer internally resolves Lit `sessionSigs` from a wallet `authSig` passed via `DecryptOptions`. `LitEngine` gains a `getSessionSigs()` method. The vault stores an `authSig` (set after wallet connect) and passes it through to `tryDecrypt`. No changes to identity layer.

**Tech Stack:** TypeScript, `@lit-protocol/*` v7, `bun:test`

---

### Task 1: Add `LitAuthSig` type and extend `DecryptOptions`

**Files:**
- Modify: `packages/sdk/src/types.ts:688-692`

**Step 1: Write the type additions**

In `packages/sdk/src/types.ts`, add `LitAuthSig` before `DecryptOptions` (after line 687), then extend `DecryptOptions`:

```typescript
/** Lit Protocol auth signature — proves wallet ownership to Lit nodes */
export interface LitAuthSig {
  sig: string;
  derivedVia: string;
  signedMessage: string;
  address: string;
}

/** Options for decryption (engine auto-detected from blob) */
export interface DecryptOptions {
  /** For AES: provide key source if not cached */
  keySource?: AESKeySource;
  /** For Lit: wallet auth signature used to obtain sessionSigs */
  authSig?: LitAuthSig;
}
```

**Step 2: Run typecheck to verify no breakage**

Run: `bun run typecheck`
Expected: PASS (DecryptOptions is a superset of before — all existing callers still valid)

**Step 3: Commit**

```bash
git add packages/sdk/src/types.ts
git commit -m "feat(sdk): add LitAuthSig type and extend DecryptOptions"
```

---

### Task 2: Add `getSessionSigs()` to `LitEngine` and update `decrypt()`

**Files:**
- Modify: `packages/sdk/src/encryption/lit.ts`
- Test: `packages/sdk/src/encryption/__tests__/lit.test.ts`

**Step 1: Write the failing tests**

Add to `packages/sdk/src/encryption/__tests__/lit.test.ts`:

```typescript
import { describe, expect, mock, test } from "bun:test";
import { LitEngine } from "../lit.js";

describe("LitEngine", () => {
  // ... existing tests stay ...

  test("getSessionSigs calls litClient.getSessionSigs with authNeededCallback", async () => {
    const engine = new LitEngine({ network: "datil-dev" });

    const mockSessionSigs = { "https://node1.lit": { sig: "abc", address: "0x123" } };
    const mockClient = {
      getSessionSigs: mock(async () => mockSessionSigs),
      getLatestBlockhash: mock(async () => "0xblockhash"),
    };
    // Inject mock client
    (engine as any).client = mockClient;

    const authSig = {
      sig: "0xsig",
      derivedVia: "web3.eth.personal.sign",
      signedMessage: "Sign in to OrbitMem",
      address: "0x1234567890abcdef1234567890abcdef12345678",
    };

    const result = await engine.getSessionSigs(authSig, "base");
    expect(result).toEqual(mockSessionSigs);
    expect(mockClient.getSessionSigs).toHaveBeenCalledTimes(1);
  });

  test("decrypt resolves authSig to sessionSigs internally", async () => {
    const engine = new LitEngine({ network: "datil-dev" });

    const decryptedData = new Uint8Array([1, 2, 3]);
    const mockClient = {
      getSessionSigs: mock(async () => ({ "https://node1.lit": { sig: "abc" } })),
      getLatestBlockhash: mock(async () => "0xblockhash"),
    };
    (engine as any).client = mockClient;

    // Mock the decrypt imports
    const mockDecryptToUint8Array = mock(async () => decryptedData);

    // We need to test that decrypt works with an authSig
    // Since decrypt uses dynamic imports, we test via the public API
    // by mocking at the engine level
    const authSig = {
      sig: "0xsig",
      derivedVia: "web3.eth.personal.sign",
      signedMessage: "Sign in",
      address: "0xABCD",
    };

    const encrypted = {
      engine: "lit" as const,
      ciphertext: new Uint8Array([10, 20]),
      dataToEncryptHash: "abc123",
      accessControlConditions: [
        {
          conditionType: "evmBasic" as const,
          contractAddress: "" as `0x${string}`,
          standardContractType: "" as const,
          chain: "base" as const,
          method: "",
          parameters: [":userAddress"],
          returnValueTest: { comparator: "=" as const, value: "0xABCD" },
        },
      ],
      chain: "base" as const,
    };

    // Verify getSessionSigs is called when authSig is provided
    const getSessionSigsSpy = mock(async () => ({ "https://node1.lit": { sig: "abc" } }));
    engine.getSessionSigs = getSessionSigsSpy;

    // decrypt will fail at the actual Lit decryption (no real Lit network),
    // but we can verify getSessionSigs was called
    try {
      await engine.decrypt(encrypted, authSig);
    } catch {
      // Expected — no real Lit network
    }
    expect(getSessionSigsSpy).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test packages/sdk/src/encryption/__tests__/lit.test.ts`
Expected: FAIL — `getSessionSigs` does not exist on LitEngine

**Step 3: Implement `getSessionSigs()` and update `decrypt()`**

In `packages/sdk/src/encryption/lit.ts`, add the import for `LitAuthSig` and the new method:

```typescript
import type {
  EvmAddress,
  EvmChain,
  LitAccessCondition,
  LitAuthSig,
  LitEncryptedData,
  LitEvmCondition,
} from "../types.js";
```

Add `getSessionSigs` method to `LitEngine` class (after `getClient()`):

```typescript
  async getSessionSigs(authSig: LitAuthSig, chain: string): Promise<any> {
    const client = await this.getClient();
    const { LitAbility } = await import("@lit-protocol/constants");
    const {
      LitAccessControlConditionResource,
      createSiweMessageWithRecaps,
      generateAuthSig,
    } = await import("@lit-protocol/auth-helpers");

    const litResource = new LitAccessControlConditionResource("*");

    return client.getSessionSigs({
      chain,
      resourceAbilityRequests: [
        { resource: litResource, ability: LitAbility.AccessControlConditionDecryption },
      ],
      authNeededCallback: async (params: {
        uri?: string;
        expiration?: string;
        resourceAbilityRequests?: any[];
      }) => {
        const toSign = await createSiweMessageWithRecaps({
          uri: params.uri!,
          expiration: params.expiration!,
          resources: params.resourceAbilityRequests!,
          walletAddress: authSig.address,
          nonce: await client.getLatestBlockhash(),
          litNodeClient: client,
        });
        return generateAuthSig({
          signer: {
            signMessage: async () => authSig.sig,
            getAddress: async () => authSig.address,
          } as any,
          toSign,
        });
      },
    });
  }
```

Update `decrypt()` to accept either sessionSigs or authSig:

```typescript
  async decrypt(encrypted: LitEncryptedData, sessionSigsOrAuthSig: any): Promise<Uint8Array> {
    let sessionSigs = sessionSigsOrAuthSig;

    // If an authSig object is passed, resolve it to sessionSigs
    if (sessionSigsOrAuthSig?.sig && sessionSigsOrAuthSig?.address) {
      sessionSigs = await this.getSessionSigs(
        sessionSigsOrAuthSig as LitAuthSig,
        encrypted.chain as string,
      );
    }

    const client = await this.getClient();
    const { decryptToUint8Array } = await import("@lit-protocol/encryption");
    return decryptToUint8Array(
      {
        accessControlConditions: encrypted.accessControlConditions as any,
        chain: encrypted.chain as string,
        ciphertext:
          typeof encrypted.ciphertext === "string"
            ? encrypted.ciphertext
            : new TextDecoder().decode(encrypted.ciphertext),
        dataToEncryptHash: encrypted.dataToEncryptHash,
        sessionSigs,
      },
      client,
    );
  }
```

**Step 4: Run tests to verify they pass**

Run: `bun test packages/sdk/src/encryption/__tests__/lit.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/sdk/src/encryption/lit.ts packages/sdk/src/encryption/__tests__/lit.test.ts
git commit -m "feat(sdk): add getSessionSigs to LitEngine, accept authSig in decrypt"
```

---

### Task 3: Wire Lit decrypt in encryption layer

**Files:**
- Modify: `packages/sdk/src/encryption/encryption-layer.ts:60-64`
- Test: `packages/sdk/src/encryption/__tests__/encryption-layer.test.ts`

**Step 1: Write the failing test**

Add to `packages/sdk/src/encryption/__tests__/encryption-layer.test.ts`:

```typescript
  test("Lit decrypt throws clear error without authSig", async () => {
    const litLayer = createEncryptionLayer({
      defaultEngine: "lit",
      aes: { kdf: "hkdf-sha256" },
      lit: { network: "cayenne" },
    });

    const fakeLitBlob = {
      engine: "lit" as const,
      ciphertext: new Uint8Array([1, 2, 3]),
      dataToEncryptHash: "abc",
      accessControlConditions: [],
      chain: "base" as const,
    };

    await expect(litLayer.decrypt(fakeLitBlob)).rejects.toThrow(
      /authSig/,
    );
  });

  test("Lit decrypt without lit config throws", async () => {
    const noLitLayer = createEncryptionLayer({
      defaultEngine: "aes",
      aes: { kdf: "hkdf-sha256" },
    });

    const fakeLitBlob = {
      engine: "lit" as const,
      ciphertext: new Uint8Array([1, 2, 3]),
      dataToEncryptHash: "abc",
      accessControlConditions: [],
      chain: "base" as const,
    };

    await expect(noLitLayer.decrypt(fakeLitBlob)).rejects.toThrow(
      /Lit Protocol not configured/,
    );
  });
```

**Step 2: Run tests to verify behavior**

Run: `bun test packages/sdk/src/encryption/__tests__/encryption-layer.test.ts`
Expected: The "without lit config" test should PASS (existing behavior), the "without authSig" test should FAIL (currently throws "use identity layer" not "authSig")

**Step 3: Replace the throw in encryption-layer.ts**

In `packages/sdk/src/encryption/encryption-layer.ts`, replace lines 60-64:

Old:
```typescript
      if (encrypted.engine === "lit") {
        if (!lit) throw new Error("Lit Protocol not configured");
        // sessionSigs must be provided via opts — this is handled by the identity layer
        throw new Error("Lit decryption requires sessionSigs — use identity layer");
      }
```

New:
```typescript
      if (encrypted.engine === "lit") {
        if (!lit) throw new Error("Lit Protocol not configured");
        if (!opts?.authSig) throw new Error("Lit decryption requires authSig in DecryptOptions");
        return lit.decrypt(encrypted as LitEncryptedData, opts.authSig);
      }
```

Also add `LitEncryptedData` to the import from `../types.js`:

```typescript
import type {
  AESEncryptedData,
  EncryptionConfig,
  EncryptLitOptions,
  IEncryptionLayer,
  LitAccessCondition,
  LitEncryptedData,
} from "../types.js";
```

**Step 4: Run tests**

Run: `bun test packages/sdk/src/encryption/__tests__/encryption-layer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/sdk/src/encryption/encryption-layer.ts packages/sdk/src/encryption/__tests__/encryption-layer.test.ts
git commit -m "feat(sdk): wire Lit decrypt through encryption layer with authSig"
```

---

### Task 4: Add `authSig` to vault and wire into `tryDecrypt`

**Files:**
- Modify: `packages/sdk/src/data/vault.ts:34-36,106-128`
- Test: `packages/sdk/src/data/__tests__/vault-encryption.test.ts`

**Step 1: Write the failing test**

Add to `packages/sdk/src/data/__tests__/vault-encryption.test.ts`:

```typescript
  test("setAuthSig stores authSig for Lit decryption", async () => {
    const mockEncryptionLayer = {
      encrypt: async (_data: any, _opts: any) => ({
        engine: "lit" as const,
        ciphertext: new TextEncoder().encode("encrypted"),
        dataToEncryptHash: "hash123",
        accessControlConditions: [],
        chain: "base" as const,
      }),
      decrypt: async (_encrypted: any, opts: any) => {
        // Verify authSig is passed through
        if (!opts?.authSig) throw new Error("No authSig");
        return new TextEncoder().encode(JSON.stringify("decrypted-value"));
      },
    };

    const vault = await createVault(createMockOrbitDB(), {
      encryptionLayer: mockEncryptionLayer as any,
    });

    const authSig = {
      sig: "0xsig",
      derivedVia: "web3.eth.personal.sign",
      signedMessage: "test",
      address: "0xABCD",
    };
    vault.setAuthSig(authSig);

    // Put with Lit encryption
    await vault.put("shared/secret", "my-data", {
      visibility: "shared",
      engine: "lit",
      accessConditions: [],
    });

    // get() should auto-decrypt using stored authSig
    const entry = await vault.get("shared/secret");
    expect(entry).not.toBeNull();
    expect(entry!.value).toBe("decrypted-value");
  });
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/sdk/src/data/__tests__/vault-encryption.test.ts`
Expected: FAIL — `vault.setAuthSig is not a function`

**Step 3: Implement vault changes**

In `packages/sdk/src/data/vault.ts`:

Add `LitAuthSig` to imports:
```typescript
import type {
  AESEncryptedData,
  ChainFamily,
  EncryptionEngine,
  IDataLayer,
  IEncryptionLayer,
  LitAuthSig,
  VaultEntry,
  VaultPath,
  Visibility,
  WalletAddress,
} from "../types.js";
```

Update the return type (line 34-36):
```typescript
): Promise<
  IDataLayer & {
    close: () => Promise<void>;
    db: any;
    setDefaultKey: (key: CryptoKey) => void;
    setAuthSig: (authSig: LitAuthSig) => void;
  }
> {
```

Add `authSig` state alongside `defaultKey` (after line 45):
```typescript
  let litAuthSig: LitAuthSig | undefined;
```

Update `tryDecrypt` to handle Lit decryption (replace lines 106-128):
```typescript
  async function tryDecrypt(rawValue: unknown, meta: any): Promise<unknown> {
    if (!meta?.encrypted || !isSerializedEncrypted(rawValue)) return rawValue;

    const encrypted = deserializeEncrypted(rawValue);

    if (
      encrypted.engine === "aes" &&
      config.aesEngine &&
      meta.visibility === "private" &&
      defaultKey
    ) {
      try {
        const decrypted = await config.aesEngine.decrypt(encrypted as AESEncryptedData, defaultKey);
        return JSON.parse(new TextDecoder().decode(decrypted));
      } catch {
        return rawValue;
      }
    }

    if (encrypted.engine === "lit" && config.encryptionLayer && litAuthSig) {
      try {
        const decrypted = await config.encryptionLayer.decrypt(encrypted, { authSig: litAuthSig });
        return JSON.parse(new TextDecoder().decode(decrypted));
      } catch {
        return rawValue;
      }
    }

    // shared+aes (no internal key) or lit (no authSig) — return encrypted blob
    return rawValue;
  }
```

Add `setAuthSig` method in `vaultImpl` (after `setDefaultKey`):
```typescript
    setAuthSig(authSig: LitAuthSig) {
      litAuthSig = authSig;
    },
```

**Step 4: Run tests**

Run: `bun test packages/sdk/src/data/__tests__/vault-encryption.test.ts`
Expected: PASS (all existing tests + new test)

**Step 5: Run full test suite**

Run: `bun test packages/sdk`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/sdk/src/data/vault.ts packages/sdk/src/data/__tests__/vault-encryption.test.ts
git commit -m "feat(sdk): add setAuthSig to vault for Lit auto-decryption"
```

---

### Task 5: Wire authSig in `createOrbitMem` connect flow

**Files:**
- Modify: `packages/sdk/src/client.ts:69-83`

**Step 1: Update connect() to generate and store authSig**

In `packages/sdk/src/client.ts`, update the `connect` method:

```typescript
    async connect(opts) {
      const result = await identity.connect(opts);
      // Derive a deterministic AES key from the wallet signature for vault encryption
      try {
        const { signature } = await identity.signChallenge("OrbitMem Vault Key v1");
        const hash = new Uint8Array(
          await crypto.subtle.digest("SHA-256", new Uint8Array(signature)),
        );
        const key = await encryption.aes.deriveKey({ type: "raw", key: hash });
        vault.setDefaultKey(key);
      } catch {
        // Key derivation is best-effort — vault works without it for public data
      }

      // Generate Lit authSig for decrypting Lit-encrypted vault entries
      if (encryption.lit && result.family === "evm") {
        try {
          const message = "OrbitMem Lit Auth";
          const { signature } = await identity.signChallenge(message);
          const sig =
            "0x" +
            Array.from(new Uint8Array(signature))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");
          vault.setAuthSig({
            sig,
            derivedVia: "web3.eth.personal.sign",
            signedMessage: message,
            address: result.address as string,
          });
        } catch {
          // Lit auth is best-effort — vault works without it for public/AES data
        }
      }

      return result;
    },
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Run full test suite**

Run: `bun test`
Expected: PASS (connect() isn't called in unit tests — uses mock wallet adapter)

**Step 4: Commit**

```bash
git add packages/sdk/src/client.ts
git commit -m "feat(sdk): generate Lit authSig on wallet connect"
```

---

### Task 6: Final verification

**Step 1: Run full test suite**

Run: `bun test`
Expected: All tests PASS

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Run lint**

Run: `bun run lint`
Expected: PASS (no lint errors)

**Step 4: Final commit (if any lint fixes needed)**

```bash
bun run lint:fix
git add -A
git commit -m "chore: lint fixes"
```
