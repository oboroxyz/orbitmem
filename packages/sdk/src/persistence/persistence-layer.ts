import type { IPersistenceLayer, Snapshot, WalletAddress } from "../types.js";

interface PersistenceConfig {
  spaceDID: string;
  mock?: boolean;
  author?: WalletAddress;
}

export function createPersistenceLayer(config: PersistenceConfig): IPersistenceLayer & {
  archive(opts?: {
    data?: Uint8Array;
    entryCount?: number;
    label?: string;
    pinToFilecoin?: boolean;
  }): Promise<Snapshot>;
} {
  // In-memory store for mock mode
  const store = new Map<string, { data: Uint8Array; snapshot: Snapshot }>();

  function generateCID(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return (
      "bafy" +
      Array.from(bytes)
        .map((b) => b.toString(36))
        .join("")
        .slice(0, 55)
    );
  }

  if (config.mock) {
    return {
      async archive(opts) {
        const data = opts?.data ?? new Uint8Array(0);
        const cid = generateCID();
        const snapshot: Snapshot = {
          cid,
          size: data.length,
          archivedAt: Date.now(),
          author: config.author ?? ("0x0" as WalletAddress),
          entryCount: opts?.entryCount ?? 0,
          encrypted: true,
          filecoinStatus: "pending",
        };
        store.set(cid, { data, snapshot });
        return snapshot;
      },

      async retrieve(cid) {
        const entry = store.get(cid);
        if (!entry) throw new Error(`Snapshot not found: ${cid}`);
        return entry.data;
      },

      async restore(cid) {
        const entry = store.get(cid);
        if (!entry) throw new Error(`Snapshot not found: ${cid}`);
        return { merged: entry.snapshot.entryCount, conflicts: 0 };
      },

      async listSnapshots(opts) {
        const all = Array.from(store.values()).map((e) => e.snapshot);
        const offset = opts?.offset ?? 0;
        const limit = opts?.limit ?? all.length;
        return all.slice(offset, offset + limit);
      },

      async deleteSnapshot(cid) {
        store.delete(cid);
      },

      async getDealStatus(cid) {
        const entry = store.get(cid);
        if (!entry) throw new Error(`Snapshot not found: ${cid}`);
        return { status: entry.snapshot.filecoinStatus };
      },
    };
  }

  // Real Storacha implementation (lazy-loaded)
  return {
    async archive(opts) {
      const { Client } = await import("@storacha/client");
      const client = await Client.create();
      // Note: real usage requires authentication setup
      const data = opts?.data ?? new Uint8Array(0);
      const blob = new Blob([data]);
      const cid = await client.uploadFile(blob as any);

      const snapshot: Snapshot = {
        cid: cid.toString(),
        size: data.length,
        archivedAt: Date.now(),
        author: config.author ?? ("0x0" as WalletAddress),
        entryCount: opts?.entryCount ?? 0,
        encrypted: true,
        filecoinStatus: "pending",
      };
      store.set(cid.toString(), { data, snapshot });
      return snapshot;
    },

    async retrieve(cid) {
      // Fetch from IPFS gateway
      const res = await fetch(`https://w3s.link/ipfs/${cid}`);
      if (!res.ok) throw new Error(`Failed to retrieve ${cid}: ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    },

    async restore(cid) {
      const _data = await this.retrieve(cid);
      return { merged: 0, conflicts: 0 };
    },

    async listSnapshots(_opts) {
      return Array.from(store.values()).map((e) => e.snapshot);
    },

    async deleteSnapshot(cid) {
      store.delete(cid);
    },

    async getDealStatus(_cid) {
      return { status: "pending" as const };
    },
  };
}
