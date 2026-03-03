import type { Address } from "viem";
import type { DataRegistration, DiscoveryConfig, IDiscoveryLayer } from "../types.js";
import { MockRegistry } from "./mock-registry.js";
import { OnChainRegistry } from "./on-chain-registry.js";

export function createDiscoveryLayer(config: DiscoveryConfig): IDiscoveryLayer {
  if (config.publicClient && config.walletClient) {
    return createOnChainDiscoveryLayer(config);
  }
  return createMockDiscoveryLayer(config);
}

// ── On-Chain Implementation ──

function createOnChainDiscoveryLayer(config: DiscoveryConfig): IDiscoveryLayer {
  const registry = new OnChainRegistry({
    publicClient: config.publicClient!,
    walletClient: config.walletClient!,
    dataRegistry: config.dataRegistry as Address,
    feedbackRegistry: config.reputationRegistry as Address,
  });

  return {
    // ── Data Discovery ──

    async registerData(opts) {
      // On-chain: mint data NFT with URI containing metadata
      const dataURI = JSON.stringify({
        name: opts.name,
        description: opts.description,
        key: opts.key,
        schema: opts.schema,
        tags: opts.tags,
      });
      const dataId = await registry.registerData(dataURI);
      return {
        dataId,
        dataRegistry: config.dataRegistry,
        vaultAddress: "",
        vaultKey: opts.key,
        name: opts.name,
        description: opts.description,
        visibility: "public",
        schema: opts.schema,
        tags: opts.tags ?? [],
        active: true,
        owner: config.walletClient!.account!.address as any,
        ownerChain: "evm",
        lastUpdated: Date.now(),
        registeredAt: Date.now(),
      };
    },

    async updateDataRegistration(dataId, updates) {
      if (updates.active !== undefined) {
        await registry.setActive(config.dataRegistry as Address, dataId, updates.active);
      }
      // Re-fetch current state
      const allData = await registry.findData({});
      const match = allData.find((d) => d.dataId === dataId);
      if (!match) throw new Error(`Data registration ${dataId} not found`);
      return { ...match, ...updates, lastUpdated: Date.now() };
    },

    async findData(query) {
      return registry.findData({ activeOnly: query.verifiedOnly });
    },

    async getDataScore(_vaultAddress, _path) {
      // On-chain mode requires dataId lookup — return zero score for vault-based lookups
      return {
        dataId: 0,
        vaultAddress: _vaultAddress,
        vaultKey: _path,
        quality: 0,
        freshness: { lastUpdated: 0, score: 0 },
        accuracy: { score: 0, feedbackCount: 0 },
        completeness: { score: 0, feedbackCount: 0 },
        verified: false,
        consumptionCount: 0,
        totalFeedback: 0,
        tagScores: {},
      };
    },

    async getDataScoreById(dataId) {
      return registry.getDataScore(dataId);
    },

    async rateData(feedback) {
      return registry.rateData(
        feedback.dataId,
        feedback.value,
        feedback.valueDecimals ?? 0,
        feedback.tag1 ?? "",
        feedback.tag2 ?? "",
        feedback.feedbackURI ?? "",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      );
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

    createDataQualityCondition(opts) {
      return {
        conditionType: "evmContract",
        contractAddress: config.dataRegistry,
        standardContractType: "",
        chain: config.registryChain,
        method: "getScore",
        parameters: [":dataId"],
        returnValueTest: { comparator: ">=", value: String(opts.minQuality) },
      };
    },
  };
}

// ── Mock Implementation (unchanged) ──

function createMockDiscoveryLayer(config: DiscoveryConfig): IDiscoveryLayer {
  const registry = new MockRegistry();
  let txCounter = 0;

  return {
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
