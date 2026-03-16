import { describe, expect, test } from "bun:test";

import { AESEngine } from "../../encryption/aes.js";
import { isSerializedEncrypted } from "../serialization.js";
import { createVault } from "../vault.js";

/** In-memory mock OrbitDB for unit tests (no network/native deps) */
function createMockOrbitDB() {
  const stores = new Map<string, Map<string, any>>();
  return {
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        async put(key: string, value: any) {
          store.set(key, value);
          return `hash-${key}`;
        },
        async get(key: string) {
          return store.get(key);
        },
        async del(key: string) {
          store.delete(key);
        },
        async all() {
          const obj: Record<string, any> = {};
          for (const [k, v] of store) obj[k] = v;
          return obj;
        },
        async close() {},
        events: { on() {}, off() {} },
      };
    },
  };
}

async function deriveTestKey(aes: AESEngine) {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return aes.deriveKey({ type: "raw", key: raw });
}

describe("Vault Encryption", () => {
  test("private+aes: put encrypts, get auto-decrypts", async () => {
    const aes = new AESEngine({ kdf: "hkdf-sha256" });
    const key = await deriveTestKey(aes);
    const vault = await createVault(createMockOrbitDB(), { aesEngine: aes });
    vault.setDefaultKey(key);

    const entry = await vault.put("secrets/password", "hunter2", { visibility: "private" });
    expect(entry.value).toBe("hunter2");
    expect(entry.encrypted).toBe(true);
    expect(entry.encryptionEngine).toBe("aes");

    // Raw OrbitDB value should be an encrypted blob, not plaintext
    const raw = await vault.db.get("secrets/password");
    expect(raw).not.toBe("hunter2");
    expect(isSerializedEncrypted(raw)).toBe(true);

    // get() should auto-decrypt
    const retrieved = await vault.get("secrets/password");
    expect(retrieved).not.toBeNull();
    expect(retrieved!.value).toBe("hunter2");
    expect(retrieved!.encrypted).toBe(true);
  });

  test("private+aes: works with object values", async () => {
    const aes = new AESEngine({ kdf: "hkdf-sha256" });
    const key = await deriveTestKey(aes);
    const vault = await createVault(createMockOrbitDB(), { aesEngine: aes });
    vault.setDefaultKey(key);

    const data = { vegan: true, allergies: ["peanuts"] };
    await vault.put("travel/dietary", data, { visibility: "private" });

    const retrieved = await vault.get("travel/dietary");
    expect(retrieved).not.toBeNull();
    expect(retrieved!.value).toEqual(data);
  });

  test("public: stores and retrieves plaintext", async () => {
    const vault = await createVault(createMockOrbitDB(), {});

    await vault.put("profile/name", "Alice", { visibility: "public" });

    const raw = await vault.db.get("profile/name");
    expect(raw).toBe("Alice");

    const retrieved = await vault.get("profile/name");
    expect(retrieved!.value).toBe("Alice");
    expect(retrieved!.encrypted).toBe(false);
  });

  test("private without aesEngine: throws", async () => {
    const vault = await createVault(createMockOrbitDB(), {});

    await expect(vault.put("secret", "data", { visibility: "private" })).rejects.toThrow(
      /AES engine not configured/,
    );
  });

  test("private without defaultKey: throws", async () => {
    const aes = new AESEngine({ kdf: "hkdf-sha256" });
    const vault = await createVault(createMockOrbitDB(), { aesEngine: aes });
    // setDefaultKey not called

    await expect(vault.put("secret", "data", { visibility: "private" })).rejects.toThrow(
      /No default key/,
    );
  });

  test("shared+aes: encrypts, get returns encrypted blob", async () => {
    const aes = new AESEngine({ kdf: "hkdf-sha256" });
    const defaultKey = await deriveTestKey(aes);
    const sharedRaw = crypto.getRandomValues(new Uint8Array(32));
    const vault = await createVault(createMockOrbitDB(), { aesEngine: aes });
    vault.setDefaultKey(defaultKey);

    await vault.put(
      "shared/data",
      { score: 42 },
      {
        visibility: "shared",
        engine: "aes",
        sharedKeySource: { type: "raw", key: sharedRaw },
      },
    );

    // get() cannot auto-decrypt shared data (no shared key internally)
    const retrieved = await vault.get("shared/data");
    expect(retrieved).not.toBeNull();
    expect(isSerializedEncrypted(retrieved!.value)).toBe(true);
  });

  test("insert encrypts all leaves for private visibility", async () => {
    const aes = new AESEngine({ kdf: "hkdf-sha256" });
    const key = await deriveTestKey(aes);
    const vault = await createVault(createMockOrbitDB(), { aesEngine: aes });
    vault.setDefaultKey(key);

    await vault.insert({ prefs: { diet: "vegan", budget: 5000 } }, { visibility: "private" });

    // Raw storage should be encrypted
    const rawDiet = await vault.db.get("prefs/diet");
    expect(isSerializedEncrypted(rawDiet)).toBe(true);

    const rawBudget = await vault.db.get("prefs/budget");
    expect(isSerializedEncrypted(rawBudget)).toBe(true);

    // get() should auto-decrypt
    const diet = await vault.get("prefs/diet");
    expect(diet!.value).toBe("vegan");

    const budget = await vault.get("prefs/budget");
    expect(budget!.value).toBe(5000);
  });

  test("insert with public visibility stores plaintext", async () => {
    const vault = await createVault(createMockOrbitDB(), {});

    await vault.insert({ profile: { name: "Bob" } }, { visibility: "public" });

    const raw = await vault.db.get("profile/name");
    expect(raw).toBe("Bob");
  });

  test("backward compat: no encryption config + public works", async () => {
    const vault = await createVault(createMockOrbitDB(), {});

    await vault.put("hello", "world", { visibility: "public" });
    const entry = await vault.get("hello");
    expect(entry!.value).toBe("world");
  });

  test("del removes encrypted data", async () => {
    const aes = new AESEngine({ kdf: "hkdf-sha256" });
    const key = await deriveTestKey(aes);
    const vault = await createVault(createMockOrbitDB(), { aesEngine: aes });
    vault.setDefaultKey(key);

    await vault.put("temp", 42, { visibility: "private" });
    await vault.del("temp");
    const result = await vault.get("temp");
    expect(result).toBeNull();
  });

  test("setAuthSig enables Lit auto-decryption in get()", async () => {
    const mockEncryptionLayer = {
      encrypt: async (_data: any, opts: any) => ({
        engine: "lit" as const,
        ciphertext: new TextEncoder().encode("encrypted"),
        dataToEncryptHash: "hash123",
        accessControlConditions: opts.accessConditions ?? [],
        chain: "base" as const,
      }),
      decrypt: async (_encrypted: any, opts: any) => {
        if (!opts?.authSig) throw new Error("No authSig");
        return new TextEncoder().encode(JSON.stringify("decrypted-value"));
      },
    };

    const vault = await createVault(createMockOrbitDB(), {
      encryptionLayer: mockEncryptionLayer as any,
    });

    const authSig = {
      sig: "0xsig",
      derivedVia: "web3.eth.personal.sign",
      signedMessage: "test",
      address: "0xABCD",
    };
    vault.setAuthSig(authSig);

    // Put with Lit encryption
    await vault.put("shared/secret", "my-data", {
      visibility: "shared",
      engine: "lit",
      accessConditions: [],
    });

    // get() should auto-decrypt using stored authSig
    const entry = await vault.get("shared/secret");
    expect(entry).not.toBeNull();
    expect(entry!.value).toBe("decrypted-value");
  });

  test("query auto-decrypts private entries", async () => {
    const aes = new AESEngine({ kdf: "hkdf-sha256" });
    const key = await deriveTestKey(aes);
    const vault = await createVault(createMockOrbitDB(), { aesEngine: aes });
    vault.setDefaultKey(key);

    await vault.put("search/a", "alpha", { visibility: "private" });
    await vault.put("search/b", "beta", { visibility: "private" });

    const results = await vault.query({ prefix: "search/" });
    expect(results).toHaveLength(2);
    const values = results.map((r: any) => r.value);
    expect(values).toContain("alpha");
    expect(values).toContain("beta");
  });
});
