#!/bin/bash
# Docker entrypoint for Green Goods Indexer
# Handles ReScript module resolution quirks

set -e

cd /app/generated

echo "🔧 Fixing ReScript module paths..."

# Fix import path mismatch: rescript-envsafe uses .bs.js suffix but generated code expects .res.js
if [ -f "src/Env.res.js" ]; then
  sed -i "s|rescript-envsafe/src/EnvSafe\.res\.js|rescript-envsafe/src/EnvSafe.bs.js|g" src/Env.res.js 2>/dev/null || true
  echo "✅ Fixed Env.res.js import path"
fi

# Fix rescript-schema suffix mismatch: envio expects .res.js but package has .bs.js
RESCRIPT_SCHEMA_DIR="node_modules/rescript-schema/src"
if [ -d "$RESCRIPT_SCHEMA_DIR" ]; then
  if [ -f "$RESCRIPT_SCHEMA_DIR/S.bs.js" ] && [ ! -f "$RESCRIPT_SCHEMA_DIR/S.res.js" ]; then
    ln -sf S.bs.js "$RESCRIPT_SCHEMA_DIR/S.res.js" 2>/dev/null || true
    echo "✅ Created S.res.js symlink"
  fi
  if [ -f "$RESCRIPT_SCHEMA_DIR/S_Core.bs.js" ] && [ ! -f "$RESCRIPT_SCHEMA_DIR/S_Core.res.js" ]; then
    ln -sf S_Core.bs.js "$RESCRIPT_SCHEMA_DIR/S_Core.res.js" 2>/dev/null || true
    echo "✅ Created S_Core.res.js symlink"
  fi
fi

# Compile rescript-envsafe if EnvSafe.bs.js doesn't exist
if [ ! -f "node_modules/rescript-envsafe/src/EnvSafe.bs.js" ]; then
  echo "🔨 Compiling rescript-envsafe..."

  # Create minimal rescript.json for compilation
  if [ -f "node_modules/rescript-envsafe/rescript.json" ]; then
    cp node_modules/rescript-envsafe/rescript.json node_modules/rescript-envsafe/rescript.json.bak
    cat > node_modules/rescript-envsafe/rescript.json << 'EOF'
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

    # Compile
    cd node_modules/rescript-envsafe
    pnpm exec rescript build 2>&1 | grep -v "not found or built" | grep -v "^>>>>" || true
    cd ../..

    # Restore original
    mv node_modules/rescript-envsafe/rescript.json.bak node_modules/rescript-envsafe/rescript.json 2>/dev/null || true
    echo "✅ Compiled rescript-envsafe"
  fi
fi

cd /app

echo "🚀 Starting indexer..."
exec "$@"
