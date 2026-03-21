#!/usr/bin/env bun
/**
 * Search research — discovers research memos by tags, schema, or keyword.
 *
 * Usage:
 *   bun run tools/search-research.ts [--tags tag1,tag2] [--min-quality 3] [--keyword text]
 *
 * Example:
 *   bun run tools/search-research.ts --tags runtime,comparison
 *   bun run tools/search-research.ts --keyword "bun vs deno"
 */
import { createAgentClient, printJson } from "./shared.js";

const args = process.argv.slice(2);

// Parse flags
const flags: Record<string, string> = {};
for (let i = 0; i < args.length; i += 2) {
  const key = args[i]?.replace(/^--/, "");
  if (key && args[i + 1]) flags[key] = args[i + 1];
}

const query: Record<string, unknown> = {};
if (flags.tags) query.tags = flags.tags.split(",");
if (flags["min-quality"]) query.minQuality = Number(flags["min-quality"]);
if (flags.keyword) query.keyword = flags.keyword;
if (flags.schema) query.schema = flags.schema;

const { client, config } = await createAgentClient();

try {
  // 1. Search on-chain registry
  const results = await client.discovery.findData(query);

  if (results.length === 0) {
    console.log("No research memos found matching your query.");
    process.exit(0);
  }

  console.log(`Found ${results.length} research memo(s):\n`);

  for (const entry of results) {
    const r = entry as any;
    console.log(`  [${r.dataId}] ${r.name}`);
    console.log(`    Tags: ${r.tags?.join(", ") ?? "—"}`);
    console.log(`    Quality: ${r.quality ?? "unrated"}`);
    console.log(`    Vault: ${String(r.vaultAddress ?? "").slice(0, 20)}...`);
    console.log();
  }

  // 2. Optionally fetch the first result's vault data
  if (results.length > 0 && flags.fetch !== undefined) {
    const first = results[0] as any;
    if (first.vaultAddress && first.key) {
      console.log(`Fetching vault data for "${first.key}"...`);
      const data = await client.vault.get(first.key);
      if (data) {
        console.log("Vault content:");
        printJson(data);
      }
    }
  }
} finally {
  await client.destroy();
}
