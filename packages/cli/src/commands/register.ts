import { loadConfig } from "../config.js";
import { createClient } from "../utils/client.js";
import { createRelayVaultClient } from "../utils/relay-client.js";
import { error, output } from "../utils/output.js";

export async function register(args: string[], flags: Record<string, string>): Promise<void> {
  const [path] = args;
  if (!path) error("Usage: orbitmem register <path>");

  const config = loadConfig();
  if (flags.relay) config.relay = flags.relay;
  if (!config.registryAddress)
    error("No registry address configured. Set registryAddress in ~/.orbitmem/config.json");

  // Fetch vault entry via relay (fast) or local OrbitDB (--local)
  let entry: { value: unknown } | null = null;
  if (flags.local === undefined && config.relay) {
    const relay = await createRelayVaultClient(config);
    entry = await relay.get(path);
  }

  const client = await createClient(config);

  try {
    if (!entry) {
      entry = await client.vault.get(path);
    }
    if (!entry) error(`Vault entry not found: ${path}`);

    // Auto-extract tags/name/description from stored data if available
    const data = typeof entry.value === "object" && entry.value !== null ? entry.value as Record<string, unknown> : {};
    const name = flags.name ?? (typeof data.name === "string" ? data.name : path);
    const description = flags.description ?? (typeof data.description === "string" ? data.description : "");
    const tags = flags.tags
      ? flags.tags.split(",")
      : Array.isArray(data.tags)
        ? data.tags.filter((t): t is string => typeof t === "string")
        : [];

    const result = await client.discovery.registerData({
      key: path,
      name,
      description,
      schema: flags.schema,
      tags,
    });

    if (flags.json !== undefined) {
      output(result, true);
    } else {
      process.stdout.write(`Registered "${path}" on-chain\n`);
      process.stdout.write(`  Data ID: ${(result as any).dataId}\n`);
      if (tags.length > 0) process.stdout.write(`  Tags: ${tags.join(", ")}\n`);
    }
  } finally {
    await client.destroy();
  }
}
