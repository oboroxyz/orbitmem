import { Hono } from "hono";
import { type ERC8128Env, erc8128 } from "../middleware/erc8128.js";

// In-memory snapshot store (mock Storacha)
const snapshotStore = new Map<
  string,
  {
    cid: string;
    size: number;
    archivedAt: number;
    signer: string;
    entryCount: number;
    encrypted: boolean;
    data: Uint8Array;
  }
>();

export const snapshotRoutes = new Hono<ERC8128Env>();

// List snapshots for the signer — requires ERC-8128
snapshotRoutes.get("/snapshots", erc8128(), async (c) => {
  const signer = c.get("signer");
  const snapshots = Array.from(snapshotStore.values())
    .filter((s) => s.signer === signer)
    .map(({ data: _, ...rest }) => rest);

  return c.json({ snapshots, count: snapshots.length });
});

// Trigger archival — requires ERC-8128
snapshotRoutes.post("/snapshots/archive", erc8128(), async (c) => {
  const signer = c.get("signer");
  const body = await c.req
    .json<{ data?: string; entryCount?: number }>()
    .catch(
      () => ({ data: undefined, entryCount: undefined }) as { data?: string; entryCount?: number },
    );

  const data = body.data ? new TextEncoder().encode(body.data) : new TextEncoder().encode("{}");

  const cidBytes = crypto.getRandomValues(new Uint8Array(32));
  const cid =
    "bafy" +
    Array.from(cidBytes)
      .map((b) => b.toString(36))
      .join("")
      .slice(0, 55);

  const snapshot = {
    cid,
    size: data.length,
    archivedAt: Date.now(),
    signer,
    entryCount: body.entryCount ?? 0,
    encrypted: true,
    data,
  };
  snapshotStore.set(cid, snapshot);

  const { data: _, ...meta } = snapshot;
  return c.json(meta);
});
