#!/usr/bin/env bash
# Extract ABIs and bytecodes from forge output into TypeScript const exports
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

# Generate bytecodes module
python3 -c "
import json
contracts = ['AgentRegistry', 'DataRegistry', 'FeedbackRegistry']
lines = []
for name in contracts:
    with open('$OUT/' + name + '.sol/' + name + '.json') as f:
        d = json.load(f)
        lines.append(f'export const {name}Bytecode = \"{d[\"bytecode\"][\"object\"]}\" as const;\n')
with open('$ABI_DIR/bytecodes.ts', 'w') as f:
    f.writelines(lines)
"
echo "  bytecodes.ts"

# Generate barrel index
{
  for name in "${CONTRACTS[@]}"; do
    echo "export { ${name}Abi } from \"./$name.js\";"
  done
  echo "export {"
  for name in "${CONTRACTS[@]}"; do
    echo "  ${name}Bytecode,"
  done
  echo "} from \"./bytecodes.js\";"
} > "$ABI_DIR/index.ts"

echo "  index.ts"
echo "Done — generated ${#CONTRACTS[@]} ABI + bytecode modules in abi/"
