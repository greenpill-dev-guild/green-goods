# W0-A: Pre-push static checks

## Goal

Make the POSIX pre-push hook reject source-structure drift and stale generated design artifacts on
every push, while adding no more than three seconds to a clean branch.

## Read first

- `AGENTS.md`
- `.husky/pre-push`
- `scripts/quality/check-source-structure.js`
- `docs/docs/builders/quality/husky.mdx`

## Allowed paths

- `.husky/pre-push`
- `docs/docs/builders/quality/husky.mdx`

## Required outcome

- After lint, run `check:source-structure` against `origin/develop` when that ref exists. Fall back
  to the command's unscoped mode when it does not.
- Then run `check:design-generated`.
- Extend the failure hint with `bun run design:generate`.
- Keep the hook valid POSIX `sh`; do not add Bash-only syntax.
- Keep test typechecking and Storybook smoke in the selector, not the hook.

## Do not

- Change source-structure or design policy.
- Change package scripts, dependencies, lockfiles, or unrelated hook checks.
- stage, commit, push, merge, or modify another lane's paths.

## Gates

- RED: on the parent commit, a temporary 360-line file under `packages/*/src/` is not rejected by
  the hook's own source-structure step.
- GREEN: the same fixture exits 1 and names the file; a clean branch completes the two new checks in
  no more than three seconds.
- `sh -n .husky/pre-push`
- `bun run check:source-structure`
- `bun run check:design-generated`
- Render and execute `bun run validation:plan -- --intent qa --changed .husky/pre-push,docs/docs/builders/quality/husky.mdx`.

## Report back

Return the changed files, RED/GREEN evidence, exact command results, elapsed clean-hook cost, and any
blocker. Do not claim passed until the tested commit and clean validated paths can be recorded in a
Validation Receipt.

## Validation Receipt

- Tested implementation commit SHA: `c354ee7a2690f97cfa8ae49598bfa5e281bd210f`
- Published draft: PR #754 against `develop` at the tested SHA.
- Run at (UTC): `2026-08-23T04:34:09Z`
- Exact command(s):
  - `sh -n .husky/pre-push`
  - `bun run check:source-structure`
  - `bun run check:design-generated`
  - `bun run build` from `docs`
  - mocked POSIX-hook executions with the remote absent, present, and present with
    `SOURCE_STRUCTURE_BASE_REF=release/base`
  - `git status --porcelain=v1`
- Result: PASS. The baseline hook accepted the 360-line fixture; the new source check rejected and
  named it. The two added clean checks took 1.47 seconds. POSIX syntax, default/override/fallback
  base behavior, design parity, the docs build, and final clean status passed.
- Validated paths: `.husky/pre-push` and `docs/docs/builders/quality/husky.mdx`
- Worktree identity command and result: `git worktree list --porcelain` identified
  `/private/tmp/gg-codex-w0_prepush_static_checks` on `perf/prepush-static-checks` at the tested SHA.
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): `git status --porcelain=v1`
  returned no paths after validation-only links were moved out.
