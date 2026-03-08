#!/bin/bash
# Gate for Claude PostToolUse hooks on agent output (SendMessage/TaskUpdate).
# Validates that agent output follows the required section order from output-contracts.md.
# Exit 0 = allow. Exit 2 = block with feedback.
#
# This is advisory validation — warns about missing sections but does not block.
# The goal is to catch contract violations early in the agent chain.
set -uo pipefail

EVENT_DETAILS="${CLAUDE_HOOK_EVENT_DETAILS:-}"
if [ -z "$EVENT_DETAILS" ]; then
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

# Extract the tool output content
CONTENT="$(jq -r '.tool_input.content // .tool_input.new_string // .tool_input.description // ""' <<<"$EVENT_DETAILS" 2>/dev/null || printf '')"

if [ -z "$CONTENT" ]; then
  exit 0
fi

CONTENT_LOWER="$(printf '%s' "$CONTENT" | tr '[:upper:]' '[:lower:]')"

# Detect agent output type from content markers
detect_output_type() {
  local text="$1"
  if printf '%s' "$text" | grep -q '### severity mapping' && printf '%s' "$text" | grep -q '### recommendation'; then
    echo "review"
  elif printf '%s' "$text" | grep -q '### classification' && printf '%s' "$text" | grep -Eq 'p[0-4]'; then
    echo "triage"
  elif printf '%s' "$text" | grep -q '### blast radius' && printf '%s' "$text" | grep -q '### execution order'; then
    echo "migration"
  elif printf '%s' "$text" | grep -q '### executive summary' && printf '%s' "$text" | grep -q '### confidence assessment'; then
    echo "oracle"
  else
    echo ""
  fi
}

OUTPUT_TYPE="$(detect_output_type "$CONTENT_LOWER")"

if [ -z "$OUTPUT_TYPE" ]; then
  # Not a recognized agent output — skip validation
  exit 0
fi

# Validate required sections based on output type
MISSING_SECTIONS=""

case "$OUTPUT_TYPE" in
  review)
    for section in "summary" "severity mapping" "must-fix" "verification" "recommendation"; do
      if ! printf '%s' "$CONTENT_LOWER" | grep -q "### $section\|## $section"; then
        MISSING_SECTIONS="${MISSING_SECTIONS}  - Missing: ${section}\n"
      fi
    done
    ;;
  triage)
    for section in "classification" "affected packages" "recommended route" "context for next agent"; do
      if ! printf '%s' "$CONTENT_LOWER" | grep -q "### $section\|## $section"; then
        MISSING_SECTIONS="${MISSING_SECTIONS}  - Missing: ${section}\n"
      fi
    done
    ;;
  migration)
    for section in "summary" "blast radius" "execution order" "validation results" "completion checklist"; do
      if ! printf '%s' "$CONTENT_LOWER" | grep -q "### $section\|## $section"; then
        MISSING_SECTIONS="${MISSING_SECTIONS}  - Missing: ${section}\n"
      fi
    done
    ;;
  oracle)
    for section in "executive summary" "key findings" "synthesis" "confidence assessment"; do
      if ! printf '%s' "$CONTENT_LOWER" | grep -q "### $section\|## $section"; then
        MISSING_SECTIONS="${MISSING_SECTIONS}  - Missing: ${section}\n"
      fi
    done
    ;;
esac

if [ -n "$MISSING_SECTIONS" ]; then
  echo "OUTPUT CONTRACT WARNING: Agent output detected as '$OUTPUT_TYPE' but missing required sections:" >&2
  printf '%b' "$MISSING_SECTIONS" >&2
  echo "   See .claude/standards/output-contracts.md for required section order." >&2
  echo "   This is advisory — output will be accepted. Fix sections before handoff." >&2
fi

# Advisory only — always allow
exit 0
