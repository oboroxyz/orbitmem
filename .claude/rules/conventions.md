## Code Conventions

- **TypeScript strict mode** with `noUnusedLocals` and `noUnusedParameters`
- **Vite+** for linting and formatting (Oxlint + Oxfmt): 2-space indent, 100-char line width, organized imports
- **Interface prefix** — all layer interfaces use `I` prefix (e.g., `IDataLayer`, `IEncryptionLayer`)
- **ESM imports** — use `.js` extension in import paths (bundler module resolution)
- **`export type` / `import type`** for type-only imports
- **Test files** live in `src/**/__tests__/*.test.ts` using `bun:test` (`describe`, `test`, `expect`)
- **Integration tests** in relay use Hono's `app.request()` without starting an HTTP server
- **SDK exports** six entry points: `.` (main), `./agent`, `./discovery`, `./transport`, `./contracts`, `./types`
- **Solidity** uses `forge fmt` (4-space indent, 100-char line width), optimizer enabled with 200 runs
- **Contract tests** in `test/*.t.sol` follow Foundry conventions (`test_` prefix, `setUp()`, `vm.expectRevert`)
- **CI** runs 4 parallel jobs: lint (Vite+ / Oxlint + Oxfmt), test (bun test), contracts (forge build/test/fmt --check), typecheck (tsc --noEmit)
