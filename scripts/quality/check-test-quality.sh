#!/usr/bin/env bash
# check-test-quality.sh — Detect weak test patterns in the codebase.
# Exit 0 if clean, non-zero if violations found.
# Checks:
#   1. Tautological assertions: expect(true), expect(false), || true
#   2. Ungoverned or expired test skips
#   3. Type-safety bypasses: @ts-nocheck in test files
#   4. Newly added or renamed Solidity tests use the canonical naming format
#   5. Direct-tested seams import their subject and never mock that subject

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
VIOLATIONS=0

# Discover tracked and new non-ignored tests by filename instead of a hand-maintained
# directory list. This includes colocated package tests, agent tests, root scripts/docs
# tests, and Playwright before a contributor stages a newly added file.
TEST_FILES=()
SCRIPT_TEST_FILES=()
while IFS= read -r tracked_file; do
  case "$tracked_file" in
    *.test.ts|*.test.tsx|*.test.js|*.test.jsx|*.test.mjs|*.test.cjs|\
    *.spec.ts|*.spec.tsx|*.spec.js|*.spec.jsx|*.spec.mjs|*.spec.cjs|*.t.sol)
      TEST_FILES+=("$REPO_ROOT/$tracked_file")
      case "$tracked_file" in
        *.t.sol) ;;
        *) SCRIPT_TEST_FILES+=("$REPO_ROOT/$tracked_file") ;;
      esac
      ;;
  esac
done < <(git -C "$REPO_ROOT" ls-files --cached --others --exclude-standard)

if [ ${#TEST_FILES[@]} -eq 0 ]; then
  echo "No tracked or new test/spec files found — nothing to check."
  exit 0
fi

echo "=== Test Quality Check ==="
echo "Discovered ${#TEST_FILES[@]} tracked or new test/spec files."
echo ""

# ── Check 1: Tautological assertions ────────────────────────────
echo "--- Check 1: Tautological assertions ---"
# A genuine source-fixture assertion may opt out only on that exact line with:
# TEST-QUALITY: allow-tautology - <why the literal expression is test data>
TAUTOLOGICAL=$(grep -rn \
  -E '(expect\([[:space:]]*(true|false)[[:space:]]*\)|(\|\|[[:space:]]*true))' \
  "${TEST_FILES[@]}" 2>/dev/null \
  | grep -vE 'TEST-QUALITY:[[:space:]]*allow-tautology[[:space:]]+-[[:space:]]+[^[:space:]]' || true)

if [ -n "$TAUTOLOGICAL" ]; then
  echo "FAIL: Found tautological assertions (expect(true), expect(false), || true):"
  echo "$TAUTOLOGICAL"
  echo ""
  VIOLATIONS=$((VIOLATIONS + $(echo "$TAUTOLOGICAL" | wc -l)))
else
  echo "PASS: No tautological assertions found."
fi
echo ""

# ── Check 2: Governed, non-expired test skips ───────────────────
echo "--- Check 2: Governed, non-expired test skips ---"
# Find lines with .skip( or test.skip or it.skip or describe.skip
# Then exclude lines that have a governance comment on the same line OR
# on the 1-2 lines immediately above: // SKIP:.*#\d+.*owner.*expiry
RAW_SKIPS=$(grep -rn \
  -E '\.(skip|only)\(' \
  "${SCRIPT_TEST_FILES[@]}" 2>/dev/null || true)

# Filter: for each skip line, require a governance comment and future expiry.
SKIP_LINES=""
EXPIRED_SKIP_LINES=""
CURRENT_DATE="$(date -u +%F)"
while IFS= read -r line; do
  [ -z "$line" ] && continue
  # Extract file path and line number
  FILE=$(echo "$line" | cut -d: -f1)
  LINENO_VAL=$(echo "$line" | cut -d: -f2)
  # Check this line plus the preceding 3 lines for a governance comment.
  # The governance pattern may span multiple comment lines, e.g.:
  #   // SKIP: #312 — reason text
  #   // Owner: team / Expiry: 2026-03-17
  # So we check if the window contains SKIP + issue number AND owner AND expiry.
  START=$((LINENO_VAL - 3))
  [ "$START" -lt 1 ] && START=1
  CONTEXT="$(sed -n "${START},$((LINENO_VAL - 1))p" "$FILE" 2>/dev/null || true)
${line}"
  if ! echo "$CONTEXT" | grep -qE '//\s*SKIP:.*#[0-9]+' || \
     ! echo "$CONTEXT" | grep -qiE '[Oo]wner' || \
     ! echo "$CONTEXT" | grep -qiE '[Ee]xpiry'; then
    SKIP_LINES="${SKIP_LINES}${line}"$'\n'
    continue
  fi

  EXPIRY_DATE=$(echo "$CONTEXT" | sed -nE 's/.*[Ee]xpiry[[:space:]]*:[[:space:]]*([0-9]{4}-[0-9]{2}-[0-9]{2}).*/\1/p' | head -1)
  if [ -z "$EXPIRY_DATE" ] || [[ "$EXPIRY_DATE" < "$CURRENT_DATE" ]]; then
    EXPIRED_SKIP_LINES="${EXPIRED_SKIP_LINES}${line} (expiry: ${EXPIRY_DATE:-missing})"$'\n'
  fi
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

EXPIRED_SKIP_LINES=$(echo "$EXPIRED_SKIP_LINES" | sed '/^$/d')
if [ -n "$EXPIRED_SKIP_LINES" ]; then
  echo "FAIL: Found test skips with missing or expired expiry dates (today: $CURRENT_DATE):"
  echo "$EXPIRED_SKIP_LINES"
  echo ""
  VIOLATIONS=$((VIOLATIONS + $(echo "$EXPIRED_SKIP_LINES" | wc -l)))
else
  echo "PASS: All governed test skips have a future expiry date."
fi
echo ""

# ── Check 3: @ts-nocheck in test files ──────────────────────────
echo "--- Check 3: @ts-nocheck in test files ---"
TS_NOCHECK=$(grep -rn \
  '@ts-nocheck' \
  "${SCRIPT_TEST_FILES[@]}" 2>/dev/null || true)

if [ -n "$TS_NOCHECK" ]; then
  echo "FAIL: Found @ts-nocheck in test files:"
  echo "$TS_NOCHECK"
  echo ""
  VIOLATIONS=$((VIOLATIONS + $(echo "$TS_NOCHECK" | wc -l)))
else
  echo "PASS: No @ts-nocheck found in test files."
fi
echo ""

# ── Check 4: Diff-aware Solidity test naming ────────────────────
echo "--- Check 4: New Solidity test naming ---"
SOLIDITY_NAME_STATUS=0
node "$REPO_ROOT/scripts/contracts/check-solidity-test-names.mjs" || SOLIDITY_NAME_STATUS=$?
if [ "$SOLIDITY_NAME_STATUS" -eq 1 ]; then
  VIOLATIONS=$((VIOLATIONS + 1))
elif [ "$SOLIDITY_NAME_STATUS" -ne 0 ]; then
  echo "ERROR: Solidity test-name checker could not run (exit $SOLIDITY_NAME_STATUS)."
  exit "$SOLIDITY_NAME_STATUS"
fi
echo ""

# ── Check 5: Direct-tested seam integrity ───────────────────────
echo "--- Check 5: Direct-tested seam integrity ---"
DIRECT_SEAM_STATUS=0
node "$REPO_ROOT/scripts/quality/check-direct-tested-seams.mjs" || DIRECT_SEAM_STATUS=$?
if [ "$DIRECT_SEAM_STATUS" -eq 1 ]; then
  VIOLATIONS=$((VIOLATIONS + 1))
elif [ "$DIRECT_SEAM_STATUS" -ne 0 ]; then
  echo "ERROR: Direct-tested seam checker could not run (exit $DIRECT_SEAM_STATUS)."
  exit "$DIRECT_SEAM_STATUS"
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
