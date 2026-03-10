import { privateKeyToAccount } from "viem/accounts";
import { getConfigDir, loadConfig, loadKey } from "../config.js";
import { error, output } from "../utils/output.js";

export async function status(_args: string[], flags: Record<string, string>): Promise<void> {
  let key: string;
  try {
    key = loadKey();
  } catch {
    error("Not initialized. Run `orbitmem init` first.");
  }

  const config = loadConfig();
  const account = privateKeyToAccount(key as `0x${string}`);

  const info = {
    address: account.address,
    configDir: getConfigDir(),
    relay: flags.relay ?? config.relay,
    chain: flags.chain ?? config.chain,
    registryAddress: config.registryAddress ?? "(not set)",
    reputationAddress: config.reputationAddress ?? "(not set)",
  };

  output(info, flags.json !== undefined);
}
