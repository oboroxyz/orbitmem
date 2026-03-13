import { useAccount } from "wagmi";
import { ConnectButton } from "./components/ConnectButton";

export function App() {
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">OrbitMem Memo</h1>
        <ConnectButton />
      </header>
      <main className="max-w-3xl mx-auto px-6 py-8">
        {isConnected ? (
          <p className="text-gray-500">Memo list will go here.</p>
        ) : (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold mb-4">Decentralized Memos</h2>
            <p className="text-gray-600 mb-8">
              Encrypted, peer-to-peer notes. Your data, your vault, your rules.
            </p>
            <ConnectButton />
          </div>
        )}
      </main>
    </div>
  );
}
