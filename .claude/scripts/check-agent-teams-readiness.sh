#!/bin/bash
# Validate local readiness for Claude Code agent teams in Green Goods.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SETTINGS_FILE="$REPO_ROOT/.claude/settings.json"

FAILURES=()
CAPABILITY_MARKERS=()

add_failure() {
  FAILURES+=("$1")
}

echo "🌿 Green Goods Agent Teams preflight"
echo "Repository: $REPO_ROOT"

if ! command -v jq >/dev/null 2>&1; then
  add_failure "Missing dependency: 'jq' is required to parse settings and hook payloads. Install with: brew install jq"
fi

if ! command -v claude >/dev/null 2>&1; then
  add_failure "Claude Code CLI not found in PATH. Install/update Claude Code before using /teams workflows."
fi

TEAMMATE_MODE="auto"
if [ ! -f "$SETTINGS_FILE" ]; then
  add_failure "Missing .claude/settings.json at $SETTINGS_FILE"
elif command -v jq >/dev/null 2>&1; then
  EXPERIMENTAL_FLAG="$(jq -r '.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS // empty' "$SETTINGS_FILE" 2>/dev/null)"
  TEAMMATE_MODE="$(jq -r '.teammateMode // "auto"' "$SETTINGS_FILE" 2>/dev/null)"

  if [ "$EXPERIMENTAL_FLAG" != "1" ]; then
    add_failure "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS is not enabled in .claude/settings.json (expected \"1\")."
  fi
fi

if [ "$TEAMMATE_MODE" != "in-process" ]; then
  if ! command -v tmux >/dev/null 2>&1; then
    add_failure "teammateMode is '$TEAMMATE_MODE' but tmux is unavailable. Install tmux or switch to teammateMode='in-process'."
  fi
fi

if command -v claude >/dev/null 2>&1; then
  HELP_OUTPUT="$(claude --help 2>&1 || true)"
  CONFIG_OUTPUT="$(claude config list 2>&1 || true)"

  if printf '%s' "$HELP_OUTPUT" | grep -Eiq 'teammate-mode'; then
    CAPABILITY_MARKERS+=("help:--teammate-mode")
  fi

  if printf '%s' "$HELP_OUTPUT" | grep -Eiq 'teammate|agent teams|delegate mode'; then
    CAPABILITY_MARKERS+=("help:teammate-keywords")
  fi

  if printf '%s' "$CONFIG_OUTPUT" | grep -Eiq 'teammateMode'; then
    CAPABILITY_MARKERS+=("config:teammateMode")
  fi

  if claude --teammate-mode in-process --help >/dev/null 2>&1; then
    CAPABILITY_MARKERS+=("flag:--teammate-mode accepted")
  fi

  if [ "${#CAPABILITY_MARKERS[@]}" -eq 0 ]; then
    add_failure "Claude CLI does not expose teammate capabilities (no teammate-related flags/keywords detected)."
  fi
fi

if [ "${#FAILURES[@]}" -gt 0 ]; then
  echo ""
  echo "❌ Agent teams preflight failed:"
  for failure in "${FAILURES[@]}"; do
    echo "- $failure"
  done

  echo ""
  echo "Suggested remediation:"
  echo "1. Upgrade Claude Code (for example: claude update)."
  echo "2. Ensure /Users/afo/Code/greenpill/green-goods/.claude/settings.json includes:"
  echo "   - env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=\"1\""
  echo "   - teammateMode=\"in-process\" (or install tmux for split modes)"
  echo "3. Re-run: bash .claude/scripts/check-agent-teams-readiness.sh"
  exit 1
fi

echo ""
echo "✅ Agent teams preflight passed"
echo "- teammateMode: $TEAMMATE_MODE"
if [ "${#CAPABILITY_MARKERS[@]}" -gt 0 ]; then
  echo "- capability markers:"
  for marker in "${CAPABILITY_MARKERS[@]}"; do
    echo "  - $marker"
  done
fi

echo "- jq: $(command -v jq)"
echo "- claude: $(command -v claude)"
