# W0-I: Turbo test-input hardening

## Goal

Ensure Turbo invalidates cached package-test results whenever a root test runner changes, and
whenever client or admin source changes affect Shared's cross-package policy tests.

## Read first

- `AGENTS.md`
- `turbo.json`
- `scripts/dev/node-cli.js`
- `scripts/lib/dev-shared.js`
- `scripts/quality/select-validation.test.mjs`
- The two actionable review findings on merged PR #760

## Allowed paths

- `turbo.json`
- `scripts/quality/select-validation.test.mjs`
- `.plans/active/module-seams-and-velocity/**`

## Required outcome

- Shared, Client, Admin, Agent, and Indexer test-task inputs include both root test-runner helpers.
- Shared test-task inputs include Client and Admin source trees because Shared tests scan them.
- A durable regression test fails when any required input is removed.

## Do not

- Edit the merged PR branch, package test behavior, selector routing, dependencies, workflows, or
  unrelated Turbo tasks.
- Reply to or resolve GitHub review threads without separate authorization.

## Gates

- Preserve the focused RED failure on the parent tree.
- `bun run validation:plan -- --intent qa --changed turbo.json --changed scripts/quality/select-validation.test.mjs --json`
- `bun run test:validation-system`
- Repeat the bounded root-cause sweep across package test entrypoints and Shared tests that read
  consumer source.
- Run the push-intent selector and every selected check before publication.

## Report back

Return the root-cause cluster, changed paths, RED/GREEN counts, selector result, clean tested SHA,
and any still-open review feedback.

## Validation Receipt

- Tested implementation commit SHA: pending
- Run at (UTC): pending
- Exact command(s): pending
- Result: pending
- Validated paths: pending
- Worktree identity command and result: pending
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable
