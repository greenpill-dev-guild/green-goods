#!/usr/bin/env bash
# check-design-tokens.sh
# Compares the Warm Earth token spec in .claude/skills/design/language.md against
# the implementation in packages/shared/src/styles/theme.css. Reports any token
# named in the spec that is not defined in theme.css.
#
# Closes the gap between the token_version field in the design skill and the
# actual CSS — catches silent drift before it ships.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

SPEC=".claude/skills/design/language.md"
IMPL="packages/shared/src/styles/theme.css"

if [[ ! -f "$SPEC" ]]; then
  echo "❌ Spec not found: $SPEC"
  exit 2
fi
if [[ ! -f "$IMPL" ]]; then
  echo "❌ Impl not found: $IMPL"
  exit 2
fi

# Tokens the spec promises — grouped by category. Keep in sync with language.md.
# Format: "category|token-name"
EXPECTED_TOKENS=(
  # Spring motion system
  "motion|--spring-spatial"
  "motion|--spring-spatial-fast"
  "motion|--spring-spatial-slow"
  "motion|--spring-effects"
  "motion|--spring-effects-fast"
  "motion|--spring-effects-slow"
  # Material system
  "material|--color-material-ultrathin"
  "material|--color-material-thin"
  "material|--color-material-regular"
  "material|--color-material-thick"
  "material|--color-material-solid"
  "material|--blur-material-ultrathin"
  "material|--blur-material-thin"
  "material|--blur-material-regular"
  "material|--blur-material-thick"
  "material|--border-material"
)

MISSING=()
for entry in "${EXPECTED_TOKENS[@]}"; do
  category="${entry%%|*}"
  token="${entry##*|}"
  if ! grep -q "^[[:space:]]*${token}:" "$IMPL"; then
    MISSING+=("${category}	${token}")
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "❌ Warm Earth tokens spec'd in $SPEC but missing from $IMPL:"
  printf '  %s\n' "${MISSING[@]}"
  echo
  echo "Either add the token to theme.css, or update the spec in language.md."
  echo "Then bump token_version in .claude/skills/design/SKILL.md and design_token_version in .claude/skills/ui/SKILL.md."
  exit 1
fi

# Version coupling check: design token_version must match ui design_token_version.
DESIGN_VER="$(awk -F': *"?' '/^token_version:/ {gsub(/["[:space:]]/, "", $2); print $2; exit}' .claude/skills/design/SKILL.md)"
UI_VER="$(awk -F': *"?' '/^design_token_version:/ {gsub(/["[:space:]]/, "", $2); print $2; exit}' .claude/skills/ui/SKILL.md)"
REG_DESIGN_VER="$(grep -o '"token_version": *"[^"]*"' .claude/registry/skills.json | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"
REG_UI_VER="$(grep -o '"design_token_version": *"[^"]*"' .claude/registry/skills.json | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"

if [[ "$DESIGN_VER" != "$UI_VER" ]]; then
  echo "❌ token_version drift: design=${DESIGN_VER} vs ui design_token_version=${UI_VER}"
  exit 1
fi
if [[ "$DESIGN_VER" != "$REG_DESIGN_VER" ]]; then
  echo "❌ registry drift: design SKILL.md token_version=${DESIGN_VER} vs registry=${REG_DESIGN_VER}"
  exit 1
fi
if [[ "$UI_VER" != "$REG_UI_VER" ]]; then
  echo "❌ registry drift: ui SKILL.md design_token_version=${UI_VER} vs registry=${REG_UI_VER}"
  exit 1
fi

echo "✅ check-design-tokens: ${#EXPECTED_TOKENS[@]} spec'd tokens present in theme.css."
echo "✅ token_version coupled across design skill, ui skill, and registry (${DESIGN_VER})."
