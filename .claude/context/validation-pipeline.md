# Validation Pipeline (shared core)

Single definition of the repo's validation commands. Skills reference this file
instead of restating the pipeline, so a change to the gate (adding a step,
renaming a script) happens in exactly one place. The intent ladder that decides
*which* rung to run lives in `CLAUDE.md § Validation Intent Ladder`.

## Review Readiness Gate (non-mutating)

The strict evidence gate for plain `/review`. It proves bounded production readiness without
editing tracked files:

```bash
bun format:check && bun lint && bun run test && VITE_CHAIN_ID=11155111 bun run build
```

Run every stage fresh in the current review. A required failure means `REQUEST_CHANGES`. A required
check that cannot run means `COMMENT_ONLY`; do not downgrade or replace the proof silently.

Conditional additions when the change touches the relevant surface:

- Design/tokens/CSS: `bun run check:design-md`, `bun run check:design-generated`,
  `bun run check:design-tokens`
- i18n / user-visible copy: `bun run lint:vocab` (locale parity runs inside
  `bun run test` via `packages/shared/src/__tests__/i18n/locale-coverage.test.ts`)
- Stories / Storybook-covered surfaces:
  `bun run --filter @green-goods/shared check:stories` and
  `bun run --filter @green-goods/shared check:story-quality`
- Changed non-test source under `packages/*/src/**`: `bun run check:source-structure`
- Contract-touching changes: `bun run verify:contracts:fast`; when protocol behavior changed,
  also run `bun run --filter @green-goods/contracts test:fork`
- Frontend, UI, CSS, accessibility, or web-design changes: retrieve current guidance with
  `bun run agentic:guidance`, then run `bun run agentic:check`
- Changed E2E specs or CI auth paths (`AuthGate`, `DevAuthProvider`, CI auth helpers): run the
  matching Playwright CI project — client: `PLAYWRIGHT_APP=client APP_ENV=test bunx playwright
  test --project=client-ci`; admin: `PLAYWRIGHT_APP=admin APP_ENV=test bunx playwright test
  --project=admin-ci`

Visible UI additionally requires rendered proof through the authenticated Brave QA profile. If
that path is unavailable, record browser proof as `BLOCKED` and return `COMMENT_ONLY` unless a
confirmed finding already requires changes. Isolated Browser, Playwright, DevTools MCP, and
clean-room browser-proof commands cannot substitute for authenticated local QA.

## Ship Gate (full pipeline)

The pre-merge/pre-push gate — required before claiming a branch is ready:

```bash
bun format && bun lint && bun run test && bun build
```

Ship uses the same conditional additions listed in the Review Readiness Gate. Unlike review, ship
may run mutating format and branch/commit safety steps because the user explicitly requested ship,
PR, commit, merge, or release readiness.

## Repo Quick Gate

Cross-package checkpoint (shared exports, hook signatures, provider contracts,
data shapes, mutation flows):

```bash
node scripts/dev/ci-local.js --quick
```

## Partial rungs (QA Speed Mode)

Targeted proof for an isolated fix — the package-local test file or command
that proves the touched behavior (see the intent ladder). Common shapes:

- Style only: `bun format && bun lint`
- One behavior: `bun run --filter <pkg> test <path/to/file>`
- Baseline capture before a sweep: `bun format && bun lint && bun run test`
  (build intentionally omitted until the sweep lands)

Failing tests are never cached and never skipped around — fix the test, not
the cache (`bun run test:fast:force` for a suspicious cache hit).
