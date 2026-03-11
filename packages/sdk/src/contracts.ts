import type { EvmAddress, EvmChain } from "./types.js";

export type NetworkId = "base" | "base-sepolia";

export interface NetworkConfig {
  dataRegistry: EvmAddress;
  feedbackRegistry: EvmAddress;
  chain: EvmChain;
  chainId: number;
  rpcUrl: string;
  relayUrl: string;
  /** Block number at which contracts were deployed (used for event queries) */
  deployBlock: bigint;
}

/** Deployed contract addresses and relay URLs per network */
export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  "base-sepolia": {
    dataRegistry: "0x9eE44938ED77227470CaA2DbCC0459F49d249B7A" as EvmAddress,
    feedbackRegistry: "0x1Bce77f90C33A5f8faCa54782Ce3a17d1AD7109a" as EvmAddress,
    chain: "base-sepolia",
    chainId: 84532,
    rpcUrl: "https://sepolia.base.org",
    relayUrl: "https://relay.orbitmem.0x7.sh",
    deployBlock: 38728995n,
  },
  base: {
    dataRegistry: "0x0000000000000000000000000000000000000000" as EvmAddress,
    feedbackRegistry: "0x0000000000000000000000000000000000000000" as EvmAddress,
    chain: "base",
    chainId: 8453,
    rpcUrl: "https://mainnet.base.org",
    relayUrl: "https://relay.orbitmem.0x7.sh",
    deployBlock: 0n,
  },
};

/** Current default network */
export const DEFAULT_NETWORK: NetworkId = "base-sepolia";

/** Resolve network config by ID */
export function getNetwork(network?: NetworkId): NetworkConfig {
  return NETWORKS[network ?? DEFAULT_NETWORK];
}
