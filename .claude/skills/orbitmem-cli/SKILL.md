---
name: orbitmem-cli
description: Develops and extends the OrbitMem CLI (npx orbitmem). Use when adding commands, modifying CLI behavior, debugging CLI issues, or working on packages/cli/ in the orbitmem monorepo.
---

# OrbitMem CLI

`packages/cli/` published as `@orbitmem/cli`. Root `package.json` bin entry enables `npx orbitmem`.

## Structure

```
packages/cli/src/
├── index.ts          # bin entry, argv parsing, command router
├── config.ts         # load/save ~/.orbitmem/{config,key}.json
├── commands/         # one file per command (init, vault, register, discover, snapshot, dev, status)
└── utils/
    ├── output.ts     # table/json formatting
    └── client.ts     # shared createOrbitMem() bootstrap
```

## Config (`~/.orbitmem/`)

| File | Contents |
|------|----------|
| `config.json` | `{ relay, chain, registryAddress, reputationAddress }` |
| `key.json` | Generated EVM private key |
| `vault/` | Local OrbitDB data directory |

## Command → SDK layer mapping

| Command | SDK Layer(s) |
|---------|-------------|
| `init` | Identity (key gen via viem) |
| `vault store/get/ls` | Data (vault) + Encryption |
| `register` | Discovery (on-chain registry) |
| `discover` | Discovery (findData) |
| `snapshot` | Persistence (Storacha) |
| `dev` | Relay (spawn server) |
| `status` | Config + Identity |

## Conventions

- **Shared flags**: `--relay <url>`, `--chain <name>`, `--json` — parsed in `index.ts`, override config values
- **Output**: Use `utils/output.ts`. Default: human-readable. `--json`: machine-readable. Errors: stderr + non-zero exit
- **Testing**: `packages/cli/src/__tests__/`, mock SDK layers, use `bun:test`
- **SDK wiring**: `utils/client.ts` calls `createOrbitMem()` from `@orbitmem/sdk`

## Adding commands

See [adding-commands.md](adding-commands.md) for the full pattern, checklist, and common mistakes.
