#!/usr/bin/env bash
# check-design-tokens.sh
# Verifies the Warm Earth runtime token projection in
# packages/shared/src/styles/theme.css. Root DESIGN.md is the canonical DesignMD
# source; generated --gg-* artifacts must stay current, and theme.css must expose
# the runtime aliases/components use.
#
# Closes the gap between the token_version field in the design skill and the
# actual CSS — catches silent drift before it ships.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

CANONICAL_DESIGN="DESIGN.md"
GENERATED_CSS="packages/shared/src/styles/design-md.generated.css"
IMPL="packages/shared/src/styles/theme.css"
USAGE_BASELINE="scripts/design-token-usage-baseline.tsv"

if [[ ! -f "$CANONICAL_DESIGN" ]]; then
  echo "❌ Canonical DesignMD source not found: $CANONICAL_DESIGN"
  exit 2
fi
if [[ ! -f "$GENERATED_CSS" ]]; then
  echo "❌ Generated DesignMD CSS not found: $GENERATED_CSS"
  exit 2
fi
if [[ ! -f "$IMPL" ]]; then
  echo "❌ Impl not found: $IMPL"
  exit 2
fi

# Runtime tokens components may consume — grouped by category.
# Radius aliases must project DesignMD-generated --gg-radius-* tokens.
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
  # Runtime radius aliases
  "radius|--radius-md"
  "radius|--radius-lg"
  "radius|--radius-xl"
  "radius|--radius-2xl"
  "radius|--radius-full"
)

GENERATED_RADIUS_TOKENS=(
  "--gg-radius-md"
  "--gg-radius-lg"
  "--gg-radius-xl"
  "--gg-radius-2xl"
  "--gg-radius-full"
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
  echo "❌ Warm Earth runtime tokens missing from $IMPL:"
  printf '  %s\n' "${MISSING[@]}"
  echo
  echo "Either project the token in theme.css, or update the runtime contract intentionally."
  echo "Then bump token_version in .claude/skills/design/SKILL.md and design_token_version in .claude/skills/ui/SKILL.md."
  exit 1
fi

MISSING_GENERATED=()
for token in "${GENERATED_RADIUS_TOKENS[@]}"; do
  if ! grep -q "^[[:space:]]*${token}:" "$GENERATED_CSS"; then
    MISSING_GENERATED+=("$token")
  fi
done

if [[ ${#MISSING_GENERATED[@]} -gt 0 ]]; then
  echo "❌ DesignMD radius tokens missing from $GENERATED_CSS:"
  printf '  %s\n' "${MISSING_GENERATED[@]}"
  echo
  echo "Update root $CANONICAL_DESIGN and run bun run design:generate."
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

# Usage check: raw cubic-bezier(), duration, color, and radius literals outside
# token-definition files, stories, tests, and audited legacy baseline entries.
# CLAUDE.md: "Never hardcode cubic-bezier, duration, or raw color/radius values."
# Allowlist: files that legitimately define or document tokens.
USAGE_ALLOWLIST_REGEX='(packages/shared/src/styles/theme\.css|packages/shared/src/styles/design-md\.generated\.css|packages/shared/src/styles/utilities\.css|packages/shared/\.storybook/|packages/admin/src/index\.css|packages/admin/src/styles/admin-m3-tokens\.css|packages/admin/src/styles/admin-m3-overrides\.css|packages/client/src/styles/animation\.css|packages/client/src/styles/view-transitions\.css|\.stories\.tsx|\.test\.tsx?|packages/client/vite\.config\.ts)'

collect_usage_hits() {
  grep -RInE --include='*.ts' --include='*.tsx' --include='*.css' \
    --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build \
    --exclude-dir=storybook-static --exclude-dir=.next --exclude-dir=coverage \
    'cubic-bezier\(|duration-[0-9]|duration-\[[^]]*[0-9][^]]*\]|#[0-9A-Fa-f]{3,8}|rgba\(|linear-gradient\(|rounded-\[[^]]*[0-9][^]]*\]' packages/ 2>/dev/null \
    | grep -Ev "$USAGE_ALLOWLIST_REGEX" \
    | grep -Ev 'cubic-bezier\([^)]*var\(' \
    | grep -Ev 'duration-\[var\(' \
    | grep -Ev 'rounded-\[var\(' \
    | sed -E 's#^([^:]+):[0-9]+:[[:space:]]*#\1	#' \
    | sed -E 's#[[:space:]]+# #g; s#[[:space:]]+$##' \
    | sort -u
}

USAGE_HITS="$(collect_usage_hits || true)"

if [[ -n "$USAGE_HITS" ]]; then
  if [[ ! -f "$USAGE_BASELINE" ]]; then
    echo "❌ Token usage baseline not found: $USAGE_BASELINE"
    echo "Current raw token usage hits:"
    echo "$USAGE_HITS" | sed 's/^/  /'
    exit 2
  fi

  BASELINE_HITS="$(grep -vE '^[[:space:]]*(#|$)' "$USAGE_BASELINE" | sort -u || true)"
  NEW_USAGE="$(comm -23 <(printf '%s\n' "$USAGE_HITS") <(printf '%s\n' "$BASELINE_HITS") || true)"
  STALE_BASELINE="$(comm -13 <(printf '%s\n' "$USAGE_HITS") <(printf '%s\n' "$BASELINE_HITS") || true)"

  if [[ -n "$NEW_USAGE" ]]; then
    echo "❌ New hardcoded design values found outside token-definition files:"
    echo "$NEW_USAGE" | sed 's/^/  /'
    echo
    echo "Use Warm Earth tokens instead: --spring-*, --color-*, --radius-*, --color-material-*, and --blur-material-*."
    echo "If this is intentional legacy debt, migrate it or add an audited baseline entry in $USAGE_BASELINE."
    exit 1
  fi

  if [[ -n "$STALE_BASELINE" ]]; then
    echo "❌ Stale token usage baseline entries found. Remove these fixed entries from $USAGE_BASELINE:"
    echo "$STALE_BASELINE" | sed 's/^/  /'
    exit 1
  fi
fi

echo "✅ check-design-tokens: ${#EXPECTED_TOKENS[@]} runtime tokens present in theme.css."
echo "✅ DesignMD radius outputs present in $GENERATED_CSS."
echo "✅ no new raw cubic-bezier, duration, color, or radius literals outside token-definition files."
echo "✅ token_version coupled across design skill, ui skill, and registry (${DESIGN_VER})."
