# Validation Pipeline (shared core)

Single definition of the repo's validation commands. Skills reference this file
instead of restating the pipeline, so a change to the gate (adding a step,
renaming a script) happens in exactly one place. The intent ladder that decides
*which* rung to run lives in `CLAUDE.md § Validation Intent Ladder`.

## Ship Gate (full pipeline)

The pre-merge/pre-push gate — required before claiming a branch is ready:

```bash
bun format && bun lint && bun run test && bun build
```

Conditional additions when the change touches the relevant surface:

- Design/tokens/CSS: `bun run check:design-md`, `bun run check:design-generated`,
  `bun run check:design-tokens`
- i18n / user-visible copy: `bun run lint:vocab` (locale parity runs inside
  `bun run test` via `packages/shared/src/__tests__/i18n/locale-coverage.test.ts`)
- Stories / Storybook-covered surfaces:
  `bun run --filter @green-goods/shared check:stories` and
  `bun run --filter @green-goods/shared check:story-quality`

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
