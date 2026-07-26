#!/bin/bash
# Fix ReScript module path mismatches between .res.js and .bs.js suffixes
# Shared by dev.sh (native) and docker-entrypoint.sh (container)
#
# Usage: source fix-rescript-paths.sh [GENERATED_DIR]
#   GENERATED_DIR defaults to "generated" (relative to working directory)

GENERATED_DIR="${1:-generated}"

if [ ! -d "$GENERATED_DIR" ]; then
  echo "⚠️  Generated directory not found: $GENERATED_DIR"
  return 0 2>/dev/null || true
fi

echo "🔧 Fixing ReScript module paths..."

# Cross-platform sed in-place
_sed_inplace() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "$@" 2>/dev/null || true
  else
    sed -i "$@" 2>/dev/null || true
  fi
}

# Phase A: Fix Env.res.js import path
# rescript-envsafe uses .bs.js suffix but generated code expects .res.js
if [ -f "$GENERATED_DIR/src/Env.res.js" ]; then
  _sed_inplace "s|rescript-envsafe/src/EnvSafe\.res\.js|rescript-envsafe/src/EnvSafe.bs.js|g" "$GENERATED_DIR/src/Env.res.js"
fi

# Phase B: Symlink rescript-schema .bs.js → .res.js
# envio expects .res.js but the package ships .bs.js
RESCRIPT_SCHEMA_DIR="$GENERATED_DIR/node_modules/rescript-schema/src"
if [ -d "$RESCRIPT_SCHEMA_DIR" ]; then
  if [ -f "$RESCRIPT_SCHEMA_DIR/S.bs.js" ] && [ ! -f "$RESCRIPT_SCHEMA_DIR/S.res.js" ]; then
    ln -sf S.bs.js "$RESCRIPT_SCHEMA_DIR/S.res.js" 2>/dev/null || true
  fi
  if [ -f "$RESCRIPT_SCHEMA_DIR/S_Core.bs.js" ] && [ ! -f "$RESCRIPT_SCHEMA_DIR/S_Core.res.js" ]; then
    ln -sf S_Core.bs.js "$RESCRIPT_SCHEMA_DIR/S_Core.res.js" 2>/dev/null || true
  fi
fi

# Phase C: Compile rescript-envsafe if EnvSafe.bs.js doesn't exist
ENVSAFE_DIR="$GENERATED_DIR/node_modules/rescript-envsafe"
if [ ! -f "$ENVSAFE_DIR/src/EnvSafe.bs.js" ] && [ -f "$ENVSAFE_DIR/rescript.json" ]; then
  echo "🔨 Compiling rescript-envsafe dependency..."

  # Create minimal rescript.json without dev dependencies
  cp "$ENVSAFE_DIR/rescript.json" "$ENVSAFE_DIR/rescript.json.bak"
  cat > "$ENVSAFE_DIR/rescript.json" << 'EOF'
{
  "name": "rescript-envsafe",
  "namespace": false,
  "bs-dependencies": ["rescript-schema"],
  "bsc-flags": ["-open RescriptSchema"],
  "suffix": ".bs.js",
  "package-specs": {
    "module": "commonjs",
    "in-source": true
  },
  "sources": [{"dir": "src"}]
}
EOF

  # Try available rescript executables
  ORIGINAL_DIR="$(pwd)"
  cd "$ENVSAFE_DIR"
  if command -v pnpm > /dev/null 2>&1; then
    pnpm exec rescript build 2>&1 | grep -v "not found or built" | grep -v "^>>>>" || true
  elif command -v npx > /dev/null 2>&1; then
    npx rescript build 2>&1 | grep -v "not found or built" | grep -v "^>>>>" || true
  elif command -v rescript > /dev/null 2>&1; then
    rescript build 2>&1 | grep -v "not found or built" | grep -v "^>>>>" || true
  fi
  cd "$ORIGINAL_DIR"

  # Restore original rescript.json
  mv "$ENVSAFE_DIR/rescript.json.bak" "$ENVSAFE_DIR/rescript.json" 2>/dev/null || true
fi

echo "✅ ReScript module paths fixed"
