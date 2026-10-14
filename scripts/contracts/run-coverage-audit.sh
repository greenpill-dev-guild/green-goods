#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/packages/contracts"
OUTPUT_DIR="$ROOT_DIR/output/contracts-test-audit"
COVERAGE_TIMEOUT_SECONDS="${COVERAGE_TIMEOUT_SECONDS:-900}"

LOCAL_LOG="$OUTPUT_DIR/coverage-local.log"
LOCAL_LCOV="$OUTPUT_DIR/lcov-local.info"
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

localCoverageOk=true
localError=""

echo "[coverage] Running all local non-fork, non-E2E Solidity coverage..."
if ! run_with_timeout "$COVERAGE_TIMEOUT_SECONDS" "$LOCAL_LOG" forge coverage --ir-minimum --report lcov \
    --no-match-contract 'E2E' --no-match-path 'test/fork/**'; then
    localCoverageOk=false
    localError="Local coverage command failed or timed out. See $LOCAL_LOG"
else
    if [[ ! -f lcov.info ]]; then
        localCoverageOk=false
        localError="Expected lcov.info after local coverage run"
    else
        mv lcov.info "$LOCAL_LCOV"
    fi
fi

popd >/dev/null

node "$ROOT_DIR/scripts/contracts/coverage-policy.mjs" \
    --local-lcov "$LOCAL_LCOV" \
    --summary-md "$SUMMARY_MD" \
    --summary-json "$SUMMARY_JSON" \
    --local-ok "$localCoverageOk" \
    --local-error "$localError"
