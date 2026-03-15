---
name: OrbitMem Research Store
slug: orbitmem-research
version: 0.1.0
description: >
  Research a topic, summarize findings, and store them in an OrbitMem vault
  with on-chain registration. Use when the user asks to research a topic and
  persist the results for other agents.
---

## When to Use

Activate when the user asks to:
- Research a topic and save the findings
- Store research notes in OrbitMem
- Create a shareable research memo

## Workflow

1. **Research** — Use web search or available tools to gather information on the requested topic.
2. **Summarize** — Create a structured summary with key findings, sources, and a brief conclusion.
3. **Store** — Run the store tool to persist to vault + register on-chain.

## Store Command

```bash
cd examples/agent-research && bun run tools/store-research.ts "<topic-slug>" "<summary-text>" --tags <tag1>,<tag2> --visibility public
```

### Arguments

| Arg | Required | Description |
|-----|----------|-------------|
| `topic-slug` | yes | Kebab-case identifier (e.g. `bun-vs-deno-2026`) |
| `summary-text` | yes | The research summary (plain text or markdown) |
| `--tags` | no | Comma-separated tags for discovery (default: `research`) |
| `--visibility` | no | `public` (default) or `private` |

## Output Format

The tool prints JSON with `path`, `dataId`, `txHash`, and `tags`. Report these back to the user.

## Rules

- Always include at least 2 relevant tags for discoverability.
- Use `public` visibility unless the user explicitly requests private.
- Keep the summary under 2000 characters for on-chain description limits.
- Slugify the topic for the path (lowercase, hyphens, no spaces).
