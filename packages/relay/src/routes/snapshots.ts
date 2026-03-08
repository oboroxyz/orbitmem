import { Hono } from "hono";
import { type ERC8128Env, erc8128 } from "../middleware/erc8128.js";
import type { IPlanService, ISnapshotService } from "../services/types.js";

export function createSnapshotRoutes(
  snapshot: ISnapshotService,
  plan: IPlanService,
): Hono<ERC8128Env> {
  const routes = new Hono<ERC8128Env>();

  routes.get("/snapshots", erc8128(), async (c) => {
    const signer = c.get("signer");
    const snapshots = await snapshot.list(signer);
    return c.json({ snapshots, count: snapshots.length });
  });

  routes.post("/snapshots/archive", erc8128(), async (c) => {
    const signer = c.get("signer");
    const body = await c.req
      .json<{ data?: string; entryCount?: number }>()
      .catch(
        () =>
          ({ data: undefined, entryCount: undefined }) as { data?: string; entryCount?: number },
      );

    const dataSize = new TextEncoder().encode(body.data ?? "{}").length;
    const usage = await plan.getUsage(signer);
    if (usage.used + dataSize > usage.limit) {
      return c.json({ error: "Storage quota exceeded" }, 413);
    }

    const meta = await snapshot.archive(signer, body.data, body.entryCount);
    await plan.addUsage(signer, meta.size);
    return c.json(meta);
  });

  routes.get("/snapshots/usage", erc8128(), async (c) => {
    const signer = c.get("signer");
    const usage = await plan.getUsage(signer);
    return c.json(usage);
  });

  return routes;
}
