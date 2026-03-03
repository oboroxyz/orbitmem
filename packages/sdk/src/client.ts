import { createOrbitDBInstance, createVault } from "./data/index.js";
import { createDiscoveryLayer } from "./discovery/index.js";
import { createEncryptionLayer } from "./encryption/index.js";
import { createIdentityLayer } from "./identity/index.js";
import { createPersistenceLayer } from "./persistence/index.js";
import { createTransportLayer } from "./transport/index.js";
import type { IOrbitMem, OrbitMemConfig } from "./types.js";

export async function createOrbitMem(config: OrbitMemConfig): Promise<IOrbitMem> {
  // Initialize identity layer
  const identity = createIdentityLayer(config.identity);

  // Initialize encryption layer
  const encryption = createEncryptionLayer(
    config.encryption ?? {
      defaultEngine: "aes",
      aes: { kdf: "hkdf-sha256" },
    },
  );

  // Initialize OrbitDB + vault
  const { orbitdb, cleanup: orbitdbCleanup } = await createOrbitDBInstance({
    directory: config.vault?.dbName ? `./${config.vault.dbName}` : "./orbitdb",
  });
  const vault = await createVault(orbitdb, {
    dbName: config.vault?.dbName,
    aesEngine: encryption.aes,
    encryptionLayer: encryption,
  });

  // Initialize transport layer with a placeholder signer
  // (gets wired to identity layer when a wallet connects)
  const transport = createTransportLayer({
    signer: async (payload) => {
      const session = identity.getActiveSession();
      if (!session) throw new Error("No active session — connect a wallet first");
      // Delegate to identity layer's signChallenge
      const message = new TextDecoder().decode(payload);
      const { signature, algorithm } = await identity.signChallenge(message);
      return { signature, algorithm };
    },
    signerAddress: "0x0" as any,
    family: "evm",
  });

  // Initialize discovery layer
  const discovery = config.discovery
    ? createDiscoveryLayer(config.discovery)
    : createDiscoveryLayer({
        dataRegistry: "0x0" as any,
        reputationRegistry: "0x0" as any,
        registryChain: "base",
      });

  // Initialize persistence layer
  const persistence = createPersistenceLayer({
    spaceDID: config.persistence?.spaceDID ?? "",
    mock: !config.persistence?.spaceDID,
  });

  return {
    identity,
    vault,
    encryption,
    transport,
    persistence,
    discovery,

    async connect(opts) {
      const result = await identity.connect(opts);
      // Derive a deterministic AES key from the wallet signature for vault encryption
      try {
        const { signature } = await identity.signChallenge("OrbitMem Vault Key v1");
        const hash = new Uint8Array(
          await crypto.subtle.digest("SHA-256", new Uint8Array(signature)),
        );
        const key = await encryption.aes.deriveKey({ type: "raw", key: hash });
        vault.setDefaultKey(key);
      } catch {
        // Key derivation is best-effort — vault works without it for public data
      }

      // Generate Lit authSig for decrypting Lit-encrypted vault entries
      if (encryption.lit && result.family === "evm") {
        try {
          const message = "OrbitMem Lit Auth";
          const { signature } = await identity.signChallenge(message);
          const sig =
            "0x" +
            Array.from(new Uint8Array(signature))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");
          vault.setAuthSig({
            sig,
            derivedVia: "web3.eth.personal.sign",
            signedMessage: message,
            address: result.address as string,
          });
        } catch {
          // Lit auth is best-effort — vault works without it for public/AES data
        }
      }

      return result;
    },

    async disconnect() {
      await identity.disconnect();
    },

    async encrypt(data, opts) {
      return encryption.encrypt(data, opts);
    },

    async decrypt(encrypted, opts) {
      return encryption.decrypt(encrypted, opts);
    },

    async destroy() {
      await vault.close();
      await orbitdbCleanup();
      await identity.disconnect();
    },
  };
}
