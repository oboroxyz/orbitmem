import { existsSync } from "node:fs";
import { join } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { getConfigDir, loadConfig, saveConfig, saveKey } from "../config.js";
import { output } from "../utils/output.js";

export async function init(args: string[], flags: Record<string, string>): Promise<void> {
  const configDir = getConfigDir();
  const keyPath = join(configDir, "key.json");

  if (existsSync(keyPath) && !flags.force) {
    process.stderr.write(
      `Already initialized at ${configDir}. Use --force to reinitialize.\n`,
    );
    process.exit(1);
  }

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  saveKey(privateKey);
  saveConfig({
    relay: flags.relay ?? "https://relay.orbitmem.xyz",
    chain: flags.chain ?? "base",
  });

  const info = {
    address: account.address,
    configDir,
    relay: loadConfig().relay,
    chain: loadConfig().chain,
  };

  if (flags.json !== undefined) {
    output(info, true);
  } else {
    process.stdout.write(`\nOrbitMem initialized!\n\n`);
    process.stdout.write(`  Address:  ${info.address}\n`);
    process.stdout.write(`  Config:   ${info.configDir}\n`);
    process.stdout.write(`  Relay:    ${info.relay}\n`);
    process.stdout.write(`  Chain:    ${info.chain}\n\n`);
  }
}
