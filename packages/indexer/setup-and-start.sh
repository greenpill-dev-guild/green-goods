#!/bin/bash
# Setup and start Green Goods Indexer
# Simple and reliable - no auto-magic

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

# Check if PostgreSQL container is running and accessible
if ! docker ps --format '{{.Names}}' | grep -q "postgres"; then
  echo ""
  echo "⚠️  PostgreSQL container not running. Starting Docker containers..."
  cd generated && docker compose up -d 2>/dev/null && cd ..
  sleep 5
fi

# Verify database is accessible (wait up to 15 seconds)
echo "🔍 Checking database connection..."
DB_READY=false
for i in 1 2 3 4 5; do
  if nc -z localhost 5433 2>/dev/null; then
    DB_READY=true
    break
  fi
  echo "   Waiting for PostgreSQL... (attempt $i/5)"
  sleep 3
done

if [ "$DB_READY" = false ]; then
  echo ""
  echo "❌ PostgreSQL is not accessible on port 5433."
  echo ""
  echo "To fix:"
  echo "  cd packages/indexer/generated && docker compose up -d"
  echo ""
  exit 1
fi
echo "✅ Database connection OK"

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

cd generated

# Check if dependencies are already installed
DEPS_INSTALLED=false
if [ -d "node_modules/rescript" ] && [ -d "node_modules/envio" ]; then
  DEPS_INSTALLED=true
  echo "📦 Dependencies already installed, skipping pnpm install"
fi

# Setup ReScript dependencies (with retry logic for network issues)
if [ "$DEPS_INSTALLED" = false ]; then
  echo "📦 Installing ReScript dependencies with pnpm..."

  MAX_RETRIES=3
  RETRY_COUNT=0
  INSTALL_SUCCESS=false

  while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ "$INSTALL_SUCCESS" = false ]; do
    if pnpm install 2>&1; then
      INSTALL_SUCCESS=true
    else
      RETRY_COUNT=$((RETRY_COUNT + 1))
      if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
        echo "⚠️  pnpm install failed, retrying in 5 seconds... (attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)"
        sleep 5
      fi
    fi
  done

  if [ "$INSTALL_SUCCESS" = false ]; then
    echo ""
    echo "❌ Failed to install dependencies after $MAX_RETRIES attempts."
    echo ""
    echo "Try running manually:"
    echo "  cd packages/indexer/generated"
    echo "  pnpm install"
    echo ""
    exit 1
  fi
fi

# Check if ReScript code needs to be built
if [ -f "src/Index.res.js" ] && [ -f "src/db/Migrations.res.js" ]; then
  echo "🔨 ReScript code already compiled, skipping build"
else
  echo "🔨 Building ReScript code..."
  # Use pnpm exec rescript to avoid build script restrictions
  if ! pnpm exec rescript 2>&1; then
    echo ""
    echo "❌ Failed to build ReScript code."
    echo ""
    echo "Try running manually:"
    echo "  cd packages/indexer/generated"
    echo "  pnpm exec rescript"
    echo ""
    exit 1
  fi
fi

# Fix import path mismatch: rescript-envsafe uses .bs.js suffix but generated code expects .res.js
# Replace the incorrect import path in Env.res.js
if [ -f "src/Env.res.js" ]; then
  sed -i.bak "s|rescript-envsafe/src/EnvSafe\.res\.js|rescript-envsafe/src/EnvSafe.bs.js|g" src/Env.res.js 2>/dev/null || \
  sed -i '' "s|rescript-envsafe/src/EnvSafe\.res\.js|rescript-envsafe/src/EnvSafe.bs.js|g" src/Env.res.js 2>/dev/null || true
  rm -f src/Env.res.js.bak 2>/dev/null || true
fi

# Fix rescript-schema suffix mismatch: envio expects .res.js but package has .bs.js
# Create symlinks for compatibility
RESCRIPT_SCHEMA_DIR="node_modules/rescript-schema/src"
if [ -d "$RESCRIPT_SCHEMA_DIR" ]; then
  if [ -f "$RESCRIPT_SCHEMA_DIR/S.bs.js" ] && [ ! -f "$RESCRIPT_SCHEMA_DIR/S.res.js" ]; then
    ln -sf S.bs.js "$RESCRIPT_SCHEMA_DIR/S.res.js" 2>/dev/null || true
  fi
  if [ -f "$RESCRIPT_SCHEMA_DIR/S_Core.bs.js" ] && [ ! -f "$RESCRIPT_SCHEMA_DIR/S_Core.res.js" ]; then
    ln -sf S_Core.bs.js "$RESCRIPT_SCHEMA_DIR/S_Core.res.js" 2>/dev/null || true
  fi
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

# Workaround: Disable proxy detection to avoid Rust panic in system-configuration crate
# This prevents "Attempted to create a NULL object" errors on macOS
export NO_PROXY="*"
export http_proxy=""
export https_proxy=""
export HTTP_PROXY=""
export HTTPS_PROXY=""

# Start envio
if command -v bunx > /dev/null 2>&1; then
  bunx envio dev
elif [ -f "node_modules/.bin/envio" ]; then
  ./node_modules/.bin/envio dev
else
  envio dev
fi

