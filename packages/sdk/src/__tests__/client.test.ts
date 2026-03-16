import { describe, expect, test } from "bun:test";

import { hasOrbitDbNativeSupport } from "./orbitdb-availability.js";

// Skip if native OrbitDB dependencies are unavailable (e.g. CI without the compiled binary)
const orbitdbAvailable = hasOrbitDbNativeSupport();

describe.skipIf(!orbitdbAvailable)("createOrbitMem", () => {
  test("initializes all layers", async () => {
    const { createOrbitMem } = await import("../client.js");
    const orbitmem = await createOrbitMem({
      identity: { chains: ["evm"] },
      encryption: { defaultEngine: "aes", aes: { kdf: "hkdf-sha256" } },
      discovery: {
        dataRegistry: "0xDATA" as any,
        reputationRegistry: "0xREP" as any,
        registryChain: "base",
      },
    });

    expect(orbitmem.identity).toBeDefined();
    expect(orbitmem.vault).toBeDefined();
    expect(orbitmem.encryption).toBeDefined();
    expect(orbitmem.transport).toBeDefined();
    expect(orbitmem.discovery).toBeDefined();
    expect(orbitmem.persistence).toBeDefined();

    await orbitmem.destroy();
  });
});
