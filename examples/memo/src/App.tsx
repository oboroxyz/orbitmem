import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "./components/ConnectButton";
import { MemoEditor } from "./components/MemoEditor";
import { MemoList } from "./components/MemoList";
import { PublicMemoView } from "./components/PublicMemoView";
import { type Memo, useOrbitMem } from "./hooks/useOrbitMem";

type View =
  | { type: "list" }
  | { type: "edit"; memo?: Memo }
  | { type: "public"; address: string; memoId: string };

function parseRoute(): View {
  const path = window.location.pathname;
  // Match /:address/:memoId (address starts with 0x)
  const match = path.match(/^\/(0x[a-fA-F0-9]+)\/([a-zA-Z0-9_-]+)$/);
  if (match) {
    return { type: "public", address: match[1], memoId: match[2] };
  }
  return { type: "list" };
}

export function App() {
  const { isConnected } = useAccount();
  const orbit = useOrbitMem();
  const initialView = parseRoute();
  const [view, setView] = useState<View>(initialView);

  // Public memo view — no wallet required
  if (view.type === "public") {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="border-b bg-white px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-xl font-bold hover:text-blue-600 transition-colors">
            OrbitMem Memo
          </a>
          <ConnectButton />
        </header>
        <main className="px-6 py-8">
          <PublicMemoView address={view.address} memoId={view.memoId} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <h1
          className="text-xl font-bold cursor-pointer"
          onClick={() => setView({ type: "list" })}
        >
          OrbitMem Memo
        </h1>
        <ConnectButton />
      </header>
      <main className="max-w-3xl mx-auto px-6 py-8">
        {!isConnected ? (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold mb-4">Decentralized Memos</h2>
            <p className="text-gray-600 mb-8">
              Encrypted, peer-to-peer notes. Your data, your vault, your rules.
            </p>
            <ConnectButton />
          </div>
        ) : orbit.error ? (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <p className="text-red-700 text-sm">{orbit.error}</p>
            <button onClick={orbit.refresh} className="text-sm text-red-600 underline mt-2">
              Retry
            </button>
          </div>
        ) : orbit.loading ? (
          <p className="text-center py-12 text-gray-500">Loading memos...</p>
        ) : view.type === "edit" ? (
          <MemoEditor
            memo={view.memo}
            onSave={orbit.saveMemo}
            onBack={() => setView({ type: "list" })}
          />
        ) : (
          <MemoList
            memos={orbit.memos}
            address={orbit.address!}
            onSelect={(memo) => setView({ type: "edit", memo })}
            onDelete={orbit.deleteMemo}
            onNew={() => setView({ type: "edit" })}
          />
        )}
      </main>
    </div>
  );
}
