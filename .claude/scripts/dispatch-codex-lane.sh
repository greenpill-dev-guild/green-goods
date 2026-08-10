#!/bin/bash
# Dispatch a codex lane: create a worktree, run codex, and exit when done.
# Intended to be called by a Claude teammate (or the lead) via the Bash tool with
# run_in_background=true. Prints a JSON summary to stdout on completion so the
# teammate can parse result path + worktree path and review codex output.
#
# Does NOT clean up the worktree — review/merge/cleanup is the teammate's job.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LANE=""
BASE=""
PHASE="main"
PROMPT=""
PROMPT_FILE=""
SCHEMA=""
WORKTREE_PARENT="${CODEX_WORKTREE_PARENT:-/tmp}"
CODEX="$("$SCRIPT_DIR/resolve-codex-binary.sh")" || exit 1

usage() {
  cat >&2 <<EOF
Usage: dispatch-codex-lane.sh --lane <slug> --base <branch> [--phase <id>] \\
         (--prompt <text> | --prompt-file <path>) [--schema <path>]

Required:
  --lane         Short slug (e.g. "factory", "state"). Worktree: /tmp/gg-codex-<lane>.
                 Branch: codex/<lane>/<phase>.
  --base         Base branch to branch off (e.g. "feature/admin-ui-revamp" or "develop").
  --prompt       Inline prompt text, OR
  --prompt-file  Path to a prompt file.

Optional:
  --phase        Phase id (default: "main"). Sets branch suffix codex/<lane>/<phase>.
  --schema       Output schema file (default: <repo>/.codex/output-schema.json).

Env overrides:
  CODEX                     Optional codex binary override. Otherwise resolves ChatGPT.app,
                            Codex.app, then PATH.
  CODEX_WORKTREE_PARENT     Parent dir for worktrees (default: /tmp).

Delegated environment:
  Root .env is never linked. Codex receives only process/runtime basics plus the non-secret
  VITE_CHAIN_ID and CI/color flags when the caller set them. Secret-backed validation stays with
  the parent session or an explicitly authorized human-run gate.

Exit codes:
  0  Dispatch completed. Teammate MUST read result file for codex-reported status.
  1  Argument validation or setup failure (no worktree created).
  2  Codex invocation returned nonzero. Worktree + partial result may exist.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --lane)        LANE="${2:-}"; shift 2;;
    --base)        BASE="${2:-}"; shift 2;;
    --phase)       PHASE="${2:-}"; shift 2;;
    --prompt)      PROMPT="${2:-}"; shift 2;;
    --prompt-file) PROMPT_FILE="${2:-}"; shift 2;;
    --schema)      SCHEMA="${2:-}"; shift 2;;
    -h|--help)     usage; exit 0;;
    *)             echo "Unknown arg: $1" >&2; usage; exit 1;;
  esac
done

[ -n "$LANE" ] || { echo "Missing --lane" >&2; usage; exit 1; }
[ -n "$BASE" ] || { echo "Missing --base" >&2; usage; exit 1; }

if [ -n "$PROMPT" ] && [ -n "$PROMPT_FILE" ]; then
  echo "Provide --prompt OR --prompt-file, not both" >&2; exit 1
fi
if [ -z "$PROMPT" ] && [ -z "$PROMPT_FILE" ]; then
  echo "Missing --prompt or --prompt-file" >&2; usage; exit 1
fi

if [ -n "$PROMPT_FILE" ]; then
  [ -f "$PROMPT_FILE" ] || { echo "Prompt file not found: $PROMPT_FILE" >&2; exit 1; }
  PROMPT="$(cat "$PROMPT_FILE")"
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "Not inside a git repository" >&2; exit 1
}

SCHEMA="${SCHEMA:-$REPO_ROOT/.codex/output-schema.json}"
[ -f "$SCHEMA" ] || { echo "Schema not found: $SCHEMA" >&2; exit 1; }

# Full-auto lanes do not need the parent process's credentials. Keep the child usable for local
# tooling while refusing implicit RPC, wallet, provider, and API secrets from either `.env` or the
# parent environment.
CODEX_ENV=(
  "HOME=$HOME"
  "PATH=$PATH"
  "TMPDIR=${TMPDIR:-/tmp}"
  "SHELL=${SHELL:-/bin/zsh}"
  "LANG=${LANG:-C.UTF-8}"
)
[ -n "${LC_ALL:-}" ] && CODEX_ENV+=("LC_ALL=$LC_ALL")
[ -n "${USER:-}" ] && CODEX_ENV+=("USER=$USER")
[ -n "${LOGNAME:-}" ] && CODEX_ENV+=("LOGNAME=$LOGNAME")
[ -n "${TERM:-}" ] && CODEX_ENV+=("TERM=$TERM")
[ -n "${COLORTERM:-}" ] && CODEX_ENV+=("COLORTERM=$COLORTERM")
[ -n "${VITE_CHAIN_ID:-}" ] && CODEX_ENV+=("VITE_CHAIN_ID=$VITE_CHAIN_ID")
[ -n "${CI:-}" ] && CODEX_ENV+=("CI=$CI")
[ -n "${NO_COLOR:-}" ] && CODEX_ENV+=("NO_COLOR=$NO_COLOR")
[ -n "${FORCE_COLOR:-}" ] && CODEX_ENV+=("FORCE_COLOR=$FORCE_COLOR")

git show-ref --verify --quiet "refs/heads/$BASE" || {
  echo "Base branch not found locally: $BASE" >&2
  echo "Available branches:" >&2
  git branch --format='  %(refname:short)' >&2
  exit 1
}

WORKTREE="$WORKTREE_PARENT/gg-codex-$LANE"
BRANCH="codex/$LANE/$PHASE"
RESULT="$WORKTREE/codex-result.md"

if [ -e "$WORKTREE" ]; then
  echo "Worktree path already exists: $WORKTREE" >&2
  echo "Remove with: git worktree remove --force $WORKTREE && git branch -D $BRANCH" >&2
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "Branch already exists: $BRANCH" >&2
  echo "Remove with: git branch -D $BRANCH" >&2
  exit 1
fi

echo "Creating worktree: $WORKTREE (branch $BRANCH off $BASE)" >&2
git worktree add "$WORKTREE" -b "$BRANCH" "$BASE" >&2 || {
  echo "Worktree creation failed" >&2
  exit 1
}

echo "Dispatching codex (full-auto) in $WORKTREE..." >&2
EXIT=0
env -i "${CODEX_ENV[@]}" "$CODEX" exec \
  --full-auto \
  -C "$WORKTREE" \
  -o "$RESULT" \
  --output-schema "$SCHEMA" \
  "$PROMPT" >&2 || EXIT=2

cat <<EOF
{
  "lane": "$LANE",
  "phase": "$PHASE",
  "branch": "$BRANCH",
  "base": "$BASE",
  "worktree": "$WORKTREE",
  "result_file": "$RESULT",
  "schema": "$SCHEMA",
  "dispatch_exit": $EXIT
}
EOF

exit "$EXIT"
