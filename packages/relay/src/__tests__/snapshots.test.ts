import { describe, expect, test } from "bun:test";
import { app } from "../app.js";

function makeERC8128Headers(signer = "0xSNAPSHOT") {
  return {
    "X-OrbitMem-Signer": signer,
    "X-OrbitMem-Family": "evm",
    "X-OrbitMem-Algorithm": "ecdsa-secp256k1",
    "X-OrbitMem-Timestamp": String(Date.now()),
    "X-OrbitMem-Nonce": crypto.randomUUID(),
    "X-OrbitMem-Signature": "ab".repeat(32),
    "Content-Type": "application/json",
  };
}

describe("Relay Snapshot Routes", () => {
  test("GET /v1/snapshots requires ERC-8128", async () => {
    const res = await app.request("/v1/snapshots");
    expect(res.status).toBe(401);
  });

  test("POST /v1/snapshots/archive creates snapshot", async () => {
    const res = await app.request("/v1/snapshots/archive", {
      method: "POST",
      headers: makeERC8128Headers(),
      body: JSON.stringify({ data: '{"hello":"world"}', entryCount: 5 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.cid).toMatch(/^bafy/);
    expect(body.entryCount).toBe(5);
    expect(body.encrypted).toBe(true);
    expect(body.signer).toBe("0xSNAPSHOT");
  });

  test("GET /v1/snapshots lists only own snapshots", async () => {
    // Archive one more for a different signer
    await app.request("/v1/snapshots/archive", {
      method: "POST",
      headers: makeERC8128Headers("0xOTHER"),
      body: JSON.stringify({ data: "{}", entryCount: 1 }),
    });

    const res = await app.request("/v1/snapshots", {
      headers: makeERC8128Headers("0xSNAPSHOT"),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.count).toBeGreaterThanOrEqual(1);
    // All returned snapshots belong to 0xSNAPSHOT
    for (const snap of body.snapshots) {
      expect(snap.signer).toBe("0xSNAPSHOT");
      expect(snap.data).toBeUndefined(); // data should be excluded
    }
  });

  test("GET /v1/snapshots/usage returns tier and usage", async () => {
    const res = await app.request("/v1/snapshots/usage", {
      headers: makeERC8128Headers("0xUSAGE"),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.tier).toBe("free");
    expect(body.used).toBe(0);
    expect(body.limit).toBe(5 * 1024 * 1024);
  });

  test("POST /v1/snapshots/archive rejects when over quota", async () => {
    const signer = "0xQUOTA";
    // Fill up most of the quota with a request just under the limit
    const almostFull = "x".repeat(5 * 1024 * 1024 - 1);
    const res1 = await app.request("/v1/snapshots/archive", {
      method: "POST",
      headers: makeERC8128Headers(signer),
      body: JSON.stringify({ data: almostFull, entryCount: 1 }),
    });
    expect(res1.status).toBe(200);

    // Second request should exceed the remaining quota
    const res2 = await app.request("/v1/snapshots/archive", {
      method: "POST",
      headers: makeERC8128Headers(signer),
      body: JSON.stringify({ data: "more data", entryCount: 1 }),
    });
    expect(res2.status).toBe(413);
  });
});
