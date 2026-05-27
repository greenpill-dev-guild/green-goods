#!/usr/bin/env bash
set -u

EVENT_JSON="$(cat 2>/dev/null || true)"

command -v jq >/dev/null 2>&1 || exit 0

CMD="$(jq -r '.tool_input.command // ""' <<<"$EVENT_JSON" 2>/dev/null || printf '')"
[ -n "$CMD" ] || exit 0

block() {
  printf 'BLOCKED: %s\n' "$1" >&2
  exit 2
}

contains_git_force_push_to_primary() {
  printf '%s' "$CMD" | grep -qiE 'git[[:space:]]+push' || return 1
  printf '%s' "$CMD" | grep -qiE '(^|[[:space:]])(--force($|[[:space:]=]|-[^[:space:]]*)|-f)([[:space:]]|$)' || return 1
  printf '%s' "$CMD" | grep -qiE '(^|[[:space:]/])(main|master)([[:space:];&|]|$)'
}

contains_secret_env_read() {
  printf '%s' "$CMD" | grep -qE '(^|[[:space:];&|])(cat|head|tail|less|more|source|bat|grep|rg|sed|awk)([[:space:]]|$)' || return 1
  printf '%s' "$CMD" | grep -qE '(^|[[:space:]/])(\./)?\.env($|[[:space:];&|])|(^|[[:space:]/])(\./)?\.env\.(local|development|production|staging|test)($|[[:space:];&|])'
}

if printf '%s' "$CMD" | grep -qE '(^|[;&|][[:space:]]*)bun[[:space:]]+test([[:space:]]|$)' &&
  ! printf '%s' "$CMD" | grep -qE 'bun[[:space:]]+run[[:space:]]+test'; then
  block 'Use `bun run test` instead of `bun test`; Green Goods relies on the Vitest wrapper.'
fi

if printf '%s' "$CMD" | grep -qE '(^|[;&|][[:space:]]*)forge[[:space:]]+(build|test)([[:space:]]|$)'; then
  block 'Use Green Goods bun wrappers instead of direct forge build/test commands.'
fi

if printf '%s' "$CMD" | grep -qiE 'deploy.*mainnet|upgrade.*mainnet|mainnet.*deploy|mainnet.*upgrade|vercel[[:space:]].*--prod|fly[[:space:]]+deploy'; then
  block 'Production/mainnet deployment commands require explicit out-of-band confirmation; do not run them from a normal Codex turn.'
fi

if contains_git_force_push_to_primary; then
  block 'Never force push to main/master from Codex.'
fi

if contains_secret_env_read; then
  block 'Direct .env file access via Bash is not allowed. Use schema/example files or ask the user for a non-secret value.'
fi

exit 0
