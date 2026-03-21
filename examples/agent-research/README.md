# Agent Research Demo

AI agents share data through OrbitMem — encrypted vaults, on-chain discovery, and reputation scoring.

## Scenario

```
Agent A (producer)   →  Generate data → Store in vault → Register on-chain
Agent B (consumer)   →  Search by tags → Discover data → Decrypt and use
Agent C (reviewer)   →  Verify content → Record score in FeedbackRegistry
```

## Setup

```bash
# 1. Install dependencies (from repo root)
bun install

# 2. Initialize OrbitMem (generates key + config)
bun run cli init

# 3. Verify setup
bun run cli status
```

## Usage with Claude Code Skills

The skills are registered in `.claude/skills/` and `.claude-plugin/plugin.json`. Claude Code auto-detects them — just chat naturally:

```
You: "Save this research"
→ orbitmem-store skill activates
→ Vault store → on-chain register

You: "Any runtime comparison docs?"
→ orbitmem-discover skill activates
→ Tag search → results displayed

You: "Rate this data a 4"
→ orbitmem-rate skill activates
→ FeedbackRegistry records score
```

## Usage with CLI (standalone)

```bash
cd examples/agent-research

# Step 1: Store data
bun run tools/store-research.ts "bun-vs-deno-2026" \
  "Bun 1.2 outperforms Deno 2.1 in bundling speed by 3x..." \
  --tags runtime,comparison,2026 \
  --visibility public

# Step 2: Search for data
bun run tools/search-research.ts --tags runtime,comparison
bun run tools/search-research.ts --keyword "bun vs deno"

# Step 3: Rate data quality
bun run tools/submit-feedback.ts 1 4 --dimension accuracy --tags accurate,fresh
```

## OrbitMem Layers Used

| Step | Layers |
|------|--------|
| Encrypt + store data | Encryption + Data (Vault) |
| Register on-chain | Discovery (DataRegistry) |
| Signed HTTP relay access | Transport (ERC-8128) |
| Search by tags | Discovery |
| Decrypt and read | Encryption |
| Record score on-chain | Discovery (FeedbackRegistry) |

## File Structure

```
.claude/skills/                        # Claude Code skills (auto-detected)
├── orbitmem-store/SKILL.md            # Store data → vault + on-chain register
├── orbitmem-discover/SKILL.md         # Search for data by tags/keywords
└── orbitmem-rate/SKILL.md             # Rate data quality on-chain

examples/agent-research/
├── tools/                             # TS scripts (invoked by skills or directly)
│   ├── shared.ts                      # Client bootstrap (reuses ~/.orbitmem config)
│   ├── store-research.ts              # Vault put + DataRegistry register
│   ├── search-research.ts             # Discovery findData query
│   └── submit-feedback.ts             # FeedbackRegistry rateData
├── package.json
└── README.md
```
