import type { IVaultService, VaultEntry } from "./types.js";

export class MockVaultService implements IVaultService {
  private store = new Map<string, Map<string, VaultEntry>>();

  private getOrCreate(address: string) {
    if (!this.store.has(address)) {
      this.store.set(address, new Map());
    }
    return this.store.get(address)!;
  }

  async getPublicKeys(address: string, prefix?: string): Promise<string[]> {
    const vault = this.store.get(address);
    if (!vault) return [];

    let keys = Array.from(vault.entries())
      .filter(([_, v]) => v.visibility === "public")
      .map(([k]) => k);

    if (prefix) {
      keys = keys.filter((k) => k.startsWith(prefix));
    }
    return keys;
  }

  async getPublic(address: string, key: string): Promise<VaultEntry | null> {
    const vault = this.store.get(address);
    if (!vault) return null;
    const entry = vault.get(key);
    if (!entry || entry.visibility !== "public") return null;
    return entry;
  }

  async getEncrypted(vaultAddress: string, path: string): Promise<VaultEntry | null> {
    const vault = this.store.get(vaultAddress);
    if (!vault) return null;
    return vault.get(path) ?? null;
  }

  async seed(
    address: string,
    entries: { key: string; value: unknown; visibility: string }[],
  ): Promise<number> {
    const vault = this.getOrCreate(address);
    for (const entry of entries) {
      vault.set(entry.key, { value: entry.value, visibility: entry.visibility });
    }
    return entries.length;
  }

  async sync(_address: string): Promise<{ status: string; timestamp: number }> {
    return { status: "synced", timestamp: Date.now() };
  }
}
