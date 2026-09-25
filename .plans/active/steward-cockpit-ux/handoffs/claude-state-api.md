# Steward Cockpit UX Fixes - State/API Handoff

## Lane

- Owner: Claude
- Branch: per PR (see the execution sub-lanes in `status.json`)
- Status: ready; work happens in the PR handoffs

## Scope

- Shared types, hooks, utilities, and data modules for PR1 to PR3 and PR5:
  [PR1](pr1-actions-crash.md) (capital parsing), [PR2](pr2-hub-review-queue.md) (work display
  titles, review time on work rows, queue summary, assessment defaults, confidence selector),
  [PR3](pr3-garden-community.md) (distinct member count, per-asset endowment),
  [PR5](pr5-copy-storybook-polish.md) (Storybook stylesheet).
- Keep reusable hooks in `packages/shared/src/hooks`; put each decision in a pure function with a
  table test.
- This file aggregates the lane's TDD proof; each PR handoff holds its own receipt.

## TDD Proof

- RED: PR1 — `greengoods.module.test.ts` → 7 failed (the capital parser did not exist;
  `getActions` returned the indexer's names), and `useBaseLists.test.ts` with the list `select`
  removed → 1 failed (a cached list kept its names). PR2, PR3, and PR5: pending.
- GREEN: PR1 — those files plus `useSuspenseBaseLists.test.ts` → 48 passed at 2095e6662; details
  in [PR1](pr1-actions-crash.md). PR2, PR3, and PR5: pending.
- Proof limit: none recorded

## Validation

- Pending lane implementation.

## Validation Receipt

- Tested implementation commit SHA: pending
- Run at (UTC): pending
- Exact command(s): pending
- Result: pending
- Validated paths: pending
- Worktree identity command and result: pending
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- Record blockers here before changing `status.json`.
