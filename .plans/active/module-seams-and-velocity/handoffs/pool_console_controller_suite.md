# Wave 1 A2: Pool console controller suite

## Goal

Give `usePoolConsoleController` direct behavioral coverage through its typed controller seam so every
act, timer transition, loading/error combination, and refetch fan-out is proven without reimplementing
the hook in an Admin view test.

## Read first

- `AGENTS.md`
- `packages/shared/AGENTS.md`
- `.plans/active/module-seams-and-velocity/{spec.md,eval.md,plan.todo.md,status.json}`
- `packages/shared/src/hooks/admin-ui/pool/usePoolConsoleController.ts`
- `packages/shared/src/hooks/admin-ui/pool/controller.types.ts`
- `packages/shared/src/__tests__/commitment-pooling-hooks.test.tsx` lines 698-766
- `packages/shared/src/__tests__/test-utils/controller-fixtures.ts`
- `packages/shared/src/config/query-keys.ts`

## Allowed final paths

- `packages/shared/src/__tests__/hooks/admin-ui/usePoolConsoleController.test.tsx`
- `.plans/active/module-seams-and-velocity/handoffs/pool_console_controller_suite.md`
- `.plans/active/module-seams-and-velocity/status.json`

`packages/shared/src/hooks/admin-ui/pool/usePoolConsoleController.ts` may be changed only temporarily
for the two required one-line mutant proofs and must match the parent exactly in the committed tree.

## Required outcome

- Follow the existing dialog-controller recipe with a typed hoisted dependency bag.
- Mock ontology query, the four commitment-pooling data readers including `getPoolClaimRequests`,
  primary address, online status, queue state, charter/reason/cycle-name/metadata hooks, both mutation
  hooks, and only `pinPoolCharter` from pool-charter. Keep selectors and query hooks real.
- Pre-seed one test QueryClient with the exact pools, cycles, commitments, and pool-claims query keys.
- Under fake timers, prove `dueLive` is empty at mount, exactly one timer is armed, advancing 30 seconds
  reveals the due row without re-arming, and unmount clears the timer.
- Under real timers, prove: no-pool acts reject with `This garden has no commitment pool`;
  `pendingCreates` filtering; exact forwarding for every act; `saveSettings` orders pin, charter write,
  then cap write and stops before cap on pin rejection; loading/error composition; and complete refetch
  fan-out.
- Reach at least 95% line coverage on `usePoolConsoleController.ts` and execute 100% of its acts.

## Do not

- Change production behavior, controller contracts, fixtures, Admin files, dependencies, barrels,
  workflows, or other lane tests.
- Use broad Shared module mocks, untyped bags, `as never`, fake selectors, or fake query-key shapes.
- Publish, merge, resolve GitHub threads, or edit Linear.

## Proof and gates

- Test-only TDD: preserve two one-line mutant failures in the receipt: the timer re-arm condition near
  the current timer effect, and the no-pool `saveSettings` guard. Revert each mutant immediately.
- Render `bun run validation:plan -- --intent qa --changed
  packages/shared/src/__tests__/hooks/admin-ui/usePoolConsoleController.test.tsx --json` and execute
  every selected check using its risk, expected signal, freshness, and stop rule.
- Run the focused test and focused V8 coverage with
  `usePoolConsoleController.ts` as the included production file.
- Run Shared full typecheck, source structure against the stacked parent, and static searches proving
  the new suite has no `as never`, `Record<string, unknown>` controller bag, or whole Shared barrel mock.
- Commit implementation first; repeat all commit-attributable gates at that SHA; then record the
  receipt and mark this execution sub-lane passed only when the acceptance proof is complete.

## Report back

Return the tested SHA, changed paths, mutant REDs, focused counts, line/branch/function coverage,
acts exercised, timer assertions, selector checks, clean implementation-path evidence, proof limits,
and blockers.

## Validation Receipt

- Tested implementation commit SHA: pending
- Run at (UTC): pending
- Exact command(s): pending
- Result: pending
- Validated paths: pending
- Worktree identity command and result: pending
- Evidence-only diff command and result (if applicable): pending
- Evidence-only worktree-status command and result (if applicable): pending
