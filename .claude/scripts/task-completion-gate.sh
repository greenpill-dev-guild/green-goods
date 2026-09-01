#!/bin/bash
# Advisory gate for Claude TaskCompleted hooks.
# Blocks explicit error signals; validation belongs to the coordinating agent.
# Exit 0 = allow completion. Exit 2 = block completion and send feedback.
set -uo pipefail

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

COMBINED="$(printf '%s %s' "$TASK_SUBJECT" "$TASK_DESCRIPTION" | tr '[:upper:]' '[:lower:]')"

if printf '%s' "$COMBINED" | grep -Eq 'error|failed|exception|crash|compilation failed|test failed'; then
  echo "TASK COMPLETION BLOCKED: Task #$TASK_ID '$TASK_SUBJECT' by $TEAMMATE_NAME contains error signals." >&2
  echo "   Fix the errors before marking complete, or report the blocker to the lead." >&2
  exit 2
fi

echo "TASK COMPLETED: Task #$TASK_ID '$TASK_SUBJECT' by $TEAMMATE_NAME (advisory pass; coordinator owns validation)."
