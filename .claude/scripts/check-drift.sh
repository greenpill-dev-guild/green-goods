#!/bin/bash
# Green Goods Skill & Configuration Drift Checker
# Verifies that skill references match actual codebase exports,
# port assignments, and core commands.

set -euo pipefail

DRIFT_COUNT=0
PASS_COUNT=0

drift() {
  echo "  DRIFT: $1"
  DRIFT_COUNT=$((DRIFT_COUNT + 1))
}

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
}

echo "Checking skill & configuration drift..."
echo ""

# ── 1. Hooks referenced in skills ──────────────────────────────────

echo "== Hooks =="
for hook in useTimeout useDelayedInvalidation useEventListener useWindowEvent \
  useDocumentEvent useAsyncEffect useAsyncSetup useOffline \
  useServiceWorkerUpdate useDraftAutoSave useDraftResume useJobQueue; do
  count=$(grep -rn "export.*$hook" packages/shared/src/ 2>/dev/null | wc -l | tr -d ' ')
  if [ "$count" -eq 0 ]; then
    drift "$hook referenced in skills but not exported from shared"
  else
    pass
  fi
done
echo "  $PASS_COUNT hooks OK"
PASS_COUNT=0

# ── 2. Utilities referenced in skills ──────────────────────────────

echo ""
echo "== Utilities =="
for util in parseContractError createMutationErrorHandler mediaResourceManager \
  getStorageQuota jobQueue jobQueueEventBus logger toastService; do
  count=$(grep -rn "export.*$util" packages/shared/src/ 2>/dev/null | wc -l | tr -d ' ')
  if [ "$count" -eq 0 ]; then
    drift "$util referenced in skills but not exported from shared"
  else
    pass
  fi
done
echo "  $PASS_COUNT utilities OK"
PASS_COUNT=0

# ── 3. Types referenced in skills ──────────────────────────────────

echo ""
echo "== Types =="
for type in Address Garden Work Action WorkApproval GardenAssessment \
  Job JobKind WorkDraft OfflineStatus; do
  count=$(grep -rn "export.*type.*${type}\b\|export.*interface.*${type}\b" packages/shared/src/ 2>/dev/null | wc -l | tr -d ' ')
  if [ "$count" -eq 0 ]; then
    drift "Type $type referenced in skills but not found in shared"
  else
    pass
  fi
done
echo "  $PASS_COUNT types OK"
PASS_COUNT=0

# ── 4. Dev port assignments ────────────────────────────────────────

echo ""
echo "== Port Assignments =="

# Expected ports from ecosystem.config.cjs (source of truth)
# Cross-check against vite configs and skill documentation
EXPECTED_PORTS="client:3001 admin:3002 docs:3003 storybook:6006 ops:8787"

for entry in $EXPECTED_PORTS; do
  name="${entry%%:*}"
  port="${entry##*:}"

  # Check ecosystem.config.cjs declares this port
  if grep -q "$name.*$port\|$port.*$name" ecosystem.config.cjs 2>/dev/null; then
    pass
  else
    drift "Port $port for $name not found in ecosystem.config.cjs"
  fi
done

# Cross-check vite configs match ecosystem ports
CLIENT_VITE_PORT=$(grep -o 'port: [0-9]*' packages/client/vite.config.ts 2>/dev/null | grep -o '[0-9]*' || echo "")
ADMIN_VITE_PORT=$(grep -o 'port: [0-9]*' packages/admin/vite.config.ts 2>/dev/null | grep -o '[0-9]*' || echo "")

if [ "$CLIENT_VITE_PORT" != "3001" ] && [ -n "$CLIENT_VITE_PORT" ]; then
  drift "Client vite port is $CLIENT_VITE_PORT, expected 3001"
fi

if [ "$ADMIN_VITE_PORT" != "3002" ] && [ -n "$ADMIN_VITE_PORT" ]; then
  drift "Admin vite port is $ADMIN_VITE_PORT, expected 3002"
fi

echo "  $PASS_COUNT port checks OK"
PASS_COUNT=0

# ── 5. Core commands still work ────────────────────────────────────

echo ""
echo "== Core Commands =="

# Check that scripts exist in root package.json (not that they run successfully)
ROOT_PKG="package.json"
for cmd in dev dev:stop format lint test build setup; do
  if grep -q "\"$cmd\"" "$ROOT_PKG" 2>/dev/null; then
    pass
  else
    drift "Command 'bun $cmd' not found in root package.json"
  fi
done

echo "  $PASS_COUNT commands OK"
PASS_COUNT=0

# ── 6. .env.schema exists and has key variables ───────────────────

echo ""
echo "== Environment =="

if [ -f ".env.schema" ]; then
  for var in VITE_CHAIN_ID VITE_STORACHA_KEY; do
    if grep -q "$var" .env.schema 2>/dev/null; then
      pass
    else
      drift "$var not found in .env.schema"
    fi
  done
  echo "  $PASS_COUNT env vars OK"
else
  drift ".env.schema not found at repo root"
fi

# ── Summary ────────────────────────────────────────────────────────

echo ""
if [ "$DRIFT_COUNT" -eq 0 ]; then
  echo "No drift detected."
  exit 0
else
  echo "$DRIFT_COUNT drift issue(s) found."
  exit 1
fi
