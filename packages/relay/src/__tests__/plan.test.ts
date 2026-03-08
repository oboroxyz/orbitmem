import { describe, expect, test } from "bun:test";
import { PlanService } from "../services/plan.js";

describe("PlanService", () => {
  test("unknown signer gets free tier", async () => {
    const plan = new PlanService();
    const info = await plan.getPlan("0xNEW");
    expect(info.tier).toBe("free");
    expect(info.storageLimit).toBe(5 * 1024 * 1024);
    expect(info.used).toBe(0);
  });

  test("addUsage tracks bytes", async () => {
    const plan = new PlanService();
    await plan.addUsage("0xUSER", 1000);
    await plan.addUsage("0xUSER", 2000);
    const usage = await plan.getUsage("0xUSER");
    expect(usage.used).toBe(3000);
  });

  test("removeUsage decrements bytes", async () => {
    const plan = new PlanService();
    await plan.addUsage("0xUSER", 5000);
    await plan.removeUsage("0xUSER", 2000);
    const usage = await plan.getUsage("0xUSER");
    expect(usage.used).toBe(3000);
  });

  test("removeUsage does not go below zero", async () => {
    const plan = new PlanService();
    await plan.addUsage("0xUSER", 100);
    await plan.removeUsage("0xUSER", 500);
    const usage = await plan.getUsage("0xUSER");
    expect(usage.used).toBe(0);
  });

  test("setPlan changes tier and limit", async () => {
    const plan = new PlanService();
    await plan.setPlan("0xUSER", "pro");
    const info = await plan.getPlan("0xUSER");
    expect(info.tier).toBe("pro");
    expect(info.storageLimit).toBe(50 * 1024 * 1024 * 1024);
  });

  test("getUsage returns limit based on tier", async () => {
    const plan = new PlanService();
    await plan.setPlan("0xUSER", "starter");
    const usage = await plan.getUsage("0xUSER");
    expect(usage.limit).toBe(10 * 1024 * 1024 * 1024);
    expect(usage.tier).toBe("starter");
  });
});
