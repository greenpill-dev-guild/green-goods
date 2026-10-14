#!/bin/bash
# Advisory event receipt; the coordinating agent owns validation evidence.
set -uo pipefail

if ! command -v jq >/dev/null 2>&1; then
  printf '%s\n' 'TASK EVENT: jq unavailable; task identity unavailable (advisory).'
  exit 0
fi

if ! MESSAGE=$(jq -er '
  if type != "object" then error("invalid event")
  elif (.task_id | type) != "string" or (.task_subject | type) != "string" then
    "TASK EVENT: missing task_id or task_subject (advisory)."
  else
    "TASK COMPLETED: \(.task_id | @json) \(.task_subject | @json) by \((.teammate_name // "unassigned") | @json). Validation remains with the coordinating agent."
  end' 2>/dev/null); then
  printf '%s\n' 'TASK EVENT: invalid or empty JSON input (advisory).'
  exit 0
fi

printf '%s\n' "$MESSAGE"
exit 0
