# Adding a CLI Command

Each command exports an async function, registers in the router, and uses shared config/client utilities.

## Command file

Create `packages/cli/src/commands/<name>.ts`:

```typescript
import { loadConfig, loadKey } from "../config.js";
import { createClient } from "../utils/client.js";
import { output } from "../utils/output.js";

export async function commandName(args: string[], flags: Record<string, string>) {
  const config = loadConfig();
  const key = loadKey();
  const client = await createClient(config, key);

  try {
    const result = await client.someLayer.someMethod();
    output(result, flags.json !== undefined);
  } finally {
    await client.destroy();
  }
}
```

## Register in router

Add to `packages/cli/src/index.ts`:

```typescript
case "commandname":
  const { commandName } = await import("./commands/name.js");
  await commandName(args.slice(1), flags);
  break;
```

## Subcommands

For commands with subcommands (like `vault store`, `vault get`), use a nested switch in the command file. See `commands/vault.ts` for the pattern.

## Checklist

- [ ] Command file in `packages/cli/src/commands/`
- [ ] Registered in `index.ts` router
- [ ] Uses `loadConfig()` and `loadKey()` from config
- [ ] Calls `client.destroy()` in finally block
- [ ] Supports `--json` flag via `output()` helper
- [ ] Test file in `packages/cli/src/__tests__/`
- [ ] Help text added to usage output

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Forgetting `client.destroy()` | Always use try/finally — OrbitDB leaves processes hanging |
| Hardcoding relay URL | Read from config, allow `--relay` override |
| Not handling missing config | Check for `~/.orbitmem/config.json`, suggest `orbitmem init` |
| Using `console.log` for output | Use `output()` helper for `--json` support |
