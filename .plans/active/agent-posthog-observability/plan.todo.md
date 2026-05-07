# Agent PostHog Observability

**Slug**: `agent-posthog-observability`
**Status**: `ACTIVE`
**Created**: `2026-04-25`
**Priority**: `p2` (force multiplier on bug-intake and debug routines)
**Branch**: `feature/agent-posthog-observability`

## Why this exists

PostHog is in production (shared analytics hooks `useAnalyticsIdentity` / `usePageView`; admin wires capture in `main.tsx` + `routes/Root.tsx`; agent package emits events). This plan is about **AI-agent and routine access to that telemetry**, not a feature in `packages/agent`.

- Bug-intake should fetch recent PostHog errors and attach safe evidence to Linear Customer Needs / linked Issues.
- No way to match a user-reported bug ("X said checkout breaks for them on Linux") to their session events / errors.
- Recurring failure patterns should roll up into one Linear Issue instead of many duplicate records.

The product-state read that started this plan surfaced a related signal: dormancy across 13 Season One gardens (#498), zero new action templates in 23 days (#473), and known onboarding bugs (#495 Pinata 403s + post-connect stuck + Linux passkey, #481 Garden selection unresponsive). PostHog already has the data on what's failing in real sessions; the remaining work is teaching routines how to use that connector access safely.

This plan now closes that gap with **Claude Code connector-first usage**. The durable script created in the first pass remains an optional fallback for Codex, cron, or environments without connector access. No PostHog MCP server is planned.

## Inputs / state

- **Already in repo**: `packages/shared/src/hooks/analytics/{useAnalyticsIdentity,usePageView}.ts`; PostHog SDK in admin + client; agent package emits events.
- **Claude Code connectors**: PostHog and Linear connector access are the primary operational path for bug-intake and interactive debugging.
- **Fallback script**: `scripts/agents/posthog-query.ts` exists for non-connector contexts and JSON/stdout automation.
- **Bug-intake routine**: `docs/routines/bug-intake.md` routes user/community signals into Linear Customer Needs and optional linked Issues. It should add safe PostHog evidence through connector-first queries.

## Approach (recommended path)

Connector-first routine integration. The script is fallback infrastructure, not the main product surface.

### Stage 1 — Connector-first bug-intake and debug usage

Claude Code should use the PostHog connector to answer these curated questions:

- recent unhandled JS errors grouped by message and URL, with affected-session counts
- error details: stack, first/last seen, affected-session counts, and private replay evidence
- user/session lookup when a reporter identifier is available
- recurring patterns over the 50-session threshold
- fuzzy matches between free-form bug reports and recent PostHog errors

Claude Code should then use the Linear connector to create or update:

- one Linear Customer Need per validated report
- an optional linked Linear Issue for actionable bugs
- one parent Linear Issue for recurring patterns above threshold

Public/shared Linear bodies only get safe evidence: error message, affected-session/user counts, first seen, last seen, app surface, and confidence. Replay links, session IDs, distinct IDs, wallet addresses, and reporter identifiers stay out of Linear bodies unless Linear has a private/internal field explicitly approved for that evidence.

### Fallback — local script for non-connector contexts

`scripts/agents/posthog-query.ts` remains useful when Codex, cron, or another runtime cannot use the Claude Code PostHog connector. It outputs JSON to stdout and includes privacy-safe public issue fields by default.

Do not build a PostHog MCP server for this plan.

## Constraints

- **Connector-first**. Claude Code PostHog + Linear connectors are the primary path.
- **No PostHog MCP**. Do not add `.mcp.json` PostHog entries or a PostHog MCP server for this plan.
- **Read-only PostHog**. Query telemetry only; do not mutate PostHog data.
- **Privacy-aware**. Session replays may include PII. Never paste replay URLs, session IDs, distinct IDs, wallet/user identifiers, or reporter identifiers into public/shared Linear bodies.
- **Fallback script env**. If the script is used, secrets stay in root env only; never hardcode keys.
- **Fallback script stdout**. If invoking the script, structured JSON to stdout is the contract.

## Success

- Bug-intake routine guidance tells Claude Code to query PostHog before writing Linear records when a report has enough detail to match.
- Linear Customer Need / Issue bodies include safe PostHog summaries only.
- Replay links and user/session identifiers remain private context, not Linear body text.
- Recurring patterns above 50 sessions collapse into one parent Linear Issue.
- `/debug` guidance tells Claude Code how to use private PostHog evidence interactively.
- The fallback script remains tested and documented, but no longer drives the plan.

## Out of scope

- PostHog MCP server.
- Building more query infrastructure when Claude Code connector access is sufficient.
- Real-time alerting (a separate routine could run hourly or daily; this plan only ships query-on-demand).
- Frontend telemetry expansion (admin + client already capture; this plan is read-side only).
- Replacing PostHog with another observability tool.

## Resolved decisions (2026-04-25)

- **Privacy boundary for replay links**: ✅ **Private context only — strict.** User-stated: "We must respect our users' privacy. That is very, very crucial." Replay URLs and any user-identifying property never land in Linear Customer Need / Issue bodies. Shared Linear bodies carry only safe summaries such as error message, affected count, first/last seen, app surface, and confidence.
- **Recurring-pattern threshold**: ✅ 50 sessions. Patterns at or above threshold collapse into a parent issue with PostHog evidence; below threshold, individual reports stay individual.
- **Bug-intake routine scope**: ✅ Extend the existing routine — fewer moving parts, one durable caller.
- **Interactive consumer**: ✅ Extend the existing `/debug` skill to call PostHog when Afo manually starts work on a reported bug. Two consumers share the same privacy boundary: `bug-intake` (autonomous, scheduled) and `/debug` (interactive, on-demand).
- **Connector-first revision (2026-05-06)**: ✅ Claude Code has PostHog and Linear connector access. Use those connectors as the primary path. Keep `scripts/agents/posthog-query.ts` only as fallback. Do not build PostHog MCP.

## Consumers

| Consumer | Mode | Trigger | Output |
|---|---|---|---|
| `bug-intake` routine | Autonomous | Scheduled run | Uses Claude Code PostHog + Linear connectors; writes safe telemetry summaries to Linear Customer Needs / linked Issues. |
| `/debug` skill | Interactive | User invokes when starting work on a bug | Uses Claude Code PostHog connector for private debugging context, including replay links when needed. |
| `scripts/agents/posthog-query.ts` | Fallback | Connector unavailable in Codex/cron/non-Claude runtime | Outputs privacy-shaped JSON to stdout. |

## Checklist

- [x] Verify `POSTHOG_PROJECT_API_KEY` / `POSTHOG_HOST` are documented in `.env.schema` (add if missing).
- [x] Implement `scripts/agents/posthog-query.ts` with the 5 listed subcommands; output JSON to stdout.
- [x] Add 5-min file cache for identical queries.
- [x] Add `scripts/agents/posthog-query.ts` entry to `scripts/README.md`.
- [x] Revise plan to connector-first and explicitly remove PostHog MCP as a future lane.
- [ ] Extend `docs/routines/bug-intake.md` to use Claude Code PostHog + Linear connectors for safe telemetry enrichment.
- [ ] Extend bug-intake routine guidance to detect recurring patterns ≥50 sessions and roll up into a parent Linear Issue.
- [ ] Extend `.claude/skills/debug/posthog.md` and `.agents/skills/debug/posthog.md` to use connector-first PostHog lookup during bug debugging.
- [ ] Verify on at least one real Discord-sourced bug (e.g., #481) through connector access.
- [ ] Validate privacy by confirming replay links and identifiers are not instructed into Linear Customer Need / Issue bodies.
