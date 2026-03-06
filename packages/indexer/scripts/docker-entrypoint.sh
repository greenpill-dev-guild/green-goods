#!/bin/bash
# Docker entrypoint for Green Goods Indexer
# Handles ReScript module resolution quirks before starting

set -e

# Fix ReScript module path mismatches (shared logic)
source /app/scripts/fix-rescript-paths.sh /app/generated

cd /app

echo "🚀 Starting indexer..."

# Work around Envio EE806/EE807: Hasura table tracking fails on fresh instances.
# Background a script that retries tracking after the indexer creates tables.
/app/scripts/track-hasura-tables.sh &

exec "$@"
