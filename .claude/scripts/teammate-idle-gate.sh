#!/bin/bash
# Idle is an event, not evidence of task success or failure.
set -uo pipefail

if ! command -v jq >/dev/null 2>&1; then
  printf '%s\n' 'TEAMMATE EVENT: jq unavailable; teammate identity unavailable (advisory).'
  exit 0
fi

if ! MESSAGE=$(jq -er '
  if type != "object" then error("invalid event")
  elif (.teammate_name | type) != "string" then
    "TEAMMATE EVENT: missing teammate_name (advisory)."
  else
    "TEAMMATE IDLE: \(.teammate_name | @json) (advisory; no validation decision)."
  end' 2>/dev/null); then
  printf '%s\n' 'TEAMMATE EVENT: invalid or empty JSON input (advisory).'
  exit 0
fi

printf '%s\n' "$MESSAGE"
exit 0
