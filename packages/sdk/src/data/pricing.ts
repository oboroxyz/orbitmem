import type { IVaultPricing, VaultPricing } from "../types.js";

const PRICING_PREFIX = "pricing/";
const DEFAULT_KEY = "pricing/_default";

/**
 * Create pricing CRUD methods backed by a vault's `-meta` OrbitDB store.
 * Pricing keys live under the `pricing/` prefix in metadata.
 */
export function createVaultPricing(metaDb: any): IVaultPricing {
  return {
    async setPrice(path: string, pricing: VaultPricing): Promise<void> {
      const key = path === "_default" ? DEFAULT_KEY : `${PRICING_PREFIX}${path}`;
      await metaDb.put(key, { amount: pricing.amount, currency: pricing.currency });
    },

    async getPrice(path: string): Promise<VaultPricing | null> {
      // Try per-path price first
      const key = `${PRICING_PREFIX}${path}`;
      const perPath = await metaDb.get(key);
      if (perPath?.amount != null) {
        return { amount: perPath.amount, currency: perPath.currency };
      }

      // Fall back to _default
      const fallback = await metaDb.get(DEFAULT_KEY);
      if (fallback?.amount != null) {
        return { amount: fallback.amount, currency: fallback.currency };
      }

      return null;
    },

    async removePrice(path: string): Promise<void> {
      const key = path === "_default" ? DEFAULT_KEY : `${PRICING_PREFIX}${path}`;
      await metaDb.del(key);
    },

    async listPrices(): Promise<Array<{ path: string } & VaultPricing>> {
      const all = await metaDb.all();
      const results: Array<{ path: string } & VaultPricing> = [];

      // Navigate into the "pricing" subtree of the nested OrbitDB
      const pricingTree = all?.pricing;
      if (!pricingTree || typeof pricingTree !== "object") return results;

      // Walk the pricing subtree to find all pricing entries (may be nested)
      const walk = (obj: any, prefix: string) => {
        for (const [k, v] of Object.entries(obj)) {
          const path = prefix ? `${prefix}/${k}` : k;
          if (v && typeof v === "object" && "amount" in (v as any) && "currency" in (v as any)) {
            results.push({ path, ...(v as VaultPricing) });
          } else if (v && typeof v === "object") {
            walk(v, path);
          }
        }
      };

      walk(pricingTree, "");
      return results;
    },
  };
}
