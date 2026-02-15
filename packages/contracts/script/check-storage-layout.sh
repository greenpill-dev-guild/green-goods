#!/usr/bin/env bash
# Storage Layout Safety Check for UUPS Upgradeable Contracts
#
# Purpose: Prevents accidental storage layout changes that would corrupt
#          state during UUPS upgrades. Compares current layout against
#          committed baselines.
#
# Usage:
#   ./script/check-storage-layout.sh          # Check current vs baseline
#   ./script/check-storage-layout.sh --update  # Update baselines
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
if [[ "${1:-}" == "--update" ]]; then
  update_mode=true
fi

cd "$PROJECT_DIR"

# Ensure baseline directory exists
mkdir -p "$BASELINE_DIR"

# Build first (forge inspect needs compiled contracts)
echo "Compiling contracts..."
forge build --quiet 2>/dev/null || {
  echo -e "${RED}Compilation failed. Fix build errors first.${NC}"
  exit 1
}

failures=0
updates=0

for entry in "${CONTRACTS[@]}"; do
  contract_name="${entry%%:*}"
  contract_path="${entry#*:}"
  baseline_file="$BASELINE_DIR/${contract_name}.json"

  # Extract storage layout
  current_layout=$(forge inspect "$contract_name" storage-layout --json 2>/dev/null)

  if [[ -z "$current_layout" ]]; then
    echo -e "${YELLOW}Warning: Could not inspect ${contract_name}${NC}"
    continue
  fi

  # Extract only the fields that matter for layout compatibility:
  # slot, offset, type, label (not astId which changes on recompilation)
  current_normalized=$(echo "$current_layout" | python3 -c "
import json, sys
data = json.load(sys.stdin)
slots = [{'slot': s['slot'], 'offset': s['offset'], 'type': s['type'], 'label': s['label']}
         for s in data.get('storage', [])]
print(json.dumps({'storage': slots}, indent=2, sort_keys=True))
" 2>/dev/null || echo "$current_layout")

  if $update_mode; then
    echo "$current_normalized" > "$baseline_file"
    echo -e "${GREEN}Updated: ${contract_name}${NC}"
    ((updates++))
    continue
  fi

  # Check mode
  if [[ ! -f "$baseline_file" ]]; then
    echo -e "${YELLOW}No baseline for ${contract_name}. Run with --update to create.${NC}"
    echo "$current_normalized" > "$baseline_file"
    ((updates++))
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
    ((failures++))
  else
    echo -e "${GREEN}OK: ${contract_name}${NC}"
  fi
done

echo ""
if $update_mode; then
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
