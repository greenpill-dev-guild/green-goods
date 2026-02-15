#!/bin/bash
# Docker entrypoint for Green Goods Indexer
# Handles ReScript module resolution quirks before starting

set -e

# Fix ReScript module path mismatches (shared logic)
source /app/scripts/fix-rescript-paths.sh /app/generated

cd /app

echo "🚀 Starting indexer..."
exec "$@"
