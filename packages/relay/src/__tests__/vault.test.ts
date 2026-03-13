import { beforeAll, describe, expect, test } from "bun:test";
import { app } from "../app.js";

function makeERC8128Headers(overrides?: Record<string, string>) {
  return {
    "X-OrbitMem-Signer": "0xTEST_SIGNER",
    "X-OrbitMem-Family": "evm",
    "X-OrbitMem-Algorithm": "ecdsa-secp256k1",
    "X-OrbitMem-Timestamp": String(Date.now()),
    "X-OrbitMem-Nonce": crypto.randomUUID(),
    "X-OrbitMem-Signature": "ab".repeat(32),
    "Content-Type": "application/json",
    ...overrides,
  };
}

describe("Relay Vault Routes", () => {
  // Seed test data
  beforeAll(async () => {
    await app.request("/v1/vault/seed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: "test-vault-001",
        entries: [
          { key: "travel/dietary", value: "vegan", visibility: "public" },
          { key: "travel/budget", value: { min: 1000, max: 2000 }, visibility: "public" },
          { key: "travel/passport", value: "ENCRYPTED_BLOB", visibility: "private" },
        ],
      }),
    });
  });

  test("GET /v1/vault/public/:address/:key returns public entry", async () => {
    const res = await app.request("/v1/vault/public/test-vault-001/travel/dietary");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.value).toBe("vegan");
    expect(body.visibility).toBe("public");
  });

  test("GET /v1/vault/public/:address/:key returns 404 for private", async () => {
    const res = await app.request("/v1/vault/public/test-vault-001/travel/passport");
    expect(res.status).toBe(404);
  });

  test("GET /v1/vault/public/:address/keys lists public keys", async () => {
    const res = await app.request("/v1/vault/public/test-vault-001/keys");
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.keys).toContain("travel/dietary");
    expect(body.keys).toContain("travel/budget");
    expect(body.keys).not.toContain("travel/passport");
  });

  test("POST /v1/vault/read requires ERC-8128 headers", async () => {
    const res = await app.request("/v1/vault/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vaultAddress: "test-vault-001", path: "travel/passport" }),
    });
    expect(res.status).toBe(401);
  });

  test("POST /v1/vault/read returns data with valid headers", async () => {
    const res = await app.request("/v1/vault/read", {
      method: "POST",
      headers: makeERC8128Headers(),
      body: JSON.stringify({ vaultAddress: "test-vault-001", path: "travel/passport" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.value).toBe("ENCRYPTED_BLOB");
    expect(body.signer).toBe("0xTEST_SIGNER");
  });

  test("POST /v1/auth/challenge returns nonce", async () => {
    const res = await app.request("/v1/auth/challenge", { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.nonce).toBeTruthy();
    expect(body.message).toContain("OrbitMem Authentication");
  });
});

describe("Vault Write/Delete/Keys", () => {
  test("POST /v1/vault/write stores entry", async () => {
    const res = await app.request("/v1/vault/write", {
      method: "POST",
      headers: makeERC8128Headers({ "X-OrbitMem-Signer": "0xWRITER" }),
      body: JSON.stringify({
        path: "memos/abc/title",
        value: "My First Memo",
        visibility: "public",
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.ok).toBe(true);
    expect(body.hash).toBeTruthy();

    const read = await app.request("/v1/vault/public/0xWRITER/memos/abc/title");
    expect(read.status).toBe(200);
    const readBody = (await read.json()) as any;
    expect(readBody.value).toBe("My First Memo");
  });

  test("POST /v1/vault/write requires auth", async () => {
    const res = await app.request("/v1/vault/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "x", value: "y", visibility: "public" }),
    });
    expect(res.status).toBe(401);
  });

  test("POST /v1/vault/keys returns all keys for signer", async () => {
    await app.request("/v1/vault/write", {
      method: "POST",
      headers: makeERC8128Headers({ "X-OrbitMem-Signer": "0xKEYS_USER" }),
      body: JSON.stringify({ path: "memos/a/title", value: "A", visibility: "public" }),
    });
    await app.request("/v1/vault/write", {
      method: "POST",
      headers: makeERC8128Headers({ "X-OrbitMem-Signer": "0xKEYS_USER" }),
      body: JSON.stringify({ path: "memos/a/body", value: "Body A", visibility: "private" }),
    });
    await app.request("/v1/vault/write", {
      method: "POST",
      headers: makeERC8128Headers({ "X-OrbitMem-Signer": "0xKEYS_USER" }),
      body: JSON.stringify({ path: "other/x", value: "X", visibility: "public" }),
    });

    const res = await app.request("/v1/vault/keys", {
      method: "POST",
      headers: makeERC8128Headers({ "X-OrbitMem-Signer": "0xKEYS_USER" }),
      body: JSON.stringify({ prefix: "memos/" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.keys).toContain("memos/a/title");
    expect(body.keys).toContain("memos/a/body");
    expect(body.keys).not.toContain("other/x");
  });

  test("POST /v1/vault/keys without prefix returns all keys", async () => {
    const res = await app.request("/v1/vault/keys", {
      method: "POST",
      headers: makeERC8128Headers({ "X-OrbitMem-Signer": "0xKEYS_USER" }),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.keys).toContain("memos/a/title");
    expect(body.keys).toContain("other/x");
  });

  test("POST /v1/vault/delete removes entry", async () => {
    await app.request("/v1/vault/write", {
      method: "POST",
      headers: makeERC8128Headers({ "X-OrbitMem-Signer": "0xDELETER" }),
      body: JSON.stringify({ path: "temp/data", value: "gone", visibility: "public" }),
    });
    const del = await app.request("/v1/vault/delete", {
      method: "POST",
      headers: makeERC8128Headers({ "X-OrbitMem-Signer": "0xDELETER" }),
      body: JSON.stringify({ path: "temp/data" }),
    });
    expect(del.status).toBe(200);
    const delBody = (await del.json()) as any;
    expect(delBody.ok).toBe(true);

    const read = await app.request("/v1/vault/public/0xDELETER/temp/data");
    expect(read.status).toBe(404);
  });

  test("POST /v1/vault/read falls back to signer when vaultAddress omitted", async () => {
    await app.request("/v1/vault/write", {
      method: "POST",
      headers: makeERC8128Headers({ "X-OrbitMem-Signer": "0xREADER" }),
      body: JSON.stringify({ path: "notes/x", value: "CIPHER", visibility: "private" }),
    });

    const res = await app.request("/v1/vault/read", {
      method: "POST",
      headers: makeERC8128Headers({ "X-OrbitMem-Signer": "0xREADER" }),
      body: JSON.stringify({ path: "notes/x" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.value).toBe("CIPHER");
  });
});
