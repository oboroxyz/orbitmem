import type { Visibility } from "@orbitmem/sdk";
import { loadConfig, loadKey } from "../config.js";
import { createClient } from "../utils/client.js";
import { error, output } from "../utils/output.js";

export async function vault(args: string[], flags: Record<string, string>): Promise<void> {
  const sub = args[0];
  switch (sub) {
    case "store":
      return vaultStore(args.slice(1), flags);
    case "get":
      return vaultGet(args.slice(1), flags);
    case "ls":
      return vaultLs(args.slice(1), flags);
    default:
      error(`Unknown vault command: ${sub ?? "(none)"}. Use: store, get, ls`);
  }
}

async function vaultStore(args: string[], flags: Record<string, string>): Promise<void> {
  const [path, ...valueParts] = args;
  const value = valueParts.join(" ");
  if (!path || !value) error("Usage: orbitmem vault store <path> <value>");

  const config = loadConfig();
  if (flags.relay) config.relay = flags.relay;
  const client = await createClient(config, loadKey());

  try {
    const visibility: Visibility = flags.public !== undefined ? "public" : "private";
    const entry = await client.vault.put(path, value, { visibility });
    const result = {
      path,
      visibility,
      encrypted: entry.encrypted,
      timestamp: entry.timestamp,
    };
    if (flags.json !== undefined) {
      output(result, true);
    } else {
      process.stdout.write(`Stored "${path}" (${visibility})\n`);
    }
  } finally {
    await client.destroy();
  }
}

async function vaultGet(args: string[], flags: Record<string, string>): Promise<void> {
  const [path] = args;
  if (!path) error("Usage: orbitmem vault get <path>");

  const config = loadConfig();
  if (flags.relay) config.relay = flags.relay;
  const client = await createClient(config, loadKey());

  try {
    const entry = await client.vault.get(path);
    if (!entry) error(`Not found: ${path}`);
    output(flags.json !== undefined ? entry : entry.value, flags.json !== undefined);
  } finally {
    await client.destroy();
  }
}

async function vaultLs(args: string[], flags: Record<string, string>): Promise<void> {
  const [prefix] = args;

  const config = loadConfig();
  if (flags.relay) config.relay = flags.relay;
  const client = await createClient(config, loadKey());

  try {
    const keys = await client.vault.keys(prefix);
    if (flags.json !== undefined) {
      output(keys, true);
    } else if (keys.length === 0) {
      process.stdout.write("(no entries)\n");
    } else {
      for (const key of keys) {
        process.stdout.write(`${key}\n`);
      }
    }
  } finally {
    await client.destroy();
  }
}
