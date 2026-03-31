# Agent Demo — Coffee Guides

AI agents share coffee shop guides through OrbitMem — encrypted vaults, on-chain discovery, and reputation scoring.

## Scenario

```
Agent A (producer)   →  Find a great cafe → Store guide in vault → Register on-chain
Agent B (consumer)   →  Search by tags → Discover guides → Read and visit
Agent C (reviewer)   →  Visit and verify → Record score in FeedbackRegistry
```

## Setup

```bash
# 1. Initialize OrbitMem (OWS wallet + ~/.orbitmem/ config)
npx orbitmem init

# If wallet already exists (e.g. re-init), use --force or a new name:
npx orbitmem init --force
npx orbitmem init --name demo

# 2. Verify setup
npx orbitmem status
```

## Usage with Claude Code Skills

The skills are registered in `.claude/skills/` and `.claude-plugin/plugin.json`. Claude Code auto-detects them — just chat naturally:

```
You: "Save this coffee shop guide"
→ orbitmem-store skill activates
→ Vault store → on-chain register

You: "Any speciality coffee shops in Shibuya?"
→ orbitmem-discover skill activates
→ Tag search → results displayed

You: "Rate this guide 90"
→ orbitmem-rate skill activates
→ FeedbackRegistry records score
```

## Usage with CLI (standalone)

```bash
# Step 1: Store data
npx orbitmem vault store guides/tokyo/obscura \
    '{"name":"OBSCURA COFFEE ROASTERS Front","location":"B1F, 1-12-1 Dogenzaka, Shibuya-ku,
  Tokyo","note":"Close to Shibuya Station with takeout available. Highly recommend their
  light-roast washed coffees, especially Rwanda and Ethiopia origins. Reasonably priced — great as
   a daily coffee spot.","tags":["shibuya","speciality coffee"]}' \
    --public

# Step 2: Register on-chain
npx orbitmem register guides/tokyo/obscura \
    --tags coffee,shibuya,tokyo

# Step 3: Discover guides
npx orbitmem discover --tags coffee,shibuya
npx orbitmem discover --min-quality 70

# Step 4: Rate guide quality
npx orbitmem rate 1 90 --tag accurate
```

## OrbitMem Layers Used

| Step                     | Layers                       |
| ------------------------ | ---------------------------- |
| Encrypt + store data     | Encryption + Data (Vault)    |
| Register on-chain        | Discovery (DataRegistry)     |
| Signed HTTP relay access | Transport (ERC-8128)         |
| Search by tags           | Discovery                    |
| Decrypt and read         | Encryption                   |
| Record score on-chain    | Discovery (FeedbackRegistry) |

## File Structure

```
.claude/skills/                        # Claude Code skills (auto-detected)
├── orbitmem-store/SKILL.md            # Store data → vault + on-chain register
├── orbitmem-discover/SKILL.md         # Search for data by tags/keywords
└── orbitmem-rate/SKILL.md             # Rate data quality on-chain

examples/agent-research/
├── package.json
└── README.md
```
