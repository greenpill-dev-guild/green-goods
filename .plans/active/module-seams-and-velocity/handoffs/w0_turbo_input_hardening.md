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

- Tested implementation commit SHA: `693f1895bb001b6292da4d94548db07697bc30f0`
- Run at (UTC): `2026-08-23T08:46:24Z`
- Exact command(s):
  - `node --test --test-name-pattern="Turbo consumer inputs" scripts/quality/select-validation.test.mjs`
    (RED, then GREEN)
  - `bun run validation:plan -- --intent qa --changed turbo.json --changed scripts/quality/select-validation.test.mjs --json`
  - `bun run test:validation-system`
  - `bun run validation:plan -- --intent push --changed turbo.json --changed scripts/quality/select-validation.test.mjs --json`
  - `bun format`
  - `bun run lint`
  - `bun run check:codex-guidance && bun run check:guidance-links && bun run check:immutable-plan-reports && bun run check:test-quality && node scripts/harness/plan-hub.mjs validate && node --test scripts/harness/plan-hub.test.mjs`
  - `VITE_CHAIN_ID=11155111 bun run build`
  - `bun run test` (additional broad proof; one localhost-dependent suite blocked by the sandbox)
- Result: the focused regression first failed on the missing Shared consumer-source inputs, then
  passed. The validation-system suite passed 130/130, every push-selector check passed, Plan Hub
  validated 46 feature hubs and passed 56/56 fixtures, and the deterministic root build passed.
  The additional full test run passed 2,050 Solidity tests, the release gas gate, and 278 contract
  script tests; `dual-chain-lifecycle.test.ts` could not connect to its local Anvil process because
  this sandbox rejects `127.0.0.1:3012` with `EPERM`, so the full-suite receipt is `BLOCKED`, not
  passing.
- Validated paths: `turbo.json`, `scripts/quality/select-validation.test.mjs`
- Worktree identity command and result: `git rev-parse HEAD` returned
  `693f1895bb001b6292da4d94548db07697bc30f0`; `git status --short` was empty after disposable
  dependency links were removed.
- Evidence-only diff command and result (if applicable):
  `git diff --exit-code 693f1895bb001b6292da4d94548db07697bc30f0 -- turbo.json scripts/quality/select-validation.test.mjs`
  exited 0 with no diff.
- Evidence-only worktree-status command and result (if applicable):
  `git status --short -- turbo.json scripts/quality/select-validation.test.mjs` returned no paths.
