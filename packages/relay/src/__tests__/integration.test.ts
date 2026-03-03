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

  test("discovery + feedback lifecycle", async () => {
    // Register data for discovery
    const regRes = await app.request("/v1/data/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "travel/dietary",
        name: "Dietary Preferences",
        description: "Dietary data for booking agents",
        schema: "orbitmem:dietary:v1",
        tags: ["verified"],
      }),
    });
    expect(regRes.status).toBe(200);
    const { dataId } = (await regRes.json()) as any;

    // Search by schema
    const searchRes = await app.request("/v1/data/search?schema=orbitmem:dietary:v1");
    expect(searchRes.status).toBe(200);
    const { results } = (await searchRes.json()) as any;
    expect(results.length).toBeGreaterThan(0);

    // Check initial score
    const scoreRes1 = await app.request(`/v1/data/${dataId}/score`);
    const score1 = (await scoreRes1.json()) as any;
    expect(score1.totalFeedback).toBe(0);

    // Submit feedback with signed request
    const transport = createTransportLayer({
      signer: async (_payload) => ({
        signature: new Uint8Array(64).fill(0xcd),
        algorithm: "ecdsa-secp256k1" as const,
      }),
      signerAddress: "0xAGENT_REVIEWER" as any,
      family: "evm",
    });

    const signed = await transport.createSignedRequest({
      url: `/v1/data/${dataId}/feedback`,
      method: "POST",
      body: { value: 85, qualityDimension: "accuracy" },
    });

    const fbRes = await app.request(signed.url, {
      method: signed.method,
      headers: { ...signed.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ value: 85, qualityDimension: "accuracy" }),
    });
    expect(fbRes.status).toBe(200);

    // Verify score updated
    const scoreRes2 = await app.request(`/v1/data/${dataId}/score`);
    const score2 = (await scoreRes2.json()) as any;
    expect(score2.totalFeedback).toBe(1);
    expect(score2.quality).toBe(85);
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
