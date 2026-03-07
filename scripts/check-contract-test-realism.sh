#!/usr/bin/env bash
set -euo pipefail

MODE="advisory"
REPORT_MD=""
REPORT_JSON=""
ALLOWLIST_PATH="packages/contracts/test/audit/mock-allowlist.json"

usage() {
    cat <<'USAGE'
Usage: scripts/check-contract-test-realism.sh [options]

Options:
  --mode advisory|enforce-must-fix|enforce-should-fix
  --report-md <path>
  --report-json <path>
  --allowlist <path>
  -h, --help
USAGE
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --mode)
            MODE="${2:-}"
            shift 2
            ;;
        --report-md)
            REPORT_MD="${2:-}"
            shift 2
            ;;
        --report-json)
            REPORT_JSON="${2:-}"
            shift 2
            ;;
        --allowlist)
            ALLOWLIST_PATH="${2:-}"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown argument: $1" >&2
            usage
            exit 2
            ;;
    esac
done

case "$MODE" in
    advisory|enforce-must-fix|enforce-should-fix)
        ;;
    *)
        echo "Invalid --mode: $MODE" >&2
        usage
        exit 2
        ;;
esac

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPORT_MD="${REPORT_MD:-$ROOT_DIR/output/contracts-test-audit/realism-report.md}"
REPORT_JSON="${REPORT_JSON:-$ROOT_DIR/output/contracts-test-audit/realism-report.json}"

mkdir -p "$(dirname "$REPORT_MD")" "$(dirname "$REPORT_JSON")"

# Resolve the worker script relative to this script's directory
WORKER_SCRIPT="$(cd "$(dirname "$0")" && pwd)/check-contract-test-realism-worker.js"

MODE="$MODE" \
ROOT_DIR="$ROOT_DIR" \
REPORT_MD="$REPORT_MD" \
REPORT_JSON="$REPORT_JSON" \
ALLOWLIST_PATH="$ALLOWLIST_PATH" \
node "$WORKER_SCRIPT"
