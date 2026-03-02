import { describe, expect, test } from "bun:test";
import type { LitAccessCondition } from "../../types.js";
import { LitEngine } from "../lit.js";

const _testConditions: LitAccessCondition[] = [
  {
    conditionType: "evmBasic",
    contractAddress: "",
    standardContractType: "",
    chain: "base",
    method: "",
    parameters: [":userAddress"],
    returnValueTest: {
      comparator: "=",
      value: "0x1234567890abcdef1234567890abcdef12345678",
    },
  },
];

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
});
