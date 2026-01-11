#!/bin/bash
# Green Goods Hook Location Validator
# Ensures all hooks are in @green-goods/shared

echo "🌿 Checking that all hooks dwell in the shared garden..."

# Find any use*.ts or use*.tsx files outside shared package (excluding tests and node_modules)
HOOKS_IN_WRONG_PLACE=$(find packages/client/src packages/admin/src \
  -type f \( -name "use*.ts" -o -name "use*.tsx" \) \
  ! -path "*/__tests__/*" \
  ! -path "*/node_modules/*" \
  2>/dev/null)

if [ -n "$HOOKS_IN_WRONG_PLACE" ]; then
  echo ""
  echo "🚫 Hooks found outside @green-goods/shared:"
  echo ""
  echo "$HOOKS_IN_WRONG_PLACE" | while read -r file; do
    echo "  ❌ $file"
  done
  echo ""
  echo "All hooks must be cultivated in packages/shared/src/hooks/"
  echo "See: packages/shared/AGENTS.md for the hook centralization pattern"
  echo ""
  exit 1
else
  echo "✅ All hooks are properly rooted in the shared garden."
  exit 0
fi
