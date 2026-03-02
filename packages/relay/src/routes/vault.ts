import { Hono } from "hono";
import { erc8128 } from "../middleware/erc8128.js";

// In-memory vault store for the relay (mirrors OrbitDB data)
// In production, this would be backed by the OrbitDB peer service
const vaultStore = new Map<string, Map<string, { value: any; visibility: string }>>();

function getOrCreateVault(address: string) {
  if (!vaultStore.has(address)) {
    vaultStore.set(address, new Map());
  }
  return vaultStore.get(address)!;
}

export const vaultRoutes = new Hono();

// List public keys — must be before the wildcard route
vaultRoutes.get("/vault/public/:address/keys", async (c) => {
  const address = c.req.param("address");
  const prefix = c.req.query("prefix");
  const vault = vaultStore.get(address);

  if (!vault) {
    return c.json({ keys: [] });
  }

  let keys = Array.from(vault.entries())
    .filter(([_, v]) => v.visibility === "public")
    .map(([k]) => k);

  if (prefix) {
    keys = keys.filter((k) => k.startsWith(prefix));
  }

  return c.json({ keys });
});

// Public read — no auth required (wildcard must come after /keys)
vaultRoutes.get("/vault/public/:address/:key{.+}", async (c) => {
  const address = c.req.param("address");
  const key = c.req.param("key");
  const vault = vaultStore.get(address);

  if (!vault) {
    return c.json({ error: "Vault not found" }, 404);
  }

  const entry = vault.get(key);
  if (!entry || entry.visibility !== "public") {
    return c.json({ error: "Entry not found or not public" }, 404);
  }

  return c.json({ key, value: entry.value, visibility: "public" });
});

// Encrypted read — requires ERC-8128
vaultRoutes.post("/vault/read", erc8128(), async (c) => {
  const body = await c.req.json<{ vaultAddress: string; path: string }>();
  const vault = vaultStore.get(body.vaultAddress);

  if (!vault) {
    return c.json({ error: "Vault not found" }, 404);
  }

  const entry = vault.get(body.path);
  if (!entry) {
    return c.json({ error: "Entry not found" }, 404);
  }

  // Return encrypted data — the caller must decrypt
  return c.json({
    key: body.path,
    value: entry.value,
    visibility: entry.visibility,
    signer: c.get("signer"),
  });
});

// Sync trigger — requires ERC-8128
vaultRoutes.post("/vault/sync", erc8128(), async (c) => {
  // In production, this would trigger OrbitDB CRDT sync
  return c.json({
    status: "synced",
    timestamp: Date.now(),
    signer: c.get("signer"),
  });
});

// Auth challenge — generate nonce for wallet signing
vaultRoutes.post("/auth/challenge", async (c) => {
  const nonce = crypto.randomUUID();
  const timestamp = Date.now();
  const message = `OrbitMem Authentication\nTimestamp: ${timestamp}\nNonce: ${nonce}`;

  return c.json({ message, nonce, timestamp });
});

// Internal: seed vault data (for testing / initial sync)
vaultRoutes.post("/vault/seed", async (c) => {
  const body = await c.req.json<{
    address: string;
    entries: Array<{ key: string; value: any; visibility: string }>;
  }>();

  const vault = getOrCreateVault(body.address);
  for (const entry of body.entries) {
    vault.set(entry.key, { value: entry.value, visibility: entry.visibility });
  }

  return c.json({ status: "ok", count: body.entries.length });
});
