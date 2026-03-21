import { relayFetch } from "./erc8128";

export async function writeEntry(
  path: string,
  value: unknown,
  visibility: string,
): Promise<{ ok: boolean; hash: string }> {
  const res = await relayFetch("/v1/vault/write", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, value, visibility }),
  });
  if (!res.ok) throw new Error(`Write failed: ${res.status}`);
  return res.json();
}

export async function readEntry(
  path: string,
): Promise<{ key: string; value: unknown; visibility: string }> {
  const res = await relayFetch("/v1/vault/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error(`Read failed: ${res.status}`);
  return res.json();
}

export async function listKeys(prefix?: string): Promise<{ keys: string[] }> {
  const res = await relayFetch("/v1/vault/keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefix }),
  });
  if (!res.ok) throw new Error(`List failed: ${res.status}`);
  return res.json();
}

export async function deleteEntry(path: string): Promise<{ ok: boolean }> {
  const res = await relayFetch("/v1/vault/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
  return res.json();
}
