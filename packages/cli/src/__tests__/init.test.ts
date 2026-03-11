import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { init } from "../commands/init.js";
import { loadConfig, loadKey } from "../config.js";

const TEST_DIR = join(import.meta.dir, ".test-orbitmem-init");

describe("init", () => {
  beforeEach(() => {
    process.env.ORBITMEM_HOME = TEST_DIR;
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    delete process.env.ORBITMEM_HOME;
  });

  test("creates config and key files", async () => {
    await init([], {});
    expect(existsSync(join(TEST_DIR, "config.json"))).toBe(true);
    expect(existsSync(join(TEST_DIR, "key.json"))).toBe(true);
  });

  test("generated key is a valid hex private key", async () => {
    await init([], {});
    const key = loadKey();
    expect(key).toMatch(/^0x[0-9a-f]{64}$/);
  });

  test("config has default network and relay", async () => {
    await init([], {});
    const config = loadConfig();
    expect(config.network).toBe("base-sepolia");
    expect(config.relay).toBe("https://relay.orbitmem.0x7.sh");
    expect(config.registryAddress).toBe("0x9eE44938ED77227470CaA2DbCC0459F49d249B7A");
    expect(config.reputationAddress).toBe("0x1Bce77f90C33A5f8faCa54782Ce3a17d1AD7109a");
  });
});
