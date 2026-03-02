export { createOrbitMem } from './client.js';
export * from './types.js';
// Layer-level exports for advanced usage
export { createEncryptionLayer } from './encryption/index.js';
export { createVault, createOrbitDBInstance } from './data/index.js';
export { createIdentityLayer } from './identity/index.js';
export { createTransportLayer } from './transport/index.js';
export { createDiscoveryLayer, MockRegistry } from './discovery/index.js';
export { createPersistenceLayer } from './persistence/index.js';
