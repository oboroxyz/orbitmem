# Web Metrics Real Data — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hardcoded mock data in the `/metrics` page with a real `GET /v1/data/stats` relay endpoint backed by `IDiscoveryService`, with 60-second TTL cache.

**Architecture:** Add `DataStats` type and `getStats()` to `IDiscoveryService`. Implement in `MockDiscoveryService` (iterate registrations + feedback) and `LiveDiscoveryService` (same logic — real chain aggregation deferred). Add route with in-memory TTL cache. Web fetches the single endpoint via react-query.

**Tech Stack:** TypeScript, Hono, React, TanStack Query, Recharts, `bun:test`

---

### Task 1: Add `DataStats` type and `getStats()` to service interface

**Files:**
- Modify: `packages/relay/src/services/types.ts`

**Step 1: Add types and extend interface**

In `packages/relay/src/services/types.ts`, add `DataStats` before `IDiscoveryService` and add `getStats()` to the interface.

Before the `IDiscoveryService` interface (line 31), add:

```typescript
export interface DataStats {
  totalEntries: number;
  totalFeedback: number;
  avgQuality: number;
  qualityDistribution: { range: string; count: number }[];
  topTags: { tag: string; count: number }[];
  activity: { date: string; entries: number; feedback: number }[];
}
```

Inside `IDiscoveryService`, after the `register(...)` method, add:

```typescript
  getStats(): Promise<DataStats>;
```

**Step 2: Run typecheck to see expected failures**

Run: `bun run typecheck`
Expected: FAIL — `MockDiscoveryService` and `LiveDiscoveryService` don't implement `getStats()`

**Step 3: Commit**

```bash
git add packages/relay/src/services/types.ts
git commit -m "feat(relay): add DataStats type and getStats to IDiscoveryService"
```

---

### Task 2: Implement `getStats()` in MockDiscoveryService

**Files:**
- Modify: `packages/relay/src/services/mock-discovery.ts`
- Depends on: `MockRegistry` in `packages/sdk/src/discovery/mock-registry.ts` — we need access to internal data/feedback maps

**Step 1: Implement getStats in MockDiscoveryService**

The `MockRegistry` doesn't expose aggregate methods, so `MockDiscoveryService.getStats()` will call existing `search()` and `getScore()` to compute aggregates.

Add to `packages/relay/src/services/mock-discovery.ts`, after the `register` method:

```typescript
  async getStats(): Promise<DataStats> {
    const allData = await this.search({});
    const scores = await Promise.all(
      (allData as any[]).map((d) => this.getScore(d.dataId)),
    );

    const totalEntries = allData.length;
    const totalFeedback = (scores as any[]).reduce((sum, s) => sum + s.totalFeedback, 0);
    const avgQuality =
      totalEntries > 0
        ? Math.round((scores as any[]).reduce((sum, s) => sum + s.quality, 0) / totalEntries)
        : 0;

    // Quality distribution buckets
    const buckets = [
      { range: "0-20", min: 0, max: 20, count: 0 },
      { range: "21-40", min: 21, max: 40, count: 0 },
      { range: "41-60", min: 41, max: 60, count: 0 },
      { range: "61-80", min: 61, max: 80, count: 0 },
      { range: "81-100", min: 81, max: 100, count: 0 },
    ];
    for (const s of scores as any[]) {
      const q = s.quality;
      const bucket = buckets.find((b) => q >= b.min && q <= b.max);
      if (bucket) bucket.count++;
    }
    const qualityDistribution = buckets.map(({ range, count }) => ({ range, count }));

    // Top tags — aggregate from all data entries
    const tagCounts = new Map<string, number>();
    for (const d of allData as any[]) {
      for (const tag of d.tags ?? []) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
    const topTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Activity — group entries by date (last 7 days)
    const now = Date.now();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now - (6 - i) * 86400000);
      return d.toLocaleDateString("en-US", { weekday: "short" });
    });
    const activityMap = new Map(days.map((d) => [d, { entries: 0, feedback: 0 }]));
    for (const d of allData as any[]) {
      const day = new Date(d.registeredAt).toLocaleDateString("en-US", { weekday: "short" });
      const entry = activityMap.get(day);
      if (entry) entry.entries++;
    }
    const activity = days.map((date) => ({
      date,
      entries: activityMap.get(date)?.entries ?? 0,
      feedback: activityMap.get(date)?.feedback ?? 0,
    }));

    return { totalEntries, totalFeedback, avgQuality, qualityDistribution, topTags, activity };
  }
```

Add the `DataStats` import at the top:
```typescript
import type { DataStats, IDiscoveryService } from "./types.js";
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: Still fails (LiveDiscoveryService missing `getStats`)

**Step 3: Commit**

```bash
git add packages/relay/src/services/mock-discovery.ts
git commit -m "feat(relay): implement getStats in MockDiscoveryService"
```

---

### Task 3: Implement `getStats()` in LiveDiscoveryService

**Files:**
- Modify: `packages/relay/src/services/live-discovery.ts`

**Step 1: Implement getStats**

`LiveDiscoveryService.getStats()` uses the same approach — calls `search()` + `getScore()` on each entry. Add after the `register` method:

```typescript
  async getStats(): Promise<DataStats> {
    const allData = await this.search({});
    const scores = await Promise.all(
      (allData as any[]).map((d) => this.getScore(d.dataId)),
    );

    const totalEntries = allData.length;
    const totalFeedback = (scores as any[]).reduce((sum, s) => sum + (s as any).totalFeedback, 0);
    const avgQuality =
      totalEntries > 0
        ? Math.round(
            (scores as any[]).reduce((sum, s) => sum + (s as any).quality, 0) / totalEntries,
          )
        : 0;

    const buckets = [
      { range: "0-20", min: 0, max: 20, count: 0 },
      { range: "21-40", min: 21, max: 40, count: 0 },
      { range: "41-60", min: 41, max: 60, count: 0 },
      { range: "61-80", min: 61, max: 80, count: 0 },
      { range: "81-100", min: 81, max: 100, count: 0 },
    ];
    for (const s of scores as any[]) {
      const q = (s as any).quality;
      const bucket = buckets.find((b) => q >= b.min && q <= b.max);
      if (bucket) bucket.count++;
    }
    const qualityDistribution = buckets.map(({ range, count }) => ({ range, count }));

    const tagCounts = new Map<string, number>();
    for (const d of allData as any[]) {
      for (const tag of d.tags ?? []) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
    const topTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const now = Date.now();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now - (6 - i) * 86400000);
      return d.toLocaleDateString("en-US", { weekday: "short" });
    });
    const activityMap = new Map(days.map((d) => [d, { entries: 0, feedback: 0 }]));
    for (const d of allData as any[]) {
      const day = new Date(d.registeredAt ?? Date.now()).toLocaleDateString("en-US", {
        weekday: "short",
      });
      const entry = activityMap.get(day);
      if (entry) entry.entries++;
    }
    const activity = days.map((date) => ({
      date,
      entries: activityMap.get(date)?.entries ?? 0,
      feedback: activityMap.get(date)?.feedback ?? 0,
    }));

    return { totalEntries, totalFeedback, avgQuality, qualityDistribution, topTags, activity };
  }
```

Add the `DataStats` import:
```typescript
import type { DataStats, IDiscoveryService } from "./types.js";
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS — both services now implement `getStats()`

**Step 3: Commit**

```bash
git add packages/relay/src/services/live-discovery.ts
git commit -m "feat(relay): implement getStats in LiveDiscoveryService"
```

---

### Task 4: Add `GET /data/stats` route with TTL cache + test

**Files:**
- Modify: `packages/relay/src/routes/data.ts`
- Modify: `packages/relay/src/__tests__/data.test.ts`

**Step 1: Write the failing test**

Add to `packages/relay/src/__tests__/data.test.ts`, after the existing `beforeAll` block's data registration and feedback submission:

```typescript
  test("GET /v1/data/stats returns aggregate metrics", async () => {
    const res = await app.request("/v1/data/stats");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.totalEntries).toBeGreaterThanOrEqual(1);
    expect(typeof body.totalFeedback).toBe("number");
    expect(typeof body.avgQuality).toBe("number");
    expect(body.qualityDistribution).toBeArray();
    expect(body.qualityDistribution).toHaveLength(5);
    expect(body.topTags).toBeArray();
    expect(body.activity).toBeArray();
    expect(body.activity).toHaveLength(7);
  });
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/relay/src/__tests__/data.test.ts`
Expected: FAIL — 404 (route doesn't exist)

**Step 3: Add the stats route with TTL cache**

In `packages/relay/src/routes/data.ts`, add at the top of `createDataRoutes`, before the existing routes:

```typescript
  // Stats cache (60s TTL)
  let statsCache: { data: unknown; expiry: number } | null = null;

  routes.get("/data/stats", async (c) => {
    const now = Date.now();
    if (statsCache && statsCache.expiry > now) {
      return c.json(statsCache.data);
    }
    const stats = await discovery.getStats();
    statsCache = { data: stats, expiry: now + 60_000 };
    return c.json(stats);
  });
```

**Step 4: Run tests**

Run: `bun test packages/relay/src/__tests__/data.test.ts`
Expected: ALL tests PASS

**Step 5: Commit**

```bash
git add packages/relay/src/routes/data.ts packages/relay/src/__tests__/data.test.ts
git commit -m "feat(relay): add GET /data/stats endpoint with 60s TTL cache"
```

---

### Task 5: Add `getDataStats()` to web API client

**Files:**
- Modify: `apps/web/app/lib/api.ts`

**Step 1: Add the function**

At the end of the "Data Registry" section in `apps/web/app/lib/api.ts` (after `getDataScore`), add:

```typescript
export interface DataStats {
  totalEntries: number;
  totalFeedback: number;
  avgQuality: number;
  qualityDistribution: { range: string; count: number }[];
  topTags: { tag: string; count: number }[];
  activity: { date: string; entries: number; feedback: number }[];
}

export function getDataStats() {
  return fetchJSON<DataStats>("/data/stats");
}
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/app/lib/api.ts
git commit -m "feat(web): add getDataStats API function"
```

---

### Task 6: Replace hardcoded metrics with real API data

**Files:**
- Modify: `apps/web/app/routes/metrics/index.tsx`

**Step 1: Replace the entire metrics page**

Replace the contents of `apps/web/app/routes/metrics/index.tsx` with:

```tsx
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
        <h1 className="text-2xl font-bold text-orbit-50 mb-1">Metrics</h1>
        <p className="text-orbit-400 text-sm">Network-wide metrics and data quality overview</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label="Data Entries" value={isLoading ? "—" : String(stats?.totalEntries ?? 0)} />
        <MetricCard label="Feedback Submitted" value={isLoading ? "—" : String(stats?.totalFeedback ?? 0)} />
        <MetricCard label="Avg Quality" value={isLoading ? "—" : String(stats?.avgQuality ?? 0)} />
        <MetricCard label="Active Vaults" value="—" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity chart */}
        <div className="bg-orbit-800 rounded-xl border border-orbit-700 p-6">
          <h2 className="text-sm font-medium text-orbit-300 mb-4">Weekly Activity</h2>
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
        <div className="bg-orbit-800 rounded-xl border border-orbit-700 p-6">
          <h2 className="text-sm font-medium text-orbit-300 mb-4">Top Feedback Tags</h2>
          {(stats?.topTags?.length ?? 0) > 0 ? (
            <div className="space-y-3">
              {stats!.topTags.map((t) => (
                <div key={t.tag} className="flex items-center gap-3">
                  <span className="text-sm text-orbit-200 w-20 font-mono">{t.tag}</span>
                  <div className="flex-1 h-2 bg-orbit-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-500 rounded-full"
                      style={{ width: `${(t.count / stats!.topTags[0].count) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-orbit-400 w-8 text-right">{t.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-orbit-500 text-sm">No feedback tags yet</p>
          )}
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
```

Key changes from original:
- Removed 3 hardcoded const arrays (`activityData`, `qualityDistribution`, `topTags`)
- Removed `searchData` import, added `getDataStats` import
- Single `useQuery` to `getDataStats` with 60s refetch
- Metric cards show real `totalFeedback`, `avgQuality` (not "—")
- Charts use `stats?.activity`, `stats?.qualityDistribution`, `stats?.topTags`
- Empty state for top tags when no data
- `QUALITY_COLORS` map replaces inline colors

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Run lint**

Run: `bun run lint`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/app/routes/metrics/index.tsx
git commit -m "feat(web): replace hardcoded metrics with real API data"
```

---

### Task 7: Final verification

**Step 1: Run relay tests**

Run: `bun test packages/relay`
Expected: ALL pass

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Run lint**

Run: `bun run lint`
Expected: PASS
