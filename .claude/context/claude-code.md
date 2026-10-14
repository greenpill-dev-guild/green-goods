# Claude Code harness notes

Repository policy lives in [AGENTS.md](../../AGENTS.md). Load this reference only for the
Claude-specific operations below. Path-scoped `.claude/rules/` continue to supply local pointers.

## Authenticated browser tools

Follow [Browser Evidence](../../AGENTS.md#browser-evidence). In Claude Code, use the
Chrome/Chromium extension against the already-open authenticated Brave profile. Probe with
`tabs_context_mcp`; the connected-browsers roster can be empty before lazy registration.
If that probe fails, try visible computer control of the same window. If neither reaches it,
record authenticated proof as pending and continue independent work with correctly labeled proof.

## Codex dispatch

Before an authorized direct Codex CLI call, resolve the binary with
`CODEX="$(.claude/scripts/resolve-codex-binary.sh)"`. The resolver checks a valid override,
installed app bundles, then `PATH`. Follow `.claude/scripts/dispatch-codex-lane.sh` and
[the team workflow](../skills/plan/teams.md); dispatch does not broaden user authorization.

## Session continuity

Before ending or compacting a long execution session, write untracked `session-state.md` only
when another agent needs continuation state absent from the owning Plan Hub. Remove that
session's handoff when it is no longer needed. Do not duplicate plan state.
