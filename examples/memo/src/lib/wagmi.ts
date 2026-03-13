import { http, createConfig, createStorage } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

// Porto passkey connector from porto/wagmi
let portoConnector: ReturnType<typeof injected> | undefined;
try {
  const portoMod = await import("porto/wagmi");
  portoConnector = portoMod.porto() as ReturnType<typeof injected>;
} catch {
  // Porto not available — EVM wallets only
  // TODO: Porto connector could not be loaded; passkey login unavailable
}

const connectors = [
  ...(portoConnector ? [portoConnector] : []),
  injected(),
  walletConnect({
    projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "orbitmem-memo-dev",
  }),
];

export const config = createConfig({
  chains: [baseSepolia],
  connectors,
  storage: createStorage({ storage: localStorage }),
  transports: {
    [baseSepolia.id]: http(),
  },
});
