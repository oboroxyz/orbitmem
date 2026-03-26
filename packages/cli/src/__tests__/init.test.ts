import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { init } from "../commands/init.js";
import { loadConfig } from "../config.js";

const TEST_DIR = join(import.meta.dir, ".test-orbitmem-init");

// Use a unique wallet name per test run to avoid OWS keystore conflicts
const RUN_ID = Date.now().toString(36);

async function deleteTestWallet(name: string): Promise<void> {
  try {
    const { deleteWallet } = await import("@open-wallet-standard/core");
    deleteWallet(name);
  } catch {
    // ignore — wallet may not exist
  }
}

describe("init", () => {
  beforeEach(() => {
    process.env.ORBITMEM_HOME = TEST_DIR;
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Clean up config dir
    rmSync(TEST_DIR, { recursive: true, force: true });
    delete process.env.ORBITMEM_HOME;
  });

  test("creates config file with walletName", async () => {
    const walletName = `test-init-a-${RUN_ID}`;
    try {
      await init([], { name: walletName });
      const config = loadConfig();
      expect(config.walletName).toBe(walletName);
    } finally {
      await deleteTestWallet(walletName);
    }
  });

  test("config has default network and relay", async () => {
    const walletName = `test-init-b-${RUN_ID}`;
    try {
      await init([], { name: walletName });
      const config = loadConfig();
      expect(config.network).toBe("base-sepolia");
      expect(config.relay).toBe("https://orbitmem-relay.fly.dev");
      expect(config.registryAddress).toBe("0x9eE44938ED77227470CaA2DbCC0459F49d249B7A");
      expect(config.reputationAddress).toBe("0x1Bce77f90C33A5f8faCa54782Ce3a17d1AD7109a");
    } finally {
      await deleteTestWallet(walletName);
    }
  });
});
