#!/usr/bin/env bash
# check-vocab.sh
# Enforces the Lens 1 (Regenerative) banned-vocabulary rule on user-facing strings,
# US spelling in English copy (DESIGN.md § Voice & Copy), and Brazilian Portuguese in the pt catalog.
#
# Source of truth: scripts/data/banned-vocabulary.json (.linter_enforced, .renamed_terms, .us_spelling, .pt_brazilian)
# Human-readable projection: docs/docs/reference/glossary.generated.mdx § Language policy
# Framework: .claude/skills/design/review-checklist.md § Lens 1
#
# Exits 1 if any banned term appears in translated message values.
# Runs as `bun run check --only vocabulary` from repo root. Selected locally for vocabulary changes and run in CI.
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
# English says "steward" and "garden"; Spanish and Portuguese use their locked words
# (PRD-749), never the English word or a synonym that drifted in.
# Message KEYS stay English, so this walks parsed values rather than raw lines,
# and skips ICU argument references ("{steward}", "{stewards, plural...}").
# A key may keep an exact proper-name phrase (.locale_allowed_phrases); only that
# phrase, standing as a whole phrase, is removed before matching, so the rest of the
# value is still checked and "Community Gardens" is not taken for "Community Garden".
# ---------------------------------------------------------------------------
if command -v python3 >/dev/null 2>&1; then
  LOCALE_HITS="$(python3 - "$VOCAB_JSON" <<'PYEOF'
import json, re, sys

vocab = json.load(open(sys.argv[1]))
renamed = vocab.get("renamed_terms", {})
locale_terms = renamed.get("locale_terms", {})
allowed_phrases = renamed.get("locale_allowed_phrases", {})
hits = []
for path, terms in locale_terms.items():
    try:
        catalog = json.load(open(path))
    except OSError:
        continue
    pattern = re.compile(r"\b(" + "|".join(re.escape(t) for t in terms) + r")\b", re.I)
    phrases = allowed_phrases.get(path, {})
    for key, value in catalog.items():
        if not isinstance(value, str):
            continue
        # ICU argument references are code the component passes, not copy.
        prose = re.sub(r"\{\s*\w+\s*[,}]", " ", value)
        for phrase in phrases.get(key, []):
            prose = re.sub(r"(?<!\w)" + re.escape(phrase) + r"(?!\w)", " ", prose)
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
  echo "❌ Off-glossary term found in a localized catalog:"
  echo "$LOCALE_HITS"
  echo
  echo "Locked visible terms: steward is es responsable, pt responsável; garden is es jardín, pt jardim. See:"
  echo "  scripts/data/banned-vocabulary.json (.renamed_terms.locale_terms)"
  exit 1
fi

# ---------------------------------------------------------------------------
# US spelling: English copy writes "canceled", never "cancelled".
# Walks parsed English values, so message keys (which keep names such as
# "app.pool.cycleState.cancelled"), ICU argument names and select or plural
# keys (wire values such as CANCELLED) are never read; branch text is.
# ---------------------------------------------------------------------------
if command -v python3 >/dev/null 2>&1; then
  SPELLING_HITS="$(python3 - "$VOCAB_JSON" <<'PYEOF'
import glob, json, re, sys

CHOICE = re.compile(r"\{\s*\w+\s*,\s*(?:select|plural|selectordinal)\s*,")


def branch_text(message):
    """Keep each select/plural branch's text and drop the keys that choose it."""
    out, i = [], 0
    while (choice := CHOICE.search(message, i)) is not None:
        out.append(message[i:choice.start()])
        depth, branches, j = 1, [], choice.end()
        while j < len(message) and depth:
            character = message[j]
            depth += {"{": 1, "}": -1}.get(character, 0)
            # Each branch loses its own braces, so a one-word branch such as
            # {cancelled} is read as text, not as an argument reference.
            if (character == "{" and depth == 2) or (character == "}" and depth == 1):
                branches.append(" ")
            elif depth >= 2:
                branches.append(character)
            j += 1
        out.append(" " + branch_text("".join(branches)) + " ")
        i = j
    return "".join(out) + message[i:]


section = json.load(open(sys.argv[1])).get("us_spelling", {})
terms = section.get("terms", {})
exempt = set(section.get("exempt_keys", []))
hits = []
if terms:
    pattern = re.compile(r"\b(" + "|".join(re.escape(t) for t in terms) + r")\b", re.I)
    for spec in section.get("globs", []):
        for path in sorted(glob.glob(spec)):
            for key, value in json.load(open(path)).items():
                if key in exempt or not isinstance(value, str):
                    continue
                # ICU argument references are code the component passes, and URLs are
                # addresses; neither is copy.
                prose = re.sub(r"\{\s*\w+\s*[,}]|https?://\S+", " ", branch_text(value))
                for match in pattern.finditer(prose):
                    word = match.group(0)
                    hits.append(f"{path}: {key}: {word} -> {terms[word.lower()]}")
print("\n".join(hits))
PYEOF
)"
else
  echo "⚠️  check-vocab: skipping US spelling (python3 not available)"
  SPELLING_HITS=""
fi

if [[ -n "$SPELLING_HITS" ]]; then
  echo "❌ UK spelling found in English copy:"
  echo "$SPELLING_HITS"
  echo
  echo "English copy uses US spelling; message keys keep their names. See:"
  echo "  DESIGN.md § Voice & Copy"
  echo "  scripts/data/banned-vocabulary.json (.us_spelling)"
  exit 1
fi

# ---------------------------------------------------------------------------
# Brazilian Portuguese: the pt catalog and the QA app's pt locale are Brazilian,
# with você. Walks parsed values, nested ones included (the QA locale groups its
# strings), skips ICU argument references, and matches the listed words as whole
# words plus the few forms a word list cannot hold (the -te clitic, "está a" +
# infinitive, «» quotes). Words that are also Brazilian in another sense are not
# listed; see the section's rationale.
# ---------------------------------------------------------------------------
if command -v python3 >/dev/null 2>&1; then
  PT_HITS="$(python3 - "$VOCAB_JSON" <<'PYEOF'
import glob, json, re, sys


def strings(node, key=""):
    """Every string in a parsed locale file, keyed by its dotted path."""
    if isinstance(node, str):
        yield key, node
    elif isinstance(node, dict):
        for name, child in node.items():
            yield from strings(child, f"{key}.{name}" if key else name)
    elif isinstance(node, list):
        for index, child in enumerate(node):
            yield from strings(child, f"{key}.{index}")


section = json.load(open(sys.argv[1])).get("pt_brazilian", {})
terms = section.get("terms", [])
patterns = [re.compile(p, re.I) for p in section.get("patterns", [])]
if terms:
    patterns.append(re.compile(r"(?<!\w)(" + "|".join(re.escape(t) for t in terms) + r")(?!\w)", re.I))
exempt = set(section.get("exempt_keys", []))
hits = []
for spec in section.get("globs", []):
    for path in sorted(glob.glob(spec)):
        for key, value in strings(json.load(open(path))):
            if key in exempt:
                continue
            # ICU argument references are code the component passes, not copy.
            prose = re.sub(r"\{\s*\w+\s*[,}]", " ", value)
            found = [match.group(0) for pattern in patterns for match in pattern.finditer(prose)]
            if found:
                hits.append(f"{path}: {key}: {', '.join(found)}")
print("\n".join(hits))
PYEOF
)"
else
  echo "⚠️  check-vocab: skipping Brazilian Portuguese (python3 not available)"
  PT_HITS=""
fi

if [[ -n "$PT_HITS" ]]; then
  echo "❌ European Portuguese form found in the Brazilian catalog:"
  echo "$PT_HITS"
  echo
  echo "The Portuguese catalog is Brazilian Portuguese with você. See:"
  echo "  scripts/data/banned-vocabulary.json (.pt_brazilian)"
  exit 1
fi

echo "✅ check-vocab: no banned, renamed, untranslated, UK-spelled, or European Portuguese vocabulary in ${#FOUND_FILES[@]} i18n file(s)."
