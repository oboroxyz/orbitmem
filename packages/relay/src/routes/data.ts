import { Hono } from "hono";
import { type ERC8128Env, erc8128 } from "../middleware/erc8128.js";
import type { IDiscoveryService } from "../services/types.js";

export function createDataRoutes(discovery: IDiscoveryService): Hono<ERC8128Env> {
  const routes = new Hono<ERC8128Env>();

  // Stats cache (60s TTL)
  let statsCache: { data: unknown; expiry: number } | null = null;

  routes.get("/data/stats", async (c) => {
    const now = Date.now();
    if (statsCache && statsCache.expiry > now) {
      return c.json(statsCache.data);
    }
    const stats = await discovery.getStats();
    statsCache = { data: stats, expiry: now + 60_000 };
    return c.json(stats);
  });

  // Search data registrations
  routes.get("/data/search", async (c) => {
    const schema = c.req.query("schema");
    const tags = c.req.query("tags")?.split(",");
    const verifiedOnly = c.req.query("verifiedOnly") === "true";
    const minQuality = c.req.query("minQuality") ? Number(c.req.query("minQuality")) : undefined;

    const results = await discovery.search({
      schema: schema || undefined,
      tags: tags?.length ? tags : undefined,
      verifiedOnly: verifiedOnly || undefined,
      minQuality,
    });

    return c.json({ results, count: results.length });
  });

  // Get data quality score
  routes.get("/data/:dataId/score", async (c) => {
    const dataId = Number(c.req.param("dataId"));
    const score = await discovery.getScore(dataId);
    return c.json(score);
  });

  // Submit quality feedback — requires ERC-8128
  routes.post("/data/:dataId/feedback", erc8128(), async (c) => {
    const dataId = Number(c.req.param("dataId"));
    const body = await c.req.json<{
      value: number;
      qualityDimension?: string;
      tag1?: string;
      tag2?: string;
    }>();

    await discovery.rate(dataId, {
      clientAddress: c.get("signer"),
      value: body.value,
      valueDecimals: 0,
      tag1: body.tag1,
      tag2: body.tag2,
      isRevoked: false,
      vaultKey: "",
      qualityDimension: body.qualityDimension,
    });

    return c.json({ status: "ok", dataId, signer: c.get("signer") });
  });

  // Register data (for seeding / testing)
  routes.post("/data/register", async (c) => {
    const body = await c.req.json<{
      key: string;
      name: string;
      description: string;
      schema?: string;
      tags: string[];
    }>();

    const reg = await discovery.register(body);
    return c.json(reg);
  });

  return routes;
}
