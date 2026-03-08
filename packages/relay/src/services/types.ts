export interface VaultEntry {
  value: unknown;
  visibility: string;
}

export interface IVaultService {
  getPublicKeys(address: string, prefix?: string): Promise<string[]>;
  getPublic(address: string, key: string): Promise<VaultEntry | null>;
  getEncrypted(vaultAddress: string, path: string): Promise<VaultEntry | null>;
  seed(
    address: string,
    entries: { key: string; value: unknown; visibility: string }[],
  ): Promise<number>;
  sync(address: string): Promise<{ status: string; timestamp: number }>;
}

export interface SnapshotMeta {
  cid: string;
  size: number;
  archivedAt: number;
  signer: string;
  entryCount: number;
  encrypted: boolean;
}

export interface ISnapshotService {
  list(signer: string): Promise<SnapshotMeta[]>;
  archive(signer: string, data?: string, entryCount?: number): Promise<SnapshotMeta>;
}

export interface DataStats {
  totalEntries: number;
  totalFeedback: number;
  avgQuality: number;
  qualityDistribution: { range: string; count: number }[];
  topTags: { tag: string; count: number }[];
  activity: { date: string; entries: number; feedback: number }[];
}

export interface UserStats {
  feedbackSubmitted: number;
  avgRatingGiven: number;
  dataEntriesRated: number;
  topTagsUsed: { tag: string; count: number }[];
}

export interface IDiscoveryService {
  search(query: {
    schema?: string;
    tags?: string[];
    verifiedOnly?: boolean;
    minQuality?: number;
  }): Promise<unknown[]>;
  getScore(dataId: number): Promise<unknown>;
  rate(dataId: number, feedback: Record<string, unknown>): Promise<void>;
  register(opts: {
    key: string;
    name: string;
    description: string;
    schema?: string;
    tags: string[];
  }): Promise<unknown>;
  getStats(): Promise<DataStats>;
  getUserStats(signer: string): Promise<UserStats>;
}

export interface PlanInfo {
  tier: "free" | "starter" | "pro" | "enterprise";
  storageLimit: number;
  used: number;
}

export interface IPlanService {
  getPlan(signer: string): Promise<PlanInfo>;
  addUsage(signer: string, bytes: number): Promise<void>;
  removeUsage(signer: string, bytes: number): Promise<void>;
  getUsage(signer: string): Promise<{ used: number; limit: number; tier: string }>;
  setPlan(signer: string, tier: PlanInfo["tier"]): Promise<void>;
}

export interface RelayServices {
  vault: IVaultService;
  snapshot: ISnapshotService;
  discovery: IDiscoveryService;
  plan: IPlanService;
}
