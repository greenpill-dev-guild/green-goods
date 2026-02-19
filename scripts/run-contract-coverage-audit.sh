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

summarize_lcov() {
    local file="$1"
    awk -F: '
        /^LF:/ { lf += $2 }
        /^LH:/ { lh += $2 }
        /^BRF:/ { brf += $2 }
        /^BRH:/ { brh += $2 }
        END {
            linePct = (lf > 0 ? (lh / lf) * 100 : 100)
            branchPct = (brf > 0 ? (brh / brf) * 100 : 100)
            printf "%d %d %.2f %d %d %.2f\n", lh, lf, linePct, brh, brf, branchPct
        }
    ' "$file"
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

unitLH=0
unitLF=0
unitLinePct=0
unitBRH=0
unitBRF=0
unitBranchPct=0
intLH=0
intLF=0
intLinePct=0
intBRH=0
intBRF=0
intBranchPct=0

if [[ "$unitCoverageOk" == true ]]; then
    read -r unitLH unitLF unitLinePct unitBRH unitBRF unitBranchPct < <(summarize_lcov "$UNIT_LCOV")
fi

if [[ "$integrationCoverageOk" == true ]]; then
    read -r intLH intLF intLinePct intBRH intBRF intBranchPct < <(summarize_lcov "$INTEGRATION_LCOV")
fi

unitLineTarget=85
unitBranchTarget=75
integrationLineTarget=80
integrationBranchTarget=70

unitStatus="PASS"
integrationStatus="PASS"
overallStatus="PASS"

if [[ "$unitCoverageOk" != true ]]; then
    unitStatus="ERROR"
    overallStatus="FAIL"
elif ! awk "BEGIN { exit !($unitLinePct >= $unitLineTarget && $unitBranchPct >= $unitBranchTarget) }"; then
    unitStatus="FAIL"
    overallStatus="FAIL"
fi

if [[ "$integrationCoverageOk" != true ]]; then
    integrationStatus="ERROR"
    overallStatus="FAIL"
elif ! awk "BEGIN { exit !($intLinePct >= $integrationLineTarget && $intBranchPct >= $integrationBranchTarget) }"; then
    integrationStatus="FAIL"
    overallStatus="FAIL"
fi

cat > "$SUMMARY_MD" <<MARKDOWN
# Contracts Coverage Summary

Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

| Suite | Line Coverage | Branch Coverage | Target | Status |
|---|---:|---:|---|---|
| Unit (test/unit/**) | ${unitLinePct}% (${unitLH}/${unitLF}) | ${unitBranchPct}% (${unitBRH}/${unitBRF}) | line >= ${unitLineTarget}%, branch >= ${unitBranchTarget}% | ${unitStatus} |
| Integration (test/integration/**) | ${intLinePct}% (${intLH}/${intLF}) | ${intBranchPct}% (${intBRH}/${intBRF}) | line >= ${integrationLineTarget}%, branch >= ${integrationBranchTarget}% | ${integrationStatus} |

Execution Notes:
- Unit: ${unitError:-OK}
- Integration: ${integrationError:-OK}
- Overall status: ${overallStatus}

Artifacts:
- output/contracts-test-audit/lcov-unit.info
- output/contracts-test-audit/lcov-integration.info
- output/contracts-test-audit/coverage-unit.log
- output/contracts-test-audit/coverage-integration.log
MARKDOWN

cat > "$SUMMARY_JSON" <<JSON
{
  "generated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "thresholds": {
    "unit": { "line": ${unitLineTarget}, "branch": ${unitBranchTarget} },
    "integration": { "line": ${integrationLineTarget}, "branch": ${integrationBranchTarget} }
  },
  "unit": {
    "ok": ${unitCoverageOk},
    "line_covered": ${unitLH},
    "line_total": ${unitLF},
    "line_percent": ${unitLinePct},
    "branch_covered": ${unitBRH},
    "branch_total": ${unitBRF},
    "branch_percent": ${unitBranchPct},
    "status": "${unitStatus}",
    "error": "${unitError}"
  },
  "integration": {
    "ok": ${integrationCoverageOk},
    "line_covered": ${intLH},
    "line_total": ${intLF},
    "line_percent": ${intLinePct},
    "branch_covered": ${intBRH},
    "branch_total": ${intBRF},
    "branch_percent": ${intBranchPct},
    "status": "${integrationStatus}",
    "error": "${integrationError}"
  },
  "overall_status": "${overallStatus}"
}
JSON

echo "Coverage summary written: $SUMMARY_MD"
echo "Coverage JSON written: $SUMMARY_JSON"

if [[ "$overallStatus" != "PASS" ]]; then
    exit 1
fi
