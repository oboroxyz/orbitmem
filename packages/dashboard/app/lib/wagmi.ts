import { createConfig, http } from "wagmi";
import { base, mainnet, optimism } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [mainnet, base, optimism],
  connectors: [
    injected(),
    walletConnect({
      projectId: import.meta.env.VITE_WC_PROJECT_ID ?? "orbitmem-dev",
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [optimism.id]: http(),
  },
});
