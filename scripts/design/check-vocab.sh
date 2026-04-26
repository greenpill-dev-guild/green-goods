#!/usr/bin/env bash
# check-vocab.sh
# Enforces the Lens 1 (Regenerative) banned-vocabulary rule on user-facing strings.
#
# Source of truth: docs/docs/reference/banned-vocabulary.json (.linter_enforced)
# Human-readable mirror: docs/docs/reference/glossary-community.md § Banned Vocabulary
# Framework: .claude/skills/design/review-checklist.md § Lens 1
#
# Exits 1 if any banned term appears in translated message values.
# Runs as `bun run lint:vocab` from repo root. Intended for pre-commit and CI.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

VOCAB_JSON="docs/docs/reference/banned-vocabulary.json"

if [[ ! -f "$VOCAB_JSON" ]]; then
  echo "❌ check-vocab: missing canonical glossary sidecar at $VOCAB_JSON"
  echo "   Restore the file or update scripts/design/check-vocab.sh to point at the new source."
  exit 2
fi

# Read the enforced term list from the JSON sidecar.
# Prefer jq when available; fall back to a python3 one-liner; last-resort
# bash/grep extraction so the linter stays runnable without extra deps.
read_terms() {
  if command -v jq >/dev/null 2>&1; then
    jq -r '.linter_enforced.terms[]' "$VOCAB_JSON"
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c "import json,sys; print('\n'.join(json.load(open('$VOCAB_JSON'))['linter_enforced']['terms']))"
  else
    # Fallback: extract the terms array via grep + sed. Robust enough for the
    # current shape (one term per line inside a JSON array of strings) but
    # only correct as long as the sidecar keeps that shape — keep this aligned
    # if you reflow the JSON.
    awk '/"linter_enforced"/,/]/' "$VOCAB_JSON" \
      | grep -oE '"[^"]+"' \
      | sed -n '2,$p' \
      | tr -d '"' \
      | sed '/^terms$/d; /^scope$/d; /^globs$/d; /^rationale$/d; /^packages\//d; /^user-facing/d; /^These terms/d' \
      | grep -v '^$' || true
  fi
}

TERMS=()
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  TERMS+=("$line")
done < <(read_terms)

if [[ ${#TERMS[@]} -eq 0 ]]; then
  echo "❌ check-vocab: failed to read banned terms from $VOCAB_JSON"
  echo "   Install jq (or python3) so the linter can parse the sidecar reliably."
  exit 2
fi

# Build the regex pattern — word-boundary anchored alternation. "\b" anchors
# prevent false positives on substrings (e.g. "urgent" must not match
# "insurgent"; "fomo" must not match broader strings).
join_alts() {
  local IFS='|'
  echo "$*"
}

ALTS="$(join_alts "${TERMS[@]}")"
BANNED_PATTERN="\\b(${ALTS})\\b"

# i18n globs — the scope of enforcement. Keep aligned with
# `.linter_enforced.globs` in the sidecar; the script declares its own copy
# here because shell glob expansion is friendlier than parsing JSON twice.
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
  echo "check-vocab: no i18n files found under packages/*/src/i18n/*.json — nothing to check."
  exit 0
fi

# Case-insensitive search on the message JSON. We scan keys + values because
# rg won't parse JSON semantically; acceptable since keys like
# "features.streakReminder" are themselves a design smell worth flagging.
if command -v rg >/dev/null 2>&1; then
  SEARCH_CMD=(rg -i -n --no-heading -P "$BANNED_PATTERN" "${FOUND_FILES[@]}")
else
  # grep -E does not support \b on all platforms; mirror the rg pattern in
  # ERE form. The leading/trailing alternation slot keeps simple alternation
  # working without PCRE.
  GREP_PATTERN="$(IFS='|'; echo "${TERMS[*]}")"
  SEARCH_CMD=(grep -i -n -E -H "$GREP_PATTERN" "${FOUND_FILES[@]}")
fi

if HITS="$("${SEARCH_CMD[@]}" || true)"; [[ -n "$HITS" ]]; then
  echo "❌ Banned regenerative-lens vocabulary found in i18n:"
  echo "$HITS"
  echo
  echo "These terms signal growth-hacking / FOMO patterns. See:"
  echo "  docs/docs/reference/glossary-community.md § Banned Vocabulary"
  echo "  docs/docs/reference/banned-vocabulary.json (.linter_enforced)"
  echo "  .claude/skills/design/review-checklist.md § Lens 1: Regenerative Design"
  exit 1
fi

echo "✅ check-vocab: no banned vocabulary found in ${#FOUND_FILES[@]} i18n file(s)."
