#!/bin/bash
# Gate for Claude TeammateIdle hooks.
# Blocks idle when the reason contains error signals, requiring retry or escalation.
# Exit 0 = allow idle. Exit 2 = block idle and send feedback.
set -uo pipefail

EVENT_DETAILS="${CLAUDE_HOOK_EVENT_DETAILS:-}"
if [ -z "$EVENT_DETAILS" ]; then
  EVENT_DETAILS='{}'
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "TEAMMATE IDLE GATE: jq unavailable; skipping gate (advisory)."
  exit 0
fi

TEAMMATE_NAME="$(jq -r '.teammate_name // .teammate.name // "unknown-teammate"' <<<"$EVENT_DETAILS" 2>/dev/null || printf 'unknown-teammate')"
TEAMMATE_TYPE="$(jq -r '.teammate_type // .teammate.type // "teammate"' <<<"$EVENT_DETAILS" 2>/dev/null || printf 'teammate')"
REASON="$(jq -r '.reason // .status_reason // .message // ""' <<<"$EVENT_DETAILS" 2>/dev/null || printf '')"

REASON_LOWER="$(printf '%s' "$REASON" | tr '[:upper:]' '[:lower:]')"

if printf '%s' "$REASON_LOWER" | grep -Eq 'error|failed|exception|timeout|crash|blocked|non-zero'; then
  echo "TEAMMATE IDLE BLOCKED: $TEAMMATE_NAME ($TEAMMATE_TYPE) went idle due to an error condition." >&2
  echo "   Reason: ${REASON:-unknown}" >&2
  echo "   Required: retry the task once. If it fails again, report blocker details to the lead." >&2
  exit 2
fi

echo "TEAMMATE IDLE: $TEAMMATE_NAME ($TEAMMATE_TYPE) is idle without error signal."
exit 0
