# Integrated QA Pass 1

## Current Evidence

- Validation-system standard-library fixtures pass.
- Guidance integrity checks pass.
- Test-quality guardrail passes across the discovered test/spec surface.
- Workflow/action YAML syntax and contract-realism tooling scenarios pass.
- `git diff --check` passes.
- Selector-driven Repo Quick passed with the exact Node 22.22.1, Bun 1.3.14, and Foundry 1.7.1
  toolchain.
- The three declared review batches cover selector/local execution, CI workflows/gating, and
  guidance/toolchain/plan integration with no blocking finding.

## Remaining

None. The clean tested SHA is `fb835410`.

## Validation Receipt

Recorded at `fb835410` with a clean working tree. Live GitHub Actions is green for every expected
workflow and the selector/CI-Gate/local-runner fixtures pass under the exact pinned toolchain. See
`qa-pass-2.md` for the local checkpoint's one environment-blocked check and for the post-
certification cache removal.

- Tested implementation commit SHA: `8fd3311980b28d71d48f72fe41c99d15276de912`
- Run at (UTC): `2026-08-23T08:02:46Z`
- Exact command(s): `bun run test:validation-system`.
- Result: 130/130 validation-system tests passed under Node 22.22.1, Bun 1.3.14, and Foundry 1.7.1;
  current live evidence at `05ff122782ae1eed7e69b534492ad355aad72885` shows all seven selected
  GitHub workflows succeeded.
- Validated paths: validation selector/runner, CI Gate/workflow parity, toolchain re-entry, surface
  leases, root validation scripts, workflows, and their configuration inputs.
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- scripts
  .github package.json turbo.json .mise.toml` → empty.
- Evidence-only diff command and result (if applicable): not applicable.
- Evidence-only worktree-status command and result (if applicable): not applicable.
