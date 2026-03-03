import type { ISnapshotService, SnapshotMeta } from "./types.js";

export class MockSnapshotService implements ISnapshotService {
  private store = new Map<string, SnapshotMeta & { data: Uint8Array }>();

  async list(signer: string): Promise<SnapshotMeta[]> {
    return Array.from(this.store.values())
      .filter((s) => s.signer === signer)
      .map(({ data: _, ...rest }) => rest);
  }

  async archive(signer: string, data?: string, entryCount?: number): Promise<SnapshotMeta> {
    const encoded = new TextEncoder().encode(data ?? "{}");

    const cidBytes = crypto.getRandomValues(new Uint8Array(32));
    const cid =
      "bafy" +
      Array.from(cidBytes)
        .map((b) => b.toString(36))
        .join("")
        .slice(0, 55);

    const snapshot = {
      cid,
      size: encoded.length,
      archivedAt: Date.now(),
      signer,
      entryCount: entryCount ?? 0,
      encrypted: true,
      data: encoded,
    };
    this.store.set(cid, snapshot);

    const { data: _, ...meta } = snapshot;
    return meta;
  }
}
