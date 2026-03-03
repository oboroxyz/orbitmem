import { DataRegistryAbi } from "@orbitmem/contracts";
import { OnChainRegistry, type OnChainRegistryConfig } from "@orbitmem/sdk/discovery";
import type { IDiscoveryService } from "./types.js";

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
}
