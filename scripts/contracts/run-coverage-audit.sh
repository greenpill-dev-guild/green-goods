#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
CONTRACTS_DIR="$ROOT_DIR/packages/contracts"
OUTPUT_DIR="$ROOT_DIR/output/contracts-test-audit"
COVERAGE_TIMEOUT_SECONDS="${COVERAGE_TIMEOUT_SECONDS:-900}"

MERGED_LCOV="$OUTPUT_DIR/lcov-local.info"
SUMMARY_MD="$OUTPUT_DIR/coverage-summary.md"
SUMMARY_JSON="$OUTPUT_DIR/coverage-summary.json"

# forge coverage keeps every test's hit maps until its last test ends, so one run over the whole
# suite outgrew a 16 GB CI runner (PRD-1624). Each shard is its own forge run. Every run compiles
# and reports all of src, so the policy merges the shards' LCOV line by line.
#   all (default): run every shard in turn, then the policy.
#   <shard>: run that shard only; a later `policy` run reads its output.
#   policy: merge whatever shard LCOV the output directory holds and apply the floors; locally,
#     `all` is the way to get a result from one commit.
SHARDS=(unit rest)
MODE="${CONTRACT_COVERAGE_SHARD:-all}"

mkdir -p "$OUTPUT_DIR"

run_with_timeout() {
    local timeout_seconds="$1"
    local log_file="$2"
    shift 2
    # Only the watchdog writes this marker, so another kill (such as out of memory) is not a timeout.
    # Each note below starts on a new line, in case forge died mid-line.
    local timeout_marker="$log_file.timed-out"
    rm -f "$timeout_marker"

    "$@" >"$log_file" 2>&1 &
    local cmd_pid=$!

    (
        sleep "$timeout_seconds"
        if kill -0 "$cmd_pid" 2>/dev/null; then
            : >"$timeout_marker"
            kill "$cmd_pid" 2>/dev/null || true
        fi
    ) &
    local killer_pid=$!

    wait "$cmd_pid"
    local cmd_exit=$?
    kill "$killer_pid" 2>/dev/null || true
    wait "$killer_pid" 2>/dev/null || true

    if [[ -f "$timeout_marker" ]]; then
        rm -f "$timeout_marker"
        printf '\nTIMEOUT after %ss\n' "$timeout_seconds" >>"$log_file"
        return 124
    fi

    if [[ "$cmd_exit" -eq 143 || "$cmd_exit" -eq 137 ]]; then
        printf '\nKILLED by signal (exit %s) before the %ss timeout\n' "$cmd_exit" "$timeout_seconds" >>"$log_file"
    fi

    return "$cmd_exit"
}

shard_log() { printf '%s/coverage-%s.log' "$OUTPUT_DIR" "$1"; }
shard_lcov() { printf '%s/lcov-%s.info' "$OUTPUT_DIR" "$1"; }
# Written only when the shard's forge run failed or timed out; its log says why.
shard_error() { printf '%s/coverage-%s.error' "$OUTPUT_DIR" "$1"; }

# Returns non-zero when the shard has no usable LCOV.
run_shard() {
    local shard="$1"
    local log lcov error
    log="$(shard_log "$shard")"
    lcov="$(shard_lcov "$shard")"
    error="$(shard_error "$shard")"
    rm -f "$lcov" "$error"

    # --skip leaves the other shard's test directories and the fork suites, which coverage never runs,
    # out of solc's single build; imports of kept files still compile. The suites directly under test/
    # run in rest but stay in unit's build, since a glob for them would also match test/unit. One
    # build of every file outgrew 16 GB.
    local filter
    local cap=()
    case "$shard" in
        unit) filter=(--match-path 'test/unit/**' --skip 'test/{fork,integration,invariant,fuzz}/**') ;;
        rest)
            filter=(--no-match-path 'test/{fork,unit}/**' --skip 'test/{fork,unit}/**')
            # Coverage asks which code the tests reach, not how deep a fuzzer goes. At Foundry's
            # default 256 runs x 500 depth this shard's invariant suites took 44 minutes under
            # coverage, and CI lost the runner about when they would have ended (PRD-1624). At
            # 32 x 64, the cap SettlementFunding and RoleHierarchy set inline, the merged floors
            # match a full-depth run, since unit tests cover the two reverts only depth reached.
            # The unit shard's invariants keep full depth: two settlement branches need it.
            # Contracts Nightly runs every suite at full depth. A caller's values apply except
            # where a suite's own forge-config comments set them.
            cap=(FOUNDRY_INVARIANT_RUNS="${FOUNDRY_INVARIANT_RUNS:-32}" FOUNDRY_INVARIANT_DEPTH="${FOUNDRY_INVARIANT_DEPTH:-64}")
            ;;
        *)
            echo "No test filter for coverage shard $shard" >&2
            return 2
            ;;
    esac

    echo "[coverage] Running the $shard shard of local non-fork, non-E2E Solidity coverage..."
    local status=0
    pushd "$CONTRACTS_DIR" >/dev/null
    if ! run_with_timeout "$COVERAGE_TIMEOUT_SECONDS" "$log" env ${cap[@]+"${cap[@]}"} forge coverage --ir-minimum --report lcov \
        --report-file "$lcov" --no-match-contract 'E2E' "${filter[@]}"; then
        echo "The $shard coverage shard failed or timed out. See $log" >"$error"
        status=1
    elif [[ ! -f "$lcov" ]]; then
        status=1
    fi
    popd >/dev/null
    return "$status"
}

apply_policy() {
    local ok=true
    local reasons=()
    local failed_log=""
    : >"$MERGED_LCOV"

    for shard in "${SHARDS[@]}"; do
        local log lcov error
        log="$(shard_log "$shard")"
        lcov="$(shard_lcov "$shard")"
        error="$(shard_error "$shard")"
        if [[ -f "$error" ]]; then
            ok=false
            reasons+=("$(cat "$error")")
            # The policy describes one forge failure from its log; take the first failed shard.
            if [[ -z "$failed_log" && -f "$log" ]]; then
                failed_log="$log"
            fi
        elif [[ ! -f "$lcov" ]]; then
            ok=false
            reasons+=("Expected $lcov after the $shard coverage shard")
        fi
        if [[ -f "$lcov" ]]; then
            cat "$lcov" >>"$MERGED_LCOV"
        fi
    done

    local joined=""
    if [[ ${#reasons[@]} -gt 0 ]]; then
        joined="$(printf '%s; ' "${reasons[@]}")"
        joined="${joined%; }"
    fi

    node "$ROOT_DIR/scripts/contracts/coverage-policy.mjs" \
        --local-lcov "$MERGED_LCOV" \
        --failed-command-log "$failed_log" \
        --summary-md "$SUMMARY_MD" \
        --summary-json "$SUMMARY_JSON" \
        --local-ok "$ok" \
        --local-error "$joined"
}

case "$MODE" in
    all)
        for shard in "${SHARDS[@]}"; do
            run_shard "$shard" || true
        done
        apply_policy
        ;;
    policy)
        apply_policy
        ;;
    *)
        known=false
        for shard in "${SHARDS[@]}"; do
            if [[ "$MODE" == "$shard" ]]; then known=true; fi
        done
        if [[ "$known" != true ]]; then
            echo "Unknown CONTRACT_COVERAGE_SHARD: $MODE; expected all, policy or one of: ${SHARDS[*]}" >&2
            exit 2
        fi
        run_shard "$MODE"
        ;;
esac
