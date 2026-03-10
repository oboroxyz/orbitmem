import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";

const TEST_DIR = join(import.meta.dir, ".test-orbitmem-cli");
const CLI = join(import.meta.dir, "..", "index.ts");

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
    const proc = Bun.spawn(["bun", CLI, "init", "--json"], {
      env: { ...process.env, ORBITMEM_HOME: TEST_DIR },
      stdout: "pipe",
    });
    const text = await new Response(proc.stdout).text();
    await proc.exited;
    const result = JSON.parse(text);
    expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(result.relay).toBe("https://relay.orbitmem.xyz");
  });

  test("status --json after init shows config", async () => {
    // First init
    const initProc = Bun.spawn(["bun", CLI, "init"], {
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
    expect(result.chain).toBe("base");
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
