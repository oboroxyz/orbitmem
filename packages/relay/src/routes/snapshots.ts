import { Hono } from "hono";
import { type ERC8128Env, erc8128 } from "../middleware/erc8128.js";
import type { ISnapshotService } from "../services/types.js";

export function createSnapshotRoutes(snapshot: ISnapshotService): Hono<ERC8128Env> {
  const routes = new Hono<ERC8128Env>();

  // List snapshots for the signer — requires ERC-8128
  routes.get("/snapshots", erc8128(), async (c) => {
    const signer = c.get("signer");
    const snapshots = await snapshot.list(signer);
    return c.json({ snapshots, count: snapshots.length });
  });

  // Trigger archival — requires ERC-8128
  routes.post("/snapshots/archive", erc8128(), async (c) => {
    const signer = c.get("signer");
    const body = await c.req
      .json<{ data?: string; entryCount?: number }>()
      .catch(
        () =>
          ({ data: undefined, entryCount: undefined }) as { data?: string; entryCount?: number },
      );

    const meta = await snapshot.archive(signer, body.data, body.entryCount);
    return c.json(meta);
  });

  return routes;
}
