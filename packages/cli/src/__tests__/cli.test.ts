import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const TEST_DIR = join(import.meta.dir, ".test-orbitmem-cli");
const CLI = join(import.meta.dir, "..", "index.ts");

// Unique wallet name per test run to avoid OWS keystore conflicts
const RUN_ID = Date.now().toString(36);
const WALLET_NAME = `orbitmem-cli-test-${RUN_ID}`;

async function deleteTestWallet(name: string): Promise<void> {
  try {
    const { deleteWallet } = await import("@open-wallet-standard/core");
    deleteWallet(name);
  } catch {
    // ignore — wallet may not exist
  }
}

describe("CLI integration", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test("--help prints usage", async () => {
    const proc = Bun.spawn(["bun", CLI, "--help"], {
      env: { ...process.env, ORBITMEM_HOME: TEST_DIR },
      stdout: "pipe",
    });
    const text = await new Response(proc.stdout).text();
    await proc.exited;
    expect(text).toContain("Usage: orbitmem");
    expect(text).toContain("init");
    expect(text).toContain("vault");
  });

  test("init --json creates config and returns address", async () => {
    try {
      const proc = Bun.spawn(["bun", CLI, "init", "--json", "--name", WALLET_NAME], {
        env: { ...process.env, ORBITMEM_HOME: TEST_DIR },
        stdout: "pipe",
      });
      const text = await new Response(proc.stdout).text();
      await proc.exited;
      const result = JSON.parse(text);
      expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(result.network).toBe("base-sepolia");
      expect(result.relay).toBe("https://orbitmem-relay.fly.dev");
    } finally {
      await deleteTestWallet(WALLET_NAME);
    }
  });

  test("status --json after init shows config", async () => {
    const walletName = `${WALLET_NAME}-status`;
    try {
      // First init
      const initProc = Bun.spawn(["bun", CLI, "init", "--name", walletName], {
        env: { ...process.env, ORBITMEM_HOME: TEST_DIR },
        stdout: "pipe",
      });
      await initProc.exited;

      // Then status
      const proc = Bun.spawn(["bun", CLI, "status", "--json"], {
        env: { ...process.env, ORBITMEM_HOME: TEST_DIR },
        stdout: "pipe",
      });
      const text = await new Response(proc.stdout).text();
      await proc.exited;
      const result = JSON.parse(text);
      expect(result.address).toMatch(/^0x/);
      expect(result.chain).toBe("base-sepolia");
    } finally {
      await deleteTestWallet(walletName);
    }
  });

  test("unknown command exits with error", async () => {
    const proc = Bun.spawn(["bun", CLI, "nonexistent"], {
      env: { ...process.env, ORBITMEM_HOME: TEST_DIR },
      stdout: "pipe",
      stderr: "pipe",
    });
    const code = await proc.exited;
    expect(code).not.toBe(0);
  });
});
