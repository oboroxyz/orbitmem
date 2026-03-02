import type {
  ChainFamily,
  EncryptionEngine,
  IDataLayer,
  VaultEntry,
  VaultPath,
  Visibility,
  WalletAddress,
} from "../types.js";

function normalizePath(path: VaultPath): string {
  return Array.isArray(path) ? path.join("/") : path;
}

export async function createVault(
  orbitdb: any,
  config: {
    dbName?: string;
    author?: WalletAddress;
    authorChain?: ChainFamily;
  },
): Promise<IDataLayer & { close: () => Promise<void>; db: any }> {
  const db = await orbitdb.open(config.dbName ?? "orbitmem-vault", { type: "nested" });

  // Metadata store: path -> { visibility, encrypted, encryptionEngine, author, authorChain, timestamp }
  const metaDb = await orbitdb.open(`${config.dbName ?? "orbitmem-vault"}-meta`, {
    type: "nested",
  });

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

  return {
    db,

    async put(path, value, opts) {
      const key = normalizePath(path);
      const visibility = opts?.visibility ?? "private";
      const encrypted = visibility !== "public";
      const engine = encrypted ? (opts?.engine ?? "aes") : null;

      // TODO: Wire encryption for private/shared — for now store raw value
      const hash = await db.put(key, value);
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
      for (const [key, value] of leaves) {
        await db.put(key, value);
        await metaDb.put(key, {
          visibility,
          encrypted: visibility !== "public",
          timestamp: Date.now(),
        });
      }
    },

    async get(path) {
      const key = normalizePath(path);
      const value = await db.get(key);
      if (value === undefined) return null;

      const meta = await metaDb.get(key);
      const visibility = meta?.visibility ?? "private";
      return makeEntry(key, value, visibility, visibility !== "public");
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
        if (o && typeof o === "object" && !Array.isArray(o)) {
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
        if (o && typeof o === "object" && !Array.isArray(o)) {
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
        results.push(makeEntry(key, value, meta?.visibility ?? "private", meta?.encrypted ?? true));
        if (filter.limit && results.length >= filter.limit) break;
      }
      return results;
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

    async close() {
      await db.close();
      await metaDb.close();
    },
  };
}
