#!/usr/bin/env bash
# check-i18n-vocab.sh
# Enforces the Lens 1 (Regenerative) banned-vocabulary rule on user-facing strings.
# Source: .claude/skills/design/review-checklist.md § Lens 1 + client-prompt-contract.md.
#
# Exits 1 if any banned term appears in translated message values.
# Runs as `bun run lint:vocab` from repo root. Intended for pre-commit and CI.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Word-boundary banned terms. "\b" anchors prevent false positives on substrings
# (e.g. "urgent" must not match "insurgent"; "fomo" must not match broader strings).
BANNED_PATTERN='\b(streak|countdown|leaderboard|FOMO|urgent|limited time|re-engagement|retention hook)\b'

I18N_GLOBS=(
  "packages/shared/src/i18n/*.json"
  "packages/client/src/i18n/*.json"
  "packages/admin/src/i18n/*.json"
)

FOUND_FILES=()
for glob in "${I18N_GLOBS[@]}"; do
  for f in $glob; do
    [[ -f "$f" ]] && FOUND_FILES+=("$f")
  done
done

if [[ ${#FOUND_FILES[@]} -eq 0 ]]; then
  echo "check-i18n-vocab: no i18n files found under packages/*/src/i18n/*.json — nothing to check."
  exit 0
fi

# Case-insensitive ripgrep on message values only. We scan the whole JSON (keys
# and values) because rg won't parse JSON semantically; acceptable since keys
# like "features.streakReminder" are themselves a design smell worth flagging.
if command -v rg >/dev/null 2>&1; then
  SEARCH_CMD=(rg -i -n --no-heading -P "$BANNED_PATTERN" "${FOUND_FILES[@]}")
else
  SEARCH_CMD=(grep -i -n -E -H "streak|countdown|leaderboard|FOMO|urgent|limited time|re-engagement|retention hook" "${FOUND_FILES[@]}")
fi

if HITS="$("${SEARCH_CMD[@]}" || true)"; [[ -n "$HITS" ]]; then
  echo "❌ Banned regenerative-lens vocabulary found in i18n:"
  echo "$HITS"
  echo
  echo "These terms signal growth-hacking / FOMO patterns. See:"
  echo "  .claude/skills/design/review-checklist.md § Lens 1: Regenerative Design"
  echo "  .claude/skills/design/client-prompt-contract.md § Never Use"
  exit 1
fi

echo "✅ check-i18n-vocab: no banned vocabulary found in ${#FOUND_FILES[@]} i18n file(s)."
