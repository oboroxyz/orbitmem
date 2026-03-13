import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAccount } from "wagmi";
import { archiveSnapshot, listSnapshots } from "../../lib/api";
import { createErc8128Headers } from "../../lib/erc8128";

export const Route = createFileRoute("/explore/snapshots")({
  component: SnapshotsPage,
});

function SnapshotsPage() {
  const { isConnected } = useAccount();
  const queryClient = useQueryClient();

  const { data: result, isLoading } = useQuery({
    queryKey: ["snapshots"],
    queryFn: async () => {
      const headers = await createErc8128Headers("GET", "/api/snapshots");
      return listSnapshots(headers);
    },
    enabled: isConnected,
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const headers = await createErc8128Headers("POST", "/api/snapshots/archive");
      return archiveSnapshot(headers);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snapshots"] });
    },
  });

  if (!isConnected) {
    return (
      <div className="text-center py-24">
        <p className="text-stone-500">Connect your wallet to view snapshots</p>
      </div>
    );
  }

  const snapshots = result?.snapshots ?? [];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-stone-500">
        <Link to="/explore" className="hover:text-stone-700 transition-colors">
          Explore
        </Link>
        <span>/</span>
        <span className="text-stone-700">Snapshots</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 mb-1">Snapshots</h1>
          <p className="text-stone-500 text-sm">Archived vault snapshots on Storacha/Filecoin</p>
        </div>
        <button
          type="button"
          onClick={() => archiveMutation.mutate()}
          disabled={archiveMutation.isPending}
          className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors disabled:opacity-50"
        >
          {archiveMutation.isPending ? "Archiving..." : "Archive Now"}
        </button>
      </div>

      {archiveMutation.isSuccess && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-500">
          Snapshot archived:{" "}
          <span className="font-mono">{archiveMutation.data.cid.slice(0, 20)}...</span>
        </div>
      )}

      {isLoading ? (
        <div className="text-center text-stone-500 py-12">Loading snapshots...</div>
      ) : snapshots.length === 0 ? (
        <div className="bg-stone-100 rounded-xl border border-stone-200 p-8 text-center text-stone-500">
          No snapshots yet. Click "Archive Now" to create your first snapshot.
        </div>
      ) : (
        <div className="bg-stone-100 rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  CID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Entries
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Encrypted
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {snapshots.map((s) => (
                <tr key={s.cid} className="hover:bg-stone-100 transition-colors">
                  <td className="px-4 py-3 font-mono text-stone-700 text-xs">
                    {s.cid.slice(0, 24)}...
                  </td>
                  <td className="px-4 py-3 text-stone-800">{s.entryCount}</td>
                  <td className="px-4 py-3 text-stone-800">{formatBytes(s.size)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs ${s.encrypted ? "text-green-500" : "text-stone-9000"}`}
                    >
                      {s.encrypted ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-500 text-xs">
                    {new Date(s.archivedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
