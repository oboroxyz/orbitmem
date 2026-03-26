import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { loadConfig, saveConfig } from "../config.js";

const TEST_DIR = join(import.meta.dir, ".test-orbitmem");

describe("config", () => {
  beforeEach(() => {
    process.env.ORBITMEM_HOME = TEST_DIR;
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    delete process.env.ORBITMEM_HOME;
  });

  test("saveConfig and loadConfig roundtrip", () => {
    const config = { relay: "http://localhost:3000", chain: "base" as const };
    saveConfig(config);
    const loaded = loadConfig();
    expect(loaded.relay).toBe("http://localhost:3000");
    expect(loaded.chain).toBe("base");
  });

  test("loadConfig returns defaults when no file exists", () => {
    const config = loadConfig();
    expect(config.relay).toBe("https://orbitmem-relay.fly.dev");
    expect(config.chain).toBe("base-sepolia");
  });

  test("saveConfig persists walletName", () => {
    saveConfig({ walletName: "my-wallet" });
    const loaded = loadConfig();
    expect(loaded.walletName).toBe("my-wallet");
  });
});
