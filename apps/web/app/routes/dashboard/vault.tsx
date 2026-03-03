import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "../../components/ConnectButton";
import { getPublicVaultEntry, getPublicVaultKeys } from "../../lib/api";

export const Route = createFileRoute("/dashboard/vault")({
  component: VaultPage,
});

function VaultPage() {
  const { address, isConnected } = useAccount();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

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
        <div className="w-16 h-16 rounded-full bg-orbit-700 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-orbit-400"
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
        <h1 className="text-2xl font-bold text-orbit-50">Connect Your Wallet</h1>
        <p className="text-orbit-400 text-center max-w-md">
          Connect your wallet to browse vault entries, manage keys, and view snapshots.
        </p>
        <ConnectButton />
      </div>
    );
  }

  const keys = keysResult?.keys ?? [];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-orbit-400">
        <Link to="/dashboard" className="hover:text-orbit-200 transition-colors">
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-orbit-200">My Data</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-orbit-50 mb-1">My Data</h1>
          <p className="text-orbit-400 text-sm">
            Vault keys for <span className="font-mono">{address?.slice(0, 10)}...</span>
          </p>
        </div>
        <ConnectButton />
      </div>

      {isLoading ? (
        <div className="text-center text-orbit-400 py-12">Loading vault keys...</div>
      ) : keys.length === 0 ? (
        <div className="bg-orbit-800 rounded-xl border border-orbit-700 p-8 text-center text-orbit-400">
          No public vault keys found. Seed data via the relay to see entries here.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Key list */}
          <div className="lg:col-span-1 bg-orbit-800 rounded-xl border border-orbit-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-orbit-700">
              <h3 className="text-sm font-medium text-orbit-300">Keys ({keys.length})</h3>
            </div>
            <div className="divide-y divide-orbit-700/50 max-h-96 overflow-y-auto">
              {keys.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  className={`w-full text-left px-4 py-3 text-sm font-mono transition-colors ${
                    selectedKey === key
                      ? "bg-accent-500/10 text-accent-300"
                      : "text-orbit-200 hover:bg-orbit-700/50"
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          {/* Entry detail */}
          <div className="lg:col-span-2 bg-orbit-800 rounded-xl border border-orbit-700 p-6">
            {selectedKey && entryResult ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-orbit-50">{entryResult.key}</h3>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      entryResult.visibility === "public"
                        ? "bg-trust-high/20 text-trust-high"
                        : "bg-trust-mid/20 text-trust-mid"
                    }`}
                  >
                    {entryResult.visibility}
                  </span>
                </div>
                <pre className="bg-orbit-900 rounded-lg p-4 text-sm text-orbit-200 overflow-x-auto font-mono">
                  {typeof entryResult.value === "string"
                    ? entryResult.value
                    : JSON.stringify(entryResult.value, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="text-center text-orbit-500 py-12">Select a key to view its value</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
