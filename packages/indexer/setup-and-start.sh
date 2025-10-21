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
pnpm install > /dev/null 2>&1

echo "🔨 Building ReScript code..."
pnpm run build > /dev/null 2>&1

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

