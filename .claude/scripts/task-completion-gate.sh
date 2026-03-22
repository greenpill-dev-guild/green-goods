#!/bin/bash
# Gate for Claude TaskCompleted hooks.
# Validates task completion quality before allowing a task to be marked done.
# Exit 0 = allow completion. Exit 2 = block completion and send feedback.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
EVENT_DETAILS="${CLAUDE_HOOK_EVENT_DETAILS:-}"
if [ -z "$EVENT_DETAILS" ]; then
  EVENT_DETAILS='{}'
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "TASK GATE: jq unavailable; skipping gate (advisory)."
  exit 0
fi

TASK_SUBJECT="$(jq -r '.task.subject // .subject // "unknown-task"' <<<"$EVENT_DETAILS" 2>/dev/null || printf 'unknown-task')"
TASK_DESCRIPTION="$(jq -r '.task.description // .description // ""' <<<"$EVENT_DETAILS" 2>/dev/null || printf '')"
TEAMMATE_NAME="$(jq -r '.teammate_name // .teammate.name // "unknown"' <<<"$EVENT_DETAILS" 2>/dev/null || printf 'unknown')"
TASK_ID="$(jq -r '.task.id // .id // "?"' <<<"$EVENT_DETAILS" 2>/dev/null || printf '?')"

# Combine for signal detection
COMBINED="$(printf '%s %s' "$TASK_SUBJECT" "$TASK_DESCRIPTION" | tr '[:upper:]' '[:lower:]')"

# Check 1: Block if error signals are present
if printf '%s' "$COMBINED" | grep -Eq 'error|failed|exception|crash|compilation failed|test failed'; then
  echo "TASK COMPLETION BLOCKED: Task #$TASK_ID '$TASK_SUBJECT' by $TEAMMATE_NAME contains error signals." >&2
  echo "   Fix the errors before marking complete, or report the blocker to the lead." >&2
  exit 2
fi

# Check 2: Auto-detect scope from task content and run quick validation
# This replaces the old [scope:*] token system with automatic detection
detect_scope() {
  local text="$1"
  if printf '%s' "$text" | grep -Eiq 'contract|solidity|foundry|deploy|\.sol'; then
    echo "contracts"
  elif printf '%s' "$text" | grep -Eiq 'indexer|envio|schema\.graphql|EventHandler'; then
    echo "indexer"
  elif printf '%s' "$text" | grep -Eiq 'shared.*hook|shared.*module|shared.*provider|middleware|@green-goods/shared'; then
    echo "shared"
  elif printf '%s' "$text" | grep -Eiq 'client.*component|client.*view|PWA|service.worker'; then
    echo "client"
  elif printf '%s' "$text" | grep -Eiq 'admin.*component|admin.*view|dashboard|operator'; then
    echo "admin"
  else
    echo ""
  fi
}

SCOPE="$(detect_scope "$COMBINED")"

if [ -z "$SCOPE" ]; then
  echo "TASK COMPLETED: Task #$TASK_ID '$TASK_SUBJECT' by $TEAMMATE_NAME (no scope detected, advisory pass)."
  exit 0
fi

# Quick type-check for the detected scope
RUN_DIR=""
QUICK_CMD=""

case "$SCOPE" in
  contracts)
    RUN_DIR="$REPO_ROOT/packages/contracts"
    QUICK_CMD="bun build"
    ;;
  indexer)
    RUN_DIR="$REPO_ROOT/packages/indexer"
    QUICK_CMD="bun build"
    ;;
  shared|client|admin)
    RUN_DIR="$REPO_ROOT/packages/$SCOPE"
    QUICK_CMD="bunx tsc --noEmit"
    ;;
esac

if [ -z "$RUN_DIR" ] || [ ! -d "$RUN_DIR" ]; then
  echo "TASK COMPLETED: Task #$TASK_ID '$TASK_SUBJECT' by $TEAMMATE_NAME (scope=$SCOPE, dir not found, advisory pass)."
  exit 0
fi

echo "TASK GATE: Task #$TASK_ID scope=$SCOPE — running quick validation..."

set +e
OUTPUT="$(cd "$RUN_DIR" && bash -lc "$QUICK_CMD" 2>&1)"
STATUS=$?
set -e

if [ "$STATUS" -eq 0 ]; then
  echo "TASK COMPLETED: Task #$TASK_ID '$TASK_SUBJECT' by $TEAMMATE_NAME (scope=$SCOPE, validation passed)."
  exit 0
fi

# Hard failure — block completion until validation passes
echo "TASK COMPLETION BLOCKED: Validation failed for scope '$SCOPE' (task #$TASK_ID)." >&2
echo "   Command: cd $RUN_DIR && $QUICK_CMD" >&2
echo "   Last 20 lines:" >&2
printf '%s\n' "$OUTPUT" | tail -n 20 >&2
echo "   Fix the errors before marking this task complete." >&2
exit 2
