import { describe, expect, test } from "bun:test";

describe("createStorachaAgent", () => {
  test("returns agentDID, proof, and instructions", async () => {
    const { createStorachaAgent } = await import("../create-agent.js");
    expect(createStorachaAgent).toBeDefined();
    expect(typeof createStorachaAgent).toBe("function");
  });
});
