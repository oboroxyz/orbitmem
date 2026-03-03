import { createFileRoute, Link } from "@tanstack/react-router";
import { useAccount } from "wagmi";
import { ConnectButton } from "../../components/ConnectButton";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { address, isConnected } = useAccount();

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
          Connect your wallet to access your personal dashboard, manage vault entries, and view
          snapshots.
        </p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-orbit-50 mb-1">Dashboard</h1>
          <p className="text-orbit-400 text-sm font-mono">{address}</p>
        </div>
        <ConnectButton />
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <OverviewCard label="Your Data" value="0" description="Data entries" />
        <OverviewCard label="Feedback Given" value="0" description="Ratings submitted" />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Link
          to="/dashboard/vault"
          className="group bg-orbit-800 rounded-xl border border-orbit-700 p-6 hover:border-accent-500/50 transition-colors"
        >
          <h2 className="text-lg font-semibold text-orbit-50 group-hover:text-accent-300 transition-colors mb-1">
            Vault Browser
          </h2>
          <p className="text-orbit-400 text-sm">Browse your vault keys and public entries</p>
        </Link>
        <Link
          to="/dashboard/snapshots"
          className="group bg-orbit-800 rounded-xl border border-orbit-700 p-6 hover:border-accent-500/50 transition-colors"
        >
          <h2 className="text-lg font-semibold text-orbit-50 group-hover:text-accent-300 transition-colors mb-1">
            Snapshots
          </h2>
          <p className="text-orbit-400 text-sm">View and create vault archive snapshots</p>
        </Link>
      </div>
    </div>
  );
}

function OverviewCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="bg-orbit-800 rounded-xl border border-orbit-700 p-6">
      <p className="text-sm text-orbit-400 mb-1">{label}</p>
      <p className="text-3xl font-bold text-accent-300 mb-1">{value}</p>
      <p className="text-xs text-orbit-500">{description}</p>
    </div>
  );
}
