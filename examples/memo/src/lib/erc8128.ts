import { type SignerClient, createSignerClient } from "@slicekit/erc8128";
import { type Config, getAccount, signMessage } from "@wagmi/core";
import { config } from "./wagmi";

const RELAY = import.meta.env.VITE_RELAY_URL ?? "http://localhost:3000";

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
