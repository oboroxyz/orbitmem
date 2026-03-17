# Agent Research Demo

AI agents share research memos through OrbitMem — encrypted vaults, on-chain discovery, and reputation scoring.

## Scenario

```
Agent A (researcher)  →  Web検索 → 要約作成 → Vault保存 → オンチェーン登録
Agent B (consumer)    →  タグ検索 → メモ発見 → 復号して利用
Agent C (reviewer)    →  内容検証 → FeedbackRegistry にスコア記録
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
You: 「Bun vs Deno 2026を調べて保存して」
→ orbitmem-research skill activates
→ Web search → summarize → vault store → on-chain register

You: 「runtimeの比較資料ある？」
→ orbitmem-discover skill activates
→ Tag search → results displayed

You: 「この調査にスコア4をつけて」
→ orbitmem-feedback skill activates
→ FeedbackRegistry records score
```

## Usage with CLI (standalone)

```bash
cd examples/agent-research

# Step 1: Store research
bun run tools/store-research.ts "bun-vs-deno-2026" \
  "Bun 1.2 outperforms Deno 2.1 in bundling speed by 3x..." \
  --tags runtime,comparison,2026 \
  --visibility public

# Step 2: Search for research
bun run tools/search-research.ts --tags runtime,comparison
bun run tools/search-research.ts --keyword "bun vs deno"

# Step 3: Rate research quality
bun run tools/submit-feedback.ts 1 4 --dimension accuracy --tags accurate,fresh
```

## OrbitMem Layers Used

| Step | Layers |
|------|--------|
| Encrypt + store memo | Encryption + Data (Vault) |
| Register on-chain | Discovery (DataRegistry) |
| Signed HTTP relay access | Transport (ERC-8128) |
| Search by tags | Discovery |
| Decrypt and read | Encryption |
| Record score on-chain | Discovery (FeedbackRegistry) |

## File Structure

```
.claude/skills/                        # Claude Code skills (auto-detected)
├── orbitmem-research/SKILL.md         # Research → store → register
├── orbitmem-discover/SKILL.md         # Search for research memos
└── orbitmem-feedback/SKILL.md         # Rate research quality

examples/agent-research/
├── tools/                             # TS scripts (invoked by skills or directly)
│   ├── shared.ts                      # Client bootstrap (reuses ~/.orbitmem config)
│   ├── store-research.ts              # Vault put + DataRegistry register
│   ├── search-research.ts             # Discovery findData query
│   └── submit-feedback.ts             # FeedbackRegistry rateData
├── package.json
└── README.md
```
