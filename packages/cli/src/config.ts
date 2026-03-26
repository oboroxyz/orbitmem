import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { getNetwork, type NetworkId } from "@orbitmem/sdk/contracts";

export interface CliConfig {
  walletName: string;
  network: NetworkId;
  relay: string;
  chain: string;
  registryAddress: string;
  reputationAddress: string;
}

function defaultConfig(network?: NetworkId): Omit<CliConfig, "walletName"> {
  const net = getNetwork(network);
  return {
    network: network ?? "base-sepolia",
    relay: net.relayUrl,
    chain: net.chain,
    registryAddress: net.dataRegistry,
    reputationAddress: net.feedbackRegistry,
  };
}

export function getConfigDir(): string {
  return process.env.ORBITMEM_HOME ?? join(homedir(), ".orbitmem");
}

function ensureDir(): void {
  const dir = getConfigDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function loadConfig(): CliConfig {
  const configPath = join(getConfigDir(), "config.json");
  const defaults = defaultConfig();
  if (!existsSync(configPath)) return { walletName: "", ...defaults };
  const raw = JSON.parse(readFileSync(configPath, "utf-8"));
  const base = raw.network ? defaultConfig(raw.network) : defaults;
  return { walletName: "", ...base, ...raw };
}

/** Derive CAIP-2 chain ID from network name */
export function toCaip2(network: string): string {
  const map: Record<string, string> = {
    "base-sepolia": "eip155:84532",
    base: "eip155:8453",
  };
  return map[network] ?? "eip155:84532";
}

export function saveConfig(config: Partial<CliConfig>): void {
  ensureDir();
  const configPath = join(getConfigDir(), "config.json");
  const existing = loadConfig();
  const merged = { ...existing, ...config };
  writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`);
}
