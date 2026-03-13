import { openVaultDB } from "./orbitdb-peer.js";
import type { IVaultService, VaultEntry } from "./types.js";

export class LiveVaultService implements IVaultService {
  private dbCache = new Map<string, any>();

  private async getDB(address: string) {
    if (!this.dbCache.has(address)) {
      const db = await openVaultDB(address);
      this.dbCache.set(address, db);
    }
    return this.dbCache.get(address)!;
  }

  async getPublicKeys(address: string, prefix?: string): Promise<string[]> {
    const db = await this.getDB(address);
    const all: Record<string, unknown> = await db.all();
    // In live mode, visibility metadata is stored in a separate "-meta" db.
    // For now, return all top-level keys (public relay only sees public data).
    let keys = Object.keys(all);
    if (prefix) {
      keys = keys.filter((k) => k.startsWith(prefix));
    }
    return keys;
  }

  async getPublic(address: string, key: string): Promise<VaultEntry | null> {
    const db = await this.getDB(address);
    const value = await db.get(key);
    if (value === undefined) return null;
    // In live mode, we treat all replicated data as public
    // (private data is encrypted client-side and opaque to the relay)
    return { value, visibility: "public" };
  }

  async getEncrypted(vaultAddress: string, path: string): Promise<VaultEntry | null> {
    const db = await this.getDB(vaultAddress);
    const value = await db.get(path);
    if (value === undefined) return null;
    return { value, visibility: "private" };
  }

  async seed(
    address: string,
    entries: { key: string; value: unknown; visibility: string }[],
  ): Promise<number> {
    const db = await this.getDB(address);
    for (const entry of entries) {
      await db.put(entry.key, entry.value);
    }
    return entries.length;
  }

  async sync(address: string): Promise<{ status: string; timestamp: number }> {
    // Opening/replicating the DB triggers OrbitDB CRDT sync
    await this.getDB(address);
    return { status: "synced", timestamp: Date.now() };
  }

  async write(
    address: string,
    path: string,
    value: unknown,
    _visibility: string,
  ): Promise<{ hash: string }> {
    const db = await this.getDB(address);
    const hash = await db.put(path, value);
    return { hash: hash ?? `live-${Date.now()}` };
  }

  async delete(address: string, path: string): Promise<void> {
    const db = await this.getDB(address);
    await db.del(path);
  }

  async getKeys(address: string, prefix?: string): Promise<string[]> {
    const db = await this.getDB(address);
    const all: Record<string, unknown> = await db.all();
    let keys = Object.keys(all);
    if (prefix) {
      keys = keys.filter((k) => k.startsWith(prefix));
    }
    return keys;
  }
}
