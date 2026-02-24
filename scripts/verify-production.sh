#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Green Goods — Production Readiness Verification
# ═══════════════════════════════════════════════════════════════════════════════
#
# Verifies contracts are ready for production deployment by running:
#   Phase 1: Full compilation (via_ir, all sources including test/script)
#   Phase 2: Lint (forge fmt --check) + Solhint (parallel, no forge lock)
#   Phase 3: Unit tests + E2E workflow test (sequential, forge lock)
#   Phase 4: Deployment dry runs — Sepolia, Arbitrum, Celo (sequential, cached)
#
# Parallelism constraints:
#   All forge subcommands share out/ and cache/ dirs → single lock, must serialize.
#   Only solhint (non-forge) can run truly parallel with forge tasks.
#
# Usage:
#   ./scripts/verify-production.sh            # Full verification
#   ./scripts/verify-production.sh --skip-e2e # Skip E2E (faster iteration)
#   ./scripts/verify-production.sh --help     # Show this help
#
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/packages/contracts"

SKIP_E2E=false
SKIP_DRY_RUN=false

for arg in "$@"; do
  case $arg in
    --skip-e2e)    SKIP_E2E=true ;;
    --skip-dry-run) SKIP_DRY_RUN=true ;;
    --help|-h)
      head -22 "$0" | tail -16
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      exit 1
      ;;
  esac
done

# ─── Output helpers ───────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

phase()   { echo -e "\n${BOLD}${BLUE}═══ $1 ═══${NC}"; }
success() { echo -e "${GREEN}  ✅ $1${NC}"; }
fail()    { echo -e "${RED}  ❌ $1${NC}"; exit 1; }
info()    { echo -e "${DIM}  $1${NC}"; }

# Track phase timings
declare -a PHASE_NAMES=()
declare -a PHASE_TIMES=()
TOTAL_START=$SECONDS

phase_start() {
  PHASE_NAMES+=("$1")
  PHASE_START=$SECONDS
}

phase_end() {
  local elapsed=$((SECONDS - PHASE_START))
  PHASE_TIMES+=("$elapsed")
  info "took ${elapsed}s"
}

# ─── Preflight ────────────────────────────────────────────────────────────────
if ! command -v forge &>/dev/null; then
  fail "forge not found — install Foundry: https://book.getfoundry.sh/getting-started/installation"
fi

if ! command -v bun &>/dev/null; then
  fail "bun not found — install Bun: https://bun.sh"
fi

cd "$CONTRACTS_DIR"

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 1: Full Compilation
# ═══════════════════════════════════════════════════════════════════════════════
# Builds EVERYTHING (src + test + script) with via_ir. All subsequent phases
# reuse cached artifacts — no recompilation unless source changed.
# ═══════════════════════════════════════════════════════════════════════════════
phase "Phase 1/4: Full Compilation"
phase_start "build"

bun build:full || fail "Compilation failed"
success "Build passed"

phase_end

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 2: Lint (forge fmt ∥ solhint)
# ═══════════════════════════════════════════════════════════════════════════════
# forge fmt --check: read-only source formatting check (~1s)
# solhint: independent static analysis (no forge lock) — runs in background
#
# These two are the ONLY tasks that can truly parallelize since solhint
# doesn't touch forge's out/cache directories.
# ═══════════════════════════════════════════════════════════════════════════════
phase "Phase 2/4: Lint"
phase_start "lint"

LINT_TMPDIR=$(mktemp -d)

# Background: solhint (independent of forge)
solhint --config ./.solhint.json 'src/**/*.sol' --ignore-path .solhintignore \
  > "$LINT_TMPDIR/solhint.log" 2>&1 &
SOLHINT_PID=$!

# Foreground: forge fmt check (fast, read-only)
if forge fmt --check > "$LINT_TMPDIR/fmt.log" 2>&1; then
  success "forge fmt --check passed"
else
  echo -e "${YELLOW}  forge fmt --check output:${NC}"
  cat "$LINT_TMPDIR/fmt.log"
  wait "$SOLHINT_PID" 2>/dev/null || true
  rm -rf "$LINT_TMPDIR"
  fail "Formatting check failed — run 'bun lint' to fix"
fi

# Collect solhint result
if wait "$SOLHINT_PID"; then
  success "solhint passed"
else
  echo -e "${YELLOW}  solhint output:${NC}"
  cat "$LINT_TMPDIR/solhint.log"
  rm -rf "$LINT_TMPDIR"
  fail "Solhint found issues"
fi

rm -rf "$LINT_TMPDIR"
phase_end

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 3: Tests
# ═══════════════════════════════════════════════════════════════════════════════
# Sequential because forge test acquires an exclusive project lock.
# Unit tests exclude E2E. E2E workflow uses the same DeploymentBase code
# path as production deployment — if it passes, the deploy script works.
# ═══════════════════════════════════════════════════════════════════════════════
phase "Phase 3/4: Tests"
phase_start "test"

echo -e "  ${DIM}Running unit tests (excludes E2E/Fork)...${NC}"
bun run test || fail "Unit tests failed"
success "Unit tests passed"

if [ "$SKIP_E2E" = false ]; then
  echo -e "  ${DIM}Running E2E workflow test...${NC}"
  # Use bun run test:e2e:workflow which includes adaptive build (cache hit ~2s)
  bun run test:e2e:workflow || fail "E2E workflow test failed"
  success "E2E workflow passed"
else
  info "E2E skipped (--skip-e2e)"
fi

phase_end

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 4: Deployment Dry Runs (Sepolia → Arbitrum → Celo)
# ═══════════════════════════════════════════════════════════════════════════════
# Pure simulation: compile check + config preflight, NO RPC calls.
# Each invokes forge build with production profile — already cached from
# Phase 1 so these are near-instant (~2s each). Sequential because they
# share the same forge out/ directory.
# ═══════════════════════════════════════════════════════════════════════════════
if [ "$SKIP_DRY_RUN" = false ]; then
  phase "Phase 4/4: Deployment Dry Runs"
  phase_start "dry-run"

  NETWORKS=("sepolia" "arbitrum" "celo")
  CHAIN_IDS=("11155111" "42161" "42220")

  for i in "${!NETWORKS[@]}"; do
    echo -e "  ${DIM}${NETWORKS[$i]} (${CHAIN_IDS[$i]})...${NC}"
    bun run "deploy:dry:${NETWORKS[$i]}" || fail "${NETWORKS[$i]} dry run failed"
    success "${NETWORKS[$i]} dry run passed"
  done

  phase_end
else
  info "Dry runs skipped (--skip-dry-run)"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════════
TOTAL_TIME=$((SECONDS - TOTAL_START))

echo ""
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  All verification checks passed!${NC}"
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Timing breakdown
echo -e "  ${BOLD}Timing${NC}"
for i in "${!PHASE_NAMES[@]}"; do
  printf "    %-12s %3ss\n" "${PHASE_NAMES[$i]}" "${PHASE_TIMES[$i]}"
done
printf "    ${BOLD}%-12s %3ss${NC}\n" "total" "$TOTAL_TIME"

echo ""
echo -e "  ${BOLD}Next steps${NC}"
echo -e "    Bump salt:  edit DeployHelper.sol:145 or pass --salt flag"
echo -e "    Deploy:     bun script/deploy.ts core --network sepolia --broadcast"
echo -e "    Rebuild:    cd ../.. && bun build"
echo ""
