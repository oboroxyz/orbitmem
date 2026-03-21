import { type SignerClient, createSignerClient } from "@slicekit/erc8128";
import { type Config, getAccount, signMessage } from "@wagmi/core";
import { config } from "./wagmi";

const RELAY = import.meta.env.VITE_RELAY_URL ?? "https://orbitmem-relay.fly.dev";

let signerClient: SignerClient | null = null;

/**
 * Initialize the ERC-8128 signer client.
 * Uses preferReplayable so the class-bound replayable signature is cached
 * and reused for all requests within the TTL (30 min).
 * Call this after wallet connection.
 */
export function initSignerClient() {
  const account = getAccount(config as Config);
  if (!account.address) throw new Error("No wallet connected");

  signerClient = createSignerClient(
    {
      address: account.address,
      chainId: account.chainId ?? 84532, // Base Sepolia
      signMessage: async (message: Uint8Array) => {
        const hex = await signMessage(config as Config, {
          message: { raw: message },
        });
        return hex;
      },
    },
    {
      preferReplayable: true,
      ttlSeconds: 1800, // 30 min
    },
  );
}

/**
 * Get the current signer client. Throws if not initialized.
 */
export function getSignerClient(): SignerClient {
  if (!signerClient) throw new Error("Signer client not initialized — call initSignerClient()");
  return signerClient;
}

/**
 * Reset the signer client (on disconnect).
 */
export function resetSignerClient() {
  signerClient = null;
}

/**
 * Make an authenticated fetch to the relay.
 * Uses class-bound replayable signature (signs once, reuses within TTL).
 */
export async function signedFetch(path: string, init?: RequestInit): Promise<Response> {
  const client = getSignerClient();
  return client.fetch(`${RELAY}${path}`, init, {
    binding: "class-bound",
    replay: "replayable",
    components: ["@authority"],
  });
}

/* ── Session token helpers ─────────────────────────────────────────── */

const SESSION_CACHE_KEY = "orbitmem:session";

interface CachedSession {
  token: string;
  expiresAt: number;
  address: string;
}

/** Get cached session token if still valid (with 30s buffer). */
function getCachedSession(address: string): CachedSession | null {
  const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
  if (!raw) return null;
  try {
    const session: CachedSession = JSON.parse(raw);
    if (session.address !== address) return null;
    if (session.expiresAt <= Date.now() + 30_000) return null;
    return session;
  } catch {
    return null;
  }
}

/** Acquire a session token — returns cached or fetches new via ERC-8128. */
export async function acquireSessionToken(): Promise<string> {
  const account = getAccount(config as Config);
  if (!account.address) throw new Error("No wallet connected");

  const cached = getCachedSession(account.address);
  if (cached) return cached.token;

  // Sign one ERC-8128 request to get a session token
  const client = getSignerClient();
  const res = await client.fetch(
    `${RELAY}/v1/auth/session`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
    {
      binding: "class-bound",
      replay: "replayable",
      components: ["@authority"],
    },
  );
  if (!res.ok) throw new Error(`Session request failed: ${res.status}`);
  const data: CachedSession = await res.json();
  sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(data));
  return data.token;
}

/** Make an authenticated fetch using a session bearer token. */
export async function sessionFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await acquireSessionToken();
  return fetch(`${RELAY}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

/** Clear session cache (on disconnect). */
export function clearSessionCache() {
  sessionStorage.removeItem(SESSION_CACHE_KEY);
}
