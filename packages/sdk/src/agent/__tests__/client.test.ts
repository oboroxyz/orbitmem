import { describe, expect, test } from "bun:test";

import { createOrbitMemClient } from "../client.js";

describe("Client", () => {
  const client = createOrbitMemClient({
    wallet: {
      family: "evm",
      address: "0xAGENT_ADDRESS" as any,
      signMessage: async (_msg) => new Uint8Array(65).fill(0xab),
    },
    discovery: {
      dataRegistry: "0xDATA_REG" as any,
      reputationRegistry: "0xREP_REG" as any,
      registryChain: "base",
    },
  });

  test("discoverData returns empty for unknown schema", async () => {
    const results = await client.discoverData({ schema: "nonexistent:v1" });
    expect(results).toEqual([]);
  });

  test("readPublicData returns null for missing data", async () => {
    // This would normally hit a relay, but the client handles errors gracefully
    const result = await client.readPublicData({
      vaultAddress: "test-vault",
      path: "travel/dietary",
      relayUrl: "http://localhost:9999", // no relay running
    });
    expect(result).toBeNull();
  });

  test("getDataScore returns zero score for unknown data", async () => {
    const score = await client.getDataScore("unknown-vault", "some/path");
    expect(score.quality).toBe(0);
    expect(score.totalFeedback).toBe(0);
  });

  test("rateData submits feedback", async () => {
    const result = await client.rateData({
      dataId: 1,
      value: 85,
      qualityDimension: "accuracy",
      tag1: "helpful",
    });
    expect(result.txHash).toBeTruthy();
    expect(result.feedbackIndex).toBeGreaterThan(0);
  });
});
