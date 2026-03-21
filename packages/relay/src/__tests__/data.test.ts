import { describe, expect, test } from "bun:test";

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
  test("GET /v1/data/search returns results", async () => {
    const res = await app.request("/v1/data/search?schema=orbitmem:dietary:v1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(typeof body.count).toBe("number");
    expect(body.results).toBeArray();
  });

  test("GET /v1/data/search without params returns all", async () => {
    const res = await app.request("/v1/data/search");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(typeof body.count).toBe("number");
    expect(body.results).toBeArray();
  });

  test("GET /v1/data/:dataId/score returns score", async () => {
    const res = await app.request("/v1/data/1/score");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.dataId).toBe(1);
    expect(typeof body.totalFeedback).toBe("number");
  });

  test("GET /v1/data/user/stats requires auth", async () => {
    const res = await app.request("/v1/data/user/stats");
    expect(res.status).toBe(401);
  });

  test("GET /v1/data/user/stats returns per-user metrics with auth", async () => {
    const headers = makeERC8128Headers();
    const res = await app.request("/v1/data/user/stats", { headers });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(typeof body.feedbackSubmitted).toBe("number");
    expect(typeof body.avgRatingGiven).toBe("number");
    expect(typeof body.dataEntriesRated).toBe("number");
    expect(body.topTagsUsed).toBeArray();
  });

  test("GET /v1/data/stats returns aggregate metrics", async () => {
    const res = await app.request("/v1/data/stats");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(typeof body.totalEntries).toBe("number");
    expect(typeof body.totalFeedback).toBe("number");
    expect(typeof body.avgQuality).toBe("number");
    expect(body.qualityDistribution).toBeArray();
    expect(body.qualityDistribution).toHaveLength(5);
    expect(body.topTags).toBeArray();
    expect(body.activity).toBeArray();
    expect(body.activity).toHaveLength(7);
  });
});
