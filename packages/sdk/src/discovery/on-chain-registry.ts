import { AgentRegistryAbi, DataRegistryAbi, FeedbackRegistryAbi } from "@orbitmem/contracts";
import type { Address, Log, PublicClient, WalletClient } from "viem";
import { parseEventLogs } from "viem";
import type {
  AgentRegistration,
  AgentReputation,
  DataRegistration,
  DataScore,
  EvmAddress,
  WalletAddress,
} from "../types.js";

export interface OnChainRegistryConfig {
  publicClient: PublicClient;
  walletClient: WalletClient;
  agentRegistry: Address;
  dataRegistry: Address;
  feedbackRegistry: Address;
}

export class OnChainRegistry {
  private pub: PublicClient;
  private wallet: WalletClient;
  private agentReg: Address;
  private dataReg: Address;
  private feedbackReg: Address;

  constructor(config: OnChainRegistryConfig) {
    this.pub = config.publicClient;
    this.wallet = config.walletClient;
    this.agentReg = config.agentRegistry;
    this.dataReg = config.dataRegistry;
    this.feedbackReg = config.feedbackRegistry;
  }

  // ── Agent Registry ──

  async registerAgent(agentURI: string): Promise<number> {
    const hash = await this.wallet.writeContract({
      address: this.agentReg,
      abi: AgentRegistryAbi,
      functionName: "register",
      args: [agentURI],
      chain: this.wallet.chain,
      account: this.wallet.account!,
    });
    const receipt = await this.pub.waitForTransactionReceipt({ hash });
    const logs = parseEventLogs({
      abi: AgentRegistryAbi,
      logs: receipt.logs as Log[],
      eventName: "AgentRegistered",
    });
    return Number(logs[0].args.agentId);
  }

  async getAgent(agentId: number): Promise<AgentRegistration | null> {
    try {
      const [owner, _tokenURI, active, agentWallet] = await Promise.all([
        this.pub.readContract({
          address: this.agentReg,
          abi: AgentRegistryAbi,
          functionName: "ownerOf",
          args: [BigInt(agentId)],
        }),
        this.pub.readContract({
          address: this.agentReg,
          abi: AgentRegistryAbi,
          functionName: "tokenURI",
          args: [BigInt(agentId)],
        }),
        this.pub.readContract({
          address: this.agentReg,
          abi: AgentRegistryAbi,
          functionName: "isActive",
          args: [BigInt(agentId)],
        }),
        this.pub.readContract({
          address: this.agentReg,
          abi: AgentRegistryAbi,
          functionName: "getAgentWallet",
          args: [BigInt(agentId)],
        }),
      ]);
      return {
        agentId,
        agentRegistry: this.agentReg,
        name: "",
        description: "",
        services: [],
        x402Support: false,
        active: active as boolean,
        supportedTrust: ["reputation"],
        owner: owner as EvmAddress,
        agentWallet: (agentWallet || undefined) as EvmAddress | undefined,
      };
    } catch {
      return null;
    }
  }

  async findAgents(query: {
    keyword?: string;
    activeOnly?: boolean;
  }): Promise<AgentRegistration[]> {
    // Read AgentRegistered events to discover agent IDs
    const logs = await this.pub.getContractEvents({
      address: this.agentReg,
      abi: AgentRegistryAbi,
      eventName: "AgentRegistered",
      fromBlock: 0n,
    });

    const agents: AgentRegistration[] = [];
    for (const log of logs) {
      const agentId = Number(log.args.agentId);
      const agent = await this.getAgent(agentId);
      if (!agent) continue;
      if (query.activeOnly && !agent.active) continue;
      agents.push(agent);
    }
    return agents;
  }

  async getAgentReputation(agentId: number): Promise<AgentReputation> {
    const [totalValue, count] = (await this.pub.readContract({
      address: this.feedbackReg,
      abi: FeedbackRegistryAbi,
      functionName: "getScore",
      args: [this.agentReg, BigInt(agentId)],
    })) as [bigint, bigint];

    const numCount = Number(count);
    const score = numCount > 0 ? Math.round(Number(totalValue) / numCount) : 0;

    return {
      agentId,
      score,
      feedbackCount: numCount,
      tagScores: {},
      validationCount: 0,
      validationTypes: [],
    };
  }

  async rateAgent(
    agentId: number,
    value: number,
    valueDecimals: number,
    tag1: string,
    tag2: string,
    feedbackURI: string,
    feedbackHash: `0x${string}`,
  ): Promise<{ txHash: string; feedbackIndex: number }> {
    const hash = await this.wallet.writeContract({
      address: this.feedbackReg,
      abi: FeedbackRegistryAbi,
      functionName: "giveFeedback",
      args: [
        this.agentReg,
        BigInt(agentId),
        BigInt(value),
        valueDecimals,
        tag1,
        tag2,
        feedbackURI,
        feedbackHash,
      ],
      chain: this.wallet.chain,
      account: this.wallet.account!,
    });
    const receipt = await this.pub.waitForTransactionReceipt({ hash });
    const logs = parseEventLogs({
      abi: FeedbackRegistryAbi,
      logs: receipt.logs as Log[],
      eventName: "FeedbackGiven",
    });
    return { txHash: hash, feedbackIndex: logs.length > 0 ? 1 : 0 };
  }

  // ── Data Registry ──

  async registerData(dataURI: string): Promise<number> {
    const hash = await this.wallet.writeContract({
      address: this.dataReg,
      abi: DataRegistryAbi,
      functionName: "register",
      args: [dataURI],
      chain: this.wallet.chain,
      account: this.wallet.account!,
    });
    const receipt = await this.pub.waitForTransactionReceipt({ hash });
    const logs = parseEventLogs({
      abi: DataRegistryAbi,
      logs: receipt.logs as Log[],
      eventName: "DataRegistered",
    });
    return Number(logs[0].args.dataId);
  }

  async findData(query: { activeOnly?: boolean }): Promise<DataRegistration[]> {
    const logs = await this.pub.getContractEvents({
      address: this.dataReg,
      abi: DataRegistryAbi,
      eventName: "DataRegistered",
      fromBlock: 0n,
    });

    const results: DataRegistration[] = [];
    for (const log of logs) {
      const dataId = Number(log.args.dataId);
      const active = (await this.pub.readContract({
        address: this.dataReg,
        abi: DataRegistryAbi,
        functionName: "isActive",
        args: [BigInt(dataId)],
      })) as boolean;
      if (query.activeOnly && !active) continue;

      const [owner] = await Promise.all([
        this.pub.readContract({
          address: this.dataReg,
          abi: DataRegistryAbi,
          functionName: "ownerOf",
          args: [BigInt(dataId)],
        }),
        this.pub.readContract({
          address: this.dataReg,
          abi: DataRegistryAbi,
          functionName: "tokenURI",
          args: [BigInt(dataId)],
        }),
      ]);

      results.push({
        dataId,
        dataRegistry: this.dataReg,
        vaultAddress: "",
        vaultKey: "",
        name: "",
        description: "",
        visibility: "public",
        tags: [],
        active,
        owner: owner as WalletAddress,
        ownerChain: "evm",
        lastUpdated: 0,
        registeredAt: 0,
      });
    }
    return results;
  }

  async getDataScore(dataId: number): Promise<DataScore> {
    const [totalValue, count] = (await this.pub.readContract({
      address: this.feedbackReg,
      abi: FeedbackRegistryAbi,
      functionName: "getScore",
      args: [this.dataReg, BigInt(dataId)],
    })) as [bigint, bigint];

    const numCount = Number(count);
    const quality = numCount > 0 ? Math.round(Number(totalValue) / numCount) : 0;

    return {
      dataId,
      vaultAddress: "",
      vaultKey: "",
      quality,
      freshness: { lastUpdated: 0, score: 0 },
      accuracy: { score: quality, feedbackCount: numCount },
      completeness: { score: quality, feedbackCount: numCount },
      verified: false,
      consumptionCount: numCount,
      totalFeedback: numCount,
      tagScores: {},
    };
  }

  async getTagScore(
    registryAddr: Address,
    entityId: number,
    tag1: string,
  ): Promise<{ totalValue: number; count: number }> {
    const [totalValue, count] = (await this.pub.readContract({
      address: this.feedbackReg,
      abi: FeedbackRegistryAbi,
      functionName: "getTagScore",
      args: [registryAddr, BigInt(entityId), tag1],
    })) as [bigint, bigint];
    return { totalValue: Number(totalValue), count: Number(count) };
  }

  async rateData(
    dataId: number,
    value: number,
    valueDecimals: number,
    tag1: string,
    tag2: string,
    feedbackURI: string,
    feedbackHash: `0x${string}`,
  ): Promise<{ txHash: string; feedbackIndex: number }> {
    const hash = await this.wallet.writeContract({
      address: this.feedbackReg,
      abi: FeedbackRegistryAbi,
      functionName: "giveFeedback",
      args: [
        this.dataReg,
        BigInt(dataId),
        BigInt(value),
        valueDecimals,
        tag1,
        tag2,
        feedbackURI,
        feedbackHash,
      ],
      chain: this.wallet.chain,
      account: this.wallet.account!,
    });
    const receipt = await this.pub.waitForTransactionReceipt({ hash });
    const logs = parseEventLogs({
      abi: FeedbackRegistryAbi,
      logs: receipt.logs as Log[],
      eventName: "FeedbackGiven",
    });
    return { txHash: hash, feedbackIndex: logs.length > 0 ? 1 : 0 };
  }

  async revokeFeedback(registryAddr: Address, entityId: number, index: number): Promise<string> {
    const hash = await this.wallet.writeContract({
      address: this.feedbackReg,
      abi: FeedbackRegistryAbi,
      functionName: "revokeFeedback",
      args: [registryAddr, BigInt(entityId), BigInt(index)],
      chain: this.wallet.chain,
      account: this.wallet.account!,
    });
    await this.pub.waitForTransactionReceipt({ hash });
    return hash;
  }

  async updateDataURI(dataId: number, dataURI: string): Promise<string> {
    const hash = await this.wallet.writeContract({
      address: this.dataReg,
      abi: DataRegistryAbi,
      functionName: "setDataURI",
      args: [BigInt(dataId), dataURI],
      chain: this.wallet.chain,
      account: this.wallet.account!,
    });
    await this.pub.waitForTransactionReceipt({ hash });
    return hash;
  }

  async setActive(registryAddr: Address, entityId: number, active: boolean): Promise<string> {
    const abi = registryAddr === this.agentReg ? AgentRegistryAbi : DataRegistryAbi;
    const hash = await this.wallet.writeContract({
      address: registryAddr,
      abi,
      functionName: "setActive",
      args: [BigInt(entityId), active],
      chain: this.wallet.chain,
      account: this.wallet.account!,
    });
    await this.pub.waitForTransactionReceipt({ hash });
    return hash;
  }
}
