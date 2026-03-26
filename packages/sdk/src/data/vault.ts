// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="../types/orbitdb.d.ts" />

import { useDatabaseType } from "@orbitdb/core";
import { Nested } from "@orbitdb/nested-db";

import type { AESEngine } from "../encryption/aes.js";
import type {
  AESEncryptedData,
  ChainFamily,
  EncryptionEngine,
  IDataLayer,
  IEncryptionLayer,
  LitAccessCondition,
  LitAuthSig,
  LitEncryptedData,
  VaultEntry,
  VaultPath,
  Visibility,
  WalletAddress,
} from "../types.js";
import {
  deserializeEncrypted,
  isSerializedEncrypted,
  serializeEncrypted,
} from "./serialization.js";

// Register the Nested database type at the point of use so callers do not depend on setup order.
useDatabaseType(Nested);

function normalizePath(path: VaultPath): string {
  return Array.isArray(path) ? path.join("/") : path;
}

export async function createVault(
  orbitdb: any,
  config: {
    dbName?: string;
    author?: WalletAddress;
    authorChain?: ChainFamily;
    /** AES engine for private/shared encryption */
    aesEngine?: AESEngine;
    /** Encryption layer for Lit Protocol operations */
    encryptionLayer?: IEncryptionLayer;
  },
): Promise<
  IDataLayer & {
    close: () => Promise<void>;
    db: any;
    metaDb: any;
    setDefaultKey: (key: CryptoKey) => void;
    setAuthSig: (authSig: LitAuthSig) => void;
    updateAccess: (
      path: VaultPath,
      newConditions: import("../types.js").LitAccessCondition[],
      opts?: { chain?: string },
    ) => Promise<VaultEntry>;
  }
> {
  const db = await orbitdb.open(config.dbName ?? "orbitmem-vault", { type: "nested" });

  // Metadata store: path -> { visibility, encrypted, encryptionEngine, author, authorChain, timestamp }
  const metaDb = await orbitdb.open(`${config.dbName ?? "orbitmem-vault"}-meta`, {
    type: "nested",
  });

  // Default AES key for private data — set via setDefaultKey() after wallet connect
  let defaultKey: CryptoKey | undefined;
  let litAuthSig: LitAuthSig | undefined;

  function makeEntry<T>(
    _path: string,
    value: T,
    visibility: Visibility,
    encrypted: boolean,
    engine?: EncryptionEngine,
  ): VaultEntry<T> {
    return {
      value,
      visibility,
      author: config.author ?? ("0x0" as WalletAddress),
      authorChain: config.authorChain ?? "evm",
      timestamp: Date.now(),
      encrypted,
      encryptionEngine: engine,
      hash: "",
    };
  }

  /** Encrypt a value for storage. Returns the serialized blob or the raw value (public). */
  async function encryptValue(
    value: unknown,
    visibility: Visibility,
    engine: EncryptionEngine | null,
    opts?: any,
  ): Promise<unknown> {
    if (visibility === "public" || !engine) return value;

    const plaintext = new TextEncoder().encode(JSON.stringify(value));

    if (engine === "aes") {
      if (!config.aesEngine)
        throw new Error("AES engine not configured — pass aesEngine to createVault");
      let cryptoKey: CryptoKey | undefined;
      if (visibility === "private") {
        cryptoKey = defaultKey;
        if (!cryptoKey) throw new Error("No default key — call setDefaultKey() or connect() first");
      } else if (visibility === "shared" && opts?.sharedKeySource) {
        cryptoKey = await config.aesEngine.deriveKey(opts.sharedKeySource);
      }
      if (!cryptoKey) throw new Error("No encryption key available");
      const encrypted = await config.aesEngine.encrypt(plaintext, cryptoKey);
      return serializeEncrypted(encrypted);
    }

    if (engine === "lit") {
      if (!config.encryptionLayer) throw new Error("Encryption layer not configured for Lit");
      if (!opts?.accessConditions) throw new Error("accessConditions required for Lit encryption");
      const encrypted = await config.encryptionLayer.encrypt(plaintext, {
        engine: "lit",
        accessConditions: opts.accessConditions,
      });
      return serializeEncrypted(encrypted);
    }

    return value;
  }

  /** Attempt auto-decryption of a stored value. Returns the decrypted value or the raw value. */
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
        // Decryption failed — return raw blob
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

  const vaultImpl: IDataLayer & {
    close: () => Promise<void>;
    db: any;
    metaDb: any;
    setDefaultKey: (key: CryptoKey) => void;
    setAuthSig: (authSig: LitAuthSig) => void;
    updateAccess: (
      path: VaultPath,
      newConditions: LitAccessCondition[],
      opts?: { chain?: string },
    ) => Promise<VaultEntry>;
  } = {
    db,
    metaDb,

    setDefaultKey(key: CryptoKey) {
      defaultKey = key;
    },

    setAuthSig(authSig: LitAuthSig) {
      litAuthSig = authSig;
    },

    async put(path, value, opts) {
      const key = normalizePath(path);
      const visibility = opts?.visibility ?? "private";
      const encrypted = visibility !== "public";
      const engine = encrypted ? (opts?.engine ?? "aes") : null;

      const storedValue = await encryptValue(value, visibility, engine, opts);
      const hash = await db.put(key, storedValue);
      const meta: Record<string, any> = { visibility, encrypted, timestamp: Date.now() };
      if (engine) meta.encryptionEngine = engine;
      await metaDb.put(key, meta);

      return { ...makeEntry(key, value, visibility, encrypted, engine ?? undefined), hash };
    },

    async insert(obj, opts) {
      const visibility = opts?.visibility ?? "private";
      const prefix = opts?.prefix;

      // Flatten the object and put each leaf
      const flatten = (o: any, parentKey: string = ""): [string, any][] => {
        const entries: [string, any][] = [];
        for (const [k, v] of Object.entries(o)) {
          const newKey = parentKey ? `${parentKey}/${k}` : k;
          if (v && typeof v === "object" && !Array.isArray(v)) {
            entries.push(...flatten(v, newKey));
          } else {
            entries.push([newKey, v]);
          }
        }
        return entries;
      };

      const leaves = flatten(obj, prefix ?? "");
      for (const [leafKey, leafValue] of leaves) {
        await vaultImpl.put(leafKey, leafValue, { visibility, engine: opts?.engine as any });
      }
    },

    async get<T = unknown>(path: VaultPath): Promise<VaultEntry<T> | null> {
      const key = normalizePath(path);
      const rawValue = await db.get(key);
      if (rawValue === undefined) return null;

      const meta = await metaDb.get(key);
      const visibility = meta?.visibility ?? "private";
      const encEngine = meta?.encryptionEngine;
      const value = await tryDecrypt(rawValue, meta);
      return makeEntry(
        key,
        value,
        visibility,
        meta?.encrypted ?? visibility !== "public",
        encEngine,
      ) as VaultEntry<T>;
    },

    async del(path) {
      const key = normalizePath(path);
      await db.del(key);
      await metaDb.del(key);
    },

    async keys(prefix?) {
      const all = await db.all();
      const flatten = (o: any, parentKey: string = ""): string[] => {
        const keys: string[] = [];
        if (o && typeof o === "object" && !Array.isArray(o) && !isSerializedEncrypted(o)) {
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
      if (prefix) return allKeys.filter((k) => k.startsWith(prefix));
      return allKeys;
    },

    async all() {
      return db.all() as any;
    },

    async query(filter) {
      const allData = await db.all();
      const results: VaultEntry[] = [];
      const flatten = (o: any, parentKey: string = ""): [string, any][] => {
        const entries: [string, any][] = [];
        if (o && typeof o === "object" && !Array.isArray(o) && !isSerializedEncrypted(o)) {
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
        const resolved = await tryDecrypt(value, meta);
        results.push(
          makeEntry(key, resolved, meta?.visibility ?? "private", meta?.encrypted ?? true),
        );
        if (filter.limit && results.length >= filter.limit) break;
      }
      return results as any;
    },

    async sync() {
      return {
        syncing: false,
        pendingPush: 0,
        pendingPull: 0,
        lastSynced: Date.now(),
        connectedPeers: 0,
      };
    },

    getSyncStatus() {
      return {
        syncing: false,
        pendingPush: 0,
        pendingPull: 0,
        lastSynced: null,
        connectedPeers: 0,
      };
    },

    onChange(callback) {
      const handler = (entry: any) => {
        callback({ type: "put", path: entry?.payload?.key ?? "", entry: undefined });
      };
      db.events.on("update", handler);
      return () => db.events.off("update", handler);
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

    async updateAccess(path, newConditions, opts) {
      if (!config.encryptionLayer) throw new Error("Encryption layer not configured for Lit");
      if (!litAuthSig) throw new Error("No authSig — call setAuthSig() first");

      const key = normalizePath(path);
      const rawValue = await db.get(key);
      if (rawValue === undefined) throw new Error(`Not found: ${key}`);

      const meta = await metaDb.get(key);
      if (meta?.encryptionEngine !== "lit")
        throw new Error(`Entry "${key}" is not Lit-encrypted (engine: ${meta?.encryptionEngine})`);
      if (!isSerializedEncrypted(rawValue)) throw new Error(`Entry "${key}" is not encrypted`);

      // Decrypt with current conditions
      const encrypted = deserializeEncrypted(rawValue) as LitEncryptedData;
      const plaintext = await config.encryptionLayer.decrypt(encrypted, { authSig: litAuthSig });

      // Re-encrypt with new conditions
      const reEncrypted = await config.encryptionLayer.encrypt(plaintext, {
        engine: "lit",
        accessConditions: newConditions,
        chain: opts?.chain as any,
      });
      const serialized = serializeEncrypted(reEncrypted);

      // Write back
      await db.put(key, serialized);
      await metaDb.put(key, { ...meta, timestamp: Date.now() });

      const value = JSON.parse(new TextDecoder().decode(plaintext));
      return makeEntry(key, value, meta.visibility, true, "lit");
    },

    async close() {
      await db.close();
      await metaDb.close();
    },
  };

  return vaultImpl;
}
