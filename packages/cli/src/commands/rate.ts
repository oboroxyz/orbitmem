import { loadConfig } from "../config.js";
import { createClient } from "../utils/client.js";
import { error, output } from "../utils/output.js";

export async function rate(args: string[], flags: Record<string, string>): Promise<void> {
  const config = loadConfig();
  if (flags.relay) config.relay = flags.relay;
  if (!config.registryAddress)
    error("No registry address configured. Set registryAddress in ~/.orbitmem/config.json");

  const dataId = Number(args[0]);
  const score = Number(args[1]);

  if (!Number.isInteger(dataId) || dataId < 0)
    error("Usage: orbitmem rate <dataId> <score> [--tag <tag>]");
  if (!Number.isFinite(score)) error("Score must be a number");

  const client = await createClient(config);

  try {
    const result = await client.discovery.rateData({
      dataId,
      value: score,
      tag1: flags.tag ?? "",
      tag2: flags.tag2 ?? "",
      feedbackURI: flags.uri ?? "",
    });

    if (flags.json !== undefined) {
      output(result, true);
    } else {
      process.stdout.write(`Rated data #${dataId} with score ${score}\n`);
      process.stdout.write(`  tx: ${result.txHash}\n`);
    }
  } finally {
    await client.destroy();
  }
}
