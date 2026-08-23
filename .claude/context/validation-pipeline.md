# Validation Pipeline (shared core)

Single definition of the repo's validation commands. Skills reference this file
instead of restating the pipeline, so a change to the gate (adding a step,
renaming a script) happens in exactly one place. The intent ladder that decides
*which* rung to run lives in `CLAUDE.md § Validation Intent Ladder`.

## Select before executing

Render the repository-owned plan first:

```bash
bun run validation:plan -- --intent <intent>
```

The selector combines intent, changed paths, dependency impact, and criticality. Agents execute the
returned plan instead of inventing a broader command set. If the selector command is unavailable or
fails, fall back to the intent ladder and commands below and report the selector problem. A missing
or failed selector never authorizes omitting a required check or critical override.

For QA and checkpoint intent, inspect each check's `selectedBy` reasons before execution. A plan is
invalid when routine test, story, or workspace-importer changes select an unrelated package suite,
or when it omits the direct acceptance check for the changed artifact. Run the targeted acceptance
proof, report the selector defect, and do not start the unrelated suite. This guard never downgrades
a critical override or readiness, push, ship, merge, or release intent.

Every selected check states:

- **Risk** — the concrete regression, invariant, or acceptance criterion it covers.
- **Expected signal** — the observable pass/fail evidence the command provides.
- **Freshness** — the source inputs, validated paths, validation entrypoint, policy, toolchain, and
  environment profile that must remain identical before a passing receipt can be reused.
- **Stop** — which dependent checks stop after a deterministic failure and which explicitly
  independent diagnostics may continue.

Receipt reuse is opt-in and off by default. Pass `--reuse-passing-receipts` to
`node scripts/dev/ci-local.js` to skip checks whose exact fingerprint already passed. The store
lives in `.cache/validation`, holds passes only, and any change to the command, policy, toolchain,
validated paths, or environment profile invalidates the fingerprint. A tampered store is rejected
rather than trusted.

`node scripts/dev/ci-local.js` renders and executes Ship intent by default. When Git identifies a
non-empty change set, Ship is path-scoped to the affected package surfaces and their strict extras.
An empty change set falls back to the full repository. Critical overrides remain mandatory, and
merge, readiness, and release keep their selector-defined scope. Use `bun run test:fast` for a
cache-aware full-scope iteration loop; keep the exact uncached `bun run test` for gates that name it.

Never reuse failures. User cancellation is terminal: stop active validation, schedule nothing else,
and report only evidence already collected. An unavailable browser, RPC, secret, service, or other
capability produces `BLOCKED`, not passing; do not retry the identical check until that capability
changes. Budgets warn and profile but never skip contract, deployment/release, authentication,
JobQueue, Work-provider, mutation-hook, security, ontology, supply-chain, or release gates. Contracts use Bun
wrappers only, never raw Forge.

## Diagnosis and evidence review (non-mutating)

Inspect existing evidence first, then run only the check needed to prove or disprove each material
finding. Keep commands non-mutating and stop dependent work on the first deterministic failure. This
rung supports diagnosis, audit, and ordinary evidence review; it does not certify production
readiness. When the user explicitly asks for production quality, approval, PR/merge readiness, or a
readiness verdict, use the full Production Review Readiness Gate below.

## Production Review Readiness Gate (non-mutating)

The strict evidence gate for an explicit production-readiness review. It proves bounded production
readiness without editing tracked files:

```bash
bun format:check && bun lint && bun run test && VITE_CHAIN_ID=11155111 bun run build
```

Run every selected stage fresh unless an exact matching receipt satisfies the freshness contract
above. A required failure means `REQUEST_CHANGES`. A required check that cannot run means
`COMMENT_ONLY`; do not downgrade or replace the proof silently.

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
- Agent runtime changes: `bun run build:agent`
- Docs runtime, navigation, or build configuration changes: `bun run build:docs`

The root `bun run build` covers Contracts, Shared, Indexer, Client, and Admin. It does not build
Agent or Docs; the conditional commands above close those scopes.

Visible UI additionally requires rendered proof through the authenticated Brave QA profile. If
that path is unavailable, record browser proof as `BLOCKED` and return `COMMENT_ONLY` unless a
confirmed finding already requires changes. Isolated Browser, Playwright, DevTools MCP, and
clean-room browser-proof commands cannot substitute for authenticated local QA.

## Ship Gate (full pipeline)

The pre-merge/pre-push gate — required before claiming a branch is ready:

```bash
bun format && bun lint && bun run test && bun run build
```

Ship uses the same conditional additions listed in the Production Review Readiness Gate. Unlike review, ship
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

- Style only: `bunx @biomejs/biome format --no-errors-on-unmatched <changed-files...>` and, for changed JavaScript or
  TypeScript, `bunx oxlint <changed-source-files...> --deny-warnings`. Both commands are
  path-scoped and non-mutating. Do not use workspace-mutating `bun format` or broad `bun lint` for
  isolated style-only QA.
- One behavior: `bun run --filter <pkg> test <path/to/file>`
- Baseline capture before a sweep: non-mutating `bun run format:check && bun lint`, then the
  selector-chosen tests. Use the mutating `bun format` only in explicit fix/Ship intent.
  (build intentionally omitted until the sweep lands)

Failing tests are never cached and never skipped around — fix the test, not
the cache (`bun run test:fast:force` for a suspicious cache hit).
