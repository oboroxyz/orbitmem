import { createOwsAdapter } from "@orbitmem/sdk/identity";

import { getConfigDir, loadConfig } from "../config.js";
import { error, output } from "../utils/output.js";

const CAIP2: Record<string, string> = {
  "base-sepolia": "eip155:84532",
  base: "eip155:8453",
};

export async function status(_args: string[], flags: Record<string, string>): Promise<void> {
  const config = loadConfig();
  if (!config.walletName) {
    error("Not initialized. Run `orbitmem init` first.");
  }

  const caip2 = CAIP2[config.network] ?? "eip155:84532";
  const adapter = createOwsAdapter(config.walletName, caip2);
  const address = await adapter.getAddress();

  const info = {
    wallet: config.walletName,
    address,
    configDir: getConfigDir(),
    relay: flags.relay ?? config.relay,
    chain: flags.chain ?? config.chain,
    registryAddress: config.registryAddress ?? "(not set)",
    reputationAddress: config.reputationAddress ?? "(not set)",
  };

  output(info, flags.json !== undefined);
}
