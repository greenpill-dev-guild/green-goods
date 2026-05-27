#!/usr/bin/env bash
set -u

EVENT_JSON="$(cat 2>/dev/null || true)"

command -v jq >/dev/null 2>&1 || exit 0

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || jq -r '.cwd // ""' <<<"$EVENT_JSON" 2>/dev/null || pwd)"

active_plans() {
  [ -d "$ROOT/.plans/active" ] || return 0
  find "$ROOT/.plans/active" -mindepth 2 -maxdepth 2 -name status.json -print 2>/dev/null |
    sort |
    while IFS= read -r status_file; do
      jq -r '.feature.name // .feature.title // empty' "$status_file" 2>/dev/null
    done |
    awk 'NF { print "- " $0 }' |
    head -8
}

PLANS="$(active_plans)"

CONTEXT="Green Goods Codex context:
- Use bun wrappers: \`bun run test\`, not raw \`bun test\`; use bun wrappers for forge.
- React hooks belong in packages/shared/src/hooks, not client/admin.
- Root env pattern only; do not create or read package-level secret env files.
- Critical surfaces: packages/contracts/src, shared auth/job queue/work providers, and mutation hooks.
- For UI-visible changes, include browser or screenshot proof before final handoff."

if [ -n "$PLANS" ]; then
  CONTEXT="${CONTEXT}

Active .plans:
${PLANS}"
fi

jq -n --arg context "$CONTEXT" \
  '{hookSpecificOutput:{hookEventName:"SessionStart", additionalContext:$context}}'

exit 0
