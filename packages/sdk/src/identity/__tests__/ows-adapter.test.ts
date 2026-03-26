import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createOwsAdapter } from "../ows-adapter.js";

const WALLET = "orbitmem-test-adapter";
const CHAIN = "eip155:84532"; // Base Sepolia

describe("ows-adapter", () => {
  beforeAll(async () => {
    const { createWallet, listWallets } = await import("@open-wallet-standard/core");
    const existing = listWallets().find((w) => w.name === WALLET);
    if (!existing) {
      createWallet(WALLET);
    }
  });

  afterAll(async () => {
    try {
      const { deleteWallet } = await import("@open-wallet-standard/core");
      deleteWallet(WALLET);
    } catch {
      // ignore
    }
  });

  test("getAddress returns a valid EVM address", async () => {
    const adapter = createOwsAdapter(WALLET, CHAIN);
    const address = await adapter.getAddress();
    expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  test("signMessage returns a Uint8Array signature", async () => {
    const adapter = createOwsAdapter(WALLET, CHAIN);
    const result = await adapter.signMessage("hello");
    expect(result.signature).toBeInstanceOf(Uint8Array);
    expect(result.signature.length).toBeGreaterThan(0);
    expect(result.algorithm).toBe("ecdsa-secp256k1");
  });

  test("toViemAccount returns account with address and sign methods", async () => {
    const adapter = createOwsAdapter(WALLET, CHAIN);
    const account = await adapter.toViemAccount();
    expect(account.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(typeof account.signMessage).toBe("function");
    expect(typeof account.signTransaction).toBe("function");
  });
});
