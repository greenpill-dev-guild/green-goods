#!/bin/bash
# Dispatch a codex lane: create worktree, symlink env, run codex, exit when done.
# Intended to be called by a Claude teammate (or the lead) via the Bash tool with
# run_in_background=true. Prints a JSON summary to stdout on completion so the
# teammate can parse result path + worktree path and review codex output.
#
# Does NOT clean up the worktree — review/merge/cleanup is the teammate's job.
set -uo pipefail

LANE=""
BASE=""
PHASE="main"
PROMPT=""
PROMPT_FILE=""
SCHEMA=""
WORKTREE_PARENT="${CODEX_WORKTREE_PARENT:-/tmp}"
CODEX="${CODEX:-/Applications/Codex.app/Contents/Resources/codex}"

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
  CODEX                     Path to codex binary (default: /Applications/Codex.app/Contents/Resources/codex).
  CODEX_WORKTREE_PARENT     Parent dir for worktrees (default: /tmp).

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

[ -x "$CODEX" ] || {
  echo "Codex binary not executable: $CODEX" >&2
  echo "Set CODEX env var or install Codex.app." >&2
  exit 1
}

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

if [ -f "$REPO_ROOT/.env" ]; then
  ln -s "$REPO_ROOT/.env" "$WORKTREE/.env"
  echo "Symlinked .env into worktree" >&2
fi

echo "Dispatching codex (full-auto) in $WORKTREE..." >&2
EXIT=0
"$CODEX" exec \
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
