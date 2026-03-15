---
name: OrbitMem Discover
slug: orbitmem-discover
version: 0.1.0
description: >
  Search for research memos stored by other agents in OrbitMem.
  Use when the user wants to find existing research before doing their own.
---

## When to Use

Activate when the user asks to:
- Find existing research on a topic
- Search OrbitMem for data by tags or keywords
- Check what research is available before starting new research

## Search Command

```bash
cd examples/agent-research && bun run tools/search-research.ts --tags <tag1>,<tag2> --keyword "<text>" --min-quality <1-5>
```

### Flags (all optional, use at least one)

| Flag | Description |
|------|-------------|
| `--tags` | Comma-separated tags to filter by |
| `--keyword` | Free-text keyword search |
| `--min-quality` | Minimum quality score (1-5) |
| `--schema` | Schema identifier to filter by |
| `--fetch` | Also retrieve the first result's vault data |

## Output

Lists matching research memos with their data ID, name, tags, quality score, and vault address. Report the results to the user in a readable format.

## Rules

- Try tags first, then keyword if no results.
- If quality scores are available, mention them — they indicate community trust.
- Suggest the user rate the data after consuming it (via orbitmem-feedback skill).
