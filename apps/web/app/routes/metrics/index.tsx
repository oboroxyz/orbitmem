import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getDataStats } from "../../lib/api";

export const Route = createFileRoute("/metrics/")({
  component: MetricsPage,
});

const QUALITY_COLORS: Record<string, string> = {
  "0-20": "#ef4444",
  "21-40": "#f97316",
  "41-60": "#eab308",
  "61-80": "#22c55e",
  "81-100": "#10b981",
};

function MetricsPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dataStats"],
    queryFn: getDataStats,
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Metrics</h1>
        <p className="text-sm">Network-wide metrics and data quality overview</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          label="Data Entries"
          value={isLoading ? "—" : String(stats?.totalEntries ?? 0)}
        />
        <MetricCard
          label="Feedback Submitted"
          value={isLoading ? "—" : String(stats?.totalFeedback ?? 0)}
        />
        <MetricCard label="Avg Quality" value={isLoading ? "—" : String(stats?.avgQuality ?? 0)} />
        <MetricCard label="Active Vaults" value="—" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity chart */}
        <div className="bg-amber-50/10 rounded-xl p-6">
          <h2 className="text-sm font-medium mb-4">Weekly Activity</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats?.activity ?? []}>
              <defs>
                <linearGradient id="entryGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="feedbackGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={false} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  color: "#f3f4f6",
                  fontSize: "12px",
                }}
              />
              <Area
                type="monotone"
                dataKey="entries"
                stroke="#8b5cf6"
                fill="url(#entryGrad)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="feedback"
                stroke="#14b8a6"
                fill="url(#feedbackGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-6 mt-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6]" />
              New entries
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#14b8a6]" />
              Feedback
            </span>
          </div>
        </div>

        {/* Quality distribution */}
        <div className="bg-amber-50/10 rounded-xl p-6">
          <h2 className="text-sm font-medium mb-4">Quality Score Distribution</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats?.qualityDistribution ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="range" tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={false} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  color: "#f3f4f6",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {(stats?.qualityDistribution ?? []).map((entry) => (
                  <Cell key={entry.range} fill={QUALITY_COLORS[entry.range] ?? "#6b7280"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top tags */}
        <div className="bg-amber-50/10 rounded-xl p-6">
          <h2 className="text-sm font-medium  mb-4">Top Feedback Tags</h2>
          {(stats?.topTags?.length ?? 0) > 0 ? (
            <div className="space-y-3">
              {stats!.topTags.map((t) => (
                <div key={t.tag} className="flex items-center gap-3">
                  <span className="text-sm  w-20 font-mono">{t.tag}</span>
                  <div className="flex-1 h-2 bg-amber-50/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-600 rounded-full"
                      style={{ width: `${(t.count / stats!.topTags[0].count) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-blue-400 w-8 text-right">{t.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-blue-600 text-sm">No feedback tags yet</p>
          )}
        </div>

        {/* Quick links */}
        <div className="space-y-4">
          <Link
            to="/dashboard"
            className="group rounded-xl bg-amber-50/10 p-5  transition-colors block"
          >
            <h3 className="text-base font-semibold text-amber-50  transition-colors mb-1">
              My Data
            </h3>
            <p className="text-sm">Connect your wallet to browse vault keys and entries</p>
          </Link>
          <Link to="/metrics/snapshots" className="group rounded-xl bg-amber-50/10 p-5 block">
            <h3 className="text-base font-semibold text-amber-50  transition-colors mb-1">
              Snapshots
            </h3>
            <p className="text-sm">View and create vault archive snapshots</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-amber-50/10 p-5">
      <p className="text-xs text-amber-50 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
