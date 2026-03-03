import { Hono } from "hono";
import { type ERC8128Env, erc8128 } from "../middleware/erc8128.js";
import type { IVaultService } from "../services/types.js";

export function createVaultRoutes(vault: IVaultService): Hono<ERC8128Env> {
  const routes = new Hono<ERC8128Env>();

  // List public keys — must be before the wildcard route
  routes.get("/vault/public/:address/keys", async (c) => {
    const address = c.req.param("address");
    const prefix = c.req.query("prefix");
    const keys = await vault.getPublicKeys(address, prefix ?? undefined);
    return c.json({ keys });
  });

  // Public read — no auth required (wildcard must come after /keys)
  routes.get("/vault/public/:address/:key{.+}", async (c) => {
    const address = c.req.param("address");
    const key = c.req.param("key");
    const entry = await vault.getPublic(address, key);

    if (!entry) {
      return c.json({ error: "Entry not found or not public" }, 404);
    }

    return c.json({ key, value: entry.value, visibility: "public" });
  });

  // Encrypted read — requires ERC-8128
  routes.post("/vault/read", erc8128(), async (c) => {
    const body = await c.req.json<{ vaultAddress: string; path: string }>();
    const entry = await vault.getEncrypted(body.vaultAddress, body.path);

    if (!entry) {
      return c.json({ error: "Entry not found" }, 404);
    }

    return c.json({
      key: body.path,
      value: entry.value,
      visibility: entry.visibility,
      signer: c.get("signer"),
    });
  });

  // Sync trigger — requires ERC-8128
  routes.post("/vault/sync", erc8128(), async (c) => {
    const result = await vault.sync(c.get("signer"));
    return c.json({ ...result, signer: c.get("signer") });
  });

  // Auth challenge — generate nonce for wallet signing
  routes.post("/auth/challenge", async (c) => {
    const nonce = crypto.randomUUID();
    const timestamp = Date.now();
    const message = `OrbitMem Authentication\nTimestamp: ${timestamp}\nNonce: ${nonce}`;
    return c.json({ message, nonce, timestamp });
  });

  // Internal: seed vault data (for testing / initial sync)
  routes.post("/vault/seed", async (c) => {
    const body = await c.req.json<{
      address: string;
      entries: Array<{ key: string; value: unknown; visibility: string }>;
    }>();
    const count = await vault.seed(body.address, body.entries);
    return c.json({ status: "ok", count });
  });

  return routes;
}
