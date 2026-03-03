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
import { searchData } from "../../lib/api";

export const Route = createFileRoute("/metrics/")({
  component: MetricsPage,
});

// Mock time-series data for charts
const activityData = [
  { date: "Mon", entries: 12, feedback: 8 },
  { date: "Tue", entries: 19, feedback: 14 },
  { date: "Wed", entries: 15, feedback: 11 },
  { date: "Thu", entries: 22, feedback: 18 },
  { date: "Fri", entries: 28, feedback: 24 },
  { date: "Sat", entries: 16, feedback: 10 },
  { date: "Sun", entries: 20, feedback: 15 },
];

const qualityDistribution = [
  { range: "0-20", count: 2, color: "#ef4444" },
  { range: "21-40", count: 5, color: "#f97316" },
  { range: "41-60", count: 12, color: "#eab308" },
  { range: "61-80", count: 28, color: "#22c55e" },
  { range: "81-100", count: 18, color: "#10b981" },
];

const topTags = [
  { tag: "accurate", count: 142 },
  { tag: "complete", count: 98 },
  { tag: "fresh", count: 76 },
  { tag: "reliable", count: 64 },
  { tag: "verified", count: 51 },
];

function MetricsPage() {
  const { data: dataResult } = useQuery({
    queryKey: ["dataSearch", "dashboard"],
    queryFn: () => searchData(),
  });

  const totalData = dataResult?.count ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-orbit-50 mb-1">Metrics</h1>
        <p className="text-orbit-400 text-sm">Network-wide metrics and data quality overview</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label="Data Entries" value={String(totalData || "—")} />
        <MetricCard label="Feedback Submitted" value="—" />
        <MetricCard label="Avg Quality" value="—" />
        <MetricCard label="Active Vaults" value="—" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity chart */}
        <div className="bg-orbit-800 rounded-xl border border-orbit-700 p-6">
          <h2 className="text-sm font-medium text-orbit-300 mb-4">Weekly Activity</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={activityData}>
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
          <div className="flex items-center gap-6 mt-3 text-xs text-orbit-400">
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
        <div className="bg-orbit-800 rounded-xl border border-orbit-700 p-6">
          <h2 className="text-sm font-medium text-orbit-300 mb-4">Quality Score Distribution</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={qualityDistribution}>
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
                {qualityDistribution.map((entry) => (
                  <Cell key={entry.range} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top tags */}
        <div className="bg-orbit-800 rounded-xl border border-orbit-700 p-6">
          <h2 className="text-sm font-medium text-orbit-300 mb-4">Top Feedback Tags</h2>
          <div className="space-y-3">
            {topTags.map((t) => (
              <div key={t.tag} className="flex items-center gap-3">
                <span className="text-sm text-orbit-200 w-20 font-mono">{t.tag}</span>
                <div className="flex-1 h-2 bg-orbit-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent-500 rounded-full"
                    style={{ width: `${(t.count / topTags[0].count) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-orbit-400 w-8 text-right">{t.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div className="space-y-4">
          <Link
            to="/dashboard"
            className="group bg-orbit-800 rounded-xl border border-orbit-700 p-5 hover:border-accent-500/50 transition-colors block"
          >
            <h3 className="text-base font-semibold text-orbit-50 group-hover:text-accent-300 transition-colors mb-1">
              My Data
            </h3>
            <p className="text-orbit-400 text-sm">
              Connect your wallet to browse vault keys and entries
            </p>
          </Link>
          <Link
            to="/metrics/snapshots"
            className="group bg-orbit-800 rounded-xl border border-orbit-700 p-5 hover:border-accent-500/50 transition-colors block"
          >
            <h3 className="text-base font-semibold text-orbit-50 group-hover:text-accent-300 transition-colors mb-1">
              Snapshots
            </h3>
            <p className="text-orbit-400 text-sm">View and create vault archive snapshots</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-orbit-800 rounded-xl border border-orbit-700 p-5">
      <p className="text-xs text-orbit-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-accent-300">{value}</p>
    </div>
  );
}
