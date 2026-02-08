#!/bin/bash
# Reset Green Goods Indexer
# Run this after restarting Docker Desktop

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "🧹 Cleaning up Docker containers and volumes..."
docker compose down -v 2>/dev/null || true
docker ps -a --filter "name=generated-envio" --format "{{.ID}}" | xargs docker rm -f 2>/dev/null || true
docker volume ls --filter "name=generated" --format "{{.Name}}" | xargs docker volume rm 2>/dev/null || true

echo "🧹 Cleaning up Envio state..."
rm -rf generated/persisted_state.envio.json .envio 2>/dev/null || true

echo "🧹 Running Docker cleanup..."
docker system prune -f

echo "✅ Reset complete! Now run: bun dev"
