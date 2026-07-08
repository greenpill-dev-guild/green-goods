#!/usr/bin/env bash
set -u

EVENT_JSON="$(cat 2>/dev/null || true)"

command -v jq >/dev/null 2>&1 || exit 0

extract_files() {
  jq -r '
    [
      .tool_input.file_path?,
      .tool_input.path?,
      (.tool_input.command? | strings | split("\n")[]? |
        capture("^\\*\\*\\* (Update|Add|Delete) File: (?<path>.+)$").path?),
      (.tool_input.command? | strings | split("\n")[]? |
        capture("^\\*\\*\\* Move to: (?<path>.+)$").path?)
    ]
    | map(select(. != null and . != ""))
    | unique[]
  ' <<<"$EVENT_JSON" 2>/dev/null || true
}

block() {
  printf 'BLOCKED: %s\n' "$1" >&2
  exit 2
}

is_secret_env_path() {
  local file="$1"
  printf '%s' "$file" | grep -qE '(^|/)\.env($|\.(local|development|production|staging|test)$)'
}

FILES="$(extract_files)"
[ -n "$FILES" ] || exit 0

CONTEXT=""

while IFS= read -r file; do
  [ -n "$file" ] || continue

  if is_secret_env_path "$file"; then
    block 'Do not edit secret .env files from Codex. Use .env.schema, .env.example, or ask the user for the specific non-secret change.'
  fi

  if printf '%s' "$file" | grep -qE '(^|/)packages/[^/]+/\.env($|\.)'; then
    block 'Package-level .env files are not allowed in Green Goods; use the root env schema/example pattern.'
  fi

  if printf '%s' "$file" | grep -qE '^packages/contracts/src/'; then
    CONTEXT="${CONTEXT}- Critical contract surface touched (${file}); require line-by-line review, access-control/storage-layout reasoning, and explicit validation notes.\n"
  fi

  if printf '%s' "$file" | grep -qE '^packages/shared/src/providers/(Auth|JobQueue|Work)\.tsx$|^packages/shared/src/modules/job-queue/|^packages/shared/src/hooks/(auth|work|vault|blockchain)/'; then
    CONTEXT="${CONTEXT}- Shared auth/queue/mutation surface touched (${file}); verify failure states, retries/replays, and user-visible recovery paths.\n"
  fi

  if printf '%s' "$file" | grep -qE '(^|/)(package\.json|bun\.lockb|bun\.lock|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$|^\.github/workflows/|^\.codex/|^\.claude/|^\.agents/skills'; then
    CONTEXT="${CONTEXT}- Workflow/dependency/agent config surface touched (${file}); keep scope tight and call out validation explicitly.\n"
  fi
done <<<"$FILES"

if [ -n "$CONTEXT" ]; then
  jq -n --arg context "Green Goods edit context:\n${CONTEXT}" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse", additionalContext:$context}}'
fi

exit 0
