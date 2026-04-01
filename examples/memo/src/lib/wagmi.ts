import { http, createConfig, createStorage } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

import type { CreateConnectorFn } from "wagmi";

const connectors: CreateConnectorFn[] = [injected()];

try {
  const { porto } = await import("porto/wagmi");
  connectors.unshift(porto() as ReturnType<typeof injected>);
} catch {
  // Porto not available — EVM wallets only
}

export const config = createConfig({
  chains: [baseSepolia],
  connectors,
  storage: createStorage({ storage: localStorage }),
  transports: {
    [baseSepolia.id]: http(),
  },
});
