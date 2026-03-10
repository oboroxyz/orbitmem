import { createOrbitMem } from "@orbitmem/sdk";
import type { CliConfig } from "../config.js";

export async function createClient(config: CliConfig, privateKey: string) {
  const client = await createOrbitMem({
    identity: { family: "evm", privateKey },
    vault: { dbName: "orbitmem-cli" },
    encryption: { defaultEngine: "aes", aes: { kdf: "hkdf-sha256" } },
    persistence: {
      relayUrl: config.relay,
    },
    discovery: config.registryAddress
      ? {
          dataRegistry: config.registryAddress as `0x${string}`,
          reputationRegistry: (config.reputationAddress ?? "0x0") as `0x${string}`,
          registryChain: config.chain as "base",
        }
      : undefined,
  });

  await client.connect({ method: "evm" });
  return client;
}
