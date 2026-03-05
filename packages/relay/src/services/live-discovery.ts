import { DataRegistryAbi } from "@orbitmem/contracts";
import { OnChainRegistry, type OnChainRegistryConfig } from "@orbitmem/sdk/discovery";
import type { DataStats, IDiscoveryService, UserStats } from "./types.js";

export class LiveDiscoveryService implements IDiscoveryService {
  private registry: OnChainRegistry;
  private config: OnChainRegistryConfig;

  constructor(config: OnChainRegistryConfig) {
    this.config = config;
    this.registry = new OnChainRegistry(config);
  }

  async search(query: {
    schema?: string;
    tags?: string[];
    verifiedOnly?: boolean;
    minQuality?: number;
  }): Promise<unknown[]> {
    const results = await this.registry.findData({ activeOnly: query.verifiedOnly });

    // Enrich each entry with tokenURI metadata
    const enriched = await Promise.all(
      results.map(async (entry) => {
        try {
          const uri = (await this.config.publicClient.readContract({
            address: this.config.dataRegistry,
            abi: DataRegistryAbi,
            functionName: "tokenURI",
            args: [BigInt(entry.dataId)],
          })) as string;
          const meta = JSON.parse(uri);
          return { ...entry, ...meta };
        } catch {
          return entry;
        }
      }),
    );

    // Client-side filtering by schema / tags
    return enriched.filter((entry: any) => {
      if (query.schema && entry.schema !== query.schema) return false;
      if (query.tags?.length && !query.tags.some((t: string) => entry.tags?.includes(t)))
        return false;
      return true;
    });
  }

  async getScore(dataId: number): Promise<unknown> {
    return this.registry.getDataScore(dataId);
  }

  async rate(dataId: number, feedback: Record<string, unknown>): Promise<void> {
    await this.registry.rateData(
      dataId,
      (feedback.value as number) ?? 0,
      (feedback.valueDecimals as number) ?? 0,
      (feedback.tag1 as string) ?? "",
      (feedback.tag2 as string) ?? "",
      (feedback.feedbackURI as string) ?? "",
      (feedback.feedbackHash as `0x${string}`) ??
        "0x0000000000000000000000000000000000000000000000000000000000000000",
    );
  }

  async register(opts: {
    key: string;
    name: string;
    description: string;
    schema?: string;
    tags: string[];
  }): Promise<unknown> {
    const dataURI = JSON.stringify({
      name: opts.name,
      description: opts.description,
      key: opts.key,
      schema: opts.schema,
      tags: opts.tags,
    });
    const dataId = await this.registry.registerData(dataURI);
    return {
      dataId,
      dataRegistry: this.config.dataRegistry,
      ...opts,
      active: true,
      registeredAt: Date.now(),
    };
  }

  async getStats(): Promise<DataStats> {
    const allData = await this.search({});
    const scores = await Promise.all((allData as any[]).map((d) => this.getScore(d.dataId)));

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
      const bucket = buckets.find(
        (b) => (s as any).quality >= b.min && (s as any).quality <= b.max,
      );
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

  async getUserStats(_signer: string): Promise<UserStats> {
    // On-chain per-signer feedback query deferred — return empty stats
    return { feedbackSubmitted: 0, avgRatingGiven: 0, dataEntriesRated: 0, topTagsUsed: [] };
  }
}
