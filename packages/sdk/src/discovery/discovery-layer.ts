import type { DataRegistration, DiscoveryConfig, IDiscoveryLayer } from "../types.js";
import { MockRegistry } from "./mock-registry.js";

export function createDiscoveryLayer(config: DiscoveryConfig): IDiscoveryLayer {
  const registry = new MockRegistry();
  let txCounter = 0;

  return {
    // ── Agent Discovery ──

    async findAgents(query) {
      return registry.findAgents({
        keyword: query.keyword,
        minReputation: query.minReputation,
        activeOnly: query.activeOnly,
      });
    },

    async getAgent(agentId) {
      return registry.getAgent(agentId);
    },

    async getAgentReputation(agentId) {
      return registry.getAgentReputation(agentId);
    },

    async rateAgent(feedback) {
      registry.rateAgent(feedback.agentId, {
        clientAddress: "0x0" as any,
        value: feedback.value,
        valueDecimals: feedback.valueDecimals ?? 0,
        tag1: feedback.tag1,
        tag2: feedback.tag2,
        endpoint: feedback.endpoint,
        feedbackURI: feedback.feedbackURI,
        isRevoked: false,
      });
      txCounter++;
      return { txHash: `0xmock_tx_${txCounter}`, feedbackIndex: txCounter };
    },

    // ── Data Discovery ──

    async registerData(opts) {
      return registry.registerData({
        key: opts.key,
        name: opts.name,
        description: opts.description,
        schema: opts.schema,
        tags: opts.tags,
      });
    },

    async updateDataRegistration(dataId, updates) {
      // Mock: just return the existing registration with updates
      const existing = Array.from((registry as any).data.values()).find(
        (d: any) => d.dataId === dataId,
      ) as DataRegistration | undefined;
      if (!existing) throw new Error(`Data registration ${dataId} not found`);
      Object.assign(existing, updates, { lastUpdated: Date.now() });
      return existing;
    },

    async findData(query) {
      return registry.findData({
        schema: query.schema,
        tags: query.tags,
        minQuality: query.minQuality,
        verifiedOnly: query.verifiedOnly,
      });
    },

    async getDataScore(vaultAddress, path) {
      // Find data registration by vault address + path
      const allData = registry.findData({});
      const match = allData.find((d) => d.vaultAddress === vaultAddress && d.vaultKey === path);
      if (!match) {
        return {
          dataId: 0,
          vaultAddress,
          vaultKey: path,
          quality: 0,
          freshness: { lastUpdated: 0, score: 0 },
          accuracy: { score: 0, feedbackCount: 0 },
          completeness: { score: 0, feedbackCount: 0 },
          verified: false,
          consumptionCount: 0,
          totalFeedback: 0,
          tagScores: {},
        };
      }
      return registry.getDataScore(match.dataId);
    },

    async getDataScoreById(dataId) {
      return registry.getDataScore(dataId);
    },

    async rateData(feedback) {
      registry.rateData(feedback.dataId, {
        clientAddress: "0x0" as any,
        value: feedback.value,
        valueDecimals: feedback.valueDecimals ?? 0,
        tag1: feedback.tag1,
        tag2: feedback.tag2,
        feedbackURI: feedback.feedbackURI,
        isRevoked: false,
        vaultKey: "",
        qualityDimension: feedback.qualityDimension,
      });
      txCounter++;
      return { txHash: `0xmock_tx_${txCounter}`, feedbackIndex: txCounter };
    },

    // ── Validation ──

    async requestValidation(request) {
      return {
        agentId: request.agentId,
        taskId: request.taskId,
        method: request.method,
        status: "pending" as const,
      };
    },

    async getValidationStatus(_agentId, _taskId) {
      return null;
    },

    // ── Lit Protocol Integration ──

    createAgentReputationCondition(opts) {
      return {
        conditionType: "evmContract",
        contractAddress: config.reputationRegistry,
        standardContractType: "",
        chain: config.registryChain,
        method: "getScore",
        parameters: [":userAddress"],
        returnValueTest: { comparator: ">=", value: String(opts.minScore) },
      };
    },

    createDataQualityCondition(opts) {
      return {
        conditionType: "evmContract",
        contractAddress: config.dataRegistry,
        standardContractType: "",
        chain: config.registryChain,
        method: "getQualityScore",
        parameters: [":dataId"],
        returnValueTest: { comparator: ">=", value: String(opts.minQuality) },
      };
    },
  };
}
