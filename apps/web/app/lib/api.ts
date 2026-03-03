const BASE = "/api";

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// ── Health ──

export function getHealth() {
  return fetchJSON<{ status: string; timestamp: number }>("/health");
}

// ── Data Registry (public) ──

export interface DataRegistration {
  dataId: number;
  name: string;
  description: string;
  schema?: string;
  tags: string[];
  visibility: string;
  owner: string;
  active: boolean;
  lastUpdated: number;
  registeredAt: number;
}

export interface DataScore {
  quality: number;
  freshness: { lastUpdated: number; score: number };
  accuracy: { score: number; feedbackCount: number };
  completeness: { score: number; feedbackCount: number };
  verified: boolean;
  verificationMethod?: string;
  consumptionCount: number;
  totalFeedback: number;
  tagScores: Record<string, { value: number; count: number }>;
}

export function searchData(params?: {
  schema?: string;
  tags?: string[];
  verifiedOnly?: boolean;
  minQuality?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.schema) qs.set("schema", params.schema);
  if (params?.tags?.length) qs.set("tags", params.tags.join(","));
  if (params?.verifiedOnly) qs.set("verifiedOnly", "true");
  if (params?.minQuality !== undefined) qs.set("minQuality", String(params.minQuality));
  const query = qs.toString();
  return fetchJSON<{ results: DataRegistration[]; count: number }>(
    `/data/search${query ? `?${query}` : ""}`,
  );
}

export function getDataScore(dataId: number) {
  return fetchJSON<DataScore>(`/data/${dataId}/score`);
}

export interface DataStats {
  totalEntries: number;
  totalFeedback: number;
  avgQuality: number;
  qualityDistribution: { range: string; count: number }[];
  topTags: { tag: string; count: number }[];
  activity: { date: string; entries: number; feedback: number }[];
}

export function getDataStats() {
  return fetchJSON<DataStats>("/data/stats");
}

// ── Vault (public reads) ──

export function getPublicVaultKeys(address: string, prefix?: string) {
  const qs = prefix ? `?prefix=${encodeURIComponent(prefix)}` : "";
  return fetchJSON<{ keys: string[] }>(`/vault/public/${address}/keys${qs}`);
}

export function getPublicVaultEntry(address: string, key: string) {
  return fetchJSON<{ key: string; value: unknown; visibility: string }>(
    `/vault/public/${address}/${key}`,
  );
}

// ── Auth ──

export function getAuthChallenge() {
  return fetchJSON<{ message: string; nonce: string; timestamp: number }>("/auth/challenge", {
    method: "POST",
  });
}

// ── Authenticated endpoints ──

export function submitFeedback(
  dataId: number,
  body: { value: number; qualityDimension?: string; tag1?: string; tag2?: string },
  headers: Record<string, string>,
) {
  return fetchJSON<{ status: string; dataId: number; signer: string }>(`/data/${dataId}/feedback`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

export function listSnapshots(headers: Record<string, string>) {
  return fetchJSON<{
    snapshots: Array<{
      cid: string;
      size: number;
      archivedAt: number;
      entryCount: number;
      encrypted: boolean;
    }>;
    count: number;
  }>("/snapshots", { headers });
}

export function archiveSnapshot(headers: Record<string, string>) {
  return fetchJSON<{
    cid: string;
    size: number;
    archivedAt: number;
    entryCount: number;
    encrypted: boolean;
  }>("/snapshots/archive", { method: "POST", headers });
}
