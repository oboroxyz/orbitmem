import { beforeAll, describe, expect, test } from "bun:test";
import { app } from "../app.js";

function makeERC8128Headers() {
  return {
    "X-OrbitMem-Signer": "0xAGENT",
    "X-OrbitMem-Family": "evm",
    "X-OrbitMem-Algorithm": "ecdsa-secp256k1",
    "X-OrbitMem-Timestamp": String(Date.now()),
    "X-OrbitMem-Nonce": crypto.randomUUID(),
    "X-OrbitMem-Signature": "ab".repeat(32),
    "Content-Type": "application/json",
  };
}

describe("Relay Discovery Routes", () => {
  let dataId: number;

  beforeAll(async () => {
    // Register test data
    const res = await app.request("/v1/data/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "travel/dietary",
        name: "Dietary Preferences",
        description: "Dietary restrictions for booking agents",
        schema: "orbitmem:dietary:v1",
        tags: ["verified", "human-curated"],
      }),
    });
    const body = (await res.json()) as any;
    dataId = body.dataId;
  });

  test("GET /v1/data/search returns results", async () => {
    const res = await app.request("/v1/data/search?schema=orbitmem:dietary:v1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.count).toBeGreaterThan(0);
    expect(body.results[0].vaultKey).toBe("travel/dietary");
  });

  test("GET /v1/data/:dataId/score returns score", async () => {
    const res = await app.request(`/v1/data/${dataId}/score`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.dataId).toBe(dataId);
    expect(body.totalFeedback).toBe(0);
  });

  test("POST /v1/data/:dataId/feedback requires ERC-8128", async () => {
    const res = await app.request(`/v1/data/${dataId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: 90 }),
    });
    expect(res.status).toBe(401);
  });

  test("POST /v1/data/:dataId/feedback with valid auth", async () => {
    const res = await app.request(`/v1/data/${dataId}/feedback`, {
      method: "POST",
      headers: makeERC8128Headers(),
      body: JSON.stringify({ value: 90, qualityDimension: "accuracy", tag1: "accurate" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.signer).toBe("0xAGENT");

    // Verify score updated
    const scoreRes = await app.request(`/v1/data/${dataId}/score`);
    const score = (await scoreRes.json()) as any;
    expect(score.totalFeedback).toBe(1);
    expect(score.quality).toBe(90);
  });

  test("GET /v1/data/stats returns aggregate metrics", async () => {
    const res = await app.request("/v1/data/stats");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.totalEntries).toBeGreaterThanOrEqual(1);
    expect(typeof body.totalFeedback).toBe("number");
    expect(typeof body.avgQuality).toBe("number");
    expect(body.qualityDistribution).toBeArray();
    expect(body.qualityDistribution).toHaveLength(5);
    expect(body.topTags).toBeArray();
    expect(body.activity).toBeArray();
    expect(body.activity).toHaveLength(7);
  });
});
