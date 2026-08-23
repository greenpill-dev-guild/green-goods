# W0-D: Local Vitest worker cap

## Goal

Cap local Vitest workers from host CPU, memory, and concurrent package share so consumer batches do
not make the suite fail under load, while leaving CI and explicit `VITEST_MAX_WORKERS` overrides
unchanged.

## Read first

- `AGENTS.md`
- `scripts/lib/dev-shared.js`
- `scripts/dev/ci-local.js`
- `packages/shared/vitest.config.ts`
- `packages/client/vitest.config.ts`
- `packages/admin/vitest.config.ts`
- `scripts/quality/workflow-performance-parity.test.mjs`

## Allowed paths

- `scripts/lib/dev-shared.js`
- `scripts/lib/dev-shared.test.mjs`
- `scripts/dev/ci-local.js`
- `scripts/dev/ci-local.test.mjs`
- `packages/shared/vitest.config.ts`
- `packages/client/vitest.config.ts`
- `packages/admin/vitest.config.ts`
- `scripts/quality/workflow-performance-parity.test.mjs`

## Required outcome

- Add `resolveVitestMaxWorkers({ cpus, totalMemoryBytes, ci, share = 1 })` with the accepted 2 GiB
  per-worker calculation and a floor of two local workers.
- The three Vitest configs use the helper for `maxWorkers`; CI receives `undefined`.
- `ci-local.js` passes `VITEST_MAX_WORKERS` to batched package tests using the batch length as share.
- Explicit environment configuration continues to win over config defaults.
- Add pure cases for 16 GB/10 cores, 8 GB, CI, and share 3, plus parity proof that all three configs
  call the helper.

## Do not

- Change CI worker counts, dependency versions, global timeouts, or root test parallelism.
- Start before `w0_toolchain_reexec` is merged into `develop`.
- stage, commit, push, merge, or modify another lane's paths.

## Gates

- Render and execute the QA selector for the allowed paths.
- `node --test scripts/lib/dev-shared.test.mjs scripts/dev/ci-local.test.mjs scripts/quality/workflow-performance-parity.test.mjs`
- Record quiet-machine shared/admin baselines and swap state, then show each single package stays
  within ten percent while the full consumer batch improves.
- Confirm `CI=true` yields no config cap and `VITEST_MAX_WORKERS=3` remains effective.

## Report back

Write `/tmp/gg-codex-w0_vitest_worker_cap/codex-result.md` with `status`, `tests_passed`, and
`issues`. Include the pure function table, timing and swap evidence, explicit override proof, and
any measurement limit. Do not claim passed until a clean committed Validation Receipt exists.

## Validation Receipt

- Tested implementation commit SHA: `8c8ca6b2c8241e455db5a9d4a1da0d734a414dd5`
- Published stacked commit SHA: `35e42cc29d9256379aa36512eba38114a1f61057` in PR #757,
  based on `fix/ci-local-toolchain-reexec`.
- Run at (UTC): `2026-08-23T04:34:09Z`
- Exact command(s):
  - `node --test scripts/lib/dev-shared.test.mjs scripts/dev/ci-local.test.mjs scripts/quality/workflow-performance-parity.test.mjs`
  - the rendered QA selector checks for the eight allowed paths
  - runtime config loads under `CI=true` and `VITEST_MAX_WORKERS=3`
  - host load, memory, and swap-in sampling before the timing decision
  - `git status --porcelain=v1`
- Result: PROOF LIMIT. Functional proof is green: 45/45 focused tests, 119/119 validation-system
  tests, Shared 3,930 passed and 1 skipped, Client 865 passed, Admin 659 passed, and Agent 270
  passed with 1 skipped. CI resolves no cap and the explicit value 3 wins. The host never became a
  credible quiet baseline, so the required base-versus-lane timing matrix and regression/improvement
  claims remain unproven. The branch is published as a stacked draft after W0-B; it still requires
  the quiet-machine timing receipt plus prerequisite review and merge.
- Validated paths: the eight allowed paths above.
- Worktree identity command and result: `git worktree list --porcelain` identified
  `/private/tmp/gg-codex-w0_vitest_worker_cap` on `perf/vitest-worker-cap` at the tested SHA.
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): `git status --porcelain=v1`
  returned no paths.
