#!/bin/bash
# Scope-aware gate for Claude TaskCompleted hooks.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
EVENT_DETAILS="${CLAUDE_HOOK_EVENT_DETAILS:-}"
if [ -z "$EVENT_DETAILS" ]; then
  EVENT_DETAILS='{}'
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "⚠️ TASK GATE: jq is unavailable; skipping task-completion gate (advisory)."
  exit 0
fi

TASK_CONTENT="$(jq -r '.task.content // ""' <<<"$EVENT_DETAILS" 2>/dev/null || printf '')"
TASK_ID="$(jq -r '.task.id // "unknown"' <<<"$EVENT_DETAILS" 2>/dev/null || printf 'unknown')"

extract_token() {
  local token_name="$1"
  local pattern="\\[$token_name:[^]]+\\]"
  local token

  token="$(printf '%s' "$TASK_CONTENT" | grep -oE "$pattern" | head -1 || true)"
  if [ -z "$token" ]; then
    printf ''
    return
  fi

  printf '%s' "$token" | sed -E "s/\\[$token_name:([^]]+)\\]/\\1/"
}

SCOPE="$(extract_token scope)"
GATE="$(extract_token gate)"
CHECK_LEVEL="$(extract_token check)"

if [ -z "$GATE" ]; then
  GATE="advisory"
fi
if [ -z "$CHECK_LEVEL" ]; then
  CHECK_LEVEL="quick"
fi

case "$GATE" in
  advisory|required) ;;
  *) GATE="advisory" ;;
esac

case "$CHECK_LEVEL" in
  quick|full) ;;
  *) CHECK_LEVEL="quick" ;;
esac

if [ -z "$SCOPE" ]; then
  echo "ℹ️ TASK GATE: Task $TASK_ID has no [scope:*] token. Defaulting to advisory/no-block."
  exit 0
fi

RUN_DIR=""
QUICK_CMD=""
FULL_CMD=""
DISPLAY_SCOPE="$SCOPE"

case "$SCOPE" in
  middleware)
    RUN_DIR="$REPO_ROOT/packages/shared"
    QUICK_CMD="bunx tsc --noEmit"
    FULL_CMD="bunx tsc --noEmit && bun run test && bun lint"
    DISPLAY_SCOPE="middleware(shared)"
    ;;
  shared|client|admin)
    RUN_DIR="$REPO_ROOT/packages/$SCOPE"
    QUICK_CMD="bunx tsc --noEmit"
    FULL_CMD="bunx tsc --noEmit && bun run test && bun lint"
    ;;
  contracts)
    RUN_DIR="$REPO_ROOT/packages/contracts"
    QUICK_CMD="bun run build"
    FULL_CMD="bun run build && bun run test"
    ;;
  indexer)
    RUN_DIR="$REPO_ROOT/packages/indexer"
    QUICK_CMD="bun run build"
    FULL_CMD="bun run build && bun run test"
    ;;
  integration)
    RUN_DIR="$REPO_ROOT"
    QUICK_CMD="bun run build:shared && bun run build:client && bun run build:admin"
    FULL_CMD="bun run test:shared && bun run test:client && bun run test:admin && bun run build"
    ;;
  docs)
    RUN_DIR="$REPO_ROOT/docs"
    QUICK_CMD="bun run build"
    FULL_CMD="bun run build"
    ;;
  *)
    echo "⚠️ TASK GATE: Unsupported scope '$SCOPE'. Allowed scopes: middleware, shared, client, admin, contracts, indexer, integration, docs."
    echo "   Proceeding advisory/no-block."
    exit 0
    ;;
esac

if [ "$CHECK_LEVEL" = "full" ]; then
  SELECTED_CMD="$FULL_CMD"
else
  SELECTED_CMD="$QUICK_CMD"
fi

echo "🔎 TASK GATE: Task $TASK_ID scope=$DISPLAY_SCOPE gate=$GATE check=$CHECK_LEVEL"
echo "↳ Running: $SELECTED_CMD"

set +e
OUTPUT="$(cd "$RUN_DIR" && bash -lc "$SELECTED_CMD" 2>&1)"
STATUS=$?
set -e

if [ "$STATUS" -eq 0 ]; then
  echo "✅ TASK GATE: Checks passed for scope '$DISPLAY_SCOPE'."
  exit 0
fi

if [ "$GATE" = "required" ]; then
  echo "🚫 TASK GATE BLOCKED: Required checks failed for scope '$DISPLAY_SCOPE' (task $TASK_ID)." >&2
  echo "   Command: $SELECTED_CMD" >&2
  echo "   Last 40 lines:" >&2
  printf '%s\n' "$OUTPUT" | tail -n 40 >&2
  exit 2
fi

echo "⚠️ TASK GATE ADVISORY: Checks failed for scope '$DISPLAY_SCOPE' (task $TASK_ID), but gate is advisory." >&2
echo "   Command: $SELECTED_CMD" >&2
echo "   Last 20 lines:" >&2
printf '%s\n' "$OUTPUT" | tail -n 20 >&2
exit 0
