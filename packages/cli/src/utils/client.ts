import type { EncryptionConfig } from "@orbitmem/sdk/types";
import { createOrbitMem, getNetwork } from "@orbitmem/sdk";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";

import type { CliConfig } from "../config.js";

const CHAINS = {
  "base-sepolia": baseSepolia,
  base: base,
} as const;

export type LitNetwork = "cayenne" | "manzano" | "habanero";

export interface CreateClientOpts {
  litNetwork?: LitNetwork;
}

export async function createClient(
  config: CliConfig,
  privateKey: string,
  opts?: CreateClientOpts,
) {
  const network = getNetwork(config.network);
  const chain = CHAINS[config.network] ?? baseSepolia;
  const transport = http(network.rpcUrl);
  const account = privateKeyToAccount(privateKey as `0x${string}`);

  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ chain, transport, account });

  const encryption: EncryptionConfig = {
    defaultEngine: "aes",
    aes: { kdf: "hkdf-sha256" },
  };
  if (opts?.litNetwork) {
    encryption.lit = { network: opts.litNetwork };
  }

  const client = await createOrbitMem({
    network: config.network,
    identity: { privateKey },
    vault: { dbName: "orbitmem-cli" },
    encryption,
    persistence: {
      relayUrl: config.relay,
    },
    discovery: {
      dataRegistry: network.dataRegistry,
      reputationRegistry: network.feedbackRegistry,
      registryChain: network.chain,
      publicClient: publicClient as any,
      walletClient: walletClient as any,
    },
  });

  await client.connect({ method: "evm" });
  return client;
}
