import { type SignerClient, createSignerClient } from "@slicekit/erc8128";
import { getAccount, signMessage } from "@wagmi/core";

import { wagmiConfig } from "./wagmi";

let signerClient: SignerClient | null = null;

/**
 * Get or create the ERC-8128 signer client.
 * Uses class-bound + replayable mode: signs once, reuses for 30 min.
 */
function getOrCreateSignerClient(): SignerClient {
  if (signerClient) return signerClient;

  const account = getAccount(wagmiConfig);
  if (!account.address) throw new Error("No wallet connected");

  signerClient = createSignerClient(
    {
      address: account.address,
      chainId: account.chainId ?? 84532,
      signMessage: async (message: Uint8Array) => {
        return signMessage(wagmiConfig, { message: { raw: message } });
      },
    },
    {
      preferReplayable: true,
      ttlSeconds: 1800,
    },
  );

  return signerClient;
}

/**
 * Reset the signer client (on disconnect).
 */
export function resetSignerClient() {
  signerClient = null;
}

/**
 * Make an authenticated fetch to the relay API proxy.
 * Signs with ERC-8128 class-bound replayable signature.
 */
export async function signedFetch(path: string, init?: RequestInit): Promise<Response> {
  const client = getOrCreateSignerClient();
  return client.fetch(`/api${path}`, init, {
    binding: "class-bound",
    replay: "replayable",
    components: ["@authority"],
  });
}

/**
 * Legacy: Generate ERC-8128 auth headers.
 * @deprecated Use signedFetch() instead for automatic signing.
 */
export async function createErc8128Headers(
  _method: string,
  _url: string,
  _body?: string,
): Promise<Record<string, string>> {
  const client = getOrCreateSignerClient();
  const signed = await client.signRequest(new Request("http://localhost/dummy"), {
    binding: "class-bound",
    replay: "replayable",
    components: ["@authority"],
  });
  const headers: Record<string, string> = {};
  signed.headers.forEach((value: string, key: string) => {
    if (key.toLowerCase() === "signature" || key.toLowerCase() === "signature-input") {
      headers[key] = value;
    }
  });
  return headers;
}
