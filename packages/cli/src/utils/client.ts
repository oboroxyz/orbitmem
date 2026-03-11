import { createOrbitMem } from "@orbitmem/sdk";
import type { CliConfig } from "../config.js";

export async function createClient(config: CliConfig, privateKey: string) {
  const client = await createOrbitMem({
    network: config.network,
    identity: { privateKey },
    vault: { dbName: "orbitmem-cli" },
    encryption: { defaultEngine: "aes", aes: { kdf: "hkdf-sha256" } },
    persistence: {
      relayUrl: config.relay,
    },
    discovery: {
      dataRegistry: config.registryAddress as `0x${string}`,
      reputationRegistry: config.reputationAddress as `0x${string}`,
      registryChain: config.chain as "base",
    },
  });

  await client.connect({ method: "evm" });
  return client;
}
