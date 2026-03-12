import { existsSync } from "node:fs";
import { join } from "node:path";
import type { NetworkId } from "@orbitmem/sdk/contracts";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { getConfigDir, loadConfig, saveConfig, saveKey } from "../config.js";
import { output } from "../utils/output.js";

export async function init(_args: string[], flags: Record<string, string>): Promise<void> {
  const configDir = getConfigDir();
  const keyPath = join(configDir, "key.json");

  if (existsSync(keyPath) && flags.force === undefined) {
    process.stderr.write(`Already initialized at ${configDir}. Use --force to reinitialize.\n`);
    process.exit(1);
  }

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  const network = (flags.network ?? "base-sepolia") as NetworkId;

  saveKey(privateKey);
  saveConfig({ network });

  const config = loadConfig();
  const info = {
    address: account.address,
    configDir,
    network: config.network,
    relay: config.relay,
    chain: config.chain,
    dataRegistry: config.registryAddress,
    feedbackRegistry: config.reputationAddress,
  };

  if (flags.json !== undefined) {
    output(info, true);
  } else {
    process.stdout.write(`\nOrbitMem initialized!\n\n`);
    process.stdout.write(`  Address:           ${info.address}\n`);
    process.stdout.write(`  Config:            ${info.configDir}\n`);
    process.stdout.write(`  Network:           ${info.network}\n`);
    process.stdout.write(`  Relay:             ${info.relay}\n`);
    process.stdout.write(`  Chain:             ${info.chain}\n`);
    process.stdout.write(`  DataRegistry:      ${info.dataRegistry}\n`);
    process.stdout.write(`  FeedbackRegistry:  ${info.feedbackRegistry}\n\n`);
  }
}
