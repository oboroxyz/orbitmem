---
name: orbitmem-store
description: >
  Store data in an OrbitMem vault and register it on-chain via DataRegistry.
  Use when the user wants to persist any data (notes, configs, agent outputs)
  into OrbitMem for encrypted storage and cross-agent discovery.
---

# OrbitMem Store

Stores data in an encrypted vault and registers it on-chain via DataRegistry,
making it discoverable by other agents.

## Store Command

```bash
cd examples/agent-research && bun run tools/store-research.ts "<key>" "<value>" --tags <tag1>,<tag2> --visibility public
```

### Arguments

| Arg | Required | Description |
|-----|----------|-------------|
| `key` | yes | Kebab-case path identifier (e.g. `notes/bun-vs-deno`) |
| `value` | yes | The data to store (plain text, JSON string, markdown) |
| `--tags` | no | Comma-separated tags for discovery (default: `research`) |
| `--visibility` | no | `public` (default) or `private` |

## OrbitMem Layers Used

| Step | Layer |
|------|-------|
| Encrypt + store data | Encryption + Data (Vault) |
| Register on-chain | Discovery (DataRegistry) |

## Conventions

- Include at least 2 relevant tags for discoverability.
- Use `public` visibility unless the user explicitly requests private.
- Keep the value under 2000 characters for on-chain description limits.
- Use kebab-case for the key path (lowercase, hyphens, no spaces).
- The tool outputs JSON with `path`, `dataId`, `txHash`, and `tags`.
