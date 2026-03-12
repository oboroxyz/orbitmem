import type { Chain } from "viem";
import { MockDiscoveryService } from "./mock-discovery.js";
import { MockSnapshotService } from "./mock-snapshot.js";
import { MockVaultService } from "./mock-vault.js";
import { PlanService } from "./plan.js";
import type { RelayServices } from "./types.js";

export async function getOrbitDBPeer(opts?: { directory?: string; listenAddrs?: string[] }) {
  const { getOrbitDBPeer: get } = await import("./orbitdb-peer.js");
  return get(opts);
}

export async function stopOrbitDBPeer() {
  const { stopOrbitDBPeer: stop } = await import("./orbitdb-peer.js");
  return stop();
}
export { PlanService } from "./plan.js";
export type {
  IDiscoveryService,
  IPlanService,
  ISnapshotService,
  IVaultService,
  RelayServices,
} from "./types.js";

function getChain(chainId?: string): Chain {
  // Lazy-resolve chain definitions to avoid importing all chains at startup
  const id = Number(chainId || "8453");
  return { id, name: `chain-${id}` } as Chain;
}

const LIVE_ENV_VARS = [
  "RPC_URL",
  "DATA_REGISTRY_ADDRESS",
  "FEEDBACK_REGISTRY_ADDRESS",
  "STORACHA_PROOF",
] as const;

function validateLiveEnv(): void {
  const missing = LIVE_ENV_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`RELAY_MODE=live requires env vars: ${missing.join(", ")}`);
  }
}

export function createMockServices(): RelayServices {
  return {
    vault: new MockVaultService(),
    snapshot: new MockSnapshotService(),
    discovery: new MockDiscoveryService(),
    plan: new PlanService(),
  };
}

export async function createLiveServices(): Promise<RelayServices> {
  validateLiveEnv();
  const { createPublicClient, http } = await import("viem");
  const { LiveDiscoveryService } = await import("./live-discovery.js");
  const { LiveSnapshotService } = await import("./live-snapshot.js");
  const { LiveVaultService } = await import("./live-vault.js");

  const chain = getChain(process.env.CHAIN_ID);
  const transport = http(process.env.RPC_URL);
  const publicClient = createPublicClient({ chain, transport });

  return {
    vault: new LiveVaultService(),
    snapshot: new LiveSnapshotService({ proof: process.env.STORACHA_PROOF! }),
    discovery: new LiveDiscoveryService({
      publicClient,
      dataRegistry: process.env.DATA_REGISTRY_ADDRESS as `0x${string}`,
      feedbackRegistry: process.env.FEEDBACK_REGISTRY_ADDRESS as `0x${string}`,
    }),
    plan: new PlanService(),
  };
}

export async function createServices(mode?: string): Promise<RelayServices> {
  if (mode === "live") {
    return createLiveServices();
  }
  return createMockServices();
}
