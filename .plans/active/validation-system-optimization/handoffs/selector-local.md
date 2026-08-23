# Selector and Local Runner Handoff

## Scope

- Versioned validation policy and intent/path/risk selector.
- Selector-driven local runner with fail-fast, cancellation, blocked-environment, dirty-input
  fingerprinting, and opt-in exact passing receipts.
- Durable `bun run validation:plan` caller through real pinned Node.

## TDD Evidence

- RED: `node --test scripts/quality/select-validation.test.mjs` failed because the durable Bun
  caller invoked the selector under Bun's Node-compatibility runtime instead of real Node 22.22.1.
- GREEN: selector and local-runner fixtures pass, including the caller boundary regression.

## Validation Receipt

- Tested implementation commit SHA: `8fd3311980b28d71d48f72fe41c99d15276de912`
- Run at (UTC): `2026-08-23T08:02:46Z`
- Exact command(s): `node --test scripts/quality/select-validation.test.mjs
  scripts/dev/ci-local.test.mjs`.
- Result: 78/78 selector and local-runner tests passed, including strict path scope, Turbo routing,
  critical overrides, re-entry, batching, receipt, cancellation, and workflow mapping.
- Validated paths: `scripts/quality/select-validation.mjs`, its test, `scripts/dev/ci-local.js`, its
  test, `scripts/lib/dev-shared.js`, root validation scripts, and validation policy/config inputs.
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all --
  scripts/quality scripts/dev scripts/lib package.json turbo.json` → empty.
- Evidence-only diff command and result (if applicable): not applicable.
- Evidence-only worktree-status command and result (if applicable): not applicable.
