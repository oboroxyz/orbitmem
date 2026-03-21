## Key Patterns

- **Factory functions over classes** — layers are created by factory functions, not class constructors (except `AESEngine`, `LitEngine`, `MockRegistry`, `OnChainRegistry` for discovery)
- **Dual-mode discovery** — `createDiscoveryLayer` auto-selects `OnChainRegistry` (viem `PublicClient`/`WalletClient` provided) or `MockRegistry` (fallback); both implement `IDiscoveryLayer`
- **Contracts -> SDK bridge** — `@orbitmem/contracts` exports TypeScript ABIs (`abi/`) consumed by the SDK's `OnChainRegistry` via workspace dependency
- **Mock-first development** — external dependencies (Storacha, Lit Protocol, on-chain registries) have in-memory mocks for testing; persistence has a `mock: true` flag
- **Interface-driven relay services** — relay uses `IVaultService`/`ISnapshotService`/`IDiscoveryService`/`IPlanService` interfaces with live/mock implementations, wired via `RelayServices`
- **Lazy imports** — Lit Protocol uses dynamic `import()` for heavy dependencies
- **Dual-database vault** — each vault has a primary `nested` OrbitDB for data and a `-meta` OrbitDB for visibility/encryption metadata
- **Nonce-based replay protection** — both SDK transport and relay middleware maintain in-memory nonce caches with 5-minute TTL
