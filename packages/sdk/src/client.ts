import type {
  IOrbitMem,
  OrbitMemConfig,
  WalletConnection,
  EncryptedData,
  EncryptLitOptions,
  EncryptAESOptions,
  DecryptOptions,
} from './types.js';
import { createIdentityLayer } from './identity/index.js';
import { createEncryptionLayer } from './encryption/index.js';
import { createVault, createOrbitDBInstance } from './data/index.js';
import { createTransportLayer } from './transport/index.js';
import { createDiscoveryLayer } from './discovery/index.js';
import { createPersistenceLayer } from './persistence/index.js';

export async function createOrbitMem(config: OrbitMemConfig): Promise<IOrbitMem> {
  // Initialize identity layer
  const identity = createIdentityLayer(config.identity);

  // Initialize encryption layer
  const encryption = createEncryptionLayer(config.encryption ?? {
    defaultEngine: 'aes',
    aes: { kdf: 'hkdf-sha256' },
  });

  // Initialize OrbitDB + vault
  const { orbitdb, cleanup: orbitdbCleanup } = await createOrbitDBInstance({
    directory: config.vault?.dbName ? `./${config.vault.dbName}` : './orbitdb',
  });
  const vault = await createVault(orbitdb, {
    dbName: config.vault?.dbName,
  });

  // Initialize transport layer with a placeholder signer
  // (gets wired to identity layer when a wallet connects)
  const transport = createTransportLayer({
    signer: async (payload) => {
      const session = identity.getActiveSession();
      if (!session) throw new Error('No active session — connect a wallet first');
      // Delegate to identity layer's signChallenge
      const message = new TextDecoder().decode(payload);
      const { signature, algorithm } = await identity.signChallenge(message);
      return { signature, algorithm };
    },
    signerAddress: '0x0' as any,
    family: 'evm',
  });

  // Initialize discovery layer
  const discovery = config.discovery
    ? createDiscoveryLayer(config.discovery)
    : createDiscoveryLayer({
        agentRegistry: '0x0' as any,
        dataRegistry: '0x0' as any,
        reputationRegistry: '0x0' as any,
        registryChain: 'base',
      });

  // Initialize persistence layer
  const persistence = createPersistenceLayer({
    spaceDID: config.persistence?.spaceDID ?? '',
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
      return identity.connect(opts);
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
