#!/usr/bin/env bash
set -u

EVENT_JSON="$(cat 2>/dev/null || true)"

command -v jq >/dev/null 2>&1 || exit 0

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || jq -r '.cwd // ""' <<<"$EVENT_JSON" 2>/dev/null || pwd)"

changed_files() {
  {
    git -C "$ROOT" diff --name-only HEAD 2>/dev/null
    git -C "$ROOT" ls-files --others --exclude-standard 2>/dev/null
  } | sort -u
}

FILES="$(changed_files | grep -E '\.(ts|tsx|js|jsx|css|scss|json|toml|ya?ml)$|(^|/)(package\.json|bun\.lockb|bun\.lock|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$|^packages/contracts/src/|^\.codex/|^\.claude/|^\.agents/skills|^\.github/workflows/' || true)"
[ -n "$FILES" ] || exit 0

SUMMARY="$(printf '%s\n' "$FILES" | head -8 | sed 's/^/- /')"

jq -n --arg msg "Green Goods changed files detected before Stop:\n${SUMMARY}\nBefore the final response, report the validation/proof that matches the touched surface. UI changes need browser/screenshot proof; contracts/auth/queue changes need explicit risk and validation notes." \
  '{systemMessage:$msg}'

exit 0
