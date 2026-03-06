#!/bin/bash
# Automated eval runner for deterministic agents (triage, code-reviewer).
# Usage: ./run-eval.sh <agent> <task> [--model <model>] [--dry-run]
#
# Examples:
#   ./run-eval.sh triage p0-security
#   ./run-eval.sh triage p3-enhancement --model haiku
#   ./run-eval.sh code-reviewer known-bug-pr
#   ./run-eval.sh code-reviewer clean-pr --dry-run
#
# The script:
#   1. Reads the eval task file and expected.json
#   2. Spawns the agent via `claude -p --agent`
#   3. Runs keyword/pattern scoring against the output
#   4. Reports pass/fail per criterion with total score
#   5. Appends results to evals/README.md (unless --dry-run)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EVALS_DIR="$(dirname "$SCRIPT_DIR")/evals"
README="$EVALS_DIR/README.md"

# Defaults
MODEL=""
DRY_RUN=false

# Parse args
AGENT="${1:-}"
TASK="${2:-}"
shift 2 2>/dev/null || true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --model) MODEL="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$AGENT" || -z "$TASK" ]]; then
  echo "Usage: ./run-eval.sh <agent> <task> [--model <model>] [--dry-run]"
  echo ""
  echo "Supported agents: triage, code-reviewer"
  echo ""
  echo "Available tasks:"
  echo "  triage:        p0-security, p3-enhancement"
  echo "  code-reviewer: known-bug-pr, clean-pr, hook-boundary-violation"
  exit 1
fi

# Validate agent is deterministic (supported by this script)
if [[ "$AGENT" != "triage" && "$AGENT" != "code-reviewer" ]]; then
  echo "Error: Only 'triage' and 'code-reviewer' agents are supported by automated eval."
  echo "For other agents, use the manual protocol in run-eval.md."
  exit 1
fi

TASK_FILE="$EVALS_DIR/$AGENT/$TASK.md"
EXPECTED_FILE="$EVALS_DIR/$AGENT/expected.json"

if [[ ! -f "$TASK_FILE" ]]; then
  echo "Error: Task file not found: $TASK_FILE"
  exit 1
fi

if [[ ! -f "$EXPECTED_FILE" ]]; then
  echo "Error: Expected file not found: $EXPECTED_FILE"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required. Install with: brew install jq"
  exit 1
fi

if ! command -v claude >/dev/null 2>&1; then
  echo "Error: claude CLI is required."
  exit 1
fi

# Determine model
if [[ -z "$MODEL" ]]; then
  # Use agent's default model from frontmatter
  MODEL=$(grep '^model:' "$EVALS_DIR/../agents/$AGENT.md" 2>/dev/null | awk '{print $2}' || echo "")
  if [[ -z "$MODEL" ]]; then
    MODEL="opus"
  fi
fi

# Create output directory
OUTPUT_DIR="$EVALS_DIR/.runs"
mkdir -p "$OUTPUT_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUTPUT_FILE="$OUTPUT_DIR/${AGENT}-${TASK}-${TIMESTAMP}.txt"

echo "╔══════════════════════════════════════════════════════╗"
echo "║  Agent Eval Runner                                  ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Agent: $AGENT"
echo "║  Task:  $TASK"
echo "║  Model: $MODEL"
echo "║  Output: $OUTPUT_FILE"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Build prompt based on agent type
TASK_CONTENT=$(cat "$TASK_FILE")

if [[ "$AGENT" == "triage" ]]; then
  PROMPT="You are being evaluated. Read the following issue report and classify it according to your triage protocol. Produce your full output format (Classification, Affected Packages, Recommended Route, Context for Next Agent).

--- ISSUE REPORT ---
$TASK_CONTENT
--- END ---"
elif [[ "$AGENT" == "code-reviewer" ]]; then
  PROMPT="You are being evaluated. Review the following PR according to your code review protocol. Produce your full output format (Summary, Must-Fix, Should-Fix, Nice-to-Have, Verification, Recommendation).

--- PR FOR REVIEW ---
$TASK_CONTENT
--- END ---"
fi

# Run the agent
echo "Running agent... (this may take a few minutes)"
START_TIME=$(date +%s)

MODEL_FLAG=""
if [[ -n "$MODEL" ]]; then
  MODEL_FLAG="--model $MODEL"
fi

set +e
claude -p --agent "$AGENT" $MODEL_FLAG --no-session-persistence \
  --dangerously-skip-permissions \
  "$PROMPT" > "$OUTPUT_FILE" 2>&1
AGENT_EXIT=$?
set -e

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

if [[ $AGENT_EXIT -ne 0 ]]; then
  echo "Warning: Agent exited with code $AGENT_EXIT"
fi

echo "Agent completed in ${DURATION}s"
echo ""

# ─── Scoring ────────────────────────────────────────────────────────────────

OUTPUT_LOWER=$(cat "$OUTPUT_FILE" | tr '[:upper:]' '[:lower:]')
TOTAL_SCORE=0
MAX_SCORE=0
RESULTS=""

score_check() {
  local name="$1"
  local points="$2"
  local passed="$3"
  MAX_SCORE=$((MAX_SCORE + points))
  if [[ "$passed" == "true" ]]; then
    TOTAL_SCORE=$((TOTAL_SCORE + points))
    RESULTS="${RESULTS}  ✓ ${name} (+${points})\n"
  else
    RESULTS="${RESULTS}  ✗ ${name} (0/${points})\n"
  fi
}

if [[ "$AGENT" == "triage" ]]; then
  EXPECTED=$(jq -r ".\"$TASK\"" "$EXPECTED_FILE")

  if [[ "$EXPECTED" == "null" ]]; then
    echo "Error: No expected data for task '$TASK' in $EXPECTED_FILE"
    exit 1
  fi

  # Extract expected values
  EXP_PRIORITY=$(echo "$EXPECTED" | jq -r '.expected_priority' | tr '[:upper:]' '[:lower:]')
  EXP_TYPE=$(echo "$EXPECTED" | jq -r '.expected_type')
  EXP_ROUTE=$(echo "$EXPECTED" | jq -r '.expected_route // ""')
  EXP_PACKAGES=$(echo "$EXPECTED" | jq -r '.expected_packages // [] | .[]')

  # Acceptable priority range (some tasks allow P3 or P4)
  EXP_PRIORITY_ACCEPTABLE=$(echo "$EXPECTED" | jq -r '.expected_priority_acceptable // [] | .[] | ascii_downcase' 2>/dev/null)
  if [[ -z "$EXP_PRIORITY_ACCEPTABLE" ]]; then
    EXP_PRIORITY_ACCEPTABLE="$EXP_PRIORITY"
  fi

  # Scoring based on expected.json scoring keys
  SCORING_KEYS=$(echo "$EXPECTED" | jq -r '.scoring | keys[]' 2>/dev/null)

  for key in $SCORING_KEYS; do
    points=$(echo "$EXPECTED" | jq -r ".scoring.\"$key\"")
    passed="false"

    case "$key" in
      correct_severity|correct_severity_range)
        # Check if output contains the expected priority
        for p in $EXP_PRIORITY $EXP_PRIORITY_ACCEPTABLE; do
          if echo "$OUTPUT_LOWER" | grep -q "$p"; then
            passed="true"
            break
          fi
        done
        ;;
      correct_type)
        if echo "$OUTPUT_LOWER" | grep -q "$EXP_TYPE"; then
          passed="true"
        fi
        ;;
      identifies_affected_packages)
        # Check if all expected packages are mentioned
        all_found="true"
        for pkg in $EXP_PACKAGES; do
          if ! echo "$OUTPUT_LOWER" | grep -q "$pkg"; then
            all_found="false"
            break
          fi
        done
        passed="$all_found"
        ;;
      correct_routing|correct_routing_to_plan)
        if [[ -n "$EXP_ROUTE" ]] && echo "$OUTPUT_LOWER" | grep -q "$(echo "$EXP_ROUTE" | tr '[:upper:]' '[:lower:]')"; then
          passed="true"
        fi
        ;;
      identifies_posthog_vector)
        if echo "$OUTPUT_LOWER" | grep -q "posthog"; then
          passed="true"
        fi
        ;;
      recommends_log_purge)
        if echo "$OUTPUT_LOWER" | grep -qE "purge|clear|delete|remove.*log"; then
          passed="true"
        fi
        ;;
      no_implementation_guidance)
        # Should NOT contain implementation code or library suggestions
        if ! echo "$OUTPUT_LOWER" | grep -qE "import {|function |const |npm install|yarn add|bun add"; then
          passed="true"
        fi
        ;;
      correct_complexity)
        exp_complexity=$(echo "$EXPECTED" | jq -r '.expected_complexity')
        if echo "$OUTPUT_LOWER" | grep -q "$exp_complexity"; then
          passed="true"
        fi
        ;;
      identifies_bundle_concern)
        if echo "$OUTPUT_LOWER" | grep -qE "bundle|size|dependency|weight"; then
          passed="true"
        fi
        ;;
    esac

    score_check "$key" "$points" "$passed"
  done

elif [[ "$AGENT" == "code-reviewer" ]]; then
  EXPECTED=$(jq -r ".\"$TASK\"" "$EXPECTED_FILE")

  if [[ "$EXPECTED" == "null" ]]; then
    echo "Error: No expected data for task '$TASK' in $EXPECTED_FILE"
    exit 1
  fi

  EXP_VERDICT=$(echo "$EXPECTED" | jq -r '.expected_verdict' | tr '[:upper:]' '[:lower:]')
  EXP_FP=$(echo "$EXPECTED" | jq -r '.expected_false_positives')
  FINDING_COUNT=$(echo "$EXPECTED" | jq '.expected_findings | length')

  # Score: correct verdict (30 points)
  if echo "$OUTPUT_LOWER" | grep -q "$EXP_VERDICT"; then
    score_check "correct_verdict" 30 "true"
  else
    score_check "correct_verdict" 30 "false"
  fi

  # Score: findings detection (50 points split across expected findings)
  if [[ "$FINDING_COUNT" -gt 0 ]]; then
    POINTS_PER_FINDING=$((50 / FINDING_COUNT))
    for i in $(seq 0 $((FINDING_COUNT - 1))); do
      finding_file=$(echo "$EXPECTED" | jq -r ".expected_findings[$i].file")
      finding_rule=$(echo "$EXPECTED" | jq -r ".expected_findings[$i].rule" | tr '[:upper:]' '[:lower:]')
      finding_severity=$(echo "$EXPECTED" | jq -r ".expected_findings[$i].severity" | tr '[:upper:]' '[:lower:]')

      # Check if the file AND rule/severity are mentioned
      file_base=$(basename "$finding_file")
      if echo "$OUTPUT_LOWER" | grep -q "$(echo "$file_base" | tr '[:upper:]' '[:lower:]')" && \
         echo "$OUTPUT_LOWER" | grep -qE "$(echo "$finding_rule" | tr '[:upper:]' '[:lower:]')|$(echo "$finding_severity" | tr '[:upper:]' '[:lower:]')"; then
        score_check "finding_${i}_${finding_rule}" "$POINTS_PER_FINDING" "true"
      else
        score_check "finding_${i}_${finding_rule}" "$POINTS_PER_FINDING" "false"
      fi
    done
  else
    # Clean PR — score for having no findings
    # Count lines that look like findings (severity markers)
    finding_lines=$(echo "$OUTPUT_LOWER" | grep -cE '\[critical\]|\[high\]|\[medium\]|must-fix.*:' || true)
    if [[ "$finding_lines" -le 0 ]]; then
      score_check "no_false_positives" 50 "true"
    else
      score_check "no_false_positives" 50 "false"
    fi
  fi

  # Score: verification section present (20 points)
  if echo "$OUTPUT_LOWER" | grep -qE "verification|bun run test|bun lint|bun build"; then
    score_check "verification_present" 20 "true"
  else
    score_check "verification_present" 20 "false"
  fi
fi

# ─── Report ─────────────────────────────────────────────────────────────────

PERCENTAGE=$((TOTAL_SCORE * 100 / MAX_SCORE))

echo "╔══════════════════════════════════════════════════════╗"
echo "║  Scoring Report                                     ║"
echo "╠══════════════════════════════════════════════════════╣"
printf "%b" "$RESULTS"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Total: $TOTAL_SCORE / $MAX_SCORE ($PERCENTAGE%)"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Determine pass/fail
if [[ "$AGENT" == "triage" && "$PERCENTAGE" -ge 90 ]]; then
  RATING="PASS"
elif [[ "$AGENT" == "code-reviewer" && "$PERCENTAGE" -ge 85 ]]; then
  RATING="PASS"
else
  RATING="FAIL"
fi

echo "Result: $RATING (target: $([ "$AGENT" == "triage" ] && echo ">=90%" || echo ">=85%"))"
echo ""

# Record results
if [[ "$DRY_RUN" == "false" ]]; then
  DATE=$(date +%Y-%m-%d)
  # Estimate turns from output length (rough heuristic: 1 turn per ~500 chars)
  CHARS=$(wc -c < "$OUTPUT_FILE" | tr -d ' ')
  EST_TURNS=$((CHARS / 500 + 1))

  NOTES="$RATING ($PERCENTAGE%). Duration: ${DURATION}s. Auto-scored."

  # Append to README.md historical results
  echo "| $DATE | $MODEL | $AGENT | $TASK | $TOTAL_SCORE/$MAX_SCORE | ~$EST_TURNS | $NOTES |" >> "$README"
  echo "Results recorded in $README"
else
  echo "(Dry run — results not recorded)"
fi

echo ""
echo "Full output saved to: $OUTPUT_FILE"
