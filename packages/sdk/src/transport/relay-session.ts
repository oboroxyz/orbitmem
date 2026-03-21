/**
 * Relay session transport — acquires a bearer token via ERC-8128 auth
 * and caches it for subsequent requests. Designed for browser use with
 * sessionStorage, but works anywhere with a custom storage adapter.
 */

import { createSignerClient } from "@slicekit/erc8128";
import type { EthHttpSigner } from "@slicekit/erc8128";

export interface RelaySessionConfig {
  /** Relay server URL (e.g. "https://orbitmem-relay.fly.dev") */
  relayUrl: string;
  /** Wallet address (checksummed) */
  address: `0x${string}`;
  /** Chain ID (default: 84532 = Base Sepolia) */
  chainId?: number;
  /** Wallet signMessage function */
  signMessage: (message: Uint8Array) => Promise<`0x${string}`>;
  /** Session TTL in seconds (default: 1800 = 30 min) */
  ttl?: number;
  /** Storage adapter for caching (default: sessionStorage if available) */
  storage?: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
  };
}

interface CachedSession {
  token: string;
  expiresAt: number;
  address: string;
}

const CACHE_KEY = "orbitmem:session";

/**
 * Create a relay session transport that handles session token
 * acquisition, caching, and authenticated fetch.
 *
 * Usage:
 * ```ts
 * const relay = createRelaySession({ relayUrl, address, signMessage });
 * const res = await relay.fetch("/v1/vault/keys", { method: "POST", body: ... });
 * relay.clear(); // on disconnect
 * ```
 */
export function createRelaySession(config: RelaySessionConfig) {
  const { relayUrl, address, chainId = 84532, signMessage, ttl = 1800 } = config;
  const storage = config.storage ?? (typeof sessionStorage !== "undefined" ? sessionStorage : null);

  const signer: EthHttpSigner = {
    address,
    chainId,
    signMessage: async (message: Uint8Array) => signMessage(message),
  };

  const client = createSignerClient(signer, {
    preferReplayable: true,
    ttlSeconds: ttl,
  });

  function getCached(): CachedSession | null {
    if (!storage) return null;
    const raw = storage.getItem(CACHE_KEY);
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

  async function acquireToken(): Promise<string> {
    const cached = getCached();
    if (cached) return cached.token;

    const res = await client.fetch(
      `${relayUrl}/v1/auth/session`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ttl }),
      },
      {
        binding: "class-bound",
        replay: "replayable",
        components: ["@authority"],
      },
    );
    if (!res.ok) throw new Error(`Session request failed: ${res.status}`);
    const data: CachedSession = await res.json();
    storage?.setItem(CACHE_KEY, JSON.stringify(data));
    return data.token;
  }

  return {
    /** Make an authenticated fetch to the relay using a cached session token. */
    async fetch(path: string, init?: RequestInit): Promise<Response> {
      const token = await acquireToken();
      return globalThis.fetch(`${relayUrl}${path}`, {
        ...init,
        headers: {
          ...init?.headers,
          Authorization: `Bearer ${token}`,
        },
      });
    },

    /** Clear the cached session token. Call on disconnect. */
    clear() {
      storage?.removeItem(CACHE_KEY);
    },
  };
}
