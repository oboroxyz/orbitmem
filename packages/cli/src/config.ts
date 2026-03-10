import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface CliConfig {
  relay: string;
  chain: string;
  registryAddress?: string;
  reputationAddress?: string;
}

const DEFAULT_CONFIG: CliConfig = {
  relay: "https://relay.orbitmem.xyz",
  chain: "base",
};

export function getConfigDir(): string {
  return process.env.ORBITMEM_HOME ?? join(homedir(), ".orbitmem");
}

function ensureDir(): void {
  const dir = getConfigDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function loadConfig(): CliConfig {
  const configPath = join(getConfigDir(), "config.json");
  if (!existsSync(configPath)) return { ...DEFAULT_CONFIG };
  const raw = readFileSync(configPath, "utf-8");
  return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
}

export function saveConfig(config: Partial<CliConfig>): void {
  ensureDir();
  const configPath = join(getConfigDir(), "config.json");
  const existing = loadConfig();
  const merged = { ...existing, ...config };
  writeFileSync(configPath, JSON.stringify(merged, null, 2) + "\n");
}

export function loadKey(): string {
  const keyPath = join(getConfigDir(), "key.json");
  if (!existsSync(keyPath)) {
    throw new Error("No key found. Run `orbitmem init` first.");
  }
  const raw = JSON.parse(readFileSync(keyPath, "utf-8"));
  return raw.privateKey;
}

export function saveKey(privateKey: string): void {
  ensureDir();
  const keyPath = join(getConfigDir(), "key.json");
  writeFileSync(keyPath, JSON.stringify({ privateKey }, null, 2) + "\n");
}
