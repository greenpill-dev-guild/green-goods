#!/bin/bash
# Validate local readiness for codex lanes (dispatched by Claude teammates).
# Mirror of check-agent-teams-readiness.sh for the codex side of the two-party flow.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

CODEX="${CODEX:-/Applications/Codex.app/Contents/Resources/codex}"
SCHEMA="${CODEX_SCHEMA:-$REPO_ROOT/.codex/output-schema.json}"
WORKTREE_PARENT="${CODEX_WORKTREE_PARENT:-/tmp}"

FAILURES=()
INFO=()

echo "🌿 Green Goods Codex lanes preflight"
echo "Repository: $REPO_ROOT"

if [ -x "$CODEX" ]; then
  INFO+=("codex: $CODEX")
else
  FAILURES+=("Codex binary not executable at $CODEX. Install Codex.app or set CODEX env var.")
fi

if [ -f "$SCHEMA" ]; then
  INFO+=("schema: $SCHEMA")
else
  FAILURES+=("Output schema missing: $SCHEMA. Expected at .codex/output-schema.json.")
fi

if ! command -v git >/dev/null 2>&1; then
  FAILURES+=("git not found in PATH")
fi

if ! command -v jq >/dev/null 2>&1; then
  FAILURES+=("jq not found (teammates parse codex results as JSON)")
fi

if [ ! -f "$REPO_ROOT/.codex/config.toml" ]; then
  FAILURES+=(".codex/config.toml missing — Codex won't pick up project conventions")
else
  INFO+=("config: $REPO_ROOT/.codex/config.toml")
fi

if [ ! -d "$WORKTREE_PARENT" ] || [ ! -w "$WORKTREE_PARENT" ]; then
  FAILURES+=("Worktree parent not writable: $WORKTREE_PARENT (override with CODEX_WORKTREE_PARENT)")
else
  INFO+=("worktree parent: $WORKTREE_PARENT")
fi

if [ -f "$REPO_ROOT/.env" ]; then
  INFO+=(".env: present — will be symlinked into worktrees")
else
  INFO+=(".env: missing — worktree .env symlink will be skipped")
fi

DISPATCH="$SCRIPT_DIR/dispatch-codex-lane.sh"
if [ -x "$DISPATCH" ]; then
  INFO+=("dispatcher: $DISPATCH")
else
  FAILURES+=("Dispatcher missing or not executable: $DISPATCH")
fi

if [ "${#FAILURES[@]}" -gt 0 ]; then
  echo ""
  echo "❌ Codex lanes preflight failed:"
  for f in "${FAILURES[@]}"; do echo "- $f"; done
  echo ""
  echo "Suggested remediation:"
  echo "1. Install Codex.app from https://chatgpt.com/codex (or set CODEX env var)."
  echo "2. Install missing CLIs: brew install jq"
  echo "3. Re-run: bash .claude/scripts/check-codex-lane-readiness.sh"
  exit 1
fi

echo ""
echo "✅ Codex lanes preflight passed"
for i in "${INFO[@]}"; do echo "- $i"; done
