#!/usr/bin/env bash
# Green Goods Dev Container Bootstrap
# Runs after container creation to set up the development environment

set -euo pipefail

echo "🌱 Setting up Green Goods development environment..."

# Initialize git submodules (contracts dependencies)
echo "📦 Initializing git submodules..."
git submodule update --init --recursive

# Create .env from template if it doesn't exist
if [ ! -f .env ]; then
  echo "📝 Creating .env from template..."
  cp .env.example .env
  echo "   ⚠️  Edit .env with your API keys (Reown, Pimlico, etc.)"
else
  echo "✅ .env already exists"
fi

# Install all workspace dependencies
echo "📦 Installing dependencies with bun..."
bun install

# Generate indexer types (so 'bun dev' works out of the box)
echo "🔧 Generating indexer types..."
bun --filter indexer codegen || echo "   ⚠️  Indexer codegen skipped (run manually if needed)"

# Setup ReScript dependencies for indexer
echo "🔧 Setting up indexer ReScript dependencies..."
bun --filter indexer setup-generated || echo "   ⚠️  Indexer setup skipped (run 'bun --filter indexer setup-generated' manually)"

# Build contracts (generates ABIs needed by other packages)
echo "🔨 Building contracts..."
bun --filter contracts build || echo "   ⚠️  Contract build skipped (run 'bun --filter contracts build' manually)"

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 Quick start:"
echo "   bun dev          - Start all services (client, admin, indexer, agent)"
echo "   bun dev:client   - Start client only (http://localhost:3001)"
echo "   bun dev:admin    - Start admin only (http://localhost:3002)"
echo "   bun test         - Run all tests"
echo ""
echo "📝 Don't forget to edit .env with your API keys!"
echo "   Required: VITE_WALLETCONNECT_PROJECT_ID, VITE_PIMLICO_API_KEY"
echo ""
