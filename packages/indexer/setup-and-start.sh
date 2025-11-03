#!/bin/bash
# Setup and start Green Goods Indexer
# Simple and reliable - no auto-magic

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔧 Setting up indexer..."

# Check if Docker is accessible (fail fast if not)
if ! docker ps > /dev/null 2>&1; then
  echo ""
  echo "❌ Docker is not running or not accessible."
  echo ""
  echo "To fix:"
  echo "  1. Open Docker Desktop: open -a Docker"
  echo "  2. Wait 30 seconds for it to start"
  echo "  3. Run: bun dev"
  echo ""
  exit 1
fi

# Check if indexer is already running
if pgrep -f "envio dev" > /dev/null 2>&1 || lsof -ti:9898 > /dev/null 2>&1; then
  echo "⚠️  Stopping existing indexer..."
  pkill -f "envio dev" 2>/dev/null || true
  pkill -f "ts-node.*Index.res.js" 2>/dev/null || true
  lsof -ti:9898 | xargs kill -9 2>/dev/null || true
  lsof -ti:8080 | xargs kill -9 2>/dev/null || true
  sleep 2
  echo "✅ Stopped existing indexer"
fi

# Check if generated folder exists
if [ ! -d "generated" ]; then
  echo "❌ Generated folder not found. Run 'bun codegen' first."
  exit 1
fi

# Setup ReScript dependencies
echo "📦 Installing ReScript dependencies with pnpm..."
cd generated

# Ensure dependencies are installed (don't suppress errors)
if ! pnpm install; then
  echo ""
  echo "❌ Failed to install dependencies in generated folder."
  echo ""
  echo "Try running manually:"
  echo "  cd packages/indexer/generated"
  echo "  pnpm install"
  echo ""
  exit 1
fi

echo "🔨 Building ReScript code..."
if ! pnpm run build; then
  echo ""
  echo "❌ Failed to build ReScript code."
  echo ""
  echo "Try running manually:"
  echo "  cd packages/indexer/generated"
  echo "  pnpm run build"
  echo ""
  exit 1
fi

# Fix import path mismatch: rescript-envsafe uses .bs.js suffix but generated code expects .res.js
# Replace the incorrect import path in Env.res.js
if [ -f "src/Env.res.js" ]; then
  sed -i.bak "s|rescript-envsafe/src/EnvSafe\.res\.js|rescript-envsafe/src/EnvSafe.bs.js|g" src/Env.res.js 2>/dev/null || \
  sed -i '' "s|rescript-envsafe/src/EnvSafe\.res\.js|rescript-envsafe/src/EnvSafe.bs.js|g" src/Env.res.js 2>/dev/null || true
  rm -f src/Env.res.js.bak 2>/dev/null || true
fi

# Ensure rescript-envsafe is compiled (it might not be compiled yet)
if [ ! -f "node_modules/rescript-envsafe/src/EnvSafe.bs.js" ]; then
  echo "🔨 Compiling rescript-envsafe dependency..."
  
  # Temporarily modify rescript.json to remove dev dependencies
  if [ -f "node_modules/rescript-envsafe/rescript.json" ]; then
    mv node_modules/rescript-envsafe/rescript.json node_modules/rescript-envsafe/rescript.json.bak
    # Create a minimal rescript.json without dev dependencies
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
    # Try to compile using pnpm exec (run from generated folder for proper path resolution)
    if command -v pnpm > /dev/null 2>&1; then
      cd node_modules/rescript-envsafe
      pnpm exec rescript build 2>&1 | grep -v "not found or built" | grep -v "^>>>>" || true
      cd ../..
    elif command -v npx > /dev/null 2>&1; then
      cd node_modules/rescript-envsafe
      npx rescript build 2>&1 | grep -v "not found or built" | grep -v "^>>>>" || true
      cd ../..
    elif command -v rescript > /dev/null 2>&1; then
      cd node_modules/rescript-envsafe
      rescript build 2>&1 | grep -v "not found or built" | grep -v "^>>>>" || true
      cd ../..
    fi
    # Restore original rescript.json
    mv node_modules/rescript-envsafe/rescript.json.bak node_modules/rescript-envsafe/rescript.json 2>/dev/null || true
  fi
fi

cd ..

echo "✅ Setup complete!"
echo ""
echo "🚀 Starting indexer..."

# Start envio
if command -v bunx > /dev/null 2>&1; then
  bunx envio dev
elif [ -f "node_modules/.bin/envio" ]; then
  ./node_modules/.bin/envio dev
else
  envio dev
fi

