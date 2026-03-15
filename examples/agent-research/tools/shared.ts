/**
 * Shared utilities for agent-research tool scripts.
 * Bootstraps an OrbitMem client from ~/.orbitmem config (same as CLI).
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createOrbitMem, getNetwork, type NetworkId } from "@orbitmem/sdk";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

interface Config {
  network: NetworkId;
  relay: string;
}

function getConfigDir(): string {
  return process.env.ORBITMEM_HOME ?? join(homedir(), ".orbitmem");
}

function loadConfig(): Config {
  const configPath = join(getConfigDir(), "config.json");
  const network = getNetwork();
  const defaults: Config = { network: "base-sepolia", relay: network.relayUrl };
  if (!existsSync(configPath)) return defaults;
  const raw = JSON.parse(readFileSync(configPath, "utf-8"));
  return { ...defaults, ...raw };
}

function loadKey(): string {
  const keyPath = join(getConfigDir(), "key.json");
  if (!existsSync(keyPath)) {
    throw new Error("No key found. Run `bun run cli init` first.");
  }
  return JSON.parse(readFileSync(keyPath, "utf-8")).privateKey;
}

export async function createAgentClient() {
  const config = loadConfig();
  const network = getNetwork(config.network);
  const transport = http(network.rpcUrl);
  const account = privateKeyToAccount(loadKey() as `0x${string}`);

  const publicClient = createPublicClient({ chain: baseSepolia, transport });
  const walletClient = createWalletClient({
    chain: baseSepolia,
    transport,
    account,
  });

  const client = await createOrbitMem({
    network: config.network,
    identity: { privateKey: loadKey() },
    vault: { dbName: "orbitmem-agent-research" },
    encryption: { defaultEngine: "aes", aes: { kdf: "hkdf-sha256" } },
    persistence: { relayUrl: config.relay },
    discovery: {
      dataRegistry: network.dataRegistry,
      reputationRegistry: network.feedbackRegistry,
      registryChain: network.chain,
      publicClient: publicClient as any,
      walletClient: walletClient as any,
    },
  });

  await client.connect({ method: "evm" });
  return { client, config };
}

/** Pretty-print JSON to stdout */
export function printJson(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}
