# W0-C: Path-scoped strict intents

## Goal

Make push, ship, and local merge select only impacted package surfaces and their strict checks, while
preserving full readiness/release scope, empty-change fallback, CI merge behavior, critical
overrides, and mandatory strict policy.

## Read first

- `AGENTS.md`
- `scripts/quality/select-validation.mjs`
- `scripts/quality/select-validation.test.mjs`
- `scripts/data/validation-policy.json`
- `.claude/context/validation-pipeline.md`
- `.plans/active/module-seams-and-velocity/spec.md`

## Allowed paths

- `scripts/quality/select-validation.mjs`
- `scripts/quality/select-validation.test.mjs`

## Required outcome

- `fullRepository` is true for readiness/release and for push/ship/local merge only when the changed
  path set is empty.
- Strict ABI and fast contract verification run only for full scope or an impacted contract
  surface. Strict test typechecks follow impacted surfaces.
- Update CLI help text to describe the new scope accurately.
- Keep `selectExpectedWorkflows` and policy version unchanged.
- Rewrite the existing strict-intent fixtures to assert the exact docs and client sets from the
  accepted plan, then add invariants for scoped admin work, critical Work paths, contract artifacts,
  local merge versus `merge --ci`, impacted typechecks, and empty ship fallback.

## Do not

- Edit `scripts/data/validation-policy.json`, workflow files, package scripts, or guidance.
- Remove mandatory checks, weaken a critical override, or make release path-scoped.
- stage, commit, push, merge, or modify another lane's paths.

## Gates

- RED: the new focused strict-intent fixtures fail because the current selector returns 27 checks.
- `node --test scripts/quality/select-validation.test.mjs`
- GREEN: `bun run validation:plan -- --intent ship --changed packages/admin/src/views/Garden/SubmitWork.tsx`
  prints exactly the eight accepted admin checks.
- Render and execute `bun run validation:plan -- --intent qa --changed scripts/quality/select-validation.mjs,scripts/quality/select-validation.test.mjs`.

## Report back

Write `/tmp/gg-codex-w0_path_scoped_strict_intents/codex-result.md` with `status`, `tests_passed`,
and `issues`. Include the exact selected ID sets and confirm that release, empty strict scope,
`merge --ci`, critical overrides, and `selectExpectedWorkflows` are unchanged. Do not claim passed
until a clean committed Validation Receipt exists.

## Validation Receipt

- Tested implementation commit SHA: `652db4e84326f5c981e7b8e52cf47259101fb48b`
- Published stacked commit SHA: `c4d9c2a56c0410a74888aef384368e399bfbf265` in PR #756,
  based on `perf/vitest-worker-cap`.
- Run at (UTC): `2026-08-23T03:43:59Z`
- Exact command(s):
  - `node --test scripts/quality/select-validation.test.mjs`
  - `bun run test:validation-system`
  - `bun run validation:plan -- --intent ship --changed packages/admin/src/views/Garden/SubmitWork.tsx`
  - `bun run validation:plan -- --intent push --changed packages/shared/src/modules/work/submit.ts`
  - `bun run validation:plan -- --intent merge --changed packages/admin/src/views/Garden/SubmitWork.tsx`
  - `bun run validation:plan -- --intent merge --ci --changed packages/admin/src/views/Garden/SubmitWork.tsx`
  - `git status --porcelain=v1`
- Result: PASS. The focused selector suite passed 49/49 and the validation-system suite passed
  113/113. Admin ship selected the exact eight IDs, the critical Work path retained its 19-check
  override, and local/CI merge selected identical IDs with only the formatter command differing.
- Validated paths: `scripts/quality/select-validation.mjs` and
  `scripts/quality/select-validation.test.mjs`
- Worktree identity command and result: `git worktree list --porcelain` identified
  `/private/tmp/gg-codex-w0_path_scoped_strict_intents` on
  `perf/path-scoped-strict-intents` at the tested SHA.
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): `git status --porcelain=v1`
  returned no paths.
