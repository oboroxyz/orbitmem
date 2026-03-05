# Web Metrics Real Data

**Date:** 2026-03-04
**Status:** Approved

## Problem

The `/metrics` page has 3 hardcoded mock datasets (activity, quality distribution, top tags) and 3 empty metric cards ("Feedback Submitted", "Avg Quality", "Active Vaults" show "—"). No relay endpoint provides aggregate data.

## Goal

Replace all hardcoded mock data with real API calls. Add a `GET /v1/data/stats` relay endpoint with TTL cache that computes aggregates from `IDiscoveryService`.

## Design

### New relay endpoint: `GET /data/stats`

Returns:
```typescript
interface DataStats {
  totalEntries: number;
  totalFeedback: number;
  avgQuality: number;
  qualityDistribution: { range: string; count: number }[];
  topTags: { tag: string; count: number }[];
  activity: { date: string; entries: number; feedback: number }[];
}
```

- Public (no auth required)
- TTL-based in-memory cache (60s) in route handler
- 5 quality buckets: 0-20, 21-40, 41-60, 61-80, 81-100
- Top 10 tags by feedback count
- Last 7 days activity

### Service changes

Add `getStats(): Promise<DataStats>` to `IDiscoveryService`. MockDiscoveryService iterates all registrations + feedback. LiveDiscoveryService delegates to same logic (real on-chain aggregation is a future concern).

### Web changes

- `api.ts`: add `getDataStats()` function
- `metrics/index.tsx`: replace all hardcoded data with `useQuery` to `/data/stats`

## Files Changed

1. `packages/relay/src/services/types.ts` — add `DataStats`, extend `IDiscoveryService`
2. `packages/relay/src/services/mock-discovery.ts` — implement `getStats()`
3. `packages/relay/src/services/live-discovery.ts` — implement `getStats()`
4. `packages/relay/src/routes/data.ts` — add `GET /data/stats` with TTL cache
5. `packages/relay/src/__tests__/data.test.ts` — test stats endpoint
6. `apps/web/app/lib/api.ts` — add `getDataStats()`
7. `apps/web/app/routes/metrics/index.tsx` — replace hardcoded data with API call
