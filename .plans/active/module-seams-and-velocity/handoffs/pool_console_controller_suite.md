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

- Tested implementation commit SHA: `596ccb7a468191f083abce02a2e1d9c2a845989f`
- Run at (UTC): `2026-08-23T15:44:16Z`
- Exact command(s):
  - `bun run validation:plan -- --intent qa --changed packages/shared/src/__tests__/hooks/admin-ui/usePoolConsoleController.test.tsx --json`
  - `bunx @biomejs/biome format --no-errors-on-unmatched 'packages/shared/src/__tests__/hooks/admin-ui/usePoolConsoleController.test.tsx'`
  - `bunx @biomejs/biome lint --no-errors-on-unmatched 'packages/shared/src/__tests__/hooks/admin-ui/usePoolConsoleController.test.tsx'`
  - `(cd packages/shared && bun run typecheck:tests)`
  - `(cd packages/shared && bun run test src/__tests__/hooks/admin-ui/usePoolConsoleController.test.tsx)`
  - `bun run --filter @green-goods/shared coverage -- src/__tests__/hooks/admin-ui/usePoolConsoleController.test.tsx --coverage.include=src/hooks/admin-ui/pool/usePoolConsoleController.ts --coverage.reporter=text`
  - `bun run --filter @green-goods/shared typecheck:full`
  - `SOURCE_STRUCTURE_BASE_REF=c00ea6ef64de134379ca6bec1f9c93a4fc31c43a bun run check:source-structure`
  - `node -e '<read the suite and reject as-never, Record-string-unknown, and whole-Shared-barrel mock patterns>'`
  - `git diff --exit-code c00ea6ef64de134379ca6bec1f9c93a4fc31c43a -- packages/shared/src/hooks/admin-ui/pool/usePoolConsoleController.ts`
- Result: selector status `ready`; all four selected checks passed at the integrated availability
  assertion commit. The focused suite passed 11/11; focused V8 coverage was 98.5% statements
  (66/67), 90.9% branches (40/44), 100% functions (25/25), and 100% lines (61/61). Shared source and
  test typechecks passed. The earlier source-structure, static-search, timer-cleanup, and
  production-controller identity evidence remains unchanged because those paths and entrypoints did
  not move after the original receipt.
- Validated paths:
  - `packages/shared/src/__tests__/hooks/admin-ui/usePoolConsoleController.test.tsx`
  - `packages/shared/src/hooks/admin-ui/pool/usePoolConsoleController.ts`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all --
  packages/shared/src/__tests__/hooks/admin-ui/usePoolConsoleController.test.tsx
  packages/shared/src/hooks/admin-ui/pool/usePoolConsoleController.ts` returned no output at the
  tested SHA.
- Evidence-only diff command and result (if applicable): `git diff --exit-code
  596ccb7a468191f083abce02a2e1d9c2a845989f..HEAD --
  packages/shared/src/__tests__/hooks/admin-ui/usePoolConsoleController.test.tsx
  packages/shared/src/hooks/admin-ui/pool/usePoolConsoleController.ts packages/shared/package.json
  packages/shared/vitest.config.ts scripts/dev/node-cli.js scripts/lib/dev-shared.js
  scripts/quality/select-validation.mjs` exited 0 with no output.
- Evidence-only worktree-status command and result (if applicable): `git status
  --porcelain=v1 --untracked-files=all --
  packages/shared/src/__tests__/hooks/admin-ui/usePoolConsoleController.test.tsx
  packages/shared/src/hooks/admin-ui/pool/usePoolConsoleController.ts packages/shared/package.json
  packages/shared/vitest.config.ts scripts/dev/node-cli.js scripts/lib/dev-shared.js
  scripts/quality/select-validation.mjs` returned no output.

## Test-only mutation proof

- Timer condition mutant: changing `if (delay <= 0) return` to `if (delay > 0) return` made the
  focused timer case fail because zero 30-second controller timers were armed instead of one.
- No-pool settings mutant: replacing `requirePool()` with `poolId ?? 0n` made the no-pool case fail
  because `saveSettings` resolved instead of rejecting with `This garden has no commitment pool`.
- Both mutants were reverted immediately. The committed production controller is identical to the
  stacked parent.

## Acceptance evidence

- The suite exercises all 12 typed acts: five pool lifecycle acts, three cycle acts, three claim or
  expiry acts, and `saveSettings`.
- `saveSettings` proves unchanged-value elision, pin then charter then cap ordering, exact payloads,
  and a pin rejection stopping both writes.
- The due-row case starts empty, observes one 30-second controller timer, reveals the due row after
  the timer fires, and observes no second 30-second arm. A separate case proves unmount clears the
  controller timer.
- Real commitment-pooling query hooks consume exact pre-seeded pools, cycles, commitments, and pool
  claims keys. The suite proves pool and dependent loading/error composition plus all four refetch
  readers.

## Selector contract

| Check | Risk | Expected signal | Freshness | Stop rule | Result |
|---|---|---|---|---|---|
| format | Unformatted tracked files produce misleading package failures | Repository formatting is unchanged | exact inputs | stop dependent checks | passed, one file checked |
| lint | Static defects cross package boundaries | Repository lint rules pass | exact inputs | stop dependent checks | passed; Biome reported zero applicable lint files |
| shared test typecheck | Tests and stories violate strict TypeScript | Test and story graph has no errors | exact inputs and toolchain | stop dependent checks | passed |
| shared test | Shared behavior regresses direct consumers | Focused Shared tests pass | exact inputs and toolchain | stop dependent checks | passed 11/11 |

## Proof limits

- This is a test-only lane. It changes no production behavior and makes no browser, integration,
  network, or performance claim.
- Error composition is driven through real React Query cache-state transitions; remote reader
  retry policy is outside this controller boundary.
