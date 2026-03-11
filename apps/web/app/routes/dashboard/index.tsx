import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "../../components/ConnectButton";
import { getPublicVaultEntry, getPublicVaultKeys, getUserStats } from "../../lib/api";
import { createErc8128Headers } from "../../lib/erc8128";

export const Route = createFileRoute("/dashboard/")({
  component: MyDataPage,
});

function MyDataPage() {
  const { address, isConnected } = useAccount();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const buildHeaders = useCallback(() => createErc8128Headers("GET", "/api/data/user/stats"), []);

  const { data: userStats } = useQuery({
    queryKey: ["userStats", address],
    queryFn: async () => {
      const headers = await buildHeaders();
      return getUserStats(headers);
    },
    enabled: isConnected && !!address,
    retry: false,
  });

  const { data: keysResult, isLoading } = useQuery({
    queryKey: ["vaultKeys", address],
    queryFn: () => getPublicVaultKeys(address!),
    enabled: isConnected && !!address,
  });

  const { data: entryResult } = useQuery({
    queryKey: ["vaultEntry", address, selectedKey],
    queryFn: () => getPublicVaultEntry(address!, selectedKey!),
    enabled: isConnected && !!address && !!selectedKey,
  });

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-16 h-16 rounded-full flex items-center border justify-center">
          <svg
            className="w-8 h-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            role="img"
            aria-label="Key icon"
          >
            <title>Wallet connection required</title>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">Connect Your Wallet</h1>
        <p className="text-center max-w-md">
          Connect your wallet to browse vault entries, manage keys, and view snapshots.
        </p>
        <ConnectButton />
      </div>
    );
  }

  const keys = keysResult?.keys ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 mb-1">My Data</h1>
          <p className="text-stone-500 text-sm">
            Vault keys for <span className="font-mono">{address?.slice(0, 10)}...</span>
          </p>
        </div>
        <ConnectButton />
      </div>

      {userStats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-stone-200 bg-stone-100 p-5">
            <p className="text-stone-500 text-xs uppercase tracking-wider mb-1">
              Feedback Submitted
            </p>
            <p className="text-2xl font-bold text-stone-900">{userStats.feedbackSubmitted}</p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-stone-100 p-5">
            <p className="text-stone-500 text-xs uppercase tracking-wider mb-1">Avg Rating Given</p>
            <p className="text-2xl font-bold text-stone-900">{userStats.avgRatingGiven}</p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-stone-100 p-5">
            <p className="text-stone-500 text-xs uppercase tracking-wider mb-1">Entries Rated</p>
            <p className="text-2xl font-bold text-stone-900">{userStats.dataEntriesRated}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">Loading vault keys...</div>
      ) : keys.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-stone-100 p-8 text-center">
          No public vault keys found. Seed data via the relay to see entries here.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Key list */}
          <div className="lg:col-span-1 rounded-xl border border-stone-200 bg-stone-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-200">
              <h3 className="text-sm font-medium text-stone-900">Keys ({keys.length})</h3>
            </div>
            <div className="divide-y divide-stone-200 max-h-96 overflow-y-auto">
              {keys.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  className={`w-full text-left px-4 py-3 text-sm font-mono transition-colors ${
                    selectedKey === key
                      ? "bg-violet-600/10 text-violet-400"
                      : "text-stone-900 hover:bg-stone-100/50 hover:text-stone-900"
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          {/* Entry detail */}
          <div className="lg:col-span-2 rounded-xl border border-stone-200 bg-stone-100 p-6">
            {selectedKey && entryResult ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-stone-900">{entryResult.key}</h3>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      entryResult.visibility === "public"
                        ? "bg-green-500/20 text-green-500"
                        : "bg-yellow-500/20 text-yellow-500"
                    }`}
                  >
                    {entryResult.visibility}
                  </span>
                </div>
                <pre className="bg-stone-50 rounded-lg p-4 text-sm text-stone-700 overflow-x-auto font-mono">
                  {typeof entryResult.value === "string"
                    ? entryResult.value
                    : JSON.stringify(entryResult.value, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="text-center text-stone-9000 py-12">
                Select a key to view its value
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
