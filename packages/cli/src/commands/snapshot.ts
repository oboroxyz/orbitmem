import { loadConfig, loadKey } from "../config.js";
import { createClient } from "../utils/client.js";
import { output } from "../utils/output.js";

export async function snapshot(_args: string[], flags: Record<string, string>): Promise<void> {
  const config = loadConfig();
  if (flags.relay) config.relay = flags.relay;
  const client = await createClient(config, loadKey());

  try {
    const snap = await client.vault.exportSnapshot();
    const result = await client.persistence.archive({
      data: snap.data,
      entryCount: snap.entryCount,
      label: flags.label,
    });

    if (flags.json !== undefined) {
      output(result, true);
    } else {
      process.stdout.write(`Snapshot archived!\n`);
      process.stdout.write(`  CID:     ${(result as any).cid}\n`);
      process.stdout.write(`  Size:    ${(result as any).size} bytes\n`);
      process.stdout.write(`  Entries: ${(result as any).entryCount}\n`);
    }
  } finally {
    await client.destroy();
  }
}
