# Wave 6 Consolidated Receipt

Wave 6 implements the Shared, Client, and Admin Node/DOM Vitest projects and the
baseline-backed direct-tested-seam guard on `develop`. The durable architecture is complete, but
AC-W6 is not closed: the isolated Admin suite spends 76.35% of measured worker time importing
modules, above the approved below-40% floor, and no quiet-machine suite or live CI timing receipt is
available.

## TDD and Routing Proof

- Shared routes the approved top-level, utility, module, config, workflow, library, type, i18n,
  public-contract, ontology, and style tests through Node. Its DOM project excludes the same Node
  globs. Admin and Client route `.test.ts` through Node and `.test.tsx` through DOM, with explicit
  DOM docblocks on the few `.test.ts` files that need browser globals.
- Partition parity passed without coverage configuration inside projects: Shared discovered 165
  Node files plus 219 DOM files, Admin 18 plus 81, and Client 15 plus 88. The six partitions passed
  with the counts recorded below.
- The direct-tested-seam checker is 150 lines, has four regression fixtures, and is wired as Check
  5 of `check-test-quality.sh`. Its mocked-subject fixture fails, while the exact 13-entry baseline
  passes without drift. The complete test-quality check discovered 862 tests.
- Canonical guidance in `.claude/context/testing.md` now requires direct subject tests for declared
  seams instead of accepting consumer-only tests hidden behind whole-module mocks.

## Validation Receipt

- Tested implementation commit SHA: `2ee5f5f9107435e557da292b350a8e4d82f3c2e7`
- Run at (UTC): `2026-08-24T03:29:33Z`
- Exact command(s): `node scripts/dev/ci-local.js --quick --base d361ecf10 --head HEAD`; the focused
  project commands were `bun run test -- --project node` and `bun run test -- --project dom` in
  each of `packages/shared`, `packages/client`, and `packages/admin`.
- Result: formatting, lint, 146 validation-system tests, Shared source/test typechecks and 61
  focused tests, Client test typecheck and 20 focused tests, Admin test typecheck and 31 focused
  tests, Agent typecheck, and 270 Agent tests passed. The boundary gate then reached 298 passing
  Indexer tests and stopped with nine environment-blocked metadata tests that could not bind
  `127.0.0.1` (`EPERM`). The unchanged blocker was not retried, so dependent gate checks did not
  run.
- Validated paths: `.claude/context/testing.md`, root and Shared package manifests, the Shared,
  Client, and Admin Vitest configs and test changes, `scripts/quality/check-direct-tested-seams.mjs`,
  its fixtures and baseline, `scripts/quality/check-test-quality.sh`, the validation-system parity
  test, and their documented script entries.
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all --
  .claude/context/testing.md package.json packages/shared packages/client packages/admin
  scripts/README.md scripts/data/direct-tested-seam-baseline.json
  scripts/quality/check-direct-tested-seams.mjs
  scripts/quality/check-direct-tested-seams.test.mjs scripts/quality/check-test-quality.sh
  scripts/quality/workflow-performance-parity.test.mjs` returned no output. The matching
  `git diff --exit-code 2ee5f5f9107435e557da292b350a8e4d82f3c2e7..HEAD -- <validated paths>` also returned no
  output before this evidence-only Plan Hub update.

## Partition Results

| Package | Project | Files | Tests | Wall time |
|---|---:|---:|---:|---:|
| Shared | Node | 164 passed, 1 skipped | 2,107 passed, 7 skipped | 51.48s |
| Shared | DOM | 218 passed, 1 skipped | 2,126 passed, 11 skipped | 70.26s |
| Client | Node | 15 passed | 119 passed | 16.91s |
| Client | DOM | 88 passed | 749 passed | 81.82s |
| Admin | Node | 18 passed | 100 passed | 46.63s |
| Admin | DOM | 81 passed | 611 passed | 143.08s |

These were isolated project runs on a heavily loaded host, not a quiet-machine suite receipt. They
prove routing and parity, but they do not prove the 60-second Shared, 50-second Client, or 90-second
Admin exit targets.

## Admin Import-Time Blocker

The isolated Admin DOM run reported 71.14s transform, 52.89s setup, 1,000.36s import, 71.59s test,
and 114.18s environment worker time. Import therefore accounts for 76.35% of the recorded worker
phases, above the below-40% acceptance floor.

Three bounded configuration experiments were rejected and fully removed:

1. Vite dependency optimization failed on `uint8arrays` conditional exports and then emitted
   untransformed JSX after exclusions.
2. `isolate: false` with a single worker reduced Node time but caused cross-file mock leakage in the
   DOM suite.
3. A generated Admin-only Shared facade reduced some Node work but transitive self-imports and 52
   root-module mocks erased the DOM benefit and initially omitted required exports.

Meeting the floor requires a real Admin import-boundary migration across roughly 370 root Shared
imports, 419 unique imported symbols, and 52 root-module mocks. That is a new production-source
scope, not a safe Vitest configuration change. Isolation and test correctness remain intact.

## Coverage and Environment Accounting

- The two-point coverage ratchet is due `2026-09-22`. It is not due on this receipt date and was not
  applied early.
- The Wave 6 Quick Gate ran exactly once. Indexer localhost binding remains BLOCKED, not passing.
  The unchanged contract dual-chain, Docker, local-server, and authenticated-Brave capability
  limits remain as previously recorded and were not retried.
- This wave changes test architecture and guidance, not rendered product UI, so authenticated
  browser proof is not applicable.
