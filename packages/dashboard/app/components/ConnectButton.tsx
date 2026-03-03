import { useAccount, useConnect, useDisconnect } from "wagmi";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-orbit-300 font-mono">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          type="button"
          onClick={() => disconnect()}
          className="px-3 py-1.5 text-sm rounded-lg border border-orbit-600 text-orbit-200 hover:bg-orbit-700 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        const injected = connectors.find((c) => c.id === "injected");
        if (injected) connect({ connector: injected });
      }}
      className="px-4 py-2 text-sm font-medium rounded-lg bg-accent-500 text-white hover:bg-accent-400 transition-colors"
    >
      Connect Wallet
    </button>
  );
}
