import { MockRegistry } from "@orbitmem/sdk/discovery";
import type { IDiscoveryService } from "./types.js";

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

  async rate(dataId: number, feedback: Record<string, unknown>): Promise<void> {
    this.registry.rateData(dataId, feedback as any);
  }

  async register(opts: {
    key: string;
    name: string;
    description: string;
    schema?: string;
    tags: string[];
  }): Promise<unknown> {
    return this.registry.registerData({
      key: opts.key,
      name: opts.name,
      description: opts.description,
      schema: opts.schema,
      tags: opts.tags as any,
    });
  }
}
