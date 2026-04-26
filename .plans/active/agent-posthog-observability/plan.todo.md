# Agent PostHog Observability

**Slug**: `agent-posthog-observability`
**Status**: `ACTIVE`
**Created**: `2026-04-25`
**Priority**: `p2` (force multiplier on bug-intake routine)
**Branch**: `feature/agent-posthog-observability`

## Why this exists

PostHog is in production (shared analytics hooks `useAnalyticsIdentity` / `usePageView`; admin wires capture in `main.tsx` + `routes/Root.tsx`; agent package emits events). What's missing is **agent-side query access**:

- No way for a bug-intake-routine agent to fetch recent errors and link them to filed issues.
- No way to match a user-reported bug ("X said checkout breaks for them on Linux") to their session events / errors.
- No automated detection of recurring failure patterns — every issue is filed in isolation, even when the same JS error fires for 50 sessions.

The product-state read this morning surfaced a related signal: dormancy across 13 Season One gardens (#498), zero new action templates in 23 days (#473), and known onboarding bugs (#495 Pinata 403s + post-connect stuck + Linux passkey, #481 Garden selection unresponsive). PostHog already has the data on what's failing in real sessions; the agent doesn't yet have the keys to read it.

This plan closes that gap: wire query access for agents, fold it into the bug-intake routine, and keep the integration small and self-hosted (no third-party agent broker).

## Inputs / state

- **Already in repo**: `packages/shared/src/hooks/analytics/{useAnalyticsIdentity,usePageView}.ts`; PostHog SDK in admin + client; agent package emits events.
- **PostHog credentials**: live in root `.env` (do not enumerate here; assume `POSTHOG_PROJECT_API_KEY` + `POSTHOG_HOST` exist or get added per `.env.schema`).
- **Empty `.mcp.json`**: no MCP servers registered; no PostHog tool layer for agents.
- **Bug-intake routine**: per `project_claude_routines`, automated bug filing already lands issues with `automated/claude` + `polish` labels (e.g., #495, #481, #487 are bug-intake output). The routine does not currently query PostHog.

## Approach (recommended path)

A two-stage delivery — script first, MCP only if usage justifies it.

### Stage 1 — Query script + bug-intake hook (ship first)

A single durable script `scripts/agents/posthog-query.ts` (per scripts/README convention — invoked by `.claude/**` routines) that wraps PostHog HogQL / Events / Persons APIs with curated queries:

- `errors --recent <window>` — recent unhandled JS errors with `$exception_*` properties, grouped by message + URL, with affected-user counts.
- `error-detail <error-hash>` — full stack + affected user list + first/last seen + sample session-replay link.
- `user-sessions <distinct-id-or-wallet> --window <window>` — sessions for a given user, with errors per session.
- `recurring --since <date>` — top recurring error patterns since a date (for "what should we be addressing that we're not" queries).
- `match-bug-report --error-snippet <text> --user <id?>` — fuzzy match a free-form bug description against recent errors; returns ranked candidates with session-replay links.

All queries return JSON to stdout. Agents parse via `bun scripts/agents/posthog-query.ts ...`.

Then extend the bug-intake routine to:
1. After scraping a user-reported bug (Discord, Drive, etc.), call `match-bug-report` with the description.
2. Inline the ranked PostHog matches into the GitHub issue body — error message, affected user count, last-seen timestamp, replay link.
3. If a `recurring` pattern crosses a threshold (e.g., 50+ sessions), open a parent issue with PostHog evidence rather than filing 50 individual reports.

This stage delivers all four user-stated needs (errors, sessions, recurring issues, user→session match) with minimal infra.

### Stage 2 — Promote to MCP only if usage demands it

If interactive agent sessions need richer queries (paginated event timelines, cohort analysis, custom HogQL), wrap the script logic as an MCP server and register it in `.mcp.json`. Until that need names itself, the script + JSON output is sufficient — keeps the surface narrow and avoids running a daemon for a query that runs hourly.

## Constraints

- **Secrets in env, never in scripts**. PostHog API key reads from env via `varlock` (per agent package pattern); never hardcoded.
- **Read-only**. Script must not mutate PostHog data (no event ingestion, no person property writes from this surface).
- **Rate-limited**. PostHog cloud has API rate limits — script caches identical queries within a 5-min window in a local file (`.cache/posthog/`) to avoid burning quota.
- **Privacy-aware**. Session replays may include PII; never paste replay URL + user identifier into a public GitHub issue without redaction. Default mode for bug-intake: include error message + counts only, replay links go into a private comment or `automated/claude` notes channel.
- **Scripts policy** (CLAUDE.md): the script earns its `scripts/agents/` slot via the bug-intake routine caller; entry in `scripts/README.md` required.
- **No `console.log`** — use `logger` if invoking from a TS context that has it; for the standalone script, structured JSON to stdout is the contract.

## Success

- `bun scripts/agents/posthog-query.ts errors --recent 24h` returns ranked recent errors with affected-user counts.
- A bug-intake-routine run that previously filed an issue with no telemetry context now files one with: top-3 PostHog matches, affected count, replay link in private comment.
- Recurring patterns above threshold collapse into a single parent issue rather than N individual issues.
- The four user-stated capabilities — see errors, see sessions, identify recurring issues, match user-reported bugs to session data — all demonstrably work end-to-end.

## Out of scope

- PostHog MCP server (Stage 2 — defer until script usage shows the gap).
- Real-time alerting (a separate routine could run hourly or daily; this plan only ships query-on-demand).
- Frontend telemetry expansion (admin + client already capture; this plan is read-side only).
- Replacing PostHog with another observability tool.

## Resolved decisions (2026-04-25)

- **Privacy boundary for replay links**: ✅ **Private comments only — strict.** User-stated: "We must respect our users' privacy. That is very, very crucial." Replay URLs and any user-identifying property never land in the issue body. The agent posts an `automated/claude` private comment containing the replay link + distinct-id; the issue body carries only the error message, affected count, first/last seen.
- **Recurring-pattern threshold**: ✅ 50 sessions. Patterns at or above threshold collapse into a parent issue with PostHog evidence; below threshold, individual reports stay individual.
- **Bug-intake routine scope**: ✅ Extend the existing routine — fewer moving parts, one durable caller.
- **Interactive consumer**: ✅ Extend the existing `/debug` skill to call PostHog when Afo manually starts work on a reported bug. Two consumers of the same script: `bug-intake` (autonomous, scheduled) and `/debug` (interactive, on-demand). Same query surface, different invocation context.

## Consumers

| Consumer | Mode | Trigger | Output |
|---|---|---|---|
| `bug-intake` routine | Autonomous | Scheduled run | Inlines top-3 PostHog matches into the filed issue body (counts only); replay link goes to private comment. |
| `/debug` skill | Interactive | User invokes when starting work on a bug | Pulls matching PostHog sessions/errors into the conversation, including replay links (private context, not posted publicly unless user asks). |

## Checklist

- [ ] Verify `POSTHOG_PROJECT_API_KEY` / `POSTHOG_HOST` are documented in `.env.schema` (add if missing).
- [ ] Implement `scripts/agents/posthog-query.ts` with the 5 listed subcommands; output JSON to stdout.
- [ ] Add 5-min file cache for identical queries.
- [ ] Add `scripts/agents/posthog-query.ts` entry to `scripts/README.md`.
- [ ] Extend bug-intake routine to call `match-bug-report` and inline results into filed issues (counts in body, replay link in private comment per privacy decision).
- [ ] Extend bug-intake routine to detect recurring patterns ≥50 sessions and roll up into a parent issue.
- [ ] Extend the existing `/debug` skill to call `posthog-query` when Afo invokes it on a bug report — pulls matching sessions + replay links into the interactive context.
- [ ] Verify on at least one real Discord-sourced bug (e.g., #481 — match against PostHog sessions for the reporting user, see if the unresponsive Garden-select event shows in the trace).
- [ ] Document the four agent capabilities + privacy contract in `docs/routines/bug-intake.md` and the `/debug` skill description.
- [ ] Validation: run the script in dry-run against a test query; confirm rate-limit + cache work; confirm replay link never lands in a public issue body.

## Future signals that would justify Stage 2 (MCP)

- Agents need to paginate >1000 events in a single conversation.
- Custom HogQL queries become routine (not just the 5 curated ones).
- Real-time agent feedback during a debugging session ("show me the next 10 events from this session").
