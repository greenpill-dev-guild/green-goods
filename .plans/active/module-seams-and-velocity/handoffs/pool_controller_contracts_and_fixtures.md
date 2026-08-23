# Wave 1 A1: Pool Controller Contracts and Fixtures

## Goal

Make the three admin pooling controller boundaries explicit and provide typed, real-selector-backed
fixtures for their views and stories, eliminating unsafe casts without changing view behavior. Do
not start until `w0_receipt_debt_burndown` is terminal and passed.

## Read first

- `AGENTS.md` and `packages/shared/AGENTS.md`
- `.claude/context/values.md` and `.claude/context/testing.md`
- `.plans/active/module-seams-and-velocity/{spec.md,status.json}`
- `packages/shared/src/hooks/admin-ui/pool/**`
- `packages/shared/src/modules/commitment-pooling/demo/demo-builders.ts`
- `packages/admin/src/views/Garden/Pool/poolStoryControllers.ts`

## Start gate

Run `node scripts/harness/plan-hub.mjs linear-sync --feature module-seams-and-velocity --json`.
Respect `parent_only`, create no lane issue, and stop if W0-H is not passed.

## Allowed paths

- `packages/shared/src/hooks/admin-ui/pool/**`
- `packages/shared/src/hooks/commitment-pooling/usePoolCharter.ts` (`PoolCharterResolution`)
- `packages/shared/src/hooks/commitment-pooling/useCommitmentReason.ts` (`CommitmentReasonResolution`)
- `packages/shared/src/__tests__/test-utils/**`
- `packages/admin/src/views/Garden/Pool/poolStoryControllers.ts`
- This handoff's TDD and Validation Receipt sections

## Required outcome

- Add `controller.types.ts` with explicit `PoolConsoleController`, `HubConfirmQueueController`, and
  `CommitmentDialogController` interfaces and named acts contracts. Reuse the real selector return
  types for `can` and `confirmation`.
- Annotate the three hooks with those interfaces and remove their `ReturnType` aliases. Name the
  inline `usePoolCharter` and `useCommitmentReason` result types.
- Export the interfaces through the pool-directory barrel only; add no root-barrel line and use
  relative imports inside shared.
- Add typed commitment-pooling domain fixtures as thin wrappers over the real demo builders, plus
  controller fixtures whose models are built through the real selectors.
- Extend `createSharedBarrelMock` with `{ defaults: false }` so typed overrides spread only actual
  exports and explicit overrides.
- Remove every `as never` from `poolStoryControllers.ts`. Keep existing admin view tests and runtime
  behavior unchanged.

## Do not

- Change controller behavior, view copy, routing, hook effects, stories, or root shared exports.
- Add `react-router` to controllers, untyped bags, casts, dependencies, or cross-lane test rewrites.
- Touch admin files outside `poolStoryControllers.ts`, workflows, configuration, or environment
  files.
- Stage, publish, merge, or modify another lane's paths.

## Gates

- RED first: interface/fixture imports and cast-free story-controller typing must fail on the parent
  commit before implementation.
- `bun run validation:plan -- --intent qa --changed
  packages/shared/src/hooks/admin-ui/pool/controller.types.ts --changed
  packages/shared/src/__tests__/test-utils/controller-fixtures.ts --changed
  packages/admin/src/views/Garden/Pool/poolStoryControllers.ts`.
- Focused existing pool hook/controller tests and fixture tests through `bun run --filter
  @green-goods/shared test -- <files>`.
- `bun run --filter @green-goods/shared typecheck:full` and `bun run --filter @green-goods/admin
  typecheck:full`.
- Existing admin pooling view tests run unchanged and green.
- Search the allowed paths for `as never` and unsafe `Record<string, unknown>` controller bags; both
  return zero.
- Execute the rendered QA plan and record RED/GREEN plus a clean committed Validation Receipt.

## Report back

Return the tested SHA, exported contract and fixture names, RED/GREEN proof, unchanged admin test
counts, typecheck and selector results, zero-cast search, exact clean path status, and any real type
drift exposed by annotation. Stop rather than weaken an interface to accommodate a fixture.

## TDD Proof

- RED: pending
- GREEN: pending
- Proof limit: none

## Validation Receipt

- Tested implementation commit SHA: pending
- Run at (UTC): pending
- Exact command(s): pending
- Result: pending
- Validated paths: pending
- Worktree identity command and result: pending
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable
