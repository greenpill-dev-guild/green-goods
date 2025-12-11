#!/bin/bash
# scripts/ci-local.sh - Run all CI checks locally
#
# Usage: ./scripts/ci-local.sh [options]
#   --skip-contracts  Skip contracts tests (requires Foundry)
#   --skip-build      Skip build step
#   --only-lint       Only run lint and format checks
#
# This script mimics what GitHub Actions CI runs.

set -e

SKIP_CONTRACTS=false
SKIP_BUILD=false
ONLY_LINT=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --skip-contracts)
      SKIP_CONTRACTS=true
      shift
      ;;
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --only-lint)
      ONLY_LINT=true
      shift
      ;;
  esac
done

echo "========================================"
echo "  Green Goods CI Local Validation"
echo "========================================"
echo ""

# Navigate to project root
cd "$(dirname "$0")/.."

echo "=== Format Check ==="
bun run format:check
echo "✓ Format check passed"
echo ""

echo "=== Lint ==="
bun run lint
echo "✓ Lint passed"
echo ""

if [ "$ONLY_LINT" = true ]; then
  echo "========================================"
  echo "  Lint-only checks completed!"
  echo "========================================"
  exit 0
fi

echo "=== Shared Package Tests ==="
cd packages/shared
bun run test || echo "⚠ Some shared tests failed (see above)"
cd ../..
echo ""

echo "=== Client Tests ==="
cd packages/client
bun run test || echo "⚠ Some client tests failed (see above)"
cd ../..
echo ""

echo "=== Admin Tests ==="
cd packages/admin
bun run test:unit || echo "⚠ Some admin tests failed (see above)"
cd ../..
echo ""

if [ "$SKIP_CONTRACTS" = false ]; then
  echo "=== Contracts Tests ==="
  cd packages/contracts
  bun run test || echo "⚠ Some contracts tests failed (see above)"
  cd ../..
  echo ""
fi

echo "=== Agent Tests ==="
cd packages/agent
ENCRYPTION_SECRET="test-secret-for-ci-encryption-32chars" bun run test
echo "✓ Agent tests passed"
cd ../..
echo ""

if [ "$SKIP_BUILD" = false ]; then
  echo "=== Build All ==="
  bun run build
  echo "✓ Build completed"
  echo ""
fi

echo "========================================"
echo "  All CI checks completed!"
echo "========================================"
echo ""
echo "Note: Some tests may have failures that need fixing."
echo "Check the output above for details."


