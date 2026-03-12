import { loadConfig, loadKey } from "../config.js";
import { createClient } from "../utils/client.js";
import { error, output } from "../utils/output.js";

export async function discover(args: string[], flags: Record<string, string>): Promise<void> {
  const config = loadConfig();
  if (flags.relay) config.relay = flags.relay;
  if (!config.registryAddress)
    error("No registry address configured. Set registryAddress in ~/.orbitmem/config.json");

  const client = await createClient(config, loadKey());

  try {
    const query: Record<string, unknown> = {};
    if (args[0]) query.schema = args[0];
    if (flags.tags) query.tags = flags.tags.split(",");
    if (flags["min-quality"]) query.minQuality = Number(flags["min-quality"]);

    const results = await client.discovery.findData(query);

    if (flags.json !== undefined) {
      output(results, true);
    } else if (results.length === 0) {
      process.stdout.write("No data found\n");
    } else {
      const rows = results.map((r: any) => ({
        id: r.dataId,
        name: r.name,
        quality: r.quality,
        vault: `${String(r.vaultAddress ?? "").slice(0, 10)}...`,
      }));
      output(rows, false);
    }
  } finally {
    await client.destroy();
  }
}
