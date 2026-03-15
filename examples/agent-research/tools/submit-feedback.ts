#!/usr/bin/env bun
/**
 * Submit feedback — rates a research memo via FeedbackRegistry.
 *
 * Usage:
 *   bun run tools/submit-feedback.ts <dataId> <score> [--dimension accuracy|freshness|completeness|usefulness] [--tags tag1,tag2]
 *
 * Example:
 *   bun run tools/submit-feedback.ts 1 4 --dimension accuracy --tags accurate,fresh
 */
import { createAgentClient, printJson } from "./shared.js";

const [dataIdStr, scoreStr, ...rest] = process.argv.slice(2);

if (!dataIdStr || !scoreStr) {
  console.error("Usage: submit-feedback <dataId> <score> [--dimension dim] [--tags t1,t2]");
  process.exit(1);
}

const dataId = Number(dataIdStr);
const score = Number(scoreStr);

if (Number.isNaN(dataId) || Number.isNaN(score) || score < 1 || score > 5) {
  console.error("dataId must be a number, score must be 1-5");
  process.exit(1);
}

// Parse flags
const flags: Record<string, string> = {};
for (let i = 0; i < rest.length; i += 2) {
  const key = rest[i]?.replace(/^--/, "");
  if (key && rest[i + 1]) flags[key] = rest[i + 1];
}

const dimension = flags.dimension as
  | "accuracy"
  | "completeness"
  | "freshness"
  | "usefulness"
  | undefined;
const tags = flags.tags?.split(",") ?? [];

const { client } = await createAgentClient();

try {
  const result = await client.discovery.rateData({
    dataId,
    value: score,
    qualityDimension: dimension ?? "usefulness",
    tag1: tags[0],
    tag2: tags[1],
  });

  console.log(`Feedback submitted for data #${dataId}:`);
  printJson({
    dataId,
    score,
    dimension: dimension ?? "usefulness",
    tags,
    txHash: result.txHash,
    feedbackIndex: result.feedbackIndex,
  });

  // Show updated score
  const updated = await client.discovery.getDataScoreById(dataId);
  console.log("\nUpdated data score:");
  printJson(updated);
} finally {
  await client.destroy();
}
