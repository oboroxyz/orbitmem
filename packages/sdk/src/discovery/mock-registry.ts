import type {
  AgentRegistration,
  AgentReputation,
  DataRegistration,
  DataScore,
  DataFeedbackEntry,
  FeedbackEntry,
  WalletAddress,
  Visibility,
  DataTag,
} from '../types.js';

export class MockRegistry {
  private agents = new Map<number, AgentRegistration>();
  private agentFeedback = new Map<number, FeedbackEntry[]>();
  private data = new Map<number, DataRegistration>();
  private dataFeedback = new Map<number, DataFeedbackEntry[]>();
  private nextAgentId = 1;
  private nextDataId = 1;

  registerAgent(agent: Omit<AgentRegistration, 'agentId'>): AgentRegistration {
    const agentId = this.nextAgentId++;
    const reg = { ...agent, agentId } as AgentRegistration;
    this.agents.set(agentId, reg);
    return reg;
  }

  findAgents(query: { keyword?: string; minReputation?: number; activeOnly?: boolean }): AgentRegistration[] {
    let results = Array.from(this.agents.values());
    if (query.activeOnly) results = results.filter(a => a.active);
    if (query.keyword) {
      const kw = query.keyword.toLowerCase();
      results = results.filter(a => a.name.toLowerCase().includes(kw) || a.description.toLowerCase().includes(kw));
    }
    return results;
  }

  getAgent(agentId: number): AgentRegistration | null {
    return this.agents.get(agentId) ?? null;
  }

  rateAgent(agentId: number, feedback: FeedbackEntry): void {
    const existing = this.agentFeedback.get(agentId) ?? [];
    existing.push(feedback);
    this.agentFeedback.set(agentId, existing);
  }

  getAgentReputation(agentId: number): AgentReputation {
    const feedback = this.agentFeedback.get(agentId) ?? [];
    const total = feedback.reduce((sum, f) => sum + f.value, 0);
    const score = feedback.length > 0 ? Math.round(total / feedback.length) : 0;
    return {
      agentId,
      score,
      feedbackCount: feedback.length,
      tagScores: {},
      validationCount: 0,
      validationTypes: [],
    };
  }

  registerData(opts: {
    key: string;
    name: string;
    description: string;
    schema?: string;
    tags: DataTag[];
    owner?: WalletAddress;
    ownerChain?: any;
    vaultAddress?: string;
    visibility?: Visibility;
  }): DataRegistration {
    const dataId = this.nextDataId++;
    const reg: DataRegistration = {
      dataId,
      dataRegistry: 'mock:0:0xDATA_REG',
      vaultAddress: opts.vaultAddress ?? '',
      vaultKey: opts.key,
      name: opts.name,
      description: opts.description,
      visibility: opts.visibility ?? 'public',
      schema: opts.schema,
      tags: opts.tags,
      active: true,
      owner: opts.owner ?? ('0x0' as WalletAddress),
      ownerChain: opts.ownerChain ?? 'evm',
      lastUpdated: Date.now(),
      registeredAt: Date.now(),
    };
    this.data.set(dataId, reg);
    return reg;
  }

  findData(query: { schema?: string; tags?: DataTag[]; minQuality?: number; verifiedOnly?: boolean }): DataRegistration[] {
    let results = Array.from(this.data.values()).filter(d => d.active);
    if (query.schema) results = results.filter(d => d.schema === query.schema);
    if (query.tags?.length) results = results.filter(d => query.tags!.some(t => d.tags.includes(t)));
    if (query.verifiedOnly) results = results.filter(d => d.tags.includes('verified'));
    return results;
  }

  rateData(dataId: number, feedback: DataFeedbackEntry): void {
    const existing = this.dataFeedback.get(dataId) ?? [];
    existing.push(feedback);
    this.dataFeedback.set(dataId, existing);
  }

  getDataScore(dataId: number): DataScore {
    const reg = this.data.get(dataId);
    const feedback = this.dataFeedback.get(dataId) ?? [];
    const total = feedback.reduce((sum, f) => sum + f.value, 0);
    const quality = feedback.length > 0 ? Math.round(total / feedback.length) : 0;
    return {
      dataId,
      vaultAddress: reg?.vaultAddress ?? '',
      vaultKey: reg?.vaultKey ?? '',
      quality,
      freshness: { lastUpdated: reg?.lastUpdated ?? 0, score: 100 },
      accuracy: { score: quality, feedbackCount: feedback.length },
      completeness: { score: quality, feedbackCount: feedback.length },
      verified: reg?.tags.includes('verified') ?? false,
      consumptionCount: feedback.length,
      totalFeedback: feedback.length,
      tagScores: {},
    };
  }
}
