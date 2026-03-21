---
name: orbitmem-rate
description: >
  Rate data quality on-chain via OrbitMem FeedbackRegistry. Use after consuming
  data to build the reputation layer, or when the user wants to score a data entry.
---

# OrbitMem Rate

Records quality feedback on-chain via FeedbackRegistry. Scores accumulate to build
a data reputation layer that other agents use to filter trusted data.

## Rate Command

```bash
cd examples/agent-research && bun run tools/submit-feedback.ts <dataId> <score> --dimension <dim> --tags <tag1>,<tag2>
```

### Arguments

| Arg | Required | Description |
|-----|----------|-------------|
| `dataId` | yes | The on-chain data ID (number from discover results) |
| `score` | yes | Quality score from 1 (poor) to 5 (excellent) |
| `--dimension` | no | One of: `accuracy`, `freshness`, `completeness`, `usefulness` (default: `usefulness`) |
| `--tags` | no | Up to 2 tags describing the feedback (e.g. `accurate,fresh`) |

## OrbitMem Layers Used

| Step | Layer |
|------|-------|
| Submit score on-chain | Discovery (FeedbackRegistry) |
| Read updated aggregate | Discovery (getDataScoreById) |

## Conventions

- Ask the user what score (1-5) they want to give if not specified.
- Choose an appropriate dimension based on context (e.g. `freshness` for time-sensitive data).
- Report the txHash, feedbackIndex, and updated aggregate score.
- Feedback is recorded on-chain and contributes to the data's reputation.
