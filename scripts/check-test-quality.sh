#!/usr/bin/env bash
# check-test-quality.sh — Detect weak test patterns in the codebase.
# Exit 0 if clean, non-zero if violations found.
# Checks:
#   1. Tautological assertions: expect(true), expect(false), || true
#   2. Ungoverned test skips: .skip without governance comment
#   3. Type-safety bypasses: @ts-nocheck in test files

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VIOLATIONS=0

# Unit/integration test directories — enforced for ALL checks.
UNIT_TEST_DIRS=(
  "packages/shared/src/__tests__"
  "packages/client/src/__tests__"
  "packages/admin/src/__tests__"
  "packages/indexer/test"
  "packages/contracts/test"
)

# E2E test directories — enforced for Checks 2 (skips) and 3 (@ts-nocheck) only.
# Check 1 (tautological assertions) is excluded for E2E because Playwright smoke tests
# legitimately use expect(true) as page-load confirmations, and conditional || true
# patterns serve as graceful degradation in environments with variable infra availability.
E2E_TEST_DIRS=(
  "tests"
)

# Build search path arrays
UNIT_PATHS=()
for d in "${UNIT_TEST_DIRS[@]}"; do
  full="$REPO_ROOT/$d"
  [ -d "$full" ] && UNIT_PATHS+=("$full")
done

ALL_PATHS=("${UNIT_PATHS[@]}")
for d in "${E2E_TEST_DIRS[@]}"; do
  full="$REPO_ROOT/$d"
  [ -d "$full" ] && ALL_PATHS+=("$full")
done

if [ ${#ALL_PATHS[@]} -eq 0 ]; then
  echo "No test directories found — nothing to check."
  exit 0
fi

# Exclusion pattern for generated/vendor files
EXCLUDE_PATTERN="(node_modules|generated|lib|dist|\.next|\.cache)"

echo "=== Test Quality Check ==="
echo ""

# ── Check 1: Tautological assertions ────────────────────────────
echo "--- Check 1: Tautological assertions ---"
TAUTOLOGICAL=$(grep -rn \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.sol' \
  -E '(expect\(\s*(true|false)\s*\)|(\|\|\s*true))' \
  "${UNIT_PATHS[@]}" 2>/dev/null \
  | grep -vE "$EXCLUDE_PATTERN" || true)

if [ -n "$TAUTOLOGICAL" ]; then
  echo "FAIL: Found tautological assertions (expect(true), expect(false), || true):"
  echo "$TAUTOLOGICAL"
  echo ""
  VIOLATIONS=$((VIOLATIONS + $(echo "$TAUTOLOGICAL" | wc -l)))
else
  echo "PASS: No tautological assertions found."
fi
echo ""

# ── Check 2: Ungoverned test skips ──────────────────────────────
echo "--- Check 2: Ungoverned test skips ---"
# Find lines with .skip( or test.skip or it.skip or describe.skip
# Then exclude lines that have a governance comment on the same line OR
# on the 1-2 lines immediately above: // SKIP:.*#\d+.*owner.*expiry
RAW_SKIPS=$(grep -rn \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
  -E '\.(skip|only)\(' \
  "${ALL_PATHS[@]}" 2>/dev/null \
  | grep -vE "$EXCLUDE_PATTERN" || true)

# Filter: for each skip line, check if it or its preceding 2 lines have a governance comment
SKIP_LINES=""
while IFS= read -r line; do
  [ -z "$line" ] && continue
  # Extract file path and line number
  FILE=$(echo "$line" | cut -d: -f1)
  LINENO_VAL=$(echo "$line" | cut -d: -f2)
  # Check same line for inline governance comment
  if echo "$line" | grep -qE '//\s*SKIP:.*#[0-9]+.*owner.*expiry'; then
    continue
  fi
  # Check preceding 3 lines in the source file for governance comment.
  # The governance pattern may span multiple comment lines, e.g.:
  #   // SKIP: #312 — reason text
  #   // Owner: team / Expiry: 2026-03-17
  # So we check if the window contains SKIP + issue number AND owner AND expiry.
  START=$((LINENO_VAL - 3))
  [ "$START" -lt 1 ] && START=1
  CONTEXT=$(sed -n "${START},$((LINENO_VAL - 1))p" "$FILE" 2>/dev/null || true)
  if echo "$CONTEXT" | grep -qE '//\s*SKIP:.*#[0-9]+' && \
     echo "$CONTEXT" | grep -qiE '[Oo]wner' && \
     echo "$CONTEXT" | grep -qiE '[Ee]xpiry'; then
    continue
  fi
  SKIP_LINES="${SKIP_LINES}${line}"$'\n'
done <<< "$RAW_SKIPS"
# Trim trailing newline
SKIP_LINES=$(echo "$SKIP_LINES" | sed '/^$/d')

if [ -n "$SKIP_LINES" ]; then
  echo "FAIL: Found test skips without governance comment (// SKIP:.*#NNN.*owner.*expiry):"
  echo "$SKIP_LINES"
  echo ""
  VIOLATIONS=$((VIOLATIONS + $(echo "$SKIP_LINES" | wc -l)))
else
  echo "PASS: No ungoverned test skips found."
fi
echo ""

# ── Check 3: @ts-nocheck in test files ──────────────────────────
echo "--- Check 3: @ts-nocheck in test files ---"
TS_NOCHECK=$(grep -rn \
  --include='*.ts' --include='*.tsx' \
  '@ts-nocheck' \
  "${ALL_PATHS[@]}" 2>/dev/null \
  | grep -vE "$EXCLUDE_PATTERN" || true)

if [ -n "$TS_NOCHECK" ]; then
  echo "FAIL: Found @ts-nocheck in test files:"
  echo "$TS_NOCHECK"
  echo ""
  VIOLATIONS=$((VIOLATIONS + $(echo "$TS_NOCHECK" | wc -l)))
else
  echo "PASS: No @ts-nocheck found in test files."
fi
echo ""

# ── Summary ─────────────────────────────────────────────────────
echo "=== Summary ==="
if [ "$VIOLATIONS" -gt 0 ]; then
  echo "FAILED: $VIOLATIONS violation(s) found."
  exit 1
else
  echo "PASSED: All test quality checks passed."
  exit 0
fi
