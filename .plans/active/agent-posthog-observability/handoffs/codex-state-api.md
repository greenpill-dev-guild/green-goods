# Codex State/API Handoff

## Scope

Implemented the Stage 1 durable script surface for read-only PostHog access:

- `scripts/agents/posthog-query.ts`
- `scripts/agents/posthog-query.test.ts`
- `.env.schema` root PostHog query env contract
- `scripts/README.md` inventory entry

No MCP server was added. The 2026-05-06 plan revision makes connector-first Claude Code usage the primary path and removes PostHog MCP from this plan.

## Behavior

The script exposes five curated commands and writes JSON to stdout:

- `errors --recent <window>`
- `error-detail <error-hash> --window <window>`
- `user-sessions <distinct-id-or-wallet> --window <window>`
- `recurring --since <YYYY-MM-DD>`
- `match-bug-report --error-snippet <text> --user <id?>`

The API surface uses PostHog's read query endpoint with a `HogQLQuery` payload. It reads
root env only:

- `POSTHOG_PROJECT_API_KEY`
- `POSTHOG_PROJECT_ID`
- `POSTHOG_HOST`

Identical queries are cached for 300 seconds under `.cache/posthog/` by default. Cache
metadata is included in the JSON response.

## Privacy

Replay links and user identifiers are kept out of `public_issue_matches` and
`public_issue_body`. Private evidence is only included under `private_context`, and
`--privacy public` suppresses `private_context` entirely.

This preserves the plan rule that replay links/user identifiers must not land in public
issue bodies.

## TDD Proof

### RED

Command:

```bash
bunx vitest run scripts/agents/posthog-query.test.ts
```

Evidence:

```text
FAIL scripts/agents/posthog-query.test.ts
Error: Cannot find module './posthog-query' imported from scripts/agents/posthog-query.test.ts
Tests: no tests
```

Additional regression RED during implementation:

```text
FAIL allows dry-run query shaping without loading the PostHog API key
Error: POSTHOG_PROJECT_API_KEY is required for read-only PostHog queries.
```

### GREEN

Command:

```bash
bunx vitest run scripts/agents/posthog-query.test.ts
```

Evidence:

```text
PASS scripts/agents/posthog-query.test.ts
Test Files 1 passed
Tests 8 passed
```

Covered behavior:

- command parsing for all five curated commands
- rejection of unknown/malformed commands
- HogQL request shaping against `/api/projects/:project_id/query/`
- snippet/user filter shaping
- dry-run without API key
- 300-second cache reuse for identical queries
- public/Linear body privacy redaction
- `--privacy public` private-context suppression

## Remaining Work

2026-05-06 plan revision: Claude Code PostHog and Linear connectors are now the
primary path. This means the script is fallback-only for Codex, cron, or another
non-connector runtime. Do not build PostHog MCP.

Remaining work is now policy/routine wiring:

- update `docs/routines/bug-intake.md` to query PostHog through the Claude Code connector before writing Linear records
- update `.claude/skills/debug/posthog.md` and `.agents/skills/debug/posthog.md` for connector-first private debugging
- validate that Linear Customer Need / Issue bodies only receive safe summaries and never replay links, session IDs, distinct IDs, wallet/user identifiers, or reporter identifiers

## Validation

Passed:

- `bunx vitest run scripts/agents/posthog-query.test.ts`
- `POSTHOG_PROJECT_ID=12345 bun scripts/agents/posthog-query.ts errors --recent 24h --dry-run --privacy public`
- `bunx tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --types node --skipLibCheck scripts/agents/posthog-query.ts scripts/agents/posthog-query.test.ts`
- `bunx oxlint scripts/agents`
- `bun run format:check`

Blocked by unrelated existing repo state:

- `node scripts/harness/plan-hub.mjs validate` fails on `.plans/active/admin-design-revamp`
  schema/taxonomy/lane issues.
- `bun run check:test-quality` fails on `tests/specs/client.happy-path.spec.ts:94`
  for an ungoverned `test.skip`.
