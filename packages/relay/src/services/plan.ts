import type { IPlanService, PlanInfo } from "./types.js";

const PLAN_LIMITS: Record<PlanInfo["tier"], number> = {
  free: 5 * 1024 * 1024,
  starter: 10 * 1024 * 1024 * 1024,
  pro: 50 * 1024 * 1024 * 1024,
  enterprise: Number.POSITIVE_INFINITY,
};

export class PlanService implements IPlanService {
  private plans = new Map<string, { tier: PlanInfo["tier"]; used: number }>();

  async getPlan(signer: string): Promise<PlanInfo> {
    const entry = this.plans.get(signer) ?? { tier: "free" as const, used: 0 };
    return {
      tier: entry.tier,
      storageLimit: PLAN_LIMITS[entry.tier],
      used: entry.used,
    };
  }

  async addUsage(signer: string, bytes: number): Promise<void> {
    const entry = this.plans.get(signer) ?? { tier: "free" as const, used: 0 };
    entry.used += bytes;
    this.plans.set(signer, entry);
  }

  async removeUsage(signer: string, bytes: number): Promise<void> {
    const entry = this.plans.get(signer) ?? { tier: "free" as const, used: 0 };
    entry.used = Math.max(0, entry.used - bytes);
    this.plans.set(signer, entry);
  }

  async getUsage(signer: string): Promise<{ used: number; limit: number; tier: string }> {
    const plan = await this.getPlan(signer);
    return { used: plan.used, limit: plan.storageLimit, tier: plan.tier };
  }

  async setPlan(signer: string, tier: PlanInfo["tier"]): Promise<void> {
    const entry = this.plans.get(signer) ?? { tier: "free" as const, used: 0 };
    entry.tier = tier;
    this.plans.set(signer, entry);
  }
}
