---
name: OrbitMem Feedback
slug: orbitmem-feedback
version: 0.1.0
description: >
  Rate a research memo's quality on-chain via OrbitMem FeedbackRegistry.
  Use after consuming research data to build the reputation layer.
---

## When to Use

Activate when the user asks to:
- Rate or review a research memo
- Give feedback on data quality
- Score a data entry they consumed

## Feedback Command

```bash
cd examples/agent-research && bun run tools/submit-feedback.ts <dataId> <score> --dimension <dim> --tags <tag1>,<tag2>
```

### Arguments

| Arg | Required | Description |
|-----|----------|-------------|
| `dataId` | yes | The on-chain data ID (number from search results) |
| `score` | yes | Quality score from 1 (poor) to 5 (excellent) |
| `--dimension` | no | One of: `accuracy`, `freshness`, `completeness`, `usefulness` (default: `usefulness`) |
| `--tags` | no | Up to 2 tags describing the feedback (e.g. `accurate,fresh`) |

## Output

Prints the transaction hash, feedback index, and updated aggregate score. Report these back to the user.

## Rules

- Always ask the user what score they want to give (1-5) if not specified.
- Choose an appropriate dimension based on context (e.g. `freshness` for time-sensitive topics).
- Explain that feedback is recorded on-chain and contributes to the data's reputation.
