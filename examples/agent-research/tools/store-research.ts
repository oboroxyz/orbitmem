#!/usr/bin/env bun
/**
 * Store research — saves a research memo to the vault and registers it on-chain.
 *
 * Usage:
 *   bun run tools/store-research.ts <topic> <content> [--tags tag1,tag2] [--visibility public|private]
 *
 * Example:
 *   bun run tools/store-research.ts "bun-vs-deno-2026" "Bun is faster at..." --tags runtime,comparison
 */
import { createAgentClient, printJson } from "./shared.js";

const [topic, content, ...rest] = process.argv.slice(2);

if (!topic || !content) {
  console.error("Usage: store-research <topic> <content> [--tags t1,t2] [--visibility public|private]");
  process.exit(1);
}

// Parse flags
const flags: Record<string, string> = {};
for (let i = 0; i < rest.length; i += 2) {
  const key = rest[i]?.replace(/^--/, "");
  if (key && rest[i + 1]) flags[key] = rest[i + 1];
}

const tags = flags.tags?.split(",") ?? ["research"];
const visibility = (flags.visibility as "public" | "private") ?? "public";
const path = `research/${topic}`;

const { client } = await createAgentClient();

try {
  // 1. Store in vault
  const entry = await client.vault.put(
    path,
    {
      topic,
      content,
      tags,
      createdAt: new Date().toISOString(),
      agent: "research-agent",
    },
    { visibility },
  );

  console.log(`Stored "${path}" in vault (${visibility})`);

  // 2. Register on-chain via DataRegistry
  const registration = await client.discovery.registerData({
    key: path,
    name: topic,
    description: content.slice(0, 200),
    tags,
  });

  console.log("Registered on-chain:");
  printJson({
    path,
    visibility,
    tags,
    dataId: (registration as any).dataId,
    txHash: (registration as any).txHash,
  });
} finally {
  await client.destroy();
}
