# Codex State/API Handoff

## Scope (current pass)

Closes the connector-first PostHog + Linear repo-guidance work that the 2026-05-06 plan revision called for. The earlier durable script work (Stage 1, recorded below) is unchanged.

Owned guidance surfaces touched in this pass:

- `docs/routines/bug-intake.md`
- `.claude/skills/debug/posthog.md`
- `.agents/skills/debug/posthog.md`
- `.plans/active/agent-posthog-observability/plan.todo.md` (checklist update)

Not touched:

- `scripts/agents/posthog-query.ts` and its test — fallback-only, no behavior change required.
- `.mcp.json` — explicitly out of scope (no PostHog MCP server).
- Any other plan, package, or shared file (94-file dirty tree from concurrent agents was preserved).

## Stage 1 (prior pass, unchanged)

Implemented the durable script surface for read-only PostHog access:

- `scripts/agents/posthog-query.ts`
- `scripts/agents/posthog-query.test.ts`
- `.env.schema` root PostHog query env contract
- `scripts/README.md` inventory entry

The 2026-05-06 plan revision makes connector-first Claude Code usage the primary path and removes PostHog MCP from this plan.

### Script behavior

The script exposes five curated commands and writes JSON to stdout:

- `errors --recent <window>`
- `error-detail <error-hash> --window <window>`
- `user-sessions <distinct-id-or-wallet> --window <window>`
- `recurring --since <YYYY-MM-DD>`
- `match-bug-report --error-snippet <text> --user <id?>`

The API surface uses PostHog's read query endpoint with a `HogQLQuery` payload. It reads root env only:

- `POSTHOG_PROJECT_API_KEY`
- `POSTHOG_PROJECT_ID`
- `POSTHOG_HOST`

Identical queries are cached for 300 seconds under `.cache/posthog/` by default. Cache metadata is included in the JSON response.

### Privacy (script)

Replay links and user identifiers are kept out of `public_issue_matches` and `public_issue_body`. Private evidence is only included under `private_context`, and `--privacy public` suppresses `private_context` entirely. This preserves the plan rule that replay links and user identifiers must not land in public issue bodies.

## Connector-first guidance (this pass)

### `docs/routines/bug-intake.md`

- Added the `posthog` connector to the front-matter `connectors:` list.
- Added a top-level `## PostHog telemetry enrichment` section that documents:
  - When to query (enrichable signal definition)
  - The five curated questions to issue against the PostHog connector
  - The privacy-boundary table (allowed-in-Linear-body vs private-only fields), including the strict "do not write the field in the first place" hard rule
  - The private-channel handoff path for replay links / session IDs / distinct IDs
  - The `scripts/agents/posthog-query.ts` fallback when the connector is unavailable
- Inserted a "Enrich with PostHog (private context)" step into Phase 1 (Discord) and Phase 2 (Telegram), and a fuzzy-only variant into Phase 3 (Drive). The new step lives between dedupe and Customer Need creation and feeds the safe-summary block.
- Added a new `## PostHog evidence (safe summary)` block to the Customer Need body template, using only the allowlisted fields (error hash, top-line message, normalized top frame, affected-session count, affected-user count, first/last seen, app surface, recurring-pattern flag, confidence). The block is omitted when no match is returned.
- Added a new `## Phase 4: Recurring-pattern roll-up` between Phase 3 and the umbrella check. It folds matches by error hash, gates on the **≥ 50 distinct sessions in 30 days** threshold from `brief.md`, and creates or refreshes a parent Linear Issue per recurring hash with safe-summary fields only. Capped at 2 new parent Issues per run.
- Renumbered the previous Phase 4 → Phase 5 (Always-create umbrella check) and Phase 5 → Phase 6 (Daily summary). Updated the cross-reference in the Linear ↔ Discord linking note.
- Added a **Phase 5 step 5** privacy grep across every body created or edited in the run, with a fail-loud-and-redact path.
- Updated the Phase 6 daily-summary message format to surface PostHog enrichment counts and recurring-pattern parents created or refreshed, and added an explicit reminder that the `#product` summary is public (no replay URLs, session IDs, distinct IDs, wallet/user identifiers, or reporter identifiers inline; private replay links go to Afo via DM only).
- Added explicit caps/guardrail lines:
  - Recurring-pattern parents do not count against the 4-Issue cap (separate cap of 2).
  - PostHog connector usage is read-only (no mutating endpoints).
  - Privacy boundary is non-negotiable and lists the forbidden fields.
  - Do not add PostHog MCP entries to `.mcp.json` from this routine.

### `.claude/skills/debug/posthog.md` and `.agents/skills/debug/posthog.md`

The two files were identical before this pass; both received the same additions and remain identical (verified with `diff`).

Added a new `## Read-side: PostHog lookup during bug debugging` section after the existing emit-side documentation. Covers:

- When to query during interactive debugging vs when to skip (skip for build/lint/code-quality).
- Primary path: the Claude Code PostHog connector with the same five curated questions used by `bug-intake`.
- Explicit private-context handling — replay URLs, session IDs, distinct IDs, wallet/user identifiers, and reporter identifiers stay in private debugging context only and never enter Linear bodies, GitHub issues, PR descriptions, commit messages, Discord summaries, or any other shared surface. Sharing across agents/humans goes through the PostHog error hash plus safe-summary fields.
- Fallback: `scripts/agents/posthog-query.ts` with the same env contract and the `--privacy public` flag for any output that may flow into a shared surface.
- Privacy hard rule: explicit allowlist mirrored from the routine.
- Anti-feature-creep: do not extend the script to add features that exist in the connector.

## Privacy validation (doc-level)

The privacy boundary is enforced through guidance, not a runtime check, so validation is doc-level. Confirmed:

1. The Customer Need body template lists only allowlisted fields. Forbidden fields are not present in the template.
2. The recurring-pattern parent Issue body uses the same allowlist.
3. The linked-Issue (per-report) guidance explicitly inherits the same boundary in Phase 1 step 6, Phase 2 step 6, and Phase 3 step 7.
4. The Phase 6 public Discord summary explicitly forbids replay URLs / session IDs / distinct IDs / wallet/user identifiers / reporter identifiers inline, and routes private replay links to a DM to `<@${DISCORD_USER_ID_AFO}>`.
5. The Phase 5 step 5 privacy grep is the runtime backstop (greps every body created or edited this run for `replay`, `session_id`, `distinct_id`, `0x`, and reporter identifiers, fails loud, and redacts).
6. The `/debug` skill files mirror the same allowlist with the "if a field came from PostHog and it is not in this allowlist, it does not leave private debugging context" hard rule.
7. Privacy boundary applies whether the agent used the connector or the fallback script — both surfaces share the same allowlist.

## Validation

Passed in this pass:

- `node scripts/harness/plan-hub.mjs validate` → `Validated 20 feature hubs.` ✅
- `bunx biome check --no-errors-on-unmatched docs/routines/bug-intake.md .claude/skills/debug/posthog.md .agents/skills/debug/posthog.md .plans/active/agent-posthog-observability/plan.todo.md` → `Checked 0 files. No fixes applied.` (markdown is not Biome-linted; no JSON/TS files in this set)
- `bun run format:check` → 6 errors, all in unrelated plan `status.json` files (`yield-split-ui`, `client-pwa-audit`, `css-maintainability-polish`, `docs-freshness-routine`, plus archived plans). None of the four files touched in this pass appear in the error list. Pre-existing concurrent-agent dirty state, not introduced by this pass.
- Banned-vocabulary spot check (`grep -ciE "streak|countdown|leaderboard|FOMO|urgent|limited time|re-engagement|retention hook"`) on the four touched files → 0 hits. The repo's `lint:vocab` script scopes i18n message values only (`docs/docs/reference/banned-vocabulary.json`), so docs/skill prose is not in scope.
- Two `posthog.md` skill files compared with `diff` → identical. The `.claude` and `.agents` copies stayed in sync.

Passed in the prior Stage 1 pass (unchanged here):

- `bunx vitest run scripts/agents/posthog-query.test.ts` → 8 passed
- `POSTHOG_PROJECT_ID=12345 bun scripts/agents/posthog-query.ts errors --recent 24h --dry-run --privacy public`
- `bunx tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --types node --skipLibCheck scripts/agents/posthog-query.ts scripts/agents/posthog-query.test.ts`
- `bunx oxlint scripts/agents`
- `bun run format:check` (when run, the prior dirty-tree state did not have today's six unrelated `status.json` errors)

Skipped intentionally:

- The script tests (`scripts/agents/posthog-query.test.ts`) were not re-run because `scripts/agents/posthog-query.ts` and its test are unchanged in this pass. Re-running would add no signal.
- `bun run check:test-quality` — flagged in the prior handoff as failing on an unrelated `tests/specs/client.happy-path.spec.ts:94 test.skip`. Still pre-existing, still unrelated to this plan.

## Remaining blockers

1. **Real-bug verification through connector access (plan checklist last item).** The plan asks for a verification on at least one real Discord-sourced bug (e.g. #481 Garden selection unresponsive). This pass produced repo guidance only; it did not exercise the routine end-to-end against live PostHog and Linear. Doing so requires (a) confirming the cloud routine environment exposes the PostHog connector under the expected name, (b) the routine running with `LINEAR_API_KEY` (or its connector equivalent) against the real `Green Goods` project, and (c) human review of the resulting Customer Need / linked Issue / recurring-pattern parent for privacy-boundary compliance. The earliest opportunity is the next scheduled `bug-intake` run after this guidance lands, which a human can review for leakage.

2. **Connector vs MCP naming in cloud env.** The routine's front matter now lists `posthog` in `connectors:`, but the cloud routines runtime may surface PostHog as an MCP entry rather than a native connector. The routine guidance is written to be tolerant ("primary path" wording mirrors the existing `linear` pattern), but if the cloud env exposes neither PostHog connector nor PostHog MCP, the routine will fall through to the script — which assumes `POSTHOG_PROJECT_API_KEY`, `POSTHOG_PROJECT_ID`, `POSTHOG_HOST` are wired into `green-goods-routines-extended`. Confirm those env vars are present in the cloud environment before the first scheduled run, otherwise enrichment will silently no-op.

3. **`pattern:posthog-*` Linear label.** Phase 4 references `pattern:posthog-{error-hash-prefix}` as a parent-Issue label. The routine fails loud if the label set is missing rather than inventing a parent, but a human will need to create the label scheme on the `Contributors` team (or wherever the production team labels live) before recurring-pattern roll-up actually emits parents. Track this as a Linear admin task downstream.

## What this hands off

Phase ownership now matches the spec: `state_api` lane has shipped both the durable fallback script (Stage 1) and the connector-first repo guidance (this pass). The remaining work is operational rather than authoring — confirm cloud connector wiring, observe one real run, validate privacy on the resulting Linear records.
