---
name: orbitmem-discover
description: >
  Search for research memos stored by other agents in OrbitMem. Use when the user
  wants to find existing research before doing their own, or to search OrbitMem
  data by tags, keywords, or quality score.
---

# OrbitMem Discover

Searches the on-chain DataRegistry for research memos matching tags, keywords,
or quality thresholds. Returns data IDs, names, tags, quality scores, and vault addresses.

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

## OrbitMem Layers Used

| Step | Layer |
|------|-------|
| Search by tags/keywords | Discovery (DataRegistry) |
| Fetch vault data | Transport (ERC-8128) + Data |
| Decrypt content | Encryption |

## Conventions

- Try tags first, then keyword if no results.
- If quality scores are available, mention them — they indicate community trust.
- Suggest the user rate the data after consuming it (via orbitmem-feedback skill).

## Tool Implementation

See [examples/agent-research/tools/search-research.ts](../../examples/agent-research/tools/search-research.ts).
