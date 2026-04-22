#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/packages/contracts"
OUTPUT_DIR="$ROOT_DIR/output/contracts-test-audit"
COVERAGE_TIMEOUT_SECONDS="${COVERAGE_TIMEOUT_SECONDS:-900}"

UNIT_LOG="$OUTPUT_DIR/coverage-unit.log"
INTEGRATION_LOG="$OUTPUT_DIR/coverage-integration.log"
UNIT_LCOV="$OUTPUT_DIR/lcov-unit.info"
INTEGRATION_LCOV="$OUTPUT_DIR/lcov-integration.info"
SUMMARY_MD="$OUTPUT_DIR/coverage-summary.md"
SUMMARY_JSON="$OUTPUT_DIR/coverage-summary.json"

mkdir -p "$OUTPUT_DIR"

run_with_timeout() {
    local timeout_seconds="$1"
    local log_file="$2"
    shift 2

    "$@" >"$log_file" 2>&1 &
    local cmd_pid=$!

    (
        sleep "$timeout_seconds"
        if kill -0 "$cmd_pid" 2>/dev/null; then
            kill "$cmd_pid" 2>/dev/null || true
        fi
    ) &
    local killer_pid=$!

    wait "$cmd_pid"
    local cmd_exit=$?
    kill "$killer_pid" 2>/dev/null || true
    wait "$killer_pid" 2>/dev/null || true

    if [[ "$cmd_exit" -eq 143 || "$cmd_exit" -eq 137 ]]; then
        echo "TIMEOUT after ${timeout_seconds}s" >>"$log_file"
        return 124
    fi

    return "$cmd_exit"
}

pushd "$CONTRACTS_DIR" >/dev/null

unitCoverageOk=true
integrationCoverageOk=true
unitError=""
integrationError=""

echo "[coverage] Running unit coverage (test/unit/**)..."
if ! run_with_timeout "$COVERAGE_TIMEOUT_SECONDS" "$UNIT_LOG" forge coverage --ir-minimum --report lcov --match-path 'test/unit/**'; then
    unitCoverageOk=false
    unitError="Unit coverage command failed or timed out. See $UNIT_LOG"
else
    if [[ ! -f lcov.info ]]; then
        unitCoverageOk=false
        unitError="Expected lcov.info after unit coverage run"
    else
        mv lcov.info "$UNIT_LCOV"
    fi
fi

echo "[coverage] Running integration coverage (test/integration/**)..."
if ! run_with_timeout "$COVERAGE_TIMEOUT_SECONDS" "$INTEGRATION_LOG" forge coverage --ir-minimum --report lcov --match-path 'test/integration/**'; then
    integrationCoverageOk=false
    integrationError="Integration coverage command failed or timed out. See $INTEGRATION_LOG"
else
    if [[ ! -f lcov.info ]]; then
        integrationCoverageOk=false
        integrationError="Expected lcov.info after integration coverage run"
    else
        mv lcov.info "$INTEGRATION_LCOV"
    fi
fi

popd >/dev/null

node "$ROOT_DIR/scripts/contract-coverage-policy.mjs" \
    --unit-lcov "$UNIT_LCOV" \
    --integration-lcov "$INTEGRATION_LCOV" \
    --summary-md "$SUMMARY_MD" \
    --summary-json "$SUMMARY_JSON" \
    --unit-ok "$unitCoverageOk" \
    --integration-ok "$integrationCoverageOk" \
    --unit-error "$unitError" \
    --integration-error "$integrationError"
