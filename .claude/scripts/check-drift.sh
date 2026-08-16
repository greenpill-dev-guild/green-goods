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

count_shared_exports() {
  local pattern="$1"
  { grep -rn "$pattern" packages/shared/src/ 2>/dev/null || true; } | wc -l | tr -d ' '
}

echo "Checking skill & configuration drift..."
echo ""

# ── 1. Hooks referenced in skills ──────────────────────────────────

echo "== Hooks =="
for hook in useTimeout useDelayedInvalidation useEventListener useWindowEvent \
  useDocumentEvent useAsyncEffect useAsyncSetup useOffline \
  useServiceWorkerUpdate useDraftAutoSave useDraftResume useJobQueue; do
  count=$(count_shared_exports "export.*$hook")
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
  count=$(count_shared_exports "export.*$util")
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
  count=$(count_shared_exports "export.*type.*${type}\b\|export.*interface.*${type}\b")
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

extract_stack_port() {
  local app="$1"
  awk -v app="$app" '
    /const portByApp = \{/ { in_ports = 1; next }
    in_ports && /^\};/ { in_ports = 0 }
    in_ports {
      line = $0
      gsub(/["'\'' ,]/, "", line)
      split(line, parts, ":")
      if (parts[1] == app) {
        print parts[2]
        exit
      }
    }
  ' scripts/dev/stack.js 2>/dev/null || true
}

extract_check_port() {
  local file="$1"
  local label="$2"
  grep -E "check-port\\.js [0-9]+ $label" "$file" 2>/dev/null \
    | sed -E "s/.*check-port\\.js ([0-9]+) $label.*/\\1/" \
    | head -1 || true
}

check_required_port() {
  local app="$1"
  local port
  port=$(extract_stack_port "$app")
  if [ -n "$port" ]; then
    pass
  else
    drift "Port for $app not found in scripts/dev/stack.js"
  fi
}

check_port_match() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  local source="$4"

  if [ -z "$expected" ]; then
    drift "Canonical port for $label not found in scripts/dev/stack.js"
  elif [ -z "$actual" ]; then
    drift "Port for $label not found in $source"
  elif [ "$actual" = "$expected" ]; then
    pass
  else
    drift "$label port is $actual in $source, expected $expected from scripts/dev/stack.js"
  fi
}

for app in client admin docs storybook agent indexer; do
  check_required_port "$app"
done

# Cross-check package-local launchers match scripts/dev/stack.js.
CLIENT_VITE_PORT=$(grep -o 'port: [0-9]*' packages/client/vite.config.ts 2>/dev/null | grep -o '[0-9]*' || echo "")
ADMIN_VITE_PORT=$(grep -o 'port: [0-9]*' packages/admin/vite.config.ts 2>/dev/null | grep -o '[0-9]*' || echo "")
DOCS_PACKAGE_PORT=$(extract_check_port docs/package.json docs)
STORYBOOK_PACKAGE_PORT=$(extract_check_port packages/shared/package.json storybook)

check_port_match "client" "$(extract_stack_port client)" "$CLIENT_VITE_PORT" "packages/client/vite.config.ts"
check_port_match "admin" "$(extract_stack_port admin)" "$ADMIN_VITE_PORT" "packages/admin/vite.config.ts"
check_port_match "docs" "$(extract_stack_port docs)" "$DOCS_PACKAGE_PORT" "docs/package.json"
check_port_match "storybook" "$(extract_stack_port storybook)" "$STORYBOOK_PACKAGE_PORT" "packages/shared/package.json"

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
  for var in VITE_CHAIN_ID VITE_API_BASE_URL VITE_PINATA_GATEWAY_URL PINATA_JWT_OP_REF PINATA_JWT; do
    if grep -q "$var" .env.schema 2>/dev/null; then
      pass
    else
      drift "$var not found in .env.schema"
    fi
  done
  if grep -Fq 'PINATA_JWT=if($PINATA_JWT_OP_REF, op($PINATA_JWT_OP_REF),' .env.schema 2>/dev/null; then
    pass
  else
    drift "PINATA_JWT in .env.schema does not derive from PINATA_JWT_OP_REF"
  fi
  if grep -q "VITE_STORACHA" .env.schema 2>/dev/null; then
    drift "Stale VITE_STORACHA variable found in .env.schema"
  else
    pass
  fi
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
