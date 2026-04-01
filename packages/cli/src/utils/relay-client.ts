/**
 * Lightweight relay-only vault client for CLI.
 * Uses ERC-8128 signed HTTP requests — no OrbitDB/libp2p/Helia overhead.
 */

import { createSignerClient } from "@slicekit/erc8128";
import type { EthHttpSigner } from "@slicekit/erc8128";
import { createOwsAdapter } from "@orbitmem/sdk/identity";

import { type CliConfig, toCaip2 } from "../config.js";

export interface RelayVaultClient {
  store(path: string, value: unknown, visibility: string): Promise<{ ok: boolean; hash: string }>;
  get(path: string): Promise<{ key: string; value: unknown; visibility: string } | null>;
  keys(prefix?: string): Promise<string[]>;
  del(path: string): Promise<{ ok: boolean }>;
  address: string;
}

export async function createRelayVaultClient(config: CliConfig): Promise<RelayVaultClient> {
  const relayUrl = config.relay;
  if (!relayUrl) throw new Error("No relay URL configured");

  const caip2 = toCaip2(config.network);
  const adapter = createOwsAdapter(config.walletName, caip2);
  const address = await adapter.getAddress();
  const chainId = Number.parseInt(caip2.split(":")[1], 10);

  const signer: EthHttpSigner = {
    address: address as `0x${string}`,
    chainId,
    signMessage: async (message: Uint8Array) => {
      const viemAccount = await adapter.toViemAccount();
      return viemAccount.signMessage({ message: { raw: message } });
    },
  };

  const client = createSignerClient(signer, {
    preferReplayable: true,
    ttlSeconds: 60,
  });

  // Acquire a session token for faster subsequent requests
  let sessionToken: string | null = null;

  async function acquireSession(): Promise<string> {
    if (sessionToken) return sessionToken;
    const res = await client.fetch(
      `${relayUrl}/v1/auth/session`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: 300 }),
      },
      {
        binding: "class-bound",
        replay: "replayable",
        components: ["@authority"],
      },
    );
    if (!res.ok) throw new Error(`Session auth failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    sessionToken = data.token;
    return sessionToken;
  }

  async function authFetch(path: string, init?: RequestInit): Promise<Response> {
    const token = await acquireSession();
    return globalThis.fetch(`${relayUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return {
    address,

    async store(path, value, visibility) {
      const res = await authFetch("/v1/vault/write", {
        method: "POST",
        body: JSON.stringify({ path, value, visibility }),
      });
      if (!res.ok) throw new Error(`Vault write failed: ${res.status} ${await res.text()}`);
      return res.json();
    },

    async get(path) {
      const res = await authFetch("/v1/vault/read", {
        method: "POST",
        body: JSON.stringify({ path }),
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Vault read failed: ${res.status} ${await res.text()}`);
      return res.json();
    },

    async keys(prefix?) {
      const res = await authFetch("/v1/vault/keys", {
        method: "POST",
        body: JSON.stringify({ prefix }),
      });
      if (!res.ok) throw new Error(`Vault keys failed: ${res.status} ${await res.text()}`);
      const data = await res.json();
      return data.keys;
    },

    async del(path) {
      const res = await authFetch("/v1/vault/delete", {
        method: "POST",
        body: JSON.stringify({ path }),
      });
      if (!res.ok) throw new Error(`Vault delete failed: ${res.status} ${await res.text()}`);
      return res.json();
    },
  };
}
