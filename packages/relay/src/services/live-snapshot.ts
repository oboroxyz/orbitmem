import type { ISnapshotService, SnapshotMeta } from "./types.js";

interface LiveSnapshotConfig {
  spaceDID: string;
}

export class LiveSnapshotService implements ISnapshotService {
  private config: LiveSnapshotConfig;
  private metadata = new Map<string, SnapshotMeta>();

  constructor(config: LiveSnapshotConfig) {
    this.config = config;
  }

  private async getClient() {
    const { Client } = await import("@storacha/client");
    const client = await (Client as any).create();
    await client.setCurrentSpace(this.config.spaceDID);
    return client;
  }

  async archive(signer: string, data?: string, entryCount?: number): Promise<SnapshotMeta> {
    const encoded = new TextEncoder().encode(data ?? "{}");
    const client = await this.getClient();
    const blob = new Blob([encoded]);
    const cid = await client.uploadFile(blob as any);

    const meta: SnapshotMeta = {
      cid: cid.toString(),
      size: encoded.length,
      archivedAt: Date.now(),
      signer,
      entryCount: entryCount ?? 0,
      encrypted: true,
    };
    this.metadata.set(meta.cid, meta);
    return meta;
  }

  async list(signer: string): Promise<SnapshotMeta[]> {
    return Array.from(this.metadata.values()).filter((s) => s.signer === signer);
  }
}
