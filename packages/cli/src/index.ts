#!/usr/bin/env node

function parseArgs(argv: string[]): {
  command: string;
  args: string[];
  flags: Record<string, string>;
} {
  const raw = argv.slice(2);
  const flags: Record<string, string> = {};
  const positional: string[] = [];

  for (let i = 0; i < raw.length; i++) {
    if (raw[i].startsWith("--")) {
      const key = raw[i].slice(2);
      const next = raw[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = "";
      }
    } else {
      positional.push(raw[i]);
    }
  }

  return {
    command: positional[0] ?? "help",
    args: positional.slice(1),
    flags,
  };
}

function printUsage(): void {
  process.stdout.write(`
Usage: orbitmem <command> [options]

Commands:
  init                       Generate keys and create config
  status                     Show identity, config, and vault info
  vault store <path> <value> Store data in vault
  vault get <path>           Read data from vault
  vault ls [prefix]          List vault keys
  register <path>            Register data on-chain (ERC-8004)
  discover [query]           Search on-chain registries
  snapshot                   Persist vault to Storacha
  dev                        Start local relay server

Options:
  --relay <url>     Override relay URL
  --chain <name>    Override chain
  --json            Output as JSON
  --help            Show this help

`);
}

async function main(): Promise<void> {
  const { command, args, flags } = parseArgs(process.argv);

  if (flags.help !== undefined || command === "help") {
    printUsage();
    return;
  }

  switch (command) {
    case "init": {
      const { init } = await import("./commands/init.js");
      await init(args, flags);
      break;
    }
    case "status": {
      const { status } = await import("./commands/status.js");
      await status(args, flags);
      break;
    }
    case "vault": {
      const { vault } = await import("./commands/vault.js");
      await vault(args, flags);
      break;
    }
    case "register": {
      const { register } = await import("./commands/register.js");
      await register(args, flags);
      break;
    }
    case "discover": {
      const { discover } = await import("./commands/discover.js");
      await discover(args, flags);
      break;
    }
    case "snapshot": {
      const { snapshot } = await import("./commands/snapshot.js");
      await snapshot(args, flags);
      break;
    }
    case "dev": {
      const { dev } = await import("./commands/dev.js");
      await dev(args, flags);
      break;
    }
    default:
      process.stderr.write(`Unknown command: ${command}\n`);
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`error: ${err.message}\n`);
  process.exit(1);
});
