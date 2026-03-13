import type { IPersistenceLayer, Snapshot, WalletAddress } from "../types.js";

const DEFAULT_GATEWAY = "https://w3s.link";

interface PersistenceConfig {
  mock?: boolean;
  relayUrl?: string;
  proof?: string;
  gatewayUrl?: string;
  author?: WalletAddress;
  signer?: string;
}

interface ArchiveOptions {
  data?: Uint8Array;
  entryCount?: number;
  label?: string;
  pinToFilecoin?: boolean;
}

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

// ── Mock Persistence ─────────────────────────────────────────

function createMockPersistence(config: PersistenceConfig): IPersistenceLayer {
  const store = new Map<string, { data: Uint8Array; snapshot: Snapshot }>();

  return {
    async archive(opts: ArchiveOptions = {}) {
      const data = opts.data ?? new Uint8Array(0);
      const cid = generateCID();
      const snapshot: Snapshot = {
        cid,
        size: data.length,
        archivedAt: Date.now(),
        author: config.author ?? ("0x0" as WalletAddress),
        entryCount: opts.entryCount ?? 0,
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

// ── Managed Persistence (relay-backed) ───────────────────────

function createManagedPersistence(config: PersistenceConfig): IPersistenceLayer {
  const relayUrl = config.relayUrl!;
  const gateway = config.gatewayUrl ?? DEFAULT_GATEWAY;

  return {
    async archive(opts: ArchiveOptions = {}) {
      const data = opts.data ?? new Uint8Array(0);
      const body = JSON.stringify({
        data: new TextDecoder().decode(data),
        entryCount: opts.entryCount ?? 0,
      });

      const res = await fetch(`${relayUrl}/v1/snapshots/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Archive failed (${res.status}): ${text}`);
      }

      const snap = await res.json();
      return snap as Snapshot;
    },

    async retrieve(cid) {
      const res = await fetch(`${gateway}/ipfs/${cid}`);
      if (!res.ok) throw new Error(`Failed to retrieve ${cid}: ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    },

    async restore(cid) {
      const res = await fetch(`${gateway}/ipfs/${cid}`);
      if (!res.ok) throw new Error(`Failed to retrieve ${cid}: ${res.status}`);
      return { merged: 0, conflicts: 0 };
    },

    async listSnapshots(_opts) {
      const res = await fetch(`${relayUrl}/v1/snapshots`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`List snapshots failed (${res.status}): ${text}`);
      }
      const items = await res.json();
      return items as Snapshot[];
    },

    async deleteSnapshot(cid) {
      const res = await fetch(`${relayUrl}/v1/snapshots/${cid}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        const text = await res.text();
        throw new Error(`Delete failed (${res.status}): ${text}`);
      }
    },

    async getDealStatus(_cid) {
      return { status: "pending" as const };
    },
  };
}

// ── Direct Persistence (Storacha UCAN) ───────────────────────

function createDirectPersistence(config: PersistenceConfig): IPersistenceLayer {
  const gateway = config.gatewayUrl ?? DEFAULT_GATEWAY;
  let clientPromise: Promise<any> | null = null;

  async function getClient() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const { create } = await import("@storacha/client");
        const { parse } = await import("@storacha/client/proof");
        const client = await create();
        const proof = await parse(config.proof!);
        const space = await client.addSpace(proof);
        await client.setCurrentSpace(space.did());
        return client;
      })();
    }
    return clientPromise;
  }

  return {
    async archive(opts: ArchiveOptions = {}) {
      const client = await getClient();
      const data = opts.data ?? new Uint8Array(0);
      const blob = new Blob([data as BlobPart]);
      const cid = await client.uploadFile(blob);

      const snapshot: Snapshot = {
        cid: cid.toString(),
        size: data.length,
        archivedAt: Date.now(),
        author: config.author ?? ("0x0" as WalletAddress),
        entryCount: opts.entryCount ?? 0,
        encrypted: true,
        filecoinStatus: "pending",
      };
      return snapshot;
    },

    async retrieve(cid) {
      const res = await fetch(`${gateway}/ipfs/${cid}`);
      if (!res.ok) throw new Error(`Failed to retrieve ${cid}: ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    },

    async restore(cid) {
      const res = await fetch(`${gateway}/ipfs/${cid}`);
      if (!res.ok) throw new Error(`Failed to retrieve ${cid}: ${res.status}`);
      return { merged: 0, conflicts: 0 };
    },

    async listSnapshots(_opts) {
      const client = await getClient();
      const result = await client.capability.upload.list();
      return (result.results ?? []).map((entry: any) => ({
        cid: entry.root.toString(),
        size: entry.size ?? 0,
        archivedAt: entry.insertedAt ? new Date(entry.insertedAt).getTime() : Date.now(),
        author: config.author ?? ("0x0" as WalletAddress),
        entryCount: 0,
        encrypted: true,
        filecoinStatus: "pending" as const,
      }));
    },

    async deleteSnapshot(cid) {
      const client = await getClient();
      const { CID: CIDClass } = await import("multiformats/cid");
      await client.capability.upload.remove(CIDClass.parse(cid));
    },

    async getDealStatus(_cid) {
      return { status: "pending" as const };
    },
  };
}

// ── Factory (mode detection) ─────────────────────────────────

export function createPersistenceLayer(config: PersistenceConfig): IPersistenceLayer {
  if (config.proof) return createDirectPersistence(config);
  if (config.relayUrl) return createManagedPersistence(config);
  return createMockPersistence(config);
}
