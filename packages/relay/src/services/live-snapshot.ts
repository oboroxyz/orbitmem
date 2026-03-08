import type { ISnapshotService, SnapshotMeta } from "./types.js";

interface LiveSnapshotConfig {
  /** Serialized UCAN delegation proof (base64 CAR) */
  proof: string;
  /** IPFS gateway URL */
  gatewayUrl?: string;
}

export class LiveSnapshotService implements ISnapshotService {
  private config: LiveSnapshotConfig;
  private metadata = new Map<string, SnapshotMeta>();
  private clientPromise: Promise<any> | null = null;

  constructor(config: LiveSnapshotConfig) {
    this.config = config;
  }

  private async getClient() {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const { Client } = await import("@storacha/client");
        const { parse } = await import("@storacha/client/proof");
        const client = await (Client as any).create();
        const proof = await parse(this.config.proof);
        const space = proof.capabilities[0].with;
        await client.addProof(proof);
        await client.setCurrentSpace(space);
        return client;
      })();
    }
    return this.clientPromise;
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
