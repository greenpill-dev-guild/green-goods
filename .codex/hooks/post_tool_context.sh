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

FILES="$(extract_files)"
[ -n "$FILES" ] || exit 0

CONTEXT=""

while IFS= read -r file; do
  [ -n "$file" ] || continue

  if printf '%s' "$file" | grep -qE '\.(tsx|css|scss)$' &&
    printf '%s' "$file" | grep -qE '^(packages/client|packages/admin|packages/shared/src/(components|hooks|modules))/'; then
    CONTEXT="${CONTEXT}- UI/layout-impacting file changed (${file}); before finishing, include browser or screenshot proof if behavior/layout could be visible.\n"
  fi

  if printf '%s' "$file" | grep -qE '^packages/contracts/src/|^packages/shared/src/providers/(Auth|JobQueue|Work)\.tsx$|^packages/shared/src/modules/job-queue/|^packages/shared/src/hooks/(auth|work|vault|blockchain)/'; then
    CONTEXT="${CONTEXT}- Critical Green Goods surface changed (${file}); final response should name the risk surface and validation performed.\n"
  fi

  if printf '%s' "$file" | grep -qE '(^|/)(package\.json|bun\.lockb|bun\.lock|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$|^\.github/workflows/|^\.codex/|^\.claude/'; then
    CONTEXT="${CONTEXT}- Dependency/workflow/agent config changed (${file}); final response should mention config impact and validation.\n"
  fi
done <<<"$FILES"

if [ -n "$CONTEXT" ]; then
  jq -n --arg context "Green Goods post-edit context:\n${CONTEXT}" \
    '{hookSpecificOutput:{hookEventName:"PostToolUse", additionalContext:$context}}'
fi

exit 0
