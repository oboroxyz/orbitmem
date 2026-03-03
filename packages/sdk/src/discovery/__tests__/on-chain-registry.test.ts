import { beforeAll, describe, expect, test } from "bun:test";
import {
  AgentRegistryAbi,
  AgentRegistryBytecode,
  DataRegistryAbi,
  DataRegistryBytecode,
  FeedbackRegistryAbi,
  FeedbackRegistryBytecode,
} from "@orbitmem/contracts";
import {
  type Address,
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { OnChainRegistry } from "../on-chain-registry.js";

// Skip all tests if Anvil is not running
async function isAnvilRunning(): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:8545", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const ANVIL_AVAILABLE = await isAnvilRunning();

// Anvil default accounts
const ALICE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const BOB_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;

const aliceAccount = privateKeyToAccount(ALICE_KEY);
const bobAccount = privateKeyToAccount(BOB_KEY);

let publicClient: PublicClient;
let aliceWallet: WalletClient;
let bobWallet: WalletClient;
let agentRegAddr: Address;
let dataRegAddr: Address;
let feedbackRegAddr: Address;

async function deployContract(
  wallet: WalletClient,
  pub: PublicClient,
  abi: readonly any[],
  bytecode: `0x${string}`,
): Promise<Address> {
  const hash = await wallet.deployContract({
    abi,
    bytecode,
    account: wallet.account!,
    chain: foundry,
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  return receipt.contractAddress!;
}

describe.skipIf(!ANVIL_AVAILABLE)("OnChainRegistry (Anvil)", () => {
  beforeAll(async () => {
    const transport = http("http://127.0.0.1:8545");

    publicClient = createPublicClient({ chain: foundry, transport });
    aliceWallet = createWalletClient({
      chain: foundry,
      transport,
      account: aliceAccount,
    });
    bobWallet = createWalletClient({
      chain: foundry,
      transport,
      account: bobAccount,
    });

    // Deploy contracts
    agentRegAddr = await deployContract(
      aliceWallet,
      publicClient,
      AgentRegistryAbi,
      AgentRegistryBytecode,
    );
    dataRegAddr = await deployContract(
      aliceWallet,
      publicClient,
      DataRegistryAbi,
      DataRegistryBytecode,
    );
    feedbackRegAddr = await deployContract(
      aliceWallet,
      publicClient,
      FeedbackRegistryAbi,
      FeedbackRegistryBytecode,
    );
  });

  test("register agent and read back", async () => {
    const registry = new OnChainRegistry({
      publicClient,
      walletClient: aliceWallet,
      agentRegistry: agentRegAddr,
      dataRegistry: dataRegAddr,
      feedbackRegistry: feedbackRegAddr,
    });

    const agentId = await registry.registerAgent("ipfs://agent-alice");
    expect(agentId).toBe(1);

    const agent = await registry.getAgent(agentId);
    expect(agent).not.toBeNull();
    expect(agent!.active).toBe(true);
    expect(agent!.owner.toLowerCase()).toBe(aliceAccount.address.toLowerCase());
  });

  test("rate agent and get score", async () => {
    const aliceRegistry = new OnChainRegistry({
      publicClient,
      walletClient: aliceWallet,
      agentRegistry: agentRegAddr,
      dataRegistry: dataRegAddr,
      feedbackRegistry: feedbackRegAddr,
    });

    const agentId = await aliceRegistry.registerAgent("ipfs://agent-2");

    // Bob rates Alice's agent
    const bobRegistry = new OnChainRegistry({
      publicClient,
      walletClient: bobWallet,
      agentRegistry: agentRegAddr,
      dataRegistry: dataRegAddr,
      feedbackRegistry: feedbackRegAddr,
    });

    const result = await bobRegistry.rateAgent(
      agentId,
      85,
      0,
      "reliable",
      "",
      "",
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    );
    expect(result.txHash).toMatch(/^0x/);

    const reputation = await aliceRegistry.getAgentReputation(agentId);
    expect(reputation.score).toBe(85);
    expect(reputation.feedbackCount).toBe(1);
  });

  test("register data and get score", async () => {
    const aliceRegistry = new OnChainRegistry({
      publicClient,
      walletClient: aliceWallet,
      agentRegistry: agentRegAddr,
      dataRegistry: dataRegAddr,
      feedbackRegistry: feedbackRegAddr,
    });

    const dataId = await aliceRegistry.registerData("ipfs://data-1");
    expect(dataId).toBeGreaterThan(0);

    // Bob rates Alice's data
    const bobRegistry = new OnChainRegistry({
      publicClient,
      walletClient: bobWallet,
      agentRegistry: agentRegAddr,
      dataRegistry: dataRegAddr,
      feedbackRegistry: feedbackRegAddr,
    });

    await bobRegistry.rateData(
      dataId,
      90,
      0,
      "accurate",
      "",
      "",
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    );

    const score = await aliceRegistry.getDataScore(dataId);
    expect(score.quality).toBe(90);
    expect(score.totalFeedback).toBe(1);
  });

  test("tag scores tracked separately", async () => {
    const aliceRegistry = new OnChainRegistry({
      publicClient,
      walletClient: aliceWallet,
      agentRegistry: agentRegAddr,
      dataRegistry: dataRegAddr,
      feedbackRegistry: feedbackRegAddr,
    });

    const dataId = await aliceRegistry.registerData("ipfs://data-tags");

    const bobRegistry = new OnChainRegistry({
      publicClient,
      walletClient: bobWallet,
      agentRegistry: agentRegAddr,
      dataRegistry: dataRegAddr,
      feedbackRegistry: feedbackRegAddr,
    });

    await bobRegistry.rateData(
      dataId,
      80,
      0,
      "accurate",
      "",
      "",
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    );
    await bobRegistry.rateData(
      dataId,
      60,
      0,
      "fresh",
      "",
      "",
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    );

    const accurateScore = await aliceRegistry.getTagScore(dataRegAddr, dataId, "accurate");
    expect(accurateScore.totalValue).toBe(80);
    expect(accurateScore.count).toBe(1);

    const freshScore = await aliceRegistry.getTagScore(dataRegAddr, dataId, "fresh");
    expect(freshScore.totalValue).toBe(60);
    expect(freshScore.count).toBe(1);
  });

  test("revoke feedback decrements score", async () => {
    const aliceRegistry = new OnChainRegistry({
      publicClient,
      walletClient: aliceWallet,
      agentRegistry: agentRegAddr,
      dataRegistry: dataRegAddr,
      feedbackRegistry: feedbackRegAddr,
    });

    const agentId = await aliceRegistry.registerAgent("ipfs://agent-revoke");

    const bobRegistry = new OnChainRegistry({
      publicClient,
      walletClient: bobWallet,
      agentRegistry: agentRegAddr,
      dataRegistry: dataRegAddr,
      feedbackRegistry: feedbackRegAddr,
    });

    await bobRegistry.rateAgent(
      agentId,
      80,
      0,
      "",
      "",
      "",
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    );

    let reputation = await aliceRegistry.getAgentReputation(agentId);
    expect(reputation.score).toBe(80);
    expect(reputation.feedbackCount).toBe(1);

    // Bob revokes
    await bobRegistry.revokeFeedback(agentRegAddr, agentId, 0);

    reputation = await aliceRegistry.getAgentReputation(agentId);
    expect(reputation.score).toBe(0);
    expect(reputation.feedbackCount).toBe(0);
  });

  test("self-feedback reverts", async () => {
    const aliceRegistry = new OnChainRegistry({
      publicClient,
      walletClient: aliceWallet,
      agentRegistry: agentRegAddr,
      dataRegistry: dataRegAddr,
      feedbackRegistry: feedbackRegAddr,
    });

    const agentId = await aliceRegistry.registerAgent("ipfs://agent-self");

    // Alice tries to rate her own agent — should revert
    await expect(
      aliceRegistry.rateAgent(
        agentId,
        99,
        0,
        "",
        "",
        "",
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      ),
    ).rejects.toThrow();
  });
});
