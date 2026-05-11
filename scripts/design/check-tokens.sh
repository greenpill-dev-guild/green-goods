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

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

CANONICAL_DESIGN="DESIGN.md"
GENERATED_CSS="packages/shared/src/styles/design-md.generated.css"
IMPL="packages/shared/src/styles/theme.css"
ADMIN_M3_TOKENS="packages/admin/src/styles/admin-m3-tokens.css"
USAGE_BASELINE="scripts/data/design-token-usage-baseline.tsv"
BASELINE_EXPIRY_MAX_DAYS=250

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
if [[ ! -f "$ADMIN_M3_TOKENS" ]]; then
  echo "❌ Admin M3 token source not found: $ADMIN_M3_TOKENS"
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

# Admin M3 semantic variables must be defined before component code can consume
# them. Otherwise Tailwind arbitrary values such as `bg-[rgb(var(--m3-...))]`
# silently drop in the browser and can produce dark-on-dark admin surfaces.
collect_m3_var_usages() {
  grep -RohE --include='*.ts' --include='*.tsx' --include='*.css' \
    --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build \
    --exclude-dir=storybook-static --exclude-dir=coverage \
    'var\(--m3-[A-Za-z0-9_-]+' packages/admin/src packages/shared/src 2>/dev/null \
    | sed -E 's/var\((--m3-[A-Za-z0-9_-]+)/\1/' \
    | sort -u
}

M3_DEFINITION_FILES=(
  "$IMPL"
  "$ADMIN_M3_TOKENS"
  "packages/admin/src/index.css"
  "packages/admin/src/styles/admin-m3-overrides.css"
)

MISSING_M3_DEFS=()
while IFS= read -r token; do
  [[ -z "$token" ]] && continue
  defined=false
  for definition_file in "${M3_DEFINITION_FILES[@]}"; do
    if grep -q "^[[:space:]]*${token}:" "$definition_file"; then
      defined=true
      break
    fi
  done
  if [[ "$defined" == false ]]; then
    MISSING_M3_DEFS+=("$token")
  fi
done < <(collect_m3_var_usages)

if [[ ${#MISSING_M3_DEFS[@]} -gt 0 ]]; then
  echo "❌ Admin M3 variables are used but not defined:"
  printf '  %s\n' "${MISSING_M3_DEFS[@]}"
  echo
  echo "Define admin M3 roles in $ADMIN_M3_TOKENS or remove the undefined usage."
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
# token-definition files and audited legacy baseline entries.
# CLAUDE.md: "Never hardcode cubic-bezier, duration, or raw color/radius values."
# Allowlist: token projection/definition files plus tests, where issue references
# such as "#312" are not design values. Story and app style files are scanned;
# existing intentional literals must be captured line-by-line in the baseline.
USAGE_ALLOWLIST_REGEX='(packages/shared/src/styles/theme\.css|packages/shared/src/styles/design-md\.generated\.css|packages/admin/src/index\.css|packages/admin/src/styles/admin-m3-tokens\.css|packages/admin/src/styles/admin-m3-overrides\.css|\.test\.tsx?|packages/client/vite\.config\.ts)'

TW_PALETTE_FAMILIES='(gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)'
TW_COLOR_UTILITY='(accent|bg|border(-[trblxy])?|caret|decoration|divide|fill|from|outline|placeholder|ring|shadow|stroke|text|to|via)'
TW_VARIANT_PREFIX='([[:alnum:]_./%+\[\]()-]+:)*!?'
TW_CLASS_BOUNDARY='([^[:alnum:]_-]|$)'
TW_PALETTE_CLASS="(^|[^[:alnum:]_-])${TW_VARIANT_PREFIX}-?${TW_COLOR_UTILITY}-${TW_PALETTE_FAMILIES}(-[0-9]{2,3})?(/[[:alnum:]_.%+\[\]()/:-]+)?${TW_CLASS_BOUNDARY}"
RAW_USAGE_PATTERN="cubic-bezier\\(|duration-[0-9]|duration-\\[[^]]*[0-9][^]]*\\]|#[0-9A-Fa-f]{3,8}|rgba\\(|linear-gradient\\(|rounded-\\[[^]]*[0-9][^]]*\\]|${TW_PALETTE_CLASS}"

validate_usage_baseline() {
  if [[ ! -f "$USAGE_BASELINE" ]]; then
    return
  fi

  local today
  today="$(date +%F)"
  local max_expires
  max_expires="$(
    BASELINE_TODAY="$today" BASELINE_EXPIRY_MAX_DAYS="$BASELINE_EXPIRY_MAX_DAYS" node -e '
      const [year, month, day] = process.env.BASELINE_TODAY.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      date.setUTCDate(date.getUTCDate() + Number(process.env.BASELINE_EXPIRY_MAX_DAYS));
      console.log(date.toISOString().slice(0, 10));
    '
  )"
  local invalid=()
  local line_no=0
  local allowed_categories='^(legacy-runtime|storybook-fixture|storybook-theme|generated-media|third-party-theme)$'

  while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
    ((line_no += 1))
    if [[ "$raw_line" =~ ^[[:space:]]*(#|$) ]]; then
      continue
    fi

    local hit category owner expires note extra
    IFS=$'\t' read -r hit category owner expires note extra <<< "$raw_line"

    if [[ -n "${extra:-}" ]]; then
      invalid+=("line ${line_no}: expected exactly 5 tab-separated fields")
      continue
    fi
    if [[ -z "${hit:-}" || -z "${category:-}" || -z "${owner:-}" || -z "${expires:-}" || -z "${note:-}" ]]; then
      invalid+=("line ${line_no}: baseline entries require hit, category, owner, expires, and note")
      continue
    fi
    if [[ ! "$category" =~ $allowed_categories ]]; then
      invalid+=("line ${line_no}: unsupported category '${category}'")
    fi
    if [[ ! "$expires" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
      invalid+=("line ${line_no}: expires must use YYYY-MM-DD")
    elif [[ "$expires" < "$today" ]]; then
      invalid+=("line ${line_no}: baseline entry expired on ${expires}")
    elif [[ "$expires" > "$max_expires" ]]; then
      invalid+=("line ${line_no}: baseline expiry ${expires} exceeds ${BASELINE_EXPIRY_MAX_DAYS}-day limit (${max_expires})")
    fi
    if [[ ${#note} -lt 12 ]]; then
      invalid+=("line ${line_no}: note must explain the exception")
    fi
  done < "$USAGE_BASELINE"

  if [[ ${#invalid[@]} -gt 0 ]]; then
    echo "❌ Invalid token usage baseline metadata in $USAGE_BASELINE:"
    printf '  %s\n' "${invalid[@]}"
    echo
    echo "Format: <raw usage hit><TAB><category><TAB><owner><TAB><expires><TAB><note>"
    echo "Categories: legacy-runtime, storybook-fixture, storybook-theme, generated-media, third-party-theme."
    echo "Expiry must be within ${BASELINE_EXPIRY_MAX_DAYS} days."
    exit 1
  fi

  local duplicate_hits
  duplicate_hits="$(awk -F '\t' '!/^[[:space:]]*(#|$)/ {print $1}' "$USAGE_BASELINE" | sort | uniq -d || true)"
  if [[ -n "$duplicate_hits" ]]; then
    echo "❌ Duplicate token usage baseline entries found in $USAGE_BASELINE:"
    echo "$duplicate_hits" | sed 's/^/  /'
    exit 1
  fi
}

collect_usage_hits() {
  grep -RInE --include='*.ts' --include='*.tsx' --include='*.css' \
    --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build \
    --exclude-dir=storybook-static --exclude-dir=.next --exclude-dir=coverage \
    "$RAW_USAGE_PATTERN" packages/ 2>/dev/null \
    | grep -Ev "$USAGE_ALLOWLIST_REGEX" \
    | grep -Ev 'cubic-bezier\([^)]*var\(' \
    | grep -Ev 'duration-\[var\(' \
    | grep -Ev 'rounded-\[var\(' \
    | sed -E 's#^([^:]+):[0-9]+:[[:space:]]*#\1	#' \
    | sed -E 's#[[:space:]]+# #g; s#[[:space:]]+$##' \
    | sort -u
}

validate_usage_baseline
USAGE_HITS="$(collect_usage_hits || true)"
BASELINE_HITS=""
if [[ -f "$USAGE_BASELINE" ]]; then
  BASELINE_HITS="$(awk -F '\t' '!/^[[:space:]]*(#|$)/ {print $1}' "$USAGE_BASELINE" | sort -u || true)"
fi

if [[ -n "$USAGE_HITS" ]]; then
  if [[ ! -f "$USAGE_BASELINE" ]]; then
    echo "❌ Token usage baseline not found: $USAGE_BASELINE"
    echo "Current raw token usage hits:"
    echo "$USAGE_HITS" | sed 's/^/  /'
    exit 2
  fi
fi

NEW_USAGE="$(comm -23 <(printf '%s\n' "$USAGE_HITS" | sed '/^$/d') <(printf '%s\n' "$BASELINE_HITS" | sed '/^$/d') || true)"
STALE_BASELINE="$(comm -13 <(printf '%s\n' "$USAGE_HITS" | sed '/^$/d') <(printf '%s\n' "$BASELINE_HITS" | sed '/^$/d') || true)"

if [[ -n "$NEW_USAGE" ]]; then
  echo "❌ New hardcoded design values found outside token-definition or audited baseline files:"
  echo "$NEW_USAGE" | sed 's/^/  /'
  echo
  echo "Use Warm Earth tokens instead: --spring-*, --color-*, --radius-*, --color-material-*, --blur-material-*, and semantic utility aliases."
  echo "If this is intentional legacy debt, migrate it or add an audited baseline entry in $USAGE_BASELINE."
  exit 1
fi

if [[ -n "$STALE_BASELINE" ]]; then
  echo "❌ Stale token usage baseline entries found. Remove these fixed entries from $USAGE_BASELINE:"
  echo "$STALE_BASELINE" | sed 's/^/  /'
  exit 1
fi

ADMIN_CHROME_ALLOWLIST_REGEX='(packages/admin/src/index\.css|packages/admin/src/styles/admin-m3-overrides\.css|packages/admin/src/styles/admin-m3-tokens\.css)'
ADMIN_CHROME_PATTERN='glass-(ground|raised|floating|overlay|surface)|backdrop-blur|backdrop-filter|linear-gradient\('

collect_admin_chrome_violations() {
  grep -RInE --include='*.ts' --include='*.tsx' --include='*.css' \
    --exclude='*.stories.tsx' --exclude='*.stories.ts' \
    --exclude='*.test.tsx' --exclude='*.test.ts' \
    --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build \
    --exclude-dir=storybook-static --exclude-dir=.next --exclude-dir=coverage \
    "$ADMIN_CHROME_PATTERN" packages/admin/src 2>/dev/null \
    | grep -Ev "$ADMIN_CHROME_ALLOWLIST_REGEX" \
    | sed -E 's#^([^:]+):[0-9]+:[[:space:]]*#\1	#' \
    | sed -E 's#[[:space:]]+# #g; s#[[:space:]]+$##' \
    | sort -u
}

ADMIN_CHROME_VIOLATIONS="$(collect_admin_chrome_violations || true)"
if [[ -n "$ADMIN_CHROME_VIOLATIONS" ]]; then
  echo "❌ Admin Controlled Chrome violation found:"
  echo "$ADMIN_CHROME_VIOLATIONS" | sed 's/^/  /'
  echo
  echo "Admin glass/backdrop blur and decorative gradients must stay in the approved chrome contract: Navigation/FAB and sheet shells via packages/admin/src/index.css or admin-m3-overrides.css; the AppBar root stays transparent."
  echo "Route cards, forms, tables, records, and dense content must use solid semantic surfaces."
  exit 1
fi

node scripts/design/check-css-custom-properties.mjs

echo "✅ check-design-tokens: ${#EXPECTED_TOKENS[@]} runtime tokens present in theme.css."
echo "✅ DesignMD radius outputs present in $GENERATED_CSS."
echo "✅ admin M3 variable usages resolve to defined tokens."
echo "✅ no new raw cubic-bezier, duration, color, radius literals, or primitive palette utilities outside token-definition or audited baseline files."
echo "✅ admin Controlled Chrome guard passed: glass/blur/gradients stay in approved shell CSS."
echo "✅ token_version coupled across design skill, ui skill, and registry (${DESIGN_VER})."
