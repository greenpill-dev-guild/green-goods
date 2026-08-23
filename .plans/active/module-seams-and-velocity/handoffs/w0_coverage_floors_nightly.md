# W0-F: Real coverage floors off the PR critical path

## Goal

Enforce real shared, client, and admin coverage floors nightly and on `main`, while changing pull
request Test jobs to plain tests and preserving measured floors through parity fixtures.

## Read first

- `AGENTS.md`
- `packages/shared/AGENTS.md`
- `packages/client/AGENTS.md`
- `packages/admin/AGENTS.md`
- The three Vitest configs and package coverage scripts
- `.github/workflows/contracts-nightly.yml`
- `.github/workflows/shared.yml`
- `.github/workflows/client.yml`
- `.github/workflows/admin.yml`
- `scripts/quality/workflow-performance-parity.test.mjs`
- `.claude/context/testing.md`

## Allowed paths

- `packages/shared/vitest.config.ts`
- `packages/client/vitest.config.ts`
- `packages/admin/vitest.config.ts`
- `.github/workflows/shared.yml`
- `.github/workflows/client.yml`
- `.github/workflows/admin.yml`
- `.github/workflows/coverage-nightly.yml`
- `scripts/quality/workflow-performance-parity.test.mjs`
- `.claude/context/testing.md`
- the existing validation documentation page that owns coverage cadence

## Required outcome

- Measure coverage with `CI=true` and flatten each config's `thresholds` object. The approved
  corrected statement floors are 61 shared, 63 client, and 51 admin; the other metrics use
  `floor(measured)`.
- Update parity arrays and add a guard against nested `thresholds.global`.
- Pull request Test steps run `bun run test`.
- Add a fail-fast-false shared/client/admin matrix workflow on schedule, `push: [main]`, and manual
  dispatch using the existing `setup-js` action and `CI: true`.
- Add parity coverage for all workflow users and document the real floors, cadence, and first
  2026-09-22 ratchet.

## Do not

- Lower a measured floor, change Agent or Indexer coverage, install dependencies, or rename existing
  workflow/job contexts.
- stage, commit, push, merge, or modify another lane's paths.

## Gates

- RED: prove the old nominal 70/75/80 values fail after flattening, which demonstrates that the old
  nested shape was not enforcing them.
- GREEN: each `CI=true` package coverage run passes at the measured floor.
- `node --test scripts/quality/workflow-performance-parity.test.mjs`
- Render and execute the QA selector for the allowed paths.
- A human/Claude with GitHub access records the first green default-branch Coverage Nightly run
  after merge, per Afo's 2026-08-22 proof-limit approval.

## Report back

Return the measured metrics, selected floor table, workflow and parity results, PR critical-path
delta, and any GitHub capability blocker. Do not claim passed until live workflow proof and a clean
committed Validation Receipt exist.

## Validation Receipt

- Tested implementation commit SHA: `359eaf1ba3d48e483031f77d0fb4eb7060c70749`
- Published stacked commit SHA: `05ff122782ae1eed7e69b534492ad355aad72885` in PR #759,
  based on `test/load-sensitive-tests`.
- Run at (UTC): `2026-08-23T05:36:49Z`
- Exact command(s):
  - RED, with the old nominal values flattened: `CI=true bun run coverage` from `packages/shared`
    and `packages/client`; `CI=true bun run test:coverage` from `packages/admin`
  - QA selector: `bun run validation:plan -- --intent qa --json` under Node 22.22.1 and Bun 1.3.14
  - `node --test scripts/quality/workflow-performance-parity.test.mjs`
  - selector checks: path-scoped Biome format/lint, `bun run test:validation-system`, Shared and
    Agent `bun run typecheck`, Agent `bun run test`, and Docs `bun run build`
  - GREEN under Node 22.22.1, Bun 1.3.14, and `CI=true`: `bun run coverage` from Shared and Client;
    `bun run test:coverage` from Admin
  - PR-path proof under the same toolchain: `bun run test` from Shared, Client, and Admin
  - `git diff --check`, `git status --short --branch`, and `git rev-parse HEAD`
- Result: IN PROGRESS. All local gates are green. Shared coverage is 61.12 statements / 52.17
  branches / 59.17 functions / 62.65 lines (3,930 tests); Client is 63.36 / 56.92 / 62.29 /
  64.95 (865 tests); Admin is 51.54 / 47.07 / 44.87 / 53.24 (659 tests). The old flattened floors
  failed only on coverage after those same suites passed. Parity passed 14/14 and the validation
  system passed 108/108. Client and Admin repeated the known non-fatal V8 `main.tsx` remap warning.
  Local PR-path timings were mixed under host contention (Shared 122.87s plain vs 115.36s coverage,
  Client 80.92s vs 87.89s, Admin 190.10s vs 157.21s), so no timing improvement is claimed. A live
  Coverage Nightly dispatch was not available while the new workflow was absent from the default
  branch. Afo explicitly accepted that proof limit on 2026-08-22 so the stack could merge; the first
  default-branch run remains required post-merge observation. After stacking, the combined parity
  assertions and validation-system suite passed 16/16 and 130/130 at the published commit. The
  refreshed head also passed Agent, Supply Chain, Docs, Client, Shared, Admin, and aggregate CI Gate.
- Validated paths: the ten committed W0-F paths listed by `git show --stat 359eaf1ba`.
- Worktree identity command and result: `git worktree list --porcelain` identified
  `/private/tmp/gg-codex-w0_coverage_floors_nightly` on `ci/coverage-floors-nightly`; HEAD is
  `05ff122782ae1eed7e69b534492ad355aad72885` after the approved stack rewrite and CI refresh.
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): `git status --short --branch`
  returned only `## ci/coverage-floors-nightly` after validation links were removed.
