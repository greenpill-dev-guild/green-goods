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

- RED: `bun run --filter @green-goods/shared test --
  src/__tests__/test-utils/controller-fixtures.test.ts` failed 1/1 on the parent with
  `TypeError: poolFixture is not a function`. Removing the story's `as never` casts before adding
  the contracts also exposed three concrete type mismatches: transaction acts returned
  `Promise<string>` instead of `Promise<\`0x${string}\`>`, the available capability was `{}`, and
  the refetch result was inferred too narrowly.
- GREEN: the direct fixture acceptance test passed 2/2; the focused Shared pool set passed 6 files
  and 74/74 tests; the same six unchanged Admin pooling view files passed 65/65.
- Proof limit: `bun run --filter @green-goods/admin typecheck:full` is **BLOCKED**, not passing, by
  untouched Shared declaration-emission portability errors: TS2883 in `config/passkeyServer.ts`,
  `config/pimlico.ts`, `hooks/admin-ui/layout/useCommandPaletteController.ts`, the cookie-jar and
  ENS hooks, and `utils/blockchain/contracts.ts`, plus TS4058 in
  `hooks/admin-ui/hub/useHubStageQueues.ts` and `useHubWorkbenchController.ts`. The accepted
  lane-equivalent proof is the passing Admin source tsconfig, test tsconfig, and 659-test suite.
  The selector also names nonexistent `controller-fixtures.ts`; the direct `.test.ts` command is
  the acceptance proof. This contract-and-fixture lane adds no production coverage floor; the
  dependent controller-suite lanes own direct controller coverage.

## Validation Receipt

- Tested implementation commit SHA: `7266e90786a445b6169dde0dd1c4a85f6633301b`
- Run at (UTC): 2026-08-23T10:37:13Z
- Toolchain/dependencies: Node 22.22.1 and Bun 1.3.14 from the checked-in toolchain path. Validation
  used disposable `node_modules` symlinks into the primary checkout; no dependency was installed
  or changed, and all symlinks were removed before the clean implementation status.
- Exact command(s), risk, signal, freshness, stopping rule, and result:
  - `bun run validation:plan -- --intent qa --changed
    packages/shared/src/hooks/admin-ui/pool/controller.types.ts --changed
    packages/shared/src/__tests__/test-utils/controller-fixtures.ts --changed
    packages/admin/src/views/Garden/Pool/poolStoryControllers.ts` — risk: missing a direct consumer;
    signal: a ready QA plan; freshness: exact implementation SHA and current selector policy; stop:
    do not substitute a lighter plan. Result: ready, routine, with format, lint, Shared source/test
    typechecks, Shared/Client/Admin/Agent tests, Agent typecheck, and ontology selected. Selector
    defect: its focused Shared path is `controller-fixtures.ts`, which is not a test file.
  - `bunx @biomejs/biome format --no-errors-on-unmatched
    'packages/admin/src/views/Garden/Pool/poolStoryControllers.ts'
    'packages/shared/src/__tests__/test-utils/controller-fixtures.ts'
    'packages/shared/src/hooks/admin-ui/pool/controller.types.ts'` and `bun --bun run oxlint
    'packages/admin/src/views/Garden/Pool/poolStoryControllers.ts'
    'packages/shared/src/hooks/admin-ui/pool/controller.types.ts' --deny-warnings` — risk:
    unformatted or statically invalid seams; signal: no format mutation and no lint error;
    freshness: exact SHA; stop: any error blocks dependent proof. Result: both passed.
  - `bun run --filter @green-goods/shared typecheck:full`, `bun run --filter
    @green-goods/admin typecheck:source`, `(cd packages/admin && node
    ../../scripts/dev/node-cli.js tsc --noEmit -p tsconfig.test.json --composite false --incremental
    false)`, and `bun run --filter @green-goods/agent typecheck` — risk: exported contract or
    consumer type drift; signal: all four direct source/test graphs exit zero; freshness: exact SHA
    and toolchain; stop: any lane type error blocks the receipt. Result: all passed. The separate
    Admin composite command is recorded as BLOCKED in the proof limit above; it produced no
    pool-controller or story-controller error.
  - `bun run --filter @green-goods/admin typecheck:full` — risk: declaration-emission drift in the
    Admin composite graph; signal: the build exits zero; freshness: exact SHA and toolchain; stop:
    classify an unrelated environment or inherited graph failure as BLOCKED, never passing. Result:
    BLOCKED by the exact untouched TS2883 and TS4058 files named in the proof limit; the command
    reported no error in this lane's controller, fixture, resolution-hook, or story paths. The
    passing Admin source tsconfig, test tsconfig, and 659-test suite are the parent-approved
    lane-equivalent proof.
  - `bun run --filter @green-goods/shared test --
    src/__tests__/test-utils/controller-fixtures.test.ts` — risk: fixtures or the no-default barrel
    option do not match their contracts; signal: 2/2 tests pass; freshness: exact SHA and direct
    `.test.ts` entrypoint; stop: any deterministic failure blocks the lane. Result: 2/2 passed.
  - `bun run --filter @green-goods/shared test --
    src/__tests__/test-utils/controller-fixtures.test.ts
    src/__tests__/commitment-pooling-hooks.test.tsx
    src/__tests__/commitment-pool-console.test.ts
    src/__tests__/commitments-to-confirm.test.tsx
    src/__tests__/commitment-pool-charter-hook.test.tsx
    src/__tests__/commitment-reasons.test.ts` — risk: hook, selector, or fixture behavior drift;
    signal: every focused file passes; freshness: exact SHA; stop: any deterministic failure blocks
    consumer proof. Result: 6/6 files and 74/74 tests passed.
  - `bun run --filter @green-goods/admin test --
    src/__tests__/views/GardenPool.test.tsx src/__tests__/views/SeedCommitment.test.tsx
    src/__tests__/views/HubConfirm.test.tsx src/__tests__/views/CommitmentDialog.test.tsx
    src/__tests__/views/CommunityPools.test.tsx src/__tests__/views/PoolSetupFlow.test.tsx` — risk:
    typed seams change existing view behavior; signal: the unchanged files pass; freshness: exact
    SHA; stop: any view regression blocks passed status. Result: 6/6 files and 65/65 tests passed.
  - `bun run --filter @green-goods/client test`, `bun run --filter @green-goods/admin test`, and
    `bun run --filter @green-goods/agent test` — risk: shared testing or public seam regression in a
    selected consumer; signal: every package suite exits zero; freshness: exact SHA and dependency
    graph; stop: a deterministic package failure blocks the lane while independent suites finish.
    Result: Client 93 files/865 tests, Admin 94 files/659 tests, and Agent 25 passed files/270 passed
    tests with one explicit skipped file/test.
  - `bun run check:ontology` and `SOURCE_STRUCTURE_BASE_REF=origin/develop bun run
    check:source-structure` — risk: ontology drift or a new oversized source file; signal: all
    ontology guards and source ceilings pass; freshness: exact SHA and current `origin/develop`;
    stop: either failure blocks passed status. Result: ontology passed 50/50 tests plus every guard;
    source structure checked 24 changed non-test files with no violation.
  - `grep -RIn 'as never' packages/shared/src/hooks/admin-ui/pool
    packages/shared/src/hooks/commitment-pooling/usePoolCharter.ts
    packages/shared/src/hooks/commitment-pooling/useCommitmentReason.ts
    packages/shared/src/__tests__/test-utils
    packages/admin/src/views/Garden/Pool/poolStoryControllers.ts` and `grep -RIn
    'Record<string, unknown>' packages/shared/src/hooks/admin-ui/pool
    packages/shared/src/__tests__/test-utils/controller-fixtures.ts
    packages/shared/src/__tests__/test-utils/commitment-pooling-fixtures.ts
    packages/admin/src/views/Garden/Pool/poolStoryControllers.ts` — risk: unsafe casts or controller
    bags survive the seam; signal: zero matches; freshness: exact committed paths; stop: any match
    blocks the lane. Result: zero `as never` in all allowed paths and zero unsafe controller bags.
- Exported contracts: `PoolConsoleController`, `PoolConsoleActs`, `HubConfirmQueueController`,
  `HubConfirmQueueActs`, `CommitmentDialogController`, `CommitmentDialogActs`,
  `PoolCharterResolution`, and `CommitmentReasonResolution`. `can` and `confirmation` use their real
  selector return types. Only the pool-directory barrel changed; the Shared root barrel did not.
- Exported fixtures: `availableCapability`, `poolFixture`, `cycleFixture`, `commitmentFixture`,
  `contributorFixture`, `claimFixture`, `commitmentDetailFixture`, `toConfirmFixture`,
  `poolClaimRowFixture`, `poolConsoleControllerFixture`, `hubConfirmQueueControllerFixture`, and
  `commitmentDialogControllerFixture`.
- Validated paths: `packages/shared/src/hooks/admin-ui/pool/**`, the two named resolution hooks,
  `packages/shared/src/__tests__/test-utils/**`, and
  `packages/admin/src/views/Garden/Pool/poolStoryControllers.ts`.
- Worktree identity/clean command and result: `git rev-parse --show-toplevel && git branch
  --show-current && git rev-parse HEAD && git status --short` returned
  `/private/tmp/gg-wave1-pool-contracts`, `refactor/pool-controller-contracts`,
  `7266e90786a445b6169dde0dd1c4a85f6633301b`, and an empty implementation status after dependency
  symlink removal.
- Evidence-only diff command and result (if applicable): after the evidence commit, `git diff
  --exit-code 7266e90786a445b6169dde0dd1c4a85f6633301b..HEAD -- packages/shared packages/admin` must
  be empty.
- Evidence-only worktree-status command and result (if applicable): after the evidence commit,
  `git status --short` must be empty.
