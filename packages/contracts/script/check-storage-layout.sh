#!/usr/bin/env bash
# Storage Layout Safety Check for UUPS Upgradeable Contracts
#
# Purpose: Prevents accidental storage layout changes that would corrupt
#          state during UUPS upgrades. Compares current layout against
#          committed baselines.
#
# Usage:
#   ./script/check-storage-layout.sh
#   ./script/check-storage-layout.sh --contract HatsModule
#   ./script/check-storage-layout.sh --update --contract HatsModule
#
# Add to CI:
#   - name: Check storage layout
#     run: cd packages/contracts && ./script/check-storage-layout.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BASELINE_DIR="$PROJECT_DIR/storage-layouts"

# All UUPS upgradeable contracts that need layout protection
CONTRACTS=(
  "GardenToken:src/tokens/Garden.sol"
  "GardenAccount:src/accounts/Garden.sol"
  "HatsModule:src/modules/Hats.sol"
  "KarmaGAPModule:src/modules/Karma.sol"
  "ActionRegistry:src/registries/Action.sol"
  "WorkResolver:src/resolvers/Work.sol"
  "WorkApprovalResolver:src/resolvers/WorkApproval.sol"
  "AssessmentResolver:src/resolvers/Assessment.sol"
  "DeploymentRegistry:src/DeploymentRegistry.sol"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

update_mode=false
contract_filter=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --update)
      update_mode=true
      shift
      ;;
    --contract)
      if [[ -z "${2:-}" ]]; then
        echo "Error: --contract requires a contract name." >&2
        exit 1
      fi
      contract_filter="$2"
      shift 2
      ;;
    *)
      echo "Error: unknown argument '$1'." >&2
      exit 1
      ;;
  esac
done

cd "$PROJECT_DIR"

# Ensure baseline directory exists
mkdir -p "$BASELINE_DIR"

# Build first (forge inspect needs compiled contracts)
echo "Compiling contracts..."
build_args=(build --quiet --extra-output storageLayout)
if [[ -n "$contract_filter" ]]; then
  selected_contract_path=""
  for entry in "${CONTRACTS[@]}"; do
    if [[ "${entry%%:*}" == "$contract_filter" ]]; then
      selected_contract_path="${entry#*:}"
      break
    fi
  done

  if [[ -z "$selected_contract_path" ]]; then
    echo -e "${RED}Unknown protected contract: ${contract_filter}${NC}"
    exit 1
  fi

  build_args+=(--force --skip test --skip script "$selected_contract_path")
fi

forge "${build_args[@]}" 2>/dev/null || {
  echo -e "${RED}Compilation failed. Fix build errors first.${NC}"
  exit 1
}

failures=0
updates=0

for entry in "${CONTRACTS[@]}"; do
  contract_name="${entry%%:*}"
  contract_path="${entry#*:}"
  baseline_file="$BASELINE_DIR/${contract_name}.json"

  if [[ -n "$contract_filter" && "$contract_name" != "$contract_filter" ]]; then
    continue
  fi

  # Extract storage layout
  if ! current_layout=$(forge inspect "$contract_name" storage-layout --json); then
    echo -e "${RED}Could not inspect ${contract_name}:${NC}"
    echo "$current_layout"
    failures=$((failures + 1))
    continue
  fi

  if [[ -z "$current_layout" ]]; then
    echo -e "${RED}Could not inspect ${contract_name}: empty storage layout${NC}"
    failures=$((failures + 1))
    continue
  fi

  # Extract only the fields that matter for layout compatibility:
  # slot, offset, type, label, and every recursively referenced type definition
  # (not astId or contract source names, which change on recompilation)
  current_normalized=$(echo "$current_layout" | python3 -c "
import json, re, sys
data = json.load(sys.stdin)

def stable_type(type_name):
    # Foundry embeds source-order-dependent AST ids in contract, struct, enum, and
    # user-defined value type identifiers. Those ids are not storage semantics.
    # Preserve array lengths such as t_array(t_uint256)50_storage.
    return re.sub(
        r't_(contract|struct|enum|userDefinedValueType)\(([^)]*)\)\d+',
        r't_\1(\2)',
        type_name,
    )

raw_types = data.get('types', {})
referenced_types = set()

def visit_type(type_name):
    if type_name in referenced_types:
        return
    referenced_types.add(type_name)
    type_definition = raw_types.get(type_name)
    if not type_definition:
        return
    for field in ('base', 'key', 'value'):
        referenced_type = type_definition.get(field)
        if referenced_type:
            visit_type(referenced_type)
    for member in type_definition.get('members', []):
        visit_type(member['type'])

slots = [{'slot': s['slot'], 'offset': s['offset'], 'type': stable_type(s['type']), 'label': s['label']}
         for s in data.get('storage', [])]
for slot in data.get('storage', []):
    visit_type(slot['type'])

types = {}
for type_name in referenced_types:
    type_definition = raw_types.get(type_name)
    if not type_definition:
        continue
    normalized = {
        field: type_definition[field]
        for field in ('encoding', 'label', 'numberOfBytes')
        if field in type_definition
    }
    for field in ('base', 'key', 'value'):
        if field in type_definition:
            normalized[field] = stable_type(type_definition[field])
    if 'members' in type_definition:
        normalized['members'] = [
            {
                'label': member['label'],
                'offset': member['offset'],
                'slot': member['slot'],
                'type': stable_type(member['type']),
            }
            for member in type_definition['members']
        ]
    types[stable_type(type_name)] = normalized

print(json.dumps({'storage': slots, 'types': types}, indent=2, sort_keys=True))
" 2>/dev/null || echo "$current_layout")

  if $update_mode; then
    echo "$current_normalized" > "$baseline_file"
    echo -e "${GREEN}Updated: ${contract_name}${NC}"
    updates=$((updates + 1))
    continue
  fi

  # Check mode
  if [[ ! -f "$baseline_file" ]]; then
    echo -e "${RED}MISSING STORAGE BASELINE: ${contract_name}${NC}"
    echo "  Expected: $baseline_file"
    echo "  Review the current layout, then create the baseline explicitly with:"
    echo "    ./script/check-storage-layout.sh --update --contract ${contract_name}"
    failures=$((failures + 1))
    continue
  fi

  # Compare normalized layouts
  baseline_content=$(cat "$baseline_file")

  if [[ "$current_normalized" != "$baseline_content" ]]; then
    echo -e "${RED}STORAGE LAYOUT CHANGED: ${contract_name}${NC}"
    echo "  Baseline: $baseline_file"
    echo "  Diff:"
    diff <(echo "$baseline_content") <(echo "$current_normalized") || true
    echo ""
    echo -e "${YELLOW}  If this change is intentional, run:${NC}"
    echo "    ./script/check-storage-layout.sh --update"
    echo ""
    failures=$((failures + 1))
  else
    echo -e "${GREEN}OK: ${contract_name}${NC}"
  fi
done

echo ""
if $update_mode; then
  if [[ "$updates" -eq 0 ]]; then
    echo -e "${RED}No matching contract baseline was updated.${NC}"
    exit 1
  fi
  echo -e "${GREEN}Updated ${updates} baseline(s).${NC}"
  echo "Commit the storage-layouts/ directory to preserve baselines."
elif [[ $failures -gt 0 ]]; then
  echo -e "${RED}${failures} storage layout change(s) detected!${NC}"
  echo "Review the changes carefully before updating baselines."
  echo "UUPS upgrades with changed storage layouts can corrupt contract state."
  exit 1
else
  echo -e "${GREEN}All storage layouts match baselines.${NC}"
fi
