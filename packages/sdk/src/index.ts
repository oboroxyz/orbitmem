export { createOrbitMem } from "./client.js";
export { createOrbitDBInstance, createVault } from "./data/index.js";
export { createDiscoveryLayer, MockRegistry, OnChainRegistry } from "./discovery/index.js";
// Layer-level exports for advanced usage
export { createEncryptionLayer } from "./encryption/index.js";
export { createIdentityLayer } from "./identity/index.js";
export { createPersistenceLayer } from "./persistence/index.js";
export { createTransportLayer } from "./transport/index.js";
export * from "./types.js";
