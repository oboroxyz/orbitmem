import { beforeAll, describe, expect, test } from "bun:test";
import { createTransportLayer } from "@orbitmem/sdk/transport";
import { app } from "../app.js";

/**
 * Integration tests verifying the SDK ↔ Relay contract.
 */
describe("SDK ↔ Relay Integration", () => {
  const testAddress = "0xINTEGRATION";

  beforeAll(async () => {
    // Seed public vault data
    await app.request("/v1/vault/seed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: testAddress,
        entries: [
          { key: "profile/name", value: "Alice", visibility: "public" },
          { key: "travel/dietary", value: { vegan: true }, visibility: "public" },
          { key: "finance/salary", value: 100000, visibility: "private" },
        ],
      }),
    });
  });

  test("full public data flow: seed → list keys → read", async () => {
    // List public keys
    const keysRes = await app.request(`/v1/vault/public/${testAddress}/keys`);
    expect(keysRes.status).toBe(200);
    const { keys } = (await keysRes.json()) as any;
    expect(keys).toContain("profile/name");
    expect(keys).toContain("travel/dietary");
    expect(keys).not.toContain("finance/salary"); // private entry excluded

    // Read public entry
    const readRes = await app.request(`/v1/vault/public/${testAddress}/travel/dietary`);
    expect(readRes.status).toBe(200);
    const data = (await readRes.json()) as any;
    expect(data.value.vegan).toBe(true);
    expect(data.visibility).toBe("public");
  });

  test("full signed request flow: SDK transport → relay middleware", async () => {
    // Create a transport layer with a mock signer
    const transport = createTransportLayer({
      signer: async (_payload) => ({
        signature: new Uint8Array(64).fill(0xab),
        algorithm: "ecdsa-secp256k1" as const,
      }),
      signerAddress: testAddress as any,
      family: "evm",
    });

    // Create a signed request via SDK
    const signed = await transport.createSignedRequest({
      url: "/v1/vault/sync",
      method: "POST",
    });

    // Send signed request to relay
    const res = await app.request(signed.url, {
      method: signed.method,
      headers: signed.headers,
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.status).toBe("synced");
    expect(body.signer).toBe(testAddress);
  });

  test("discovery read-only flow: search + score", async () => {
    // Search by schema
    const searchRes = await app.request("/v1/data/search?schema=orbitmem:dietary:v1");
    expect(searchRes.status).toBe(200);
    const { results, count } = (await searchRes.json()) as any;
    expect(results).toBeArray();
    expect(typeof count).toBe("number");

    // Check score endpoint works
    const scoreRes = await app.request("/v1/data/1/score");
    expect(scoreRes.status).toBe(200);
    const score = (await scoreRes.json()) as any;
    expect(score.dataId).toBe(1);
    expect(typeof score.totalFeedback).toBe("number");
  });

  test("snapshot archival with signed request", async () => {
    const transport = createTransportLayer({
      signer: async (_payload) => ({
        signature: new Uint8Array(64).fill(0xef),
        algorithm: "ecdsa-secp256k1" as const,
      }),
      signerAddress: testAddress as any,
      family: "evm",
    });

    // Archive snapshot
    const archiveSigned = await transport.createSignedRequest({
      url: "/v1/snapshots/archive",
      method: "POST",
      body: { data: '{"snapshot":true}', entryCount: 10 },
    });

    const archiveRes = await app.request(archiveSigned.url, {
      method: archiveSigned.method,
      headers: { ...archiveSigned.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ data: '{"snapshot":true}', entryCount: 10 }),
    });
    expect(archiveRes.status).toBe(200);
    const archived = (await archiveRes.json()) as any;
    expect(archived.cid).toMatch(/^bafy/);

    // List snapshots
    const listSigned = await transport.createSignedRequest({
      url: "/v1/snapshots",
      method: "GET",
    });

    const listRes = await app.request(listSigned.url, {
      headers: listSigned.headers,
    });
    expect(listRes.status).toBe(200);
    const { snapshots } = (await listRes.json()) as any;
    expect(snapshots.length).toBeGreaterThanOrEqual(1);
    expect(snapshots[0].signer).toBe(testAddress);
  });
});
