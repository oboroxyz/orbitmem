import { describe, expect, test } from "bun:test";
import { createDiscoveryLayer } from "../discovery-layer.js";

describe("DiscoveryLayer (mock)", () => {
  const discovery = createDiscoveryLayer({
    agentRegistry: "0xAGENT_REG" as any,
    dataRegistry: "0xDATA_REG" as any,
    reputationRegistry: "0xREP_REG" as any,
    registryChain: "base",
  });

  test("registerData and findData", async () => {
    const reg = await discovery.registerData({
      key: "travel/dietary",
      name: "Dietary Preferences",
      description: "Dietary restrictions",
      schema: "orbitmem:dietary:v1",
      tags: ["verified", "human-curated"],
    });
    expect(reg.dataId).toBeGreaterThan(0);
    expect(reg.name).toBe("Dietary Preferences");

    const results = await discovery.findData({ schema: "orbitmem:dietary:v1" });
    expect(results).toHaveLength(1);
    expect(results[0].vaultKey).toBe("travel/dietary");
  });

  test("rateData and getDataScoreById", async () => {
    // Register
    const reg = await discovery.registerData({
      key: "travel/budget",
      name: "Budget",
      description: "Budget range",
      tags: ["verified"],
    });

    // Rate
    await discovery.rateData({
      dataId: reg.dataId,
      value: 90,
      qualityDimension: "accuracy",
      tag1: "accurate",
    });

    const score = await discovery.getDataScoreById(reg.dataId);
    expect(score.quality).toBeGreaterThan(0);
    expect(score.totalFeedback).toBe(1);
  });

  test("findAgents returns empty initially", async () => {
    const agents = await discovery.findAgents({ keyword: "booking" });
    expect(agents).toEqual([]);
  });

  test("createAgentReputationCondition returns Lit condition", () => {
    const condition = discovery.createAgentReputationCondition({ minScore: 80 });
    expect(condition.conditionType).toBe("evmContract");
    expect(condition.returnValueTest.comparator).toBe(">=");
    expect(condition.returnValueTest.value).toBe("80");
  });
});
