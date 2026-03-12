import { MockRegistry } from "@orbitmem/sdk/discovery";
import type { DataStats, IDiscoveryService, UserStats } from "./types.js";

export class MockDiscoveryService implements IDiscoveryService {
  private registry = new MockRegistry();

  async search(query: {
    schema?: string;
    tags?: string[];
    verifiedOnly?: boolean;
    minQuality?: number;
  }): Promise<unknown[]> {
    return this.registry.findData({
      schema: query.schema,
      tags: query.tags?.length ? (query.tags as any) : undefined,
      verifiedOnly: query.verifiedOnly || undefined,
      minQuality: query.minQuality,
    });
  }

  async getScore(dataId: number): Promise<unknown> {
    return this.registry.getDataScore(dataId);
  }

  async getStats(): Promise<DataStats> {
    const allData = await this.search({});
    const scores = await Promise.all((allData as any[]).map((d) => this.getScore(d.dataId)));

    const totalEntries = allData.length;
    const totalFeedback = (scores as any[]).reduce((sum, s) => sum + s.totalFeedback, 0);
    const avgQuality =
      totalEntries > 0
        ? Math.round((scores as any[]).reduce((sum, s) => sum + s.quality, 0) / totalEntries)
        : 0;

    const buckets = [
      { range: "0-20", min: 0, max: 20, count: 0 },
      { range: "21-40", min: 21, max: 40, count: 0 },
      { range: "41-60", min: 41, max: 60, count: 0 },
      { range: "61-80", min: 61, max: 80, count: 0 },
      { range: "81-100", min: 81, max: 100, count: 0 },
    ];
    for (const s of scores as any[]) {
      const bucket = buckets.find((b) => s.quality >= b.min && s.quality <= b.max);
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

  async getUserStats(signer: string): Promise<UserStats> {
    const feedback = this.registry.getUserFeedback(signer);
    const feedbackSubmitted = feedback.length;
    const avgRatingGiven =
      feedbackSubmitted > 0
        ? Math.round(feedback.reduce((sum, f) => sum + f.entry.value, 0) / feedbackSubmitted)
        : 0;
    const dataEntriesRated = new Set(feedback.map((f) => f.dataId)).size;

    const tagCounts = new Map<string, number>();
    for (const { entry } of feedback) {
      if (entry.tag1) tagCounts.set(entry.tag1, (tagCounts.get(entry.tag1) ?? 0) + 1);
      if (entry.tag2) tagCounts.set(entry.tag2, (tagCounts.get(entry.tag2) ?? 0) + 1);
    }
    const topTagsUsed = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { feedbackSubmitted, avgRatingGiven, dataEntriesRated, topTagsUsed };
  }
}
