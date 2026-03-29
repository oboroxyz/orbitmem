import { useAccount } from "wagmi";

import { ConnectButton } from "./components/ConnectButton";
import { MemoEditor } from "./components/MemoEditor";
import { MemoList } from "./components/MemoList";
import { PublicMemoView } from "./components/PublicMemoView";
import { useOrbitMem } from "./hooks/useOrbitMem";
import { useRouter } from "./hooks/useRouter";

export function App() {
  const { isConnected } = useAccount();
  const { route, go } = useRouter();
  const orbit = useOrbitMem({ skip: route.page === "public" });

  // Public memo view — no wallet required
  if (route.page === "public") {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="border-b bg-white px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => go("/")}
            className="text-xl font-bold hover:text-blue-600 transition-colors"
          >
            OrbitMem Memo
          </button>
          <ConnectButton />
        </header>
        <main className="px-6 py-8">
          <PublicMemoView address={route.address} memoId={route.memoId} />
        </main>
      </div>
    );
  }

  const selectedMemo =
    route.page === "edit" ? orbit.memos.find((m) => m.id === route.id) : undefined;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white px-6 py-4 flex items-center justify-between">
        <h1
          className="text-xl font-bold cursor-pointer"
          onClick={() => go("/")}
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
        ) : route.page === "new" || route.page === "edit" ? (
          <MemoEditor
            memo={selectedMemo}
            onSave={orbit.saveMemo}
            onBack={() => go("/")}
          />
        ) : (
          <MemoList
            memos={orbit.memos}
            address={orbit.address!}
            onSelect={(memo) => go(`/edit/${memo.id}`)}
            onDelete={orbit.deleteMemo}
            onNew={() => go("/new")}
          />
        )}
      </main>
    </div>
  );
}
