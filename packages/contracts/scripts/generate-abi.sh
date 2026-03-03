#!/usr/bin/env bash
# Extract ABIs from forge output into TypeScript const exports
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
OUT="$ROOT/out"
ABI_DIR="$ROOT/abi"

CONTRACTS=("AgentRegistry" "DataRegistry" "FeedbackRegistry")

rm -rf "$ABI_DIR"
mkdir -p "$ABI_DIR"

for name in "${CONTRACTS[@]}"; do
  json="$OUT/$name.sol/$name.json"
  if [ ! -f "$json" ]; then
    echo "ERROR: $json not found. Run 'forge build' first." >&2
    exit 1
  fi

  # Extract ABI array and write as TypeScript const
  abi=$(python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin)['abi'], indent=2))" < "$json")

  cat > "$ABI_DIR/$name.ts" <<TSEOF
export const ${name}Abi = ${abi} as const;
TSEOF

  echo "  $name.ts"
done

# Generate barrel index
{
  for name in "${CONTRACTS[@]}"; do
    echo "export { ${name}Abi } from \"./$name.js\";"
  done
} > "$ABI_DIR/index.ts"

echo "  index.ts"
echo "Done — generated ${#CONTRACTS[@]} ABI modules in abi/"
