# W0-G1: Turbo test routing

## Goal

Route eligible local package test checks through Turbo so unchanged consumers reuse passing results,
without changing focused, CI, release, contracts, or receipt semantics.

## Read first

- `AGENTS.md`
- `scripts/quality/select-validation.mjs`
- `scripts/quality/select-validation.test.mjs`
- `scripts/dev/ci-local.js`
- `turbo.json`
- root and package `package.json` test scripts
- `.plans/active/module-seams-and-velocity/plan.todo.md` Decision 6

## Allowed paths

- `scripts/quality/select-validation.mjs`
- `scripts/quality/select-validation.test.mjs`
- `turbo.json`

## Required outcome

- In `materializeCheck`, local non-focused package tests under checkpoint, readiness, push, ship,
  and local merge use `turbo run test --filter=@green-goods/<pkg> --output-logs=new-only`.
- Preserve the docs package's relative binary path and exclude Contracts.
- Focused runs, `ci: true`, and release use the package scripts unchanged.
- Consumer inputs ignore shared `*.test.*`, `*.spec.*`, and `*.stories.*` while retaining
  `__tests__/**`, `__mocks__`, setup files, and other public test utilities. Remove
  `../contracts/.generated/**` from shared inputs.
- Update selector fixtures for Turbo commands, CI/focused/release exclusions, and consumer input
  rules. Receipts continue to fingerprint the materialized Turbo command.

## Do not

- Change package scripts, dependency versions, test scope, CI routing, or release behavior.
- Start before `w0_path_scoped_strict_intents` is merged into `develop`.
- stage, commit, push, merge, or modify another lane's paths.

## Gates

- `node --test scripts/quality/select-validation.test.mjs`
- Render and execute the QA selector for the three allowed paths.
- Run `node scripts/dev/ci-local.js --intent checkpoint --changed packages/shared/src/__tests__/hooks/useWorkMutation.test.ts`
  twice; the second run must report client/admin/agent cache hits.
- Change only `hooks/work/useWorkMutation.ts` in a disposable proof and show those consumers
  invalidate. Restore the disposable proof before handoff.
- Confirm `merge --ci`, focused tests, and release materialize package scripts, not Turbo.

The two empirical mutation steps above are retained as the pasted-program record, but they conflict
with accepted W0-C/D6 behavior: the named shared test is focused and intentionally Shared-only, and
shared `*.test.*` files are intentionally excluded from consumer inputs. Do not broaden selection
or mutate an out-of-allowlist production hook to manufacture this evidence. Static input proof plus
a direct cold/warm package cache proof is the bounded substitute pending scope correction.

## Report back

Write `/tmp/gg-codex-w0_turbo_test_routing/codex-result.md` with `status`, `tests_passed`, and
`issues`. Include first/second cache evidence, source invalidation proof, exact commands, and whether
stray Turbo daemons appeared. Do not claim passed until a clean committed Validation Receipt exists.

## Validation Receipt

- Tested implementation commit SHA: `8df13d8ef35735411f74b54ffae6e2f42176290c`
- Published stacked commit SHA: `c7dfa0ca3348d5552c017771f893532be60be059` in PR #760,
  based on `perf/path-scoped-strict-intents`.
- Run at (UTC): `2026-08-23T04:48:54Z`
- Exact command(s):
  - `node --test scripts/quality/select-validation.test.mjs`
  - `bun run test:validation-system`
  - direct materialized Agent Turbo command twice for cold/warm cache proof
  - `TURBO_SCM_BASE=bff909092a96407b3252b3d58bbc55e2ecd78189 TURBO_SCM_HEAD=6976423240d31105fcdd63a49210c1886c003780 node node_modules/.bin/turbo run test --affected --dry-run=json --cwd /private/tmp/gg-codex-w0_turbo_test_routing`
  - `node node_modules/.bin/turbo daemon status`
  - `git status --porcelain=v1`
- Result: PASS WITH EMPIRICAL PROOF LIMIT. Selector proof passed 53/53 and the durable validation
  suite passed 117/117. A cold Agent run passed 270 tests in 10.068 seconds; the same command then
  hit the full Turbo cache in 146 ms, with no daemon left running. Focused, CI, release, Contracts,
  docs-path, receipt, and consumer-input invariants pass. A current-config affected dry run over the
  historical `useWorkMutation.ts` runtime change selected Shared, Client, Admin, and Agent, proving
  consumer invalidation without mutating an out-of-scope path. The exact pasted test-only ci-local
  example remains unrun because it contradicts W0-C/D6: focused shared tests are Shared-only and
  consumer inputs deliberately exclude `*.test.*`. The branch is published as a stacked draft
  after W0-C and awaits prerequisite review and merge.
- Validated paths: `scripts/quality/select-validation.mjs`,
  `scripts/quality/select-validation.test.mjs`, and `turbo.json`
- Worktree identity command and result: `git worktree list --porcelain` identified
  `/private/tmp/gg-codex-w0_turbo_test_routing` on `perf/turbo-test-routing` at the tested SHA.
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): `git status --porcelain=v1`
  returned no paths.
