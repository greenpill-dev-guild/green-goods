#!/usr/bin/env bash
# check-vocab.sh
# Enforces the Lens 1 (Regenerative) banned-vocabulary rule on user-facing strings.
#
# Source of truth: scripts/data/banned-vocabulary.json (.linter_enforced)
# Human-readable projection: docs/docs/reference/glossary.generated.mdx § Language policy
# Framework: .claude/skills/design/review-checklist.md § Lens 1
#
# Exits 1 if any banned term appears in translated message values.
# Runs as `bun run lint:vocab` from repo root. Selected locally for vocabulary changes and run in CI.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

VOCAB_JSON="scripts/data/banned-vocabulary.json"

if [[ ! -f "$VOCAB_JSON" ]]; then
  echo "❌ check-vocab: missing canonical glossary sidecar at $VOCAB_JSON"
  echo "   Restore the file or update scripts/design/check-vocab.sh to point at the new source."
  exit 2
fi

# Read the enforced term list from the JSON sidecar.
# Prefer jq when available; fall back to a python3 one-liner; last-resort
# awk extraction so the linter stays runnable without extra deps.
read_terms() {
  if command -v jq >/dev/null 2>&1; then
    jq -r '.linter_enforced.terms[]' "$VOCAB_JSON"
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c "import json,sys; print('\n'.join(json.load(open('$VOCAB_JSON'))['linter_enforced']['terms']))"
  else
    # Fallback: extract only .linter_enforced.terms from the current JSON
    # shape. This intentionally waits for the terms key after linter_enforced
    # so the globs array cannot terminate the range early.
    awk '
      /"linter_enforced"[[:space:]]*:/ { in_linter = 1 }
      in_linter && /"terms"[[:space:]]*:[[:space:]]*\[/ { in_terms = 1; next }
      in_terms && /\]/ { exit }
      in_terms {
        line = $0
        sub(/^[[:space:]]*"/, "", line)
        sub(/",[[:space:]]*$/, "", line)
        sub(/"[[:space:]]*$/, "", line)
        if (line != "") print line
      }
    ' "$VOCAB_JSON"
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
  echo "  docs/docs/reference/glossary.generated.mdx § Language policy"
  echo "  scripts/data/banned-vocabulary.json (.linter_enforced)"
  echo "  .claude/skills/design/review-checklist.md § Lens 1: Regenerative Design"
  exit 1
fi

# ---------------------------------------------------------------------------
# Renamed terms: a word the product used to use and must not use again.
# Read separately from `.linter_enforced` because these carry per-key exemptions
# (a term can still be legitimate in a different sense).
# ---------------------------------------------------------------------------
read_json_array() {
  local path="$1"
  if command -v jq >/dev/null 2>&1; then
    jq -r "${path}[]? // empty" "$VOCAB_JSON"
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c "
import json, sys
data = json.load(open('$VOCAB_JSON'))
for key in '${path}'.lstrip('.').split('.'):
    data = data.get(key, {}) if isinstance(data, dict) else {}
if isinstance(data, list):
    print('\n'.join(data))
"
  else
    echo "__NO_PARSER__"
  fi
}

RENAMED_TERMS=()
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  RENAMED_TERMS+=("$line")
done < <(read_json_array ".renamed_terms.terms")

if [[ ${#RENAMED_TERMS[@]} -gt 0 && "${RENAMED_TERMS[0]}" == "__NO_PARSER__" ]]; then
  echo "❌ check-vocab: renamed-term enforcement needs jq or python3 to read $VOCAB_JSON"
  exit 2
fi

if [[ ${#RENAMED_TERMS[@]} -gt 0 ]]; then
  EXEMPT_KEYS=()
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    EXEMPT_KEYS+=("$line")
  done < <(read_json_array ".renamed_terms.exempt_keys")

  RENAMED_ALTS="$(join_alts "${RENAMED_TERMS[@]}")"
  RENAMED_PATTERN="\\b(${RENAMED_ALTS})\\b"
  if command -v rg >/dev/null 2>&1; then
    RENAMED_CMD=(rg -i -n --no-heading -P "$RENAMED_PATTERN" "${FOUND_FILES[@]}")
  else
    RENAMED_CMD=(grep -i -n -E -H "$(IFS='|'; echo "${RENAMED_TERMS[*]}")" "${FOUND_FILES[@]}")
  fi

  RENAMED_HITS="$("${RENAMED_CMD[@]}" || true)"
  for key in "${EXEMPT_KEYS[@]}"; do
    RENAMED_HITS="$(printf '%s\n' "$RENAMED_HITS" | grep -v -F "\"${key}\":" || true)"
  done
  RENAMED_HITS="$(printf '%s' "$RENAMED_HITS" | sed '/^$/d')"

  if [[ -n "$RENAMED_HITS" ]]; then
    echo "❌ Renamed vocabulary found in i18n:"
    echo "$RENAMED_HITS"
    echo
    echo "The garden role is a Steward. The deployed contracts keep the Operator wire"
    echo "name, but no string a person reads should. See:"
    echo "  scripts/data/banned-vocabulary.json (.renamed_terms)"
    echo "  packages/shared/src/ontology/green-goods-ontology.json § personas"
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# Locale-scoped terms: a word that is correct in one catalog and drift in another.
# English says "Steward"; Spanish and Portuguese translate it (PRD-749).
# Message KEYS stay English, so this walks parsed values rather than raw lines,
# and skips ICU argument references ("{steward}", "{stewards, plural...}").
# ---------------------------------------------------------------------------
if command -v python3 >/dev/null 2>&1; then
  LOCALE_HITS="$(python3 - "$VOCAB_JSON" <<'PYEOF'
import json, re, sys

vocab = json.load(open(sys.argv[1]))
locale_terms = vocab.get("renamed_terms", {}).get("locale_terms", {})
hits = []
for path, terms in locale_terms.items():
    try:
        catalog = json.load(open(path))
    except OSError:
        continue
    pattern = re.compile(r"\b(" + "|".join(re.escape(t) for t in terms) + r")\b", re.I)
    for key, value in catalog.items():
        if not isinstance(value, str):
            continue
        # ICU argument references are code the component passes, not copy.
        prose = re.sub(r"\{\s*\w+\s*[,}]", " ", value)
        if pattern.search(prose):
            hits.append(f"{path}: {key} = {value}")
print("\n".join(hits))
PYEOF
)"
else
  echo "⚠️  check-vocab: skipping locale-scoped terms (python3 not available)"
  LOCALE_HITS=""
fi

if [[ -n "$LOCALE_HITS" ]]; then
  echo "❌ Untranslated role term found in a localized catalog:"
  echo "$LOCALE_HITS"
  echo
  echo "Locked visible terms: es Responsable, pt Responsável. See:"
  echo "  scripts/data/banned-vocabulary.json (.renamed_terms.locale_terms)"
  exit 1
fi

echo "✅ check-vocab: no banned, renamed, or untranslated vocabulary in ${#FOUND_FILES[@]} i18n file(s)."
