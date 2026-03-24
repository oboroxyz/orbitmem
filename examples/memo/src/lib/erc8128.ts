import { createRelaySession } from "@orbitmem/sdk";
import { type Config, getAccount, signMessage } from "@wagmi/core";

import { config } from "./wagmi";

const RELAY = import.meta.env.VITE_RELAY_URL ?? "https://orbitmem-relay.fly.dev";

let relay: ReturnType<typeof createRelaySession> | null = null;

/** Initialize relay session transport. Call after wallet connection. */
export function initRelay() {
  const account = getAccount(config as Config);
  if (!account.address) throw new Error("No wallet connected");

  relay = createRelaySession({
    relayUrl: RELAY,
    address: account.address,
    chainId: account.chainId ?? 84532,
    signMessage: async (message: Uint8Array) => {
      return await signMessage(config as Config, { message: { raw: message } });
    },
  });
}

/** Make an authenticated fetch to the relay. */
export async function relayFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!relay) throw new Error("Relay not initialized — call initRelay()");
  return relay.fetch(path, init);
}

/** Reset relay transport and clear cached session (on disconnect). */
export function resetRelay() {
  relay?.clear();
  relay = null;
}
