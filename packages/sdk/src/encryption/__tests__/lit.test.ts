import { describe, expect, mock, test } from "bun:test";

import { LitEngine } from "../lit.js";

describe("LitEngine", () => {
  test("creates access conditions correctly", () => {
    const engine = new LitEngine({ network: "datil-dev" });
    const condition = engine.createAddressCondition(
      "0x1234567890abcdef1234567890abcdef12345678",
      "base",
    );
    expect(condition.conditionType).toBe("evmBasic");
    expect(condition.returnValueTest.value).toBe("0x1234567890abcdef1234567890abcdef12345678");
  });

  test("createReputationCondition builds correct contract call condition", () => {
    const engine = new LitEngine({ network: "datil-dev" });
    const condition = engine.createReputationCondition({
      registryAddress: "0xREP_REGISTRY",
      minScore: 80,
      chain: "base",
    });
    expect(condition.conditionType).toBe("evmContract");
    expect(condition.returnValueTest.comparator).toBe(">=");
  });

  test("getSessionSigs calls litClient.getSessionSigs with authNeededCallback", async () => {
    const engine = new LitEngine({ network: "datil-dev" });

    const mockSessionSigs = { "https://node1.lit": { sig: "abc", address: "0x123" } };
    const mockClient = {
      getSessionSigs: mock(async () => mockSessionSigs),
      getLatestBlockhash: mock(async () => "0xblockhash"),
    };
    // Inject mock client
    (engine as any).client = mockClient;

    const authSig = {
      sig: "0xsig",
      derivedVia: "web3.eth.personal.sign",
      signedMessage: "Sign in to OrbitMem",
      address: "0x1234567890abcdef1234567890abcdef12345678",
    };

    const result = await engine.getSessionSigs(authSig, "base");
    expect(result).toEqual(mockSessionSigs);
    expect(mockClient.getSessionSigs).toHaveBeenCalledTimes(1);
  });

  test("decrypt resolves authSig to sessionSigs when authSig object is passed", async () => {
    const engine = new LitEngine({ network: "datil-dev" });

    const mockClient = {
      getSessionSigs: mock(async () => ({ "https://node1.lit": { sig: "abc" } })),
      getLatestBlockhash: mock(async () => "0xblockhash"),
    };
    (engine as any).client = mockClient;

    const authSig = {
      sig: "0xsig",
      derivedVia: "web3.eth.personal.sign",
      signedMessage: "Sign in",
      address: "0xABCD",
    };

    const encrypted = {
      engine: "lit" as const,
      ciphertext: new Uint8Array([10, 20]),
      dataToEncryptHash: "abc123",
      accessControlConditions: [
        {
          conditionType: "evmBasic" as const,
          contractAddress: "" as `0x${string}`,
          standardContractType: "" as const,
          chain: "base" as const,
          method: "",
          parameters: [":userAddress"],
          returnValueTest: { comparator: "=" as const, value: "0xABCD" },
        },
      ],
      chain: "base" as const,
    };

    // Spy on getSessionSigs to verify it's called when authSig is provided
    const getSessionSigsSpy = mock(async () => ({ "https://node1.lit": { sig: "abc" } }));
    engine.getSessionSigs = getSessionSigsSpy;

    // decrypt will fail at the actual Lit decryption (no real Lit network),
    // but we can verify getSessionSigs was called
    try {
      await engine.decrypt(encrypted, authSig);
    } catch {
      // Expected — dynamic import of @lit-protocol/encryption will fail in test
    }
    expect(getSessionSigsSpy).toHaveBeenCalledTimes(1);
  });
});
