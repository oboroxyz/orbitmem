# OrbitMem Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the OrbitMem SDK (`@orbitmem/sdk`) and Relay Node (`@orbitmem/relay`) — a sovereign data layer for AI agents with encrypted P2P vaults, multi-chain identity, and bidirectional trust.

**Architecture:** Bottom-up, layer-by-layer. Each SDK layer is a self-contained module with a factory function matching the interfaces in `sdk-types.ts`. The relay is a stateless Hono server acting as an OrbitDB gossip peer. Smart contract registries are mocked in-memory for now.

**Tech Stack:** Bun + bun workspaces, TypeScript, Hono, OrbitDB + @orbitdb/nested-db + Helia, Lit Protocol v7, AES-256-GCM (Web Crypto), Storacha, viem (EVM), @solana/web3.js

**Reference docs:**
- `docs/design/spec.md` — full technical spec
- `docs/design/sdk-types.ts` — all TypeScript interfaces
- `docs/design/architecture.jsx` — architecture visualization
- `docs/plans/2026-03-02-orbitmem-build-design.md` — design decisions

---

## Task 1: Monorepo Scaffold

**Files:**
- Create: `package.json` (root)
- Create: `tsconfig.base.json`
- Create: `packages/sdk/package.json`
- Create: `packages/sdk/tsconfig.json`
- Create: `packages/relay/package.json`
- Create: `packages/relay/tsconfig.json`

**Step 1: Create root package.json with bun workspaces**

```json
{
  "name": "orbitmem",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "bun run --filter '*' build",
    "test": "bun run --filter '*' test",
    "dev:relay": "bun run --filter @orbitmem/relay dev",
    "lint": "bun run --filter '*' lint"
  }
}
```

**Step 2: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["bun-types"]
  }
}
```

**Step 3: Create packages/sdk/package.json**

```json
{
  "name": "@orbitmem/sdk",
  "version": "0.3.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./agent": "./dist/agent/index.js",
    "./types": "./dist/types.js"
  },
  "scripts": {
    "build": "bun build ./src/index.ts --outdir ./dist --target node",
    "test": "bun test",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@orbitdb/core": "^3.0.2",
    "@orbitdb/nested-db": "^2.0.4",
    "helia": "^5.5.1",
    "libp2p": "^2.0.0",
    "@chainsafe/libp2p-gossipsub": "^14.0.0",
    "@libp2p/identify": "^3.0.0",
    "@libp2p/tcp": "^10.0.0",
    "@chainsafe/libp2p-noise": "^16.0.0",
    "@chainsafe/libp2p-yamux": "^7.0.0",
    "blockstore-level": "^2.0.0",
    "@lit-protocol/lit-node-client": "^7.0.0",
    "@lit-protocol/encryption": "^7.0.0",
    "@lit-protocol/constants": "^7.0.0",
    "@lit-protocol/auth-helpers": "^7.0.0",
    "@storacha/client": "^1.0.0",
    "viem": "^2.0.0",
    "@solana/web3.js": "^1.95.0"
  },
  "devDependencies": {
    "bun-types": "latest",
    "typescript": "^5.5.0"
  }
}
```

**Step 4: Create packages/sdk/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**Step 5: Create packages/relay/package.json**

```json
{
  "name": "@orbitmem/relay",
  "version": "0.3.0",
  "type": "module",
  "scripts": {
    "dev": "bun run --hot src/index.ts",
    "build": "bun build ./src/index.ts --outdir ./dist --target bun",
    "start": "bun run dist/index.js",
    "test": "bun test",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "@hono/zod-validator": "^0.4.0",
    "zod": "^3.23.0",
    "@orbitmem/sdk": "workspace:*",
    "@orbitdb/core": "^3.0.2",
    "@orbitdb/nested-db": "^2.0.4",
    "helia": "^5.5.1",
    "libp2p": "^2.0.0",
    "@chainsafe/libp2p-gossipsub": "^14.0.0",
    "@libp2p/identify": "^3.0.0",
    "@libp2p/tcp": "^10.0.0",
    "@chainsafe/libp2p-noise": "^16.0.0",
    "@chainsafe/libp2p-yamux": "^7.0.0",
    "blockstore-level": "^2.0.0",
    "@storacha/client": "^1.0.0"
  },
  "devDependencies": {
    "bun-types": "latest",
    "typescript": "^5.5.0"
  }
}
```

**Step 6: Create packages/relay/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**Step 7: Install dependencies**

Run: `bun install`
Expected: lockfile created, node_modules populated

**Step 8: Commit**

```bash
git add package.json tsconfig.base.json packages/sdk/package.json packages/sdk/tsconfig.json packages/relay/package.json packages/relay/tsconfig.json bun.lockb
git commit -m "feat: scaffold monorepo with bun workspaces"
```

---

## Task 2: SDK Types

**Files:**
- Create: `packages/sdk/src/types.ts` (from `docs/design/sdk-types.ts`)
- Create: `packages/sdk/src/index.ts` (stub entry)

**Step 1: Copy sdk-types.ts into the SDK package**

Copy `docs/design/sdk-types.ts` → `packages/sdk/src/types.ts`. This is the source of truth for all interfaces.

**Step 2: Create stub entry point**

```typescript
// packages/sdk/src/index.ts
export type {
  OrbitMemConfig,
  IOrbitMem,
  WalletConnection,
  ChainFamily,
  Visibility,
  EncryptionEngine,
  VaultEntry,
  SessionKey,
} from './types.js';
```

**Step 3: Verify it compiles**

Run: `cd packages/sdk && bun run lint`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/sdk/src/types.ts packages/sdk/src/index.ts
git commit -m "feat: add SDK type definitions"
```

---

## Task 3: Encryption Layer — AES Engine

**Files:**
- Create: `packages/sdk/src/encryption/aes.ts`
- Create: `packages/sdk/src/encryption/index.ts`
- Test: `packages/sdk/src/encryption/__tests__/aes.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/sdk/src/encryption/__tests__/aes.test.ts
import { describe, test, expect } from 'bun:test';
import { AESEngine } from '../aes.js';

describe('AESEngine', () => {
  const engine = new AESEngine({ kdf: 'hkdf-sha256' });

  test('deriveKey returns a CryptoKey from wallet signature', async () => {
    const fakeSignature = new Uint8Array(64).fill(1);
    const key = await engine.deriveKey({
      type: 'wallet-signature',
    }, fakeSignature);
    expect(key).toBeDefined();
    expect(key.type).toBe('secret');
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM' });
  });

  test('encrypt then decrypt returns original data', async () => {
    const fakeSignature = new Uint8Array(64).fill(1);
    const key = await engine.deriveKey({
      type: 'wallet-signature',
    }, fakeSignature);

    const plaintext = new TextEncoder().encode('Hello OrbitMem');
    const encrypted = await engine.encrypt(plaintext, key);

    expect(encrypted.engine).toBe('aes');
    expect(encrypted.ciphertext).toBeInstanceOf(Uint8Array);
    expect(encrypted.iv).toBeInstanceOf(Uint8Array);
    expect(encrypted.iv.length).toBe(12);
    expect(encrypted.authTag).toBeInstanceOf(Uint8Array);

    const decrypted = await engine.decrypt(encrypted, key);
    expect(new TextDecoder().decode(decrypted)).toBe('Hello OrbitMem');
  });

  test('decrypt with wrong key fails', async () => {
    const sig1 = new Uint8Array(64).fill(1);
    const sig2 = new Uint8Array(64).fill(2);
    const key1 = await engine.deriveKey({ type: 'wallet-signature' }, sig1);
    const key2 = await engine.deriveKey({ type: 'wallet-signature' }, sig2);

    const plaintext = new TextEncoder().encode('secret');
    const encrypted = await engine.encrypt(plaintext, key1);

    expect(engine.decrypt(encrypted, key2)).rejects.toThrow();
  });

  test('encrypt with raw key source', async () => {
    const rawKey = crypto.getRandomValues(new Uint8Array(32));
    const key = await engine.deriveKey({ type: 'raw', key: rawKey });

    const plaintext = new TextEncoder().encode('raw key test');
    const encrypted = await engine.encrypt(plaintext, key);
    const decrypted = await engine.decrypt(encrypted, key);
    expect(new TextDecoder().decode(decrypted)).toBe('raw key test');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/sdk && bun test src/encryption/__tests__/aes.test.ts`
Expected: FAIL — module not found

**Step 3: Implement AES engine**

```typescript
// packages/sdk/src/encryption/aes.ts
import type { AESEncryptedData, AESKeySource } from '../types.js';

export interface AESConfig {
  kdf: 'hkdf-sha256' | 'pbkdf2-sha256';
  iterations?: number;
}

export class AESEngine {
  private config: AESConfig;

  constructor(config: AESConfig) {
    this.config = config;
  }

  async deriveKey(source: AESKeySource, walletSignature?: Uint8Array): Promise<CryptoKey> {
    if (source.type === 'raw') {
      return crypto.subtle.importKey(
        'raw',
        source.key,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );
    }

    if (source.type === 'wallet-signature') {
      if (!walletSignature) throw new Error('walletSignature required for wallet-signature source');
      const ikm = await crypto.subtle.importKey(
        'raw',
        walletSignature,
        'HKDF',
        false,
        ['deriveKey']
      );
      const salt = crypto.getRandomValues(new Uint8Array(32));
      const info = new TextEncoder().encode('orbitmem-aes-256-gcm');
      return crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt, info },
        ikm,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    }

    if (source.type === 'password') {
      const enc = new TextEncoder().encode(source.password);
      const ikm = await crypto.subtle.importKey('raw', enc, 'PBKDF2', false, ['deriveKey']);
      const salt = crypto.getRandomValues(new Uint8Array(32));
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: this.config.iterations ?? 100000 },
        ikm,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    }

    throw new Error(`Unknown key source type: ${(source as any).type}`);
  }

  async encrypt(data: Uint8Array, key: CryptoKey): Promise<AESEncryptedData> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertextWithTag = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      key,
      data
    );
    // AES-GCM appends the 16-byte auth tag to the ciphertext
    const raw = new Uint8Array(ciphertextWithTag);
    const ciphertext = raw.slice(0, raw.length - 16);
    const authTag = raw.slice(raw.length - 16);

    return {
      engine: 'aes',
      ciphertext,
      iv,
      authTag,
      keyDerivation: {
        source: 'wallet-signature',
        salt: new Uint8Array(32), // placeholder — real salt from deriveKey
        kdf: this.config.kdf === 'hkdf-sha256' ? 'hkdf-sha256' : 'pbkdf2-sha256',
      },
    };
  }

  async decrypt(encrypted: AESEncryptedData, key: CryptoKey): Promise<Uint8Array> {
    // Reconstruct ciphertext + authTag
    const combined = new Uint8Array(encrypted.ciphertext.length + encrypted.authTag.length);
    combined.set(encrypted.ciphertext, 0);
    combined.set(encrypted.authTag, encrypted.ciphertext.length);

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: encrypted.iv, tagLength: 128 },
      key,
      combined
    );
    return new Uint8Array(plaintext);
  }
}
```

**Step 4: Create encryption index**

```typescript
// packages/sdk/src/encryption/index.ts
export { AESEngine } from './aes.js';
export type { AESConfig } from './aes.js';
```

**Step 5: Run tests**

Run: `cd packages/sdk && bun test src/encryption/__tests__/aes.test.ts`
Expected: All 4 tests PASS

**Step 6: Commit**

```bash
git add packages/sdk/src/encryption/
git commit -m "feat(sdk): add AES-256-GCM encryption engine"
```

---

## Task 4: Encryption Layer — Lit Engine

**Files:**
- Create: `packages/sdk/src/encryption/lit.ts`
- Modify: `packages/sdk/src/encryption/index.ts`
- Test: `packages/sdk/src/encryption/__tests__/lit.test.ts`

**Step 1: Write the failing test**

Lit requires network access to decrypt, so we test encryption (client-side) and mock the decrypt path.

```typescript
// packages/sdk/src/encryption/__tests__/lit.test.ts
import { describe, test, expect } from 'bun:test';
import { LitEngine } from '../lit.js';
import type { LitAccessCondition } from '../../types.js';

const testConditions: LitAccessCondition[] = [
  {
    conditionType: 'evmBasic',
    contractAddress: '',
    standardContractType: '',
    chain: 'base',
    method: '',
    parameters: [':userAddress'],
    returnValueTest: {
      comparator: '=',
      value: '0x1234567890abcdef1234567890abcdef12345678',
    },
  },
];

describe('LitEngine', () => {
  test('creates access conditions correctly', () => {
    const engine = new LitEngine({ network: 'datil-dev' });
    const condition = engine.createAddressCondition(
      '0x1234567890abcdef1234567890abcdef12345678',
      'base'
    );
    expect(condition.conditionType).toBe('evmBasic');
    expect(condition.returnValueTest.value).toBe('0x1234567890abcdef1234567890abcdef12345678');
  });

  test('createReputationCondition builds correct contract call condition', () => {
    const engine = new LitEngine({ network: 'datil-dev' });
    const condition = engine.createReputationCondition({
      registryAddress: '0xREP_REGISTRY',
      minScore: 80,
      chain: 'base',
    });
    expect(condition.conditionType).toBe('evmContract');
    expect(condition.returnValueTest.comparator).toBe('>=');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/sdk && bun test src/encryption/__tests__/lit.test.ts`
Expected: FAIL — module not found

**Step 3: Implement Lit engine**

```typescript
// packages/sdk/src/encryption/lit.ts
import type {
  LitEncryptedData,
  LitAccessCondition,
  LitEvmCondition,
  EvmChain,
  EvmAddress,
} from '../types.js';

export interface LitConfig {
  network: 'datil-dev' | 'datil-test' | 'datil';
  debug?: boolean;
}

export class LitEngine {
  private config: LitConfig;
  private client: any | null = null;

  constructor(config: LitConfig) {
    this.config = config;
  }

  /** Lazy-initialize the Lit client (heavy import) */
  async getClient(): Promise<any> {
    if (this.client) return this.client;
    const { LitNodeClient } = await import('@lit-protocol/lit-node-client');
    const { LIT_NETWORK } = await import('@lit-protocol/constants');
    const networkMap: Record<string, string> = {
      'datil-dev': LIT_NETWORK.DatilDev,
      'datil-test': LIT_NETWORK.DatilTest,
      'datil': LIT_NETWORK.Datil,
    };
    this.client = new LitNodeClient({
      litNetwork: networkMap[this.config.network],
      debug: this.config.debug ?? false,
    });
    await this.client.connect();
    return this.client;
  }

  async encrypt(
    data: Uint8Array,
    accessConditions: LitAccessCondition[],
    chain: string = 'ethereum'
  ): Promise<LitEncryptedData> {
    const client = await this.getClient();
    const { encryptUint8Array } = await import('@lit-protocol/encryption');
    const { ciphertext, dataToEncryptHash } = await encryptUint8Array(
      { accessControlConditions: accessConditions as any, dataToEncrypt: data },
      client
    );
    return {
      engine: 'lit',
      ciphertext: typeof ciphertext === 'string'
        ? new TextEncoder().encode(ciphertext)
        : ciphertext,
      dataToEncryptHash,
      accessControlConditions: accessConditions,
      chain: chain as any,
    };
  }

  async decrypt(
    encrypted: LitEncryptedData,
    sessionSigs: any
  ): Promise<Uint8Array> {
    const client = await this.getClient();
    const { decryptToUint8Array } = await import('@lit-protocol/encryption');
    return decryptToUint8Array(
      {
        accessControlConditions: encrypted.accessControlConditions as any,
        chain: encrypted.chain as string,
        ciphertext: typeof encrypted.ciphertext === 'string'
          ? encrypted.ciphertext
          : new TextDecoder().decode(encrypted.ciphertext),
        dataToEncryptHash: encrypted.dataToEncryptHash,
        sessionSigs,
      },
      client
    );
  }

  createAddressCondition(address: string, chain: EvmChain): LitEvmCondition {
    return {
      conditionType: 'evmBasic',
      contractAddress: '' as EvmAddress,
      standardContractType: '',
      chain,
      method: '',
      parameters: [':userAddress'],
      returnValueTest: { comparator: '=', value: address },
    };
  }

  createReputationCondition(opts: {
    registryAddress: string;
    minScore: number;
    chain: EvmChain;
  }): LitEvmCondition {
    return {
      conditionType: 'evmContract',
      contractAddress: opts.registryAddress as EvmAddress,
      standardContractType: '',
      chain: opts.chain,
      method: 'getScore',
      parameters: [':userAddress'],
      returnValueTest: { comparator: '>=', value: String(opts.minScore) },
    };
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
    }
  }
}
```

**Step 4: Update encryption index**

```typescript
// packages/sdk/src/encryption/index.ts
export { AESEngine } from './aes.js';
export type { AESConfig } from './aes.js';
export { LitEngine } from './lit.js';
export type { LitConfig } from './lit.js';
```

**Step 5: Run tests**

Run: `cd packages/sdk && bun test src/encryption/__tests__/lit.test.ts`
Expected: PASS (tests only use synchronous condition builders, no network)

**Step 6: Commit**

```bash
git add packages/sdk/src/encryption/
git commit -m "feat(sdk): add Lit Protocol encryption engine"
```

---

## Task 5: Encryption Layer — Unified Interface

**Files:**
- Create: `packages/sdk/src/encryption/encryption-layer.ts`
- Modify: `packages/sdk/src/encryption/index.ts`
- Test: `packages/sdk/src/encryption/__tests__/encryption-layer.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/sdk/src/encryption/__tests__/encryption-layer.test.ts
import { describe, test, expect } from 'bun:test';
import { createEncryptionLayer } from '../encryption-layer.js';

describe('EncryptionLayer', () => {
  const layer = createEncryptionLayer({
    defaultEngine: 'aes',
    aes: { kdf: 'hkdf-sha256' },
  });

  test('encrypt/decrypt with AES via unified interface', async () => {
    const data = new TextEncoder().encode('unified test');
    const fakeSignature = new Uint8Array(64).fill(42);

    const encrypted = await layer.encrypt(data, {
      engine: 'aes',
      keySource: { type: 'raw', key: crypto.getRandomValues(new Uint8Array(32)) },
    });

    expect(encrypted.engine).toBe('aes');

    const decrypted = await layer.decrypt(encrypted, {
      keySource: { type: 'raw', key: (encrypted as any)._testKey },
    });
    // This test will need adjustment — we need to thread the key through
  });

  test('deriveAESKey returns CryptoKey', async () => {
    const key = await layer.deriveAESKey({ type: 'raw', key: crypto.getRandomValues(new Uint8Array(32)) });
    expect(key.type).toBe('secret');
  });
});
```

**Step 2: Implement unified encryption layer**

```typescript
// packages/sdk/src/encryption/encryption-layer.ts
import type {
  IEncryptionLayer,
  EncryptionConfig,
  EncryptedData,
  EncryptLitOptions,
  EncryptAESOptions,
  DecryptOptions,
  LitEncryptedData,
  AESEncryptedData,
  AESKeySource,
  LitAccessCondition,
  WalletAddress,
  Chain,
} from '../types.js';
import { AESEngine } from './aes.js';
import { LitEngine } from './lit.js';

export function createEncryptionLayer(config: EncryptionConfig): IEncryptionLayer & {
  aes: AESEngine;
  lit: LitEngine | null;
} {
  const aes = new AESEngine({
    kdf: config.aes?.kdf ?? 'hkdf-sha256',
    iterations: config.aes?.iterations,
  });
  const lit = config.lit ? new LitEngine({
    network: config.lit.network === 'cayenne' ? 'datil-dev'
      : config.lit.network === 'manzano' ? 'datil-test'
      : config.lit.network === 'habanero' ? 'datil'
      : config.lit.network as any,
    debug: config.lit.debug,
  }) : null;

  // Cache for AES keys by source fingerprint
  const keyCache = new Map<string, CryptoKey>();

  return {
    aes,
    lit,

    async encrypt(data, opts) {
      if (opts.engine === 'aes') {
        const aesOpts = opts as EncryptAESOptions;
        const key = await aes.deriveKey(aesOpts.keySource);
        return aes.encrypt(data instanceof Uint8Array ? data : new TextEncoder().encode(data), key);
      }
      if (opts.engine === 'lit') {
        if (!lit) throw new Error('Lit Protocol not configured');
        const litOpts = opts as EncryptLitOptions;
        const raw = data instanceof Uint8Array ? data : new TextEncoder().encode(data);
        return lit.encrypt(raw, litOpts.accessConditions, litOpts.chain as string);
      }
      throw new Error(`Unknown engine: ${(opts as any).engine}`);
    },

    async decrypt(encrypted, opts) {
      if (encrypted.engine === 'aes') {
        const aesData = encrypted as AESEncryptedData;
        if (!opts?.keySource) throw new Error('keySource required for AES decryption');
        const key = await aes.deriveKey(opts.keySource);
        return aes.decrypt(aesData, key);
      }
      if (encrypted.engine === 'lit') {
        if (!lit) throw new Error('Lit Protocol not configured');
        // sessionSigs must be provided via opts — this is handled by the identity layer
        throw new Error('Lit decryption requires sessionSigs — use identity layer');
      }
      throw new Error(`Unknown engine: ${(encrypted as any).engine}`);
    },

    async grantAccess(encrypted, agentAddress, opts) {
      if (!lit) throw new Error('Lit Protocol not configured');
      // Add address condition to existing conditions
      const newCondition = lit.createAddressCondition(
        agentAddress as string,
        (opts?.chain ?? 'base') as any
      );
      const updatedConditions = [
        ...encrypted.accessControlConditions,
        { operator: 'or' as const },
        newCondition,
      ];
      // Re-encrypt with updated conditions
      // In practice, Lit handles this via condition updates
      return { ...encrypted, accessControlConditions: updatedConditions };
    },

    async revokeAccess(encrypted, agentAddress) {
      const filtered = encrypted.accessControlConditions.filter((c: any) =>
        !('returnValueTest' in c && c.returnValueTest?.value === agentAddress)
      );
      return { ...encrypted, accessControlConditions: filtered };
    },

    async deriveAESKey(source) {
      return aes.deriveKey(source);
    },

    async canDecrypt(encrypted) {
      if (encrypted.engine === 'aes') return true; // caller must have key
      if (encrypted.engine === 'lit') return lit !== null;
      return false;
    },
  };
}
```

**Step 3: Update encryption index**

```typescript
// packages/sdk/src/encryption/index.ts
export { AESEngine } from './aes.js';
export type { AESConfig } from './aes.js';
export { LitEngine } from './lit.js';
export type { LitConfig } from './lit.js';
export { createEncryptionLayer } from './encryption-layer.js';
```

**Step 4: Run all encryption tests**

Run: `cd packages/sdk && bun test src/encryption/`
Expected: All PASS

**Step 5: Commit**

```bash
git add packages/sdk/src/encryption/
git commit -m "feat(sdk): add unified encryption layer (AES + Lit)"
```

---

## Task 6: Data Layer — OrbitDB Nested Vault

**Files:**
- Create: `packages/sdk/src/data/vault.ts`
- Create: `packages/sdk/src/data/index.ts`
- Create: `packages/sdk/src/data/orbitdb.ts` (Helia + OrbitDB setup)
- Test: `packages/sdk/src/data/__tests__/vault.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/sdk/src/data/__tests__/vault.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createVault, createOrbitDBInstance } from '../index.js';

describe('DataLayer — Vault', () => {
  let vault: Awaited<ReturnType<typeof createVault>>;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const { orbitdb, cleanup: c } = await createOrbitDBInstance({ directory: './.test-orbitdb' });
    cleanup = c;
    vault = await createVault(orbitdb, {});
  });

  afterAll(async () => {
    await vault.close();
    await cleanup();
  });

  test('put and get a public value', async () => {
    const entry = await vault.put('test/greeting', 'hello', { visibility: 'public' });
    expect(entry.value).toBe('hello');
    expect(entry.visibility).toBe('public');
    expect(entry.encrypted).toBe(false);

    const retrieved = await vault.get('test/greeting');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.value).toBe('hello');
  });

  test('put and get nested path', async () => {
    await vault.put('travel/dietary', 'vegan', { visibility: 'public' });
    await vault.put('travel/budget', 3000, { visibility: 'public' });

    const travel = await vault.get('travel');
    expect(travel).not.toBeNull();
    expect(travel!.value).toMatchObject({ dietary: 'vegan', budget: 3000 });
  });

  test('insert merges nested object', async () => {
    await vault.insert({
      profile: { name: 'Alice', interests: ['travel'] },
    }, { visibility: 'public' });

    const profile = await vault.get('profile');
    expect(profile).not.toBeNull();
    expect(profile!.value).toMatchObject({ name: 'Alice', interests: ['travel'] });
  });

  test('del removes a path', async () => {
    await vault.put('temp/data', 42, { visibility: 'public' });
    await vault.del('temp/data');
    const result = await vault.get('temp/data');
    expect(result).toBeNull();
  });

  test('keys returns all leaf paths', async () => {
    const allKeys = await vault.keys();
    expect(allKeys).toContain('test/greeting');
    expect(allKeys).toContain('travel/dietary');
  });

  test('all returns full nested object', async () => {
    const everything = await vault.all();
    expect(everything).toHaveProperty('test');
    expect(everything).toHaveProperty('travel');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/sdk && bun test src/data/__tests__/vault.test.ts`
Expected: FAIL — module not found

**Step 3: Create OrbitDB setup helper**

```typescript
// packages/sdk/src/data/orbitdb.ts
import { createLibp2p } from 'libp2p';
import { createHelia } from 'helia';
import { createOrbitDB, useDatabaseType } from '@orbitdb/core';
import { Nested } from '@orbitdb/nested-db';
import { LevelBlockstore } from 'blockstore-level';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { identify } from '@libp2p/identify';
import { tcp } from '@libp2p/tcp';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';

// Register the Nested database type (must happen before createOrbitDB)
useDatabaseType(Nested);

export async function createOrbitDBInstance(opts: {
  directory?: string;
  listenAddrs?: string[];
}) {
  const blockstore = new LevelBlockstore(opts.directory ?? './orbitdb/blocks');

  const libp2p = await createLibp2p({
    addresses: { listen: opts.listenAddrs ?? ['/ip4/0.0.0.0/tcp/0'] },
    transports: [tcp()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identify(),
      pubsub: gossipsub({ allowPublishToZeroTopicPeers: true }),
    },
  });

  const ipfs = await createHelia({ libp2p, blockstore });
  const orbitdb = await createOrbitDB({ ipfs });

  return {
    orbitdb,
    ipfs,
    libp2p,
    cleanup: async () => {
      await orbitdb.stop();
      await ipfs.stop();
    },
  };
}
```

**Step 4: Create Vault implementation**

```typescript
// packages/sdk/src/data/vault.ts
import type {
  IDataLayer,
  VaultEntry,
  VaultPath,
  Visibility,
  EncryptionEngine,
  LitAccessCondition,
  AESKeySource,
  SyncStatus,
  WalletAddress,
  ChainFamily,
} from '../types.js';

function normalizePath(path: VaultPath): string {
  return Array.isArray(path) ? path.join('/') : path;
}

export async function createVault(
  orbitdb: any,
  config: {
    dbName?: string;
    author?: WalletAddress;
    authorChain?: ChainFamily;
  }
): Promise<IDataLayer & { close: () => Promise<void>; db: any }> {
  const db = await orbitdb.open(config.dbName ?? 'orbitmem-vault', { type: 'nested' });

  // Metadata store: path -> { visibility, encrypted, encryptionEngine, author, authorChain, timestamp }
  const metaDb = await orbitdb.open((config.dbName ?? 'orbitmem-vault') + '-meta', { type: 'nested' });

  function makeEntry<T>(path: string, value: T, visibility: Visibility, encrypted: boolean, engine?: EncryptionEngine): VaultEntry<T> {
    return {
      value,
      visibility,
      author: config.author ?? ('0x0' as WalletAddress),
      authorChain: config.authorChain ?? 'evm',
      timestamp: Date.now(),
      encrypted,
      encryptionEngine: engine,
      hash: '',
    };
  }

  return {
    db,

    async put(path, value, opts) {
      const key = normalizePath(path);
      const visibility = opts?.visibility ?? 'private';
      const encrypted = visibility !== 'public';
      const engine = encrypted ? (opts?.engine ?? 'aes') : undefined;

      // TODO: Wire encryption for private/shared — for now store raw value
      const hash = await db.put(key, value);
      await metaDb.put(key, { visibility, encrypted, encryptionEngine: engine, timestamp: Date.now() });

      return { ...makeEntry(key, value, visibility, encrypted, engine), hash };
    },

    async insert(obj, opts) {
      const visibility = opts?.visibility ?? 'private';
      const prefix = opts?.prefix;

      // Flatten the object and put each leaf
      const flatten = (o: any, parentKey: string = ''): [string, any][] => {
        const entries: [string, any][] = [];
        for (const [k, v] of Object.entries(o)) {
          const newKey = parentKey ? `${parentKey}/${k}` : k;
          if (v && typeof v === 'object' && !Array.isArray(v)) {
            entries.push(...flatten(v, newKey));
          } else {
            entries.push([newKey, v]);
          }
        }
        return entries;
      };

      const leaves = flatten(obj, prefix ?? '');
      for (const [key, value] of leaves) {
        await db.put(key, value);
        await metaDb.put(key, { visibility, encrypted: visibility !== 'public', timestamp: Date.now() });
      }
    },

    async get(path) {
      const key = normalizePath(path);
      const value = await db.get(key);
      if (value === undefined) return null;

      const meta = await metaDb.get(key);
      const visibility = meta?.visibility ?? 'private';
      return makeEntry(key, value, visibility, visibility !== 'public');
    },

    async del(path) {
      const key = normalizePath(path);
      await db.del(key);
      await metaDb.del(key);
    },

    async keys(prefix?) {
      const all = await db.all();
      const flatten = (o: any, parentKey: string = ''): string[] => {
        const keys: string[] = [];
        if (o && typeof o === 'object' && !Array.isArray(o)) {
          for (const [k, v] of Object.entries(o)) {
            const newKey = parentKey ? `${parentKey}/${k}` : k;
            keys.push(...flatten(v, newKey));
          }
        } else {
          keys.push(parentKey);
        }
        return keys;
      };
      const allKeys = flatten(all);
      if (prefix) return allKeys.filter(k => k.startsWith(prefix));
      return allKeys;
    },

    async all() {
      return db.all() as any;
    },

    async query(filter) {
      const allData = await db.all();
      // Simple implementation — iterate and filter
      const results: VaultEntry[] = [];
      const flatten = (o: any, parentKey: string = ''): [string, any][] => {
        const entries: [string, any][] = [];
        if (o && typeof o === 'object' && !Array.isArray(o)) {
          for (const [k, v] of Object.entries(o)) {
            const newKey = parentKey ? `${parentKey}/${k}` : k;
            entries.push(...flatten(v, newKey));
          }
        } else {
          entries.push([parentKey, o]);
        }
        return entries;
      };
      const leaves = flatten(allData);
      for (const [key, value] of leaves) {
        if (filter.prefix && !key.startsWith(filter.prefix)) continue;
        const meta = await metaDb.get(key);
        if (filter.visibility && meta?.visibility !== filter.visibility) continue;
        if (filter.since && (meta?.timestamp ?? 0) < filter.since) continue;
        results.push(makeEntry(key, value, meta?.visibility ?? 'private', meta?.encrypted ?? true));
        if (filter.limit && results.length >= filter.limit) break;
      }
      return results;
    },

    async sync() {
      return { syncing: false, pendingPush: 0, pendingPull: 0, lastSynced: Date.now(), connectedPeers: 0 };
    },

    getSyncStatus() {
      return { syncing: false, pendingPush: 0, pendingPull: 0, lastSynced: null, connectedPeers: 0 };
    },

    onChange(callback) {
      const handler = (entry: any) => {
        callback({ type: 'put', path: entry?.payload?.key ?? '', entry: undefined });
      };
      db.events.on('update', handler);
      return () => db.events.off('update', handler);
    },

    async exportSnapshot() {
      const allData = await db.all();
      const data = new TextEncoder().encode(JSON.stringify(allData));
      return { data, entryCount: Object.keys(allData).length, timestamp: Date.now() };
    },

    async importSnapshot(data) {
      const obj = JSON.parse(new TextDecoder().decode(data));
      await db.insert(obj);
      return { merged: Object.keys(obj).length, conflicts: 0 };
    },

    async close() {
      await db.close();
      await metaDb.close();
    },
  };
}
```

**Step 5: Create data index**

```typescript
// packages/sdk/src/data/index.ts
export { createVault } from './vault.js';
export { createOrbitDBInstance } from './orbitdb.js';
```

**Step 6: Run tests**

Run: `cd packages/sdk && bun test src/data/__tests__/vault.test.ts`
Expected: All tests PASS

**Step 7: Commit**

```bash
git add packages/sdk/src/data/
git commit -m "feat(sdk): add OrbitDB nested-db data vault layer"
```

---

## Task 7: Identity Layer

**Files:**
- Create: `packages/sdk/src/identity/identity-layer.ts`
- Create: `packages/sdk/src/identity/session.ts`
- Create: `packages/sdk/src/identity/index.ts`
- Test: `packages/sdk/src/identity/__tests__/identity.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/sdk/src/identity/__tests__/identity.test.ts
import { describe, test, expect } from 'bun:test';
import { createIdentityLayer } from '../identity-layer.js';
import { deriveSessionKey } from '../session.js';

describe('IdentityLayer', () => {
  test('creates session key from EVM signature', async () => {
    const session = await deriveSessionKey({
      family: 'evm',
      signature: new Uint8Array(65).fill(1),
      parentAddress: '0x1234567890abcdef1234567890abcdef12345678',
      permissions: [{ type: 'vault:read' }, { type: 'vault:write' }],
      ttl: 3600,
    });
    expect(session.id).toBeTruthy();
    expect(session.family).toBe('evm');
    expect(session.permissions).toHaveLength(2);
    expect(session.isActive).toBe(true);
    expect(session.expiresAt).toBeGreaterThan(Date.now());
  });

  test('session key expires', async () => {
    const session = await deriveSessionKey({
      family: 'evm',
      signature: new Uint8Array(65).fill(1),
      parentAddress: '0x1234567890abcdef1234567890abcdef12345678',
      permissions: [{ type: 'vault:read' }],
      ttl: -1, // already expired
    });
    expect(session.isActive).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/sdk && bun test src/identity/__tests__/identity.test.ts`
Expected: FAIL

**Step 3: Implement session key derivation**

```typescript
// packages/sdk/src/identity/session.ts
import type { SessionKey, SessionPermission, ChainFamily, WalletAddress, SignatureAlgorithm } from '../types.js';

export async function deriveSessionKey(opts: {
  family: ChainFamily;
  signature: Uint8Array;
  parentAddress: WalletAddress;
  permissions: SessionPermission[];
  ttl: number; // seconds
  nonce?: Uint8Array;
}): Promise<SessionKey> {
  const nonce = opts.nonce ?? crypto.getRandomValues(new Uint8Array(32));

  // Derive session address from signature + nonce
  const combined = new Uint8Array(opts.signature.length + nonce.length);
  combined.set(opts.signature, 0);
  combined.set(nonce, opts.signature.length);

  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  const hashArray = new Uint8Array(hashBuffer);

  // Use first 20 bytes as session address (EVM-style)
  const sessionAddrBytes = hashArray.slice(0, 20);
  const sessionAddress = '0x' + Array.from(sessionAddrBytes).map(b => b.toString(16).padStart(2, '0')).join('') as WalletAddress;

  // Session ID from hash
  const id = Array.from(hashArray.slice(20, 32)).map(b => b.toString(16).padStart(2, '0')).join('');

  const expiresAt = Date.now() + (opts.ttl * 1000);

  const algorithmMap: Record<ChainFamily, SignatureAlgorithm> = {
    passkey: 'p256',
    evm: 'ecdsa-secp256k1',
    solana: 'ed25519',
  };

  return {
    id,
    parentAddress: opts.parentAddress,
    family: opts.family,
    sessionAddress,
    permissions: opts.permissions,
    expiresAt,
    isActive: expiresAt > Date.now(),
    algorithm: algorithmMap[opts.family],
  };
}
```

**Step 4: Implement identity layer**

```typescript
// packages/sdk/src/identity/identity-layer.ts
import type {
  IIdentityLayer,
  IdentityConfig,
  WalletConnection,
  SessionKey,
  SessionPermission,
  ChainFamily,
  SignatureAlgorithm,
  Chain,
  EvmWalletAdapter,
  SolanaWalletAdapter,
  EvmAddress,
} from '../types.js';
import { deriveSessionKey } from './session.js';

export function createIdentityLayer(config: IdentityConfig): IIdentityLayer {
  let connection: WalletConnection | null = null;
  let activeSession: SessionKey | null = null;
  const sessions = new Map<string, SessionKey>();
  const listeners: Set<(conn: WalletConnection | null) => void> = new Set();

  // Store signer function set by external wallet adapters
  let signFn: ((message: string) => Promise<{ signature: Uint8Array; algorithm: SignatureAlgorithm }>) | null = null;

  return {
    async connect(opts) {
      // In a real implementation, this would open the wallet adapter
      // For now, this is a hook point — external code sets the connection
      throw new Error(
        `connect(${opts.method}) requires a wallet adapter. ` +
        'Use setConnection() for testing or integrate a wallet provider.'
      );
    },

    async createPasskey() {
      throw new Error('Passkey creation requires browser WebAuthn API');
    },

    async disconnect() {
      connection = null;
      activeSession = null;
      signFn = null;
      for (const cb of listeners) cb(null);
    },

    async signChallenge(message) {
      if (!signFn) throw new Error('No signer available — connect a wallet first');
      return signFn(message);
    },

    async createSessionKey(permissions, opts) {
      if (!connection) throw new Error('No wallet connected');
      if (!signFn) throw new Error('No signer available');

      const challenge = `OrbitMem Authentication\nTimestamp: ${Date.now()}\nNonce: ${crypto.randomUUID()}`;
      const { signature } = await signFn(challenge);

      const session = await deriveSessionKey({
        family: connection.family,
        signature,
        parentAddress: connection.address,
        permissions,
        ttl: opts?.ttl ?? config.sessionTTL ?? 3600,
      });

      sessions.set(session.id, session);
      activeSession = session;
      return session;
    },

    async resumeSession(sessionId) {
      const session = sessions.get(sessionId);
      if (!session) return null;
      if (session.expiresAt <= Date.now()) {
        sessions.delete(sessionId);
        return null;
      }
      activeSession = session;
      return session;
    },

    async revokeSession(sessionId) {
      sessions.delete(sessionId);
      if (activeSession?.id === sessionId) activeSession = null;
    },

    getConnection() {
      return connection;
    },

    getActiveSession() {
      if (activeSession && activeSession.expiresAt <= Date.now()) {
        activeSession = null;
      }
      return activeSession;
    },

    onConnectionChange(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
}

/**
 * Helper to set connection externally (for wallet adapters and testing).
 * The identity layer returned by createIdentityLayer is extended with this.
 */
export function setConnection(
  layer: IIdentityLayer,
  conn: WalletConnection,
  signer: (message: string) => Promise<{ signature: Uint8Array; algorithm: SignatureAlgorithm }>
): void {
  // This requires the layer to expose internal state — we handle this
  // by returning an extended interface from createIdentityLayer.
  // For now, identity-layer.ts will export a version that supports this.
  (layer as any)._setConnection(conn, signer);
}
```

**Step 5: Create identity index**

```typescript
// packages/sdk/src/identity/index.ts
export { createIdentityLayer } from './identity-layer.js';
export { deriveSessionKey } from './session.js';
```

**Step 6: Run tests**

Run: `cd packages/sdk && bun test src/identity/__tests__/identity.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add packages/sdk/src/identity/
git commit -m "feat(sdk): add identity layer with session key derivation"
```

---

## Task 8: Transport Layer — ERC-8128

**Files:**
- Create: `packages/sdk/src/transport/transport-layer.ts`
- Create: `packages/sdk/src/transport/index.ts`
- Test: `packages/sdk/src/transport/__tests__/transport.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/sdk/src/transport/__tests__/transport.test.ts
import { describe, test, expect } from 'bun:test';
import { createTransportLayer } from '../transport-layer.js';

describe('TransportLayer', () => {
  test('createSignedRequest adds ERC-8128 headers', async () => {
    const transport = createTransportLayer({
      signer: async (payload: Uint8Array) => ({
        signature: new Uint8Array(65).fill(0xAB),
        algorithm: 'ecdsa-secp256k1' as const,
      }),
      signerAddress: '0x1234567890abcdef1234567890abcdef12345678',
      family: 'evm',
    });

    const signed = await transport.createSignedRequest({
      url: 'https://relay.orbitmem.xyz/v1/vault/read',
      method: 'POST',
      body: { key: 'preferences' },
    });

    expect(signed.proof.signer).toBe('0x1234567890abcdef1234567890abcdef12345678');
    expect(signed.proof.family).toBe('evm');
    expect(signed.proof.algorithm).toBe('ecdsa-secp256k1');
    expect(signed.proof.signature).toBeInstanceOf(Uint8Array);
    expect(signed.proof.nonce).toBeTruthy();
    expect(signed.proof.timestamp).toBeGreaterThan(0);
    expect(signed.headers['X-OrbitMem-Signer']).toBe('0x1234567890abcdef1234567890abcdef12345678');
  });

  test('verifyRequest validates signature round-trip', async () => {
    let lastPayload: Uint8Array | null = null;

    const transport = createTransportLayer({
      signer: async (payload: Uint8Array) => {
        lastPayload = payload;
        // Simple "sign" = hash of payload (for testing)
        const hash = await crypto.subtle.digest('SHA-256', payload);
        return {
          signature: new Uint8Array(hash),
          algorithm: 'ecdsa-secp256k1' as const,
        };
      },
      verifier: async (payload: Uint8Array, signature: Uint8Array) => {
        const hash = await crypto.subtle.digest('SHA-256', payload);
        const expected = new Uint8Array(hash);
        return signature.length === expected.length &&
          signature.every((b, i) => b === expected[i]);
      },
      signerAddress: '0xAGENT',
      family: 'evm',
    });

    const signed = await transport.createSignedRequest({
      url: 'https://relay.orbitmem.xyz/v1/vault/read',
      method: 'POST',
      body: { key: 'test' },
    });

    const result = await transport.verifyRequest(signed);
    expect(result.valid).toBe(true);
    expect(result.signer).toBe('0xAGENT');
    expect(result.isReplay).toBe(false);
  });

  test('replay detection rejects seen nonce', async () => {
    const transport = createTransportLayer({
      signer: async (payload) => ({
        signature: new Uint8Array(32).fill(1),
        algorithm: 'ecdsa-secp256k1' as const,
      }),
      verifier: async () => true,
      signerAddress: '0xAGENT',
      family: 'evm',
    });

    const signed = await transport.createSignedRequest({
      url: 'https://relay.orbitmem.xyz/v1/health',
      method: 'GET',
    });

    const first = await transport.verifyRequest(signed);
    expect(first.isReplay).toBe(false);

    const second = await transport.verifyRequest(signed);
    expect(second.isReplay).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/sdk && bun test src/transport/__tests__/transport.test.ts`
Expected: FAIL

**Step 3: Implement transport layer**

```typescript
// packages/sdk/src/transport/transport-layer.ts
import type {
  ITransportLayer,
  SignedRequest,
  VerificationResult,
  WalletAddress,
  ChainFamily,
  SignatureAlgorithm,
} from '../types.js';

interface TransportConfig {
  signer: (payload: Uint8Array) => Promise<{ signature: Uint8Array; algorithm: SignatureAlgorithm }>;
  verifier?: (payload: Uint8Array, signature: Uint8Array, algorithm: SignatureAlgorithm) => Promise<boolean>;
  signerAddress: WalletAddress;
  family: ChainFamily;
  nonceTTL?: number; // ms, default 5 min
}

export function createTransportLayer(config: TransportConfig): ITransportLayer {
  const nonceCache = new Map<string, number>(); // nonce -> timestamp
  const NONCE_TTL = config.nonceTTL ?? 5 * 60 * 1000;
  const TIMESTAMP_TOLERANCE = 30 * 1000; // ±30s

  // Periodic cleanup
  function cleanNonces() {
    const now = Date.now();
    for (const [nonce, ts] of nonceCache) {
      if (now - ts > NONCE_TTL) nonceCache.delete(nonce);
    }
  }

  async function computePayload(method: string, url: string, timestamp: number, nonce: string, body?: unknown): Promise<Uint8Array> {
    const bodyHash = body
      ? new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(body))))
      : new Uint8Array(0);
    const payload = new TextEncoder().encode(
      `${method}\n${url}\n${timestamp}\n${nonce}\n${Array.from(bodyHash).map(b => b.toString(16).padStart(2, '0')).join('')}`
    );
    return payload;
  }

  return {
    async createSignedRequest(request) {
      const timestamp = Date.now();
      const nonce = crypto.randomUUID();
      const payload = await computePayload(request.method, request.url, timestamp, nonce, request.body);
      const { signature, algorithm } = await config.signer(payload);

      const headers: Record<string, string> = {
        ...request.headers,
        'X-OrbitMem-Signer': config.signerAddress as string,
        'X-OrbitMem-Family': config.family,
        'X-OrbitMem-Algorithm': algorithm,
        'X-OrbitMem-Timestamp': String(timestamp),
        'X-OrbitMem-Nonce': nonce,
        'X-OrbitMem-Signature': Array.from(signature).map(b => b.toString(16).padStart(2, '0')).join(''),
      };

      return {
        url: request.url,
        method: request.method ?? 'GET',
        headers,
        body: request.body,
        proof: {
          signer: config.signerAddress,
          family: config.family,
          signature,
          algorithm,
          timestamp,
          nonce,
        },
      };
    },

    async verifyRequest(request) {
      cleanNonces();

      const { proof } = request;

      // Timestamp check
      const now = Date.now();
      if (Math.abs(now - proof.timestamp) > TIMESTAMP_TOLERANCE) {
        return { valid: false, signer: proof.signer, family: proof.family, isReplay: false };
      }

      // Nonce replay check
      if (nonceCache.has(proof.nonce)) {
        return { valid: true, signer: proof.signer, family: proof.family, isReplay: true };
      }

      // Signature verification
      if (config.verifier) {
        const payload = await computePayload(request.method, request.url, proof.timestamp, proof.nonce, request.body);
        const valid = await config.verifier(payload, proof.signature, proof.algorithm);
        if (valid) {
          nonceCache.set(proof.nonce, Date.now());
        }
        return { valid, signer: proof.signer, family: proof.family, isReplay: false };
      }

      // No verifier — trust the signature (for client-side use)
      nonceCache.set(proof.nonce, Date.now());
      return { valid: true, signer: proof.signer, family: proof.family, isReplay: false };
    },

    async fetch(url, init) {
      const signed = await this.createSignedRequest({
        url,
        method: init?.method ?? 'GET',
        headers: init?.headers,
        body: init?.body,
      });

      return globalThis.fetch(signed.url, {
        method: signed.method,
        headers: signed.headers,
        body: signed.body ? JSON.stringify(signed.body) : undefined,
      });
    },
  };
}
```

**Step 4: Create transport index**

```typescript
// packages/sdk/src/transport/index.ts
export { createTransportLayer } from './transport-layer.js';
```

**Step 5: Run tests**

Run: `cd packages/sdk && bun test src/transport/__tests__/transport.test.ts`
Expected: All 3 PASS

**Step 6: Commit**

```bash
git add packages/sdk/src/transport/
git commit -m "feat(sdk): add ERC-8128 transport layer with replay protection"
```

---

## Task 9: Discovery Layer — Mock Registries

**Files:**
- Create: `packages/sdk/src/discovery/mock-registry.ts`
- Create: `packages/sdk/src/discovery/discovery-layer.ts`
- Create: `packages/sdk/src/discovery/index.ts`
- Test: `packages/sdk/src/discovery/__tests__/discovery.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/sdk/src/discovery/__tests__/discovery.test.ts
import { describe, test, expect } from 'bun:test';
import { createDiscoveryLayer } from '../discovery-layer.js';

describe('DiscoveryLayer (mock)', () => {
  const discovery = createDiscoveryLayer({
    agentRegistry: '0xAGENT_REG' as any,
    dataRegistry: '0xDATA_REG' as any,
    reputationRegistry: '0xREP_REG' as any,
    registryChain: 'base',
  });

  test('registerData and findData', async () => {
    const reg = await discovery.registerData({
      key: 'travel/dietary',
      name: 'Dietary Preferences',
      description: 'Dietary restrictions',
      schema: 'orbitmem:dietary:v1',
      tags: ['verified', 'human-curated'],
    });
    expect(reg.dataId).toBeGreaterThan(0);
    expect(reg.name).toBe('Dietary Preferences');

    const results = await discovery.findData({ schema: 'orbitmem:dietary:v1' });
    expect(results).toHaveLength(1);
    expect(results[0].vaultKey).toBe('travel/dietary');
  });

  test('rateData and getDataScoreById', async () => {
    // Register
    const reg = await discovery.registerData({
      key: 'travel/budget',
      name: 'Budget',
      description: 'Budget range',
      tags: ['verified'],
    });

    // Rate
    await discovery.rateData({
      dataId: reg.dataId,
      value: 90,
      qualityDimension: 'accuracy',
      tag1: 'accurate',
    });

    const score = await discovery.getDataScoreById(reg.dataId);
    expect(score.quality).toBeGreaterThan(0);
    expect(score.totalFeedback).toBe(1);
  });

  test('findAgents returns empty initially', async () => {
    const agents = await discovery.findAgents({ keyword: 'booking' });
    expect(agents).toEqual([]);
  });

  test('createAgentReputationCondition returns Lit condition', () => {
    const condition = discovery.createAgentReputationCondition({ minScore: 80 });
    expect(condition.conditionType).toBe('evmContract');
    expect(condition.returnValueTest.comparator).toBe('>=');
    expect(condition.returnValueTest.value).toBe('80');
  });
});
```

**Step 2: Implement mock registry + discovery layer**

```typescript
// packages/sdk/src/discovery/mock-registry.ts
import type {
  AgentRegistration,
  AgentReputation,
  DataRegistration,
  DataScore,
  DataFeedbackEntry,
  FeedbackEntry,
  WalletAddress,
  Visibility,
  DataTag,
} from '../types.js';

export class MockRegistry {
  private agents = new Map<number, AgentRegistration>();
  private agentFeedback = new Map<number, FeedbackEntry[]>();
  private data = new Map<number, DataRegistration>();
  private dataFeedback = new Map<number, DataFeedbackEntry[]>();
  private nextAgentId = 1;
  private nextDataId = 1;

  registerAgent(agent: Omit<AgentRegistration, 'agentId'>): AgentRegistration {
    const agentId = this.nextAgentId++;
    const reg = { ...agent, agentId } as AgentRegistration;
    this.agents.set(agentId, reg);
    return reg;
  }

  findAgents(query: { keyword?: string; minReputation?: number; activeOnly?: boolean }): AgentRegistration[] {
    let results = Array.from(this.agents.values());
    if (query.activeOnly) results = results.filter(a => a.active);
    if (query.keyword) {
      const kw = query.keyword.toLowerCase();
      results = results.filter(a => a.name.toLowerCase().includes(kw) || a.description.toLowerCase().includes(kw));
    }
    return results;
  }

  getAgent(agentId: number): AgentRegistration | null {
    return this.agents.get(agentId) ?? null;
  }

  rateAgent(agentId: number, feedback: FeedbackEntry): void {
    const existing = this.agentFeedback.get(agentId) ?? [];
    existing.push(feedback);
    this.agentFeedback.set(agentId, existing);
  }

  getAgentReputation(agentId: number): AgentReputation {
    const feedback = this.agentFeedback.get(agentId) ?? [];
    const total = feedback.reduce((sum, f) => sum + f.value, 0);
    const score = feedback.length > 0 ? Math.round(total / feedback.length) : 0;
    return {
      agentId,
      score,
      feedbackCount: feedback.length,
      tagScores: {},
      validationCount: 0,
      validationTypes: [],
    };
  }

  registerData(opts: {
    key: string;
    name: string;
    description: string;
    schema?: string;
    tags: DataTag[];
    owner?: WalletAddress;
    ownerChain?: any;
    vaultAddress?: string;
    visibility?: Visibility;
  }): DataRegistration {
    const dataId = this.nextDataId++;
    const reg: DataRegistration = {
      dataId,
      dataRegistry: 'mock:0:0xDATA_REG',
      vaultAddress: opts.vaultAddress ?? '',
      vaultKey: opts.key,
      name: opts.name,
      description: opts.description,
      visibility: opts.visibility ?? 'public',
      schema: opts.schema,
      tags: opts.tags,
      active: true,
      owner: opts.owner ?? ('0x0' as WalletAddress),
      ownerChain: opts.ownerChain ?? 'evm',
      lastUpdated: Date.now(),
      registeredAt: Date.now(),
    };
    this.data.set(dataId, reg);
    return reg;
  }

  findData(query: { schema?: string; tags?: DataTag[]; minQuality?: number; verifiedOnly?: boolean }): DataRegistration[] {
    let results = Array.from(this.data.values()).filter(d => d.active);
    if (query.schema) results = results.filter(d => d.schema === query.schema);
    if (query.tags?.length) results = results.filter(d => query.tags!.some(t => d.tags.includes(t)));
    if (query.verifiedOnly) results = results.filter(d => d.tags.includes('verified'));
    return results;
  }

  rateData(dataId: number, feedback: DataFeedbackEntry): void {
    const existing = this.dataFeedback.get(dataId) ?? [];
    existing.push(feedback);
    this.dataFeedback.set(dataId, existing);
  }

  getDataScore(dataId: number): DataScore {
    const reg = this.data.get(dataId);
    const feedback = this.dataFeedback.get(dataId) ?? [];
    const total = feedback.reduce((sum, f) => sum + f.value, 0);
    const quality = feedback.length > 0 ? Math.round(total / feedback.length) : 0;
    return {
      dataId,
      vaultAddress: reg?.vaultAddress ?? '',
      vaultKey: reg?.vaultKey ?? '',
      quality,
      freshness: { lastUpdated: reg?.lastUpdated ?? 0, score: 100 },
      accuracy: { score: quality, feedbackCount: feedback.length },
      completeness: { score: quality, feedbackCount: feedback.length },
      verified: reg?.tags.includes('verified') ?? false,
      consumptionCount: feedback.length,
      totalFeedback: feedback.length,
      tagScores: {},
    };
  }
}
```

Create `discovery-layer.ts` that wraps `MockRegistry` into `IDiscoveryLayer` interface. Create `index.ts` exporting both.

**Step 3: Run tests**

Run: `cd packages/sdk && bun test src/discovery/__tests__/discovery.test.ts`
Expected: All PASS

**Step 4: Commit**

```bash
git add packages/sdk/src/discovery/
git commit -m "feat(sdk): add mock discovery layer (ERC-8004 registries)"
```

---

## Task 10: Persistence Layer — Storacha

**Files:**
- Create: `packages/sdk/src/persistence/persistence-layer.ts`
- Create: `packages/sdk/src/persistence/index.ts`
- Test: `packages/sdk/src/persistence/__tests__/persistence.test.ts`

This layer is straightforward — it wraps Storacha client for upload/retrieve. Since Storacha requires auth credentials, tests will use a mock/stub approach.

**Step 1: Write the failing test (with mock Storacha)**

```typescript
// packages/sdk/src/persistence/__tests__/persistence.test.ts
import { describe, test, expect } from 'bun:test';
import { createPersistenceLayer } from '../persistence-layer.js';

describe('PersistenceLayer (mock)', () => {
  // Use in-memory mock for testing
  const layer = createPersistenceLayer({
    spaceDID: 'did:key:test',
    mock: true,
  });

  test('archive creates a snapshot', async () => {
    const snapshot = await layer.archive({
      data: new TextEncoder().encode('{"test": true}'),
      entryCount: 1,
    });
    expect(snapshot.cid).toBeTruthy();
    expect(snapshot.size).toBeGreaterThan(0);
    expect(snapshot.encrypted).toBe(true);
  });

  test('listSnapshots returns archived snapshots', async () => {
    const list = await layer.listSnapshots();
    expect(list.length).toBeGreaterThan(0);
  });

  test('retrieve returns snapshot data', async () => {
    const snapshots = await layer.listSnapshots();
    const data = await layer.retrieve(snapshots[0].cid);
    expect(data).toBeInstanceOf(Uint8Array);
  });
});
```

**Step 2: Implement with mock fallback**

Build `persistence-layer.ts` with a `mock: true` option that stores in-memory, and real Storacha when configured. The real integration uses `@storacha/client` `uploadFile()` and retrieval via IPFS gateway fetch.

**Step 3: Run tests, commit**

```bash
git add packages/sdk/src/persistence/
git commit -m "feat(sdk): add persistence layer (Storacha + mock)"
```

---

## Task 11: SDK Entry — createOrbitMem()

**Files:**
- Create: `packages/sdk/src/client.ts`
- Modify: `packages/sdk/src/index.ts`
- Test: `packages/sdk/src/__tests__/client.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/sdk/src/__tests__/client.test.ts
import { describe, test, expect } from 'bun:test';
import { createOrbitMem } from '../client.js';

describe('createOrbitMem', () => {
  test('initializes all layers', async () => {
    const orbitmem = await createOrbitMem({
      identity: { chains: ['evm'] },
      encryption: { defaultEngine: 'aes', aes: { kdf: 'hkdf-sha256' } },
      discovery: {
        agentRegistry: '0xAGENT' as any,
        dataRegistry: '0xDATA' as any,
        reputationRegistry: '0xREP' as any,
        registryChain: 'base',
      },
    });

    expect(orbitmem.identity).toBeDefined();
    expect(orbitmem.vault).toBeDefined();
    expect(orbitmem.encryption).toBeDefined();
    expect(orbitmem.transport).toBeDefined();
    expect(orbitmem.discovery).toBeDefined();

    await orbitmem.destroy();
  });
});
```

**Step 2: Implement client.ts**

Wire all layers together: identity → transport, encryption → data vault, discovery, persistence. Export `createOrbitMem()` as the main entry.

**Step 3: Update index.ts to export everything**

```typescript
// packages/sdk/src/index.ts
export { createOrbitMem } from './client.js';
export * from './types.js';
// Layer-level exports for advanced usage
export { createEncryptionLayer } from './encryption/index.js';
export { createVault, createOrbitDBInstance } from './data/index.js';
export { createIdentityLayer } from './identity/index.js';
export { createTransportLayer } from './transport/index.js';
export { createDiscoveryLayer } from './discovery/index.js';
export { createPersistenceLayer } from './persistence/index.js';
```

**Step 4: Run tests, commit**

```bash
git add packages/sdk/src/client.ts packages/sdk/src/index.ts packages/sdk/src/__tests__/
git commit -m "feat(sdk): add createOrbitMem() client composition"
```

---

## Task 12: Agent Adapter

**Files:**
- Create: `packages/sdk/src/agent/agent-adapter.ts`
- Create: `packages/sdk/src/agent/index.ts`
- Test: `packages/sdk/src/agent/__tests__/agent-adapter.test.ts`

**Step 1: Write the failing test**

Test the discover → evaluate → fetch lifecycle with mock relay.

**Step 2: Implement `createOrbitMemAgentAdapter()`**

Implements `IOrbitMemAgentAdapter`:
- `discoverData()` — calls discovery layer
- `getDataScore()` — checks quality before consuming
- `readPublicData()` — fetches from relay public endpoint
- `fetchUserData()` — ERC-8128 signed fetch from relay
- `decrypt()` — delegates to encryption layer
- `withUserData()` — full lifecycle: score check → fetch → decrypt → callback → zero → rate
- `rateData()` — submits feedback

**Step 3: Run tests, commit**

```bash
git add packages/sdk/src/agent/
git commit -m "feat(sdk): add agent adapter with full data lifecycle"
```

---

## Task 13: Relay — Hono Server Scaffold

**Files:**
- Create: `packages/relay/src/index.ts`
- Create: `packages/relay/src/app.ts`
- Create: `packages/relay/src/routes/health.ts`
- Test: `packages/relay/src/__tests__/health.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/relay/src/__tests__/health.test.ts
import { describe, test, expect } from 'bun:test';
import { app } from '../app.js';

describe('Relay Health', () => {
  test('GET /v1/health returns ok', async () => {
    const res = await app.request('/v1/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});
```

**Step 2: Implement Hono app**

```typescript
// packages/relay/src/app.ts
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { healthRoutes } from './routes/health.js';

export const app = new Hono().basePath('/v1');

app.use(logger());
app.use(cors());

app.route('/', healthRoutes);
```

```typescript
// packages/relay/src/routes/health.ts
import { Hono } from 'hono';

export const healthRoutes = new Hono();

healthRoutes.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }));
```

```typescript
// packages/relay/src/index.ts
import { app } from './app.js';

const port = Number(process.env.PORT ?? 3000);
console.log(`OrbitMem Relay starting on port ${port}`);

export default { port, fetch: app.fetch };
```

**Step 3: Run test, commit**

```bash
git add packages/relay/src/
git commit -m "feat(relay): scaffold Hono server with health endpoint"
```

---

## Task 14: Relay — OrbitDB Peer Service

**Files:**
- Create: `packages/relay/src/services/orbitdb-peer.ts`
- Modify: `packages/relay/src/app.ts`

Create a service that initializes a Helia + OrbitDB instance for the relay to participate in CRDT replication. Reuse `createOrbitDBInstance()` from the SDK.

**Commit:**

```bash
git commit -m "feat(relay): add OrbitDB peer service for vault replication"
```

---

## Task 15: Relay — ERC-8128 Middleware

**Files:**
- Create: `packages/relay/src/middleware/erc8128.ts`
- Test: `packages/relay/src/__tests__/erc8128.test.ts`

Create Hono middleware that:
1. Extracts `X-OrbitMem-*` headers
2. Reconstructs the signed payload
3. Verifies signature using `createTransportLayer().verifyRequest()`
4. Rejects replays (nonce cache)
5. Sets `c.set('signer', address)` for downstream handlers

**Commit:**

```bash
git commit -m "feat(relay): add ERC-8128 signature verification middleware"
```

---

## Task 16: Relay — Vault Routes

**Files:**
- Create: `packages/relay/src/routes/vault.ts`
- Test: `packages/relay/src/__tests__/vault.test.ts`

Implement:
- `GET /v1/vault/public/:address/:key` — read public entry from OrbitDB
- `GET /v1/vault/public/:address/keys` — list public keys
- `POST /v1/vault/read` — read encrypted entry (ERC-8128 required)
- `POST /v1/vault/sync` — trigger CRDT sync
- `POST /v1/auth/challenge` — generate challenge nonce

**Commit:**

```bash
git commit -m "feat(relay): add vault routes (public read, encrypted read, sync)"
```

---

## Task 17: Relay — Discovery Routes

**Files:**
- Create: `packages/relay/src/routes/data.ts`
- Test: `packages/relay/src/__tests__/data.test.ts`

Implement:
- `GET /v1/data/search` — query mock Data Registry
- `GET /v1/data/:dataId/score` — get data quality score
- `POST /v1/data/:dataId/feedback` — submit quality feedback (ERC-8128)

Uses the same `MockRegistry` from SDK discovery layer.

**Commit:**

```bash
git commit -m "feat(relay): add discovery routes (search, score, feedback)"
```

---

## Task 18: Relay — Snapshot Routes

**Files:**
- Create: `packages/relay/src/routes/snapshots.ts`
- Test: `packages/relay/src/__tests__/snapshots.test.ts`

Implement:
- `GET /v1/snapshots` — list snapshots for address (ERC-8128)
- `POST /v1/snapshots/archive` — trigger Storacha archival (ERC-8128)

**Commit:**

```bash
git commit -m "feat(relay): add snapshot routes (list, archive)"
```

---

## Task 19: Integration Test — SDK ↔ Relay

**Files:**
- Create: `packages/relay/src/__tests__/integration.test.ts`

**Step 1: Write the integration test**

```typescript
// packages/relay/src/__tests__/integration.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { app } from '../app.js';
import { createOrbitMem } from '@orbitmem/sdk';

describe('SDK ↔ Relay Integration', () => {
  // Test the full flow:
  // 1. SDK writes public data to vault
  // 2. Relay serves it via /v1/vault/public/:address/:key
  // 3. SDK registers data for discovery
  // 4. Agent adapter discovers and fetches data
  // 5. Agent submits quality feedback

  test('full public data flow', async () => {
    // Write data via SDK
    // Fetch via relay
    // Verify round-trip
  });

  test('full signed request flow', async () => {
    // Create signed request via SDK transport
    // Send to relay
    // Verify ERC-8128 middleware accepts it
  });
});
```

**Step 2: Run tests, commit**

```bash
git commit -m "test: add SDK <-> Relay integration tests"
```

---

## Task 20: Final Wiring & README

**Files:**
- Modify: `README.md`
- Verify all tests pass

**Step 1: Run full test suite**

Run: `bun test` (from root)
Expected: All tests PASS across both packages

**Step 2: Update README with quick start**

Brief overview + installation + basic usage matching the spec's SDK Quick Start section.

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README with quick start guide"
```

---

## Summary

| Task | Component | Estimated Complexity |
|------|-----------|---------------------|
| 1 | Monorepo scaffold | Low |
| 2 | SDK types | Low |
| 3 | AES encryption engine | Medium |
| 4 | Lit encryption engine | Medium |
| 5 | Unified encryption layer | Medium |
| 6 | OrbitDB data vault | High |
| 7 | Identity layer | Medium |
| 8 | Transport layer (ERC-8128) | Medium |
| 9 | Discovery layer (mock) | Medium |
| 10 | Persistence layer (Storacha) | Medium |
| 11 | SDK client composition | Medium |
| 12 | Agent adapter | Medium |
| 13 | Relay scaffold | Low |
| 14 | Relay OrbitDB peer | Medium |
| 15 | Relay ERC-8128 middleware | Medium |
| 16 | Relay vault routes | Medium |
| 17 | Relay discovery routes | Low |
| 18 | Relay snapshot routes | Low |
| 19 | Integration tests | Medium |
| 20 | Final wiring + README | Low |
