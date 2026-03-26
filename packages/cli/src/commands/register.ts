import { loadConfig } from "../config.js";
import { createClient } from "../utils/client.js";
import { error, output } from "../utils/output.js";

export async function register(args: string[], flags: Record<string, string>): Promise<void> {
  const [path] = args;
  if (!path) error("Usage: orbitmem register <path>");

  const config = loadConfig();
  if (flags.relay) config.relay = flags.relay;
  if (!config.registryAddress)
    error("No registry address configured. Set registryAddress in ~/.orbitmem/config.json");

  const client = await createClient(config);

  try {
    const entry = await client.vault.get(path);
    if (!entry) error(`Vault entry not found: ${path}`);

    const result = await client.discovery.registerData({
      key: path,
      name: flags.name ?? path,
      description: flags.description ?? "",
      schema: flags.schema,
      tags: flags.tags ? flags.tags.split(",") : [],
    });

    if (flags.json !== undefined) {
      output(result, true);
    } else {
      process.stdout.write(`Registered "${path}" on-chain\n`);
      process.stdout.write(`  Data ID: ${(result as any).dataId}\n`);
    }
  } finally {
    await client.destroy();
  }
}
