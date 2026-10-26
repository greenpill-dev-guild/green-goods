# Thin push gate (2026-10-26)

Afo decided the local push gate's future on 2026-10-25, relayed by the PWA Home orchestrator: make
the push a thin pre-check of format, lint, typechecks, docs drift and focused tests, keep the full
contracts gate, and leave builds, Storybook and package-wide suites to CI. He settled the two open
choices the same night: a cheap whole suite no longer counts as proof on push, and `react-patterns`
joins the local checks (D16). This report records the mapping and the evidence. It builds on D15
([critical push override](2026-10-25-critical-push-override.md)).

## What a push runs

- Format and lint, scoped to the changed paths.
- Cheap repository checks: `react-patterns` (new on push), `source-structure`, `test-quality`,
  `staged-modules`, `agent-guidance`, `em-dashes`, `brand-voice-parity`, `ontology`,
  `immutable-plan-reports`, `qa-id-ledger`, `story-quality`, `dependabot-sync-test`,
  `env-schema-test`.
- The owner's typecheck as compile proof, and for a critical change every consumer's source and
  test typecheck. The Indexer has no standalone typecheck: its build is codegen plus
  `tsc --noEmit`, so `indexer-build` stays as its typecheck.
- Docs drift: `docs-generated`, `docs-authority`.
- Focused tests named by `--test-path` or inferred from a changed test file. A changed test helper or
  a deleted test now names the test that still proves it, however cheap its suite.
- The complete contracts gate for a critical contracts change.

## What a push leaves to PR CI

A push drops each check below only when its workflow is expected for the change (the selector's
`workflowRules`, which CI Gate also uses). Where the workflow does not run, the check stays local.
The plan lists every check it left and the workflow that runs it. Local cost is the measured wall
time from the receipt stores (2026-08-16 to 2026-10-25).

| Check | PR CI lane | Local p50 / p90 |
|---|---|---|
| `shared-build` | none needed: the Shared build is an echo | 0 s |
| `client-build` | Client › Lint And Build › Build client | 47 s / 108 s |
| `admin-build` | Admin › Lint And Build › Build admin | 36 s / 112 s |
| `agent-build` | Agent › Lint Typecheck And Build › Build agent | 4 s / 9 s |
| `storybook-build` | Design › Storybook › Build Storybook | 77 s / 283 s |
| `browser-passkey` | Client › Playwright Client CI › Run qualified browser proof (passkey) | 44 s / 203 s |
| `browser-work-exploration` | Client › Playwright Client CI › Run qualified browser proof (explore) | 69 s / 144 s |
| `browser-pwa-preview` | Client › Playwright Client CI › Run qualified browser proof (pwa-preview) | too few runs |
| whole `shared-test` | Shared › Test (1/2), Test (2/2) | 74 s whole |
| whole `client-test` | Client › Test | 76 s whole |
| whole `admin-test` | Admin › Test | 99 s whole |
| whole `agent-test` | Agent › Test (units with coverage, SQLite) | 5 s whole |
| whole `indexer-test` | Indexer › Test (handlers with coverage) | 242 s whole |
| `docs-test` | Docs › Build Docs › Test docs | 1 s |
| `docs-build` | Docs › Build Docs › Build docs | 13 s |

## What stays local, and why

- `indexer-build`: the Indexer's only typecheck.
- `validation-system-test`: CI runs 7 of its 16 test files.
- `review-guardrails-test`: 6 of its 11 test files run in no workflow.
- `agent-tools-test` and `fork-fixtures-test`: no workflow runs them.
- The contracts gate: `contracts-verify-fast` has no pull-request CI equivalent.
- Any check above whose workflow does not run for the change. Two such paths turned up while
  mapping: the passkey preset reads the Agent's test driver
  (`packages/agent/src/__tests__/reporting/driver/server.ts`), whose changes run no Client CI, and
  the Design workflow watches only Shared's Storybook config.

## Evidence

- A comparison harness ran develop's selector and this branch's over twelve change shapes in seven
  intents. Checkpoint, readiness, ship, merge and release match develop in all 60 plans. Against
  #1308's head, push differs only by `react-patterns` joining source changes, `client-typecheck`
  replacing `client-build` for a client entry point, and the passkey preset leaving the push where
  Client CI runs; qa does not change.
- A selector test walks every policy rule path and asserts that each check a push leaves to CI has
  its workflow expected, that no CI-owned check stays local where its workflow runs, and that no
  suite runs whole unless the plan is asking for its test or its workflow does not run.

## Decisions (D16)

1. A push is a thin pre-check; builds, the Storybook build, browser presets and whole package suites
   belong to PR CI, each only where its workflow runs.
2. A cheap whole suite no longer counts as proof on push; qa still accepts one.
3. `react-patterns` runs on push for the package source and manifests it reads.
4. Checkpoint, ship, readiness, merge and release are unchanged. The policy version moves to 4.
