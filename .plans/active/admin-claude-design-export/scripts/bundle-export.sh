#!/usr/bin/env bash
set -euo pipefail

# Admin Claude Design Export — bundle to ~/Downloads
# Per-view session model: 00-SYSTEM.md + 01-HUB.md..04-ACTIONS.md + screenshots/<bucket>/.
# Usage:
#   ./bundle-export.sh                  # default: --variants=first
#   ./bundle-export.sh --variants=all   # full coverage (~286 PNGs)
#   ./bundle-export.sh --skip-rebuild   # don't rebuild Storybook static
#   ./bundle-export.sh --skip-captures  # text bundle only (no screenshots)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLAN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$PLAN_DIR/../../.." && pwd)"

VARIANTS_FLAG=""
SKIP_REBUILD=false
SKIP_CAPTURES=false

for arg in "$@"; do
  case "$arg" in
    --variants=*) VARIANTS_FLAG="$arg" ;;
    --skip-rebuild) SKIP_REBUILD=true ;;
    --skip-captures) SKIP_CAPTURES=true ;;
    *) echo "Unknown arg: $arg" >&2; exit 1 ;;
  esac
done

DATE_TAG="$(date +%Y-%m-%d)"
DEST="$HOME/Downloads/admin-claude-design-export-$DATE_TAG"
SRC_TEXT_BUNDLE="$REPO_ROOT/tmp/storybook-design-assets"
REFERENCE_IMG="$HOME/Downloads/admin-claude-design-reference.png"

echo "=== Admin Claude Design Export ==="
echo "Repo:     $REPO_ROOT"
echo "Plan:     $PLAN_DIR"
echo "Dest:     $DEST"
echo "Variants: ${VARIANTS_FLAG:-(default: first)}"
echo "Skip rebuild:  $SKIP_REBUILD"
echo "Skip captures: $SKIP_CAPTURES"
echo ""

cd "$REPO_ROOT"

if [[ "$SKIP_REBUILD" == false ]]; then
  echo "→ Building Storybook static..."
  bun --cwd=packages/shared run build-storybook
else
  echo "→ Skipping Storybook rebuild (using existing storybook-static/)"
  if [[ ! -f "$REPO_ROOT/packages/shared/storybook-static/index.json" ]]; then
    echo "ERROR: storybook-static/index.json missing. Re-run without --skip-rebuild." >&2
    exit 1
  fi
fi

echo ""
echo "→ Refreshing text bundle (DESIGN.md dialects + tokens + manifest)..."
bun --cwd=packages/shared run storybook:prepare-design-assets

if [[ "$SKIP_CAPTURES" == false ]]; then
  echo ""
  echo "→ Capturing Storybook screenshots into per-view buckets..."
  rm -rf "$SRC_TEXT_BUNDLE/screenshots"
  node "$REPO_ROOT/packages/shared/.storybook/capture-admin-stories.mjs" $VARIANTS_FLAG
else
  echo "→ Skipping captures"
fi

echo ""
echo "→ Bundling to $DEST..."
rm -rf "$DEST"
mkdir -p "$DEST"

# Text bundle (DESIGN.md dialects, tokens, manifest, screenshots/)
cp -R "$SRC_TEXT_BUNDLE/." "$DEST/"

# Per-view session prompts
for prompt in READ-ME-FIRST.md 00-SYSTEM.md 01-HUB.md 02-GARDEN.md 03-COMMUNITY.md 04-ACTIONS.md; do
  if [[ -f "$PLAN_DIR/$prompt" ]]; then
    cp "$PLAN_DIR/$prompt" "$DEST/$prompt"
    echo "  ✓ $prompt"
  else
    echo "  ⚠ MISSING: $prompt (expected at $PLAN_DIR/$prompt)"
  fi
done

# Reference image
if [[ -f "$REFERENCE_IMG" ]]; then
  cp "$REFERENCE_IMG" "$DEST/reference-image.png"
  echo "  ✓ reference-image.png"
else
  echo "  ⚠ reference-image.png NOT FOUND at $REFERENCE_IMG"
  echo "    Save the user-provided reference image there and re-run --skip-rebuild --skip-captures."
fi

# Drop the old single-brief README (prepare-design-assets writes its own); per-view bundle has READ-ME-FIRST.md.
rm -f "$DEST/README.md"

# Build paste-ready combined session messages (one per route).
echo ""
echo "→ Building paste-ready SESSION-XX.md files (system + per-view + inline tokens)..."
node "$SCRIPT_DIR/build-session-messages.mjs" "$DEST"

echo ""
echo "=== Done ==="
echo "Bundle: $DEST"
echo ""
echo "Top-level contents:"
ls -1 "$DEST" | sed 's/^/  /'
echo ""
if [[ -d "$DEST/screenshots" ]]; then
  echo "Screenshots by bucket:"
  for bucket in "$DEST"/screenshots/*/; do
    bucket_name=$(basename "$bucket")
    count=$(find "$bucket" -name "*.png" 2>/dev/null | wc -l | tr -d ' ')
    echo "  $bucket_name: $count PNG"
  done
fi
echo ""
echo "Total bundle size:"
du -sh "$DEST"
echo ""
echo "Per-session feed (Hub example):"
echo "  $DEST/READ-ME-FIRST.md"
echo "  $DEST/00-SYSTEM.md"
echo "  $DEST/01-HUB.md"
echo "  $DEST/reference-image.png"
echo "  $DEST/DESIGN.md, DESIGN.admin.md, theme.css, design-md.generated.json"
echo "  $DEST/screenshots/shell/, primitives/, tokens/, hub/"
