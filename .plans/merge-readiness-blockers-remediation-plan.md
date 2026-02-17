# Merge Readiness Blockers Remediation Plan

Date: 2026-02-08
Branch: `feature/hats-protocol-v2`

## Objective

Capture the current merge blockers discovered during validation and define a concrete plan to get the branch merge-ready for `develop`.

## Findings

1. Admin test suite is failing and blocks merge.
   - Command: `bun run test` in `packages/admin`
   - Result: `31` failing tests across `2` files.
   - Root cause A:
     - `packages/admin/src/__tests__/components/hypercerts/DistributionConfig.test.tsx`
     - The `vi.mock("@green-goods/shared", ...)` factory does not provide `cn`.
     - Component under test uses `cn` in `packages/admin/src/components/hypercerts/steps/DistributionConfig.tsx`.
   - Root cause B:
     - `packages/admin/src/__tests__/components/MembersModal.test.tsx`
     - Test expects `getByLabelText("Close modal")`.
     - Component label is localized via `app.common.close` and currently resolves to `"Close"` in `packages/admin/src/components/Garden/MembersModal.tsx`.

2. Contracts full test command can fail without local fork RPC.
   - Command: `bun run test` in `packages/contracts`
   - Failure condition: fork tests requiring `http://localhost:8545` when no fork node is running.
   - Observed behavior:
     - `bun run test:fast` passes.
     - Dry-run simulation scripts pass for `sepolia`, `arbitrum`, and `celo`.

3. Requested integration fixes are otherwise validated.
   - Shared coverage: passing.
   - Indexer Node 20 test runner: passing.
   - Contracts pure simulation dry-runs: passing.

## Remediation Tasks

1. Fix `DistributionConfig` test mock shape.
   - Update `packages/admin/src/__tests__/components/hypercerts/DistributionConfig.test.tsx`.
   - Use partial module mock (`importOriginal`) or include `cn` in the `@green-goods/shared` mock.
   - Keep mocks aligned with actual component imports to avoid future drift.

2. Fix `MembersModal` close button assertion.
   - Update `packages/admin/src/__tests__/components/MembersModal.test.tsx`.
   - Assert `getByLabelText("Close")` or use i18n-aware lookup consistent with `app.common.close`.

3. Make contracts validation path explicit for non-fork environments.
   - Either:
     - Run `bun run test:fast` as required local gate, or
     - Start a local fork/anvil before `bun run test`.
   - Document this in the branch handoff to avoid false negatives.

4. Re-run merge gates after fixes.
   - `packages/admin`: `bun run test`
   - `packages/shared`: `bun run coverage`
   - `packages/client`: `bun run test`
   - `packages/indexer`: `bun run test`
   - `packages/contracts`: `bun run test:fast`
   - Contracts dry-runs:
     - `bun run deploy:dry:sepolia`
     - `bun run upgrade:dry:sepolia`
     - `bun run deploy:dry:arbitrum`
     - `bun run upgrade:dry:arbitrum`
     - `bun run deploy:dry:celo`
     - `bun run upgrade:dry:celo`

## Exit Criteria

1. Admin test suite returns zero failures.
2. Shared coverage and indexer tests remain green on Node 20.
3. Contracts `test:fast` and all three-network dry-runs pass.
4. No new regressions introduced in lint/type/test gates.
