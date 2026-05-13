# Yield Split Visibility and Operator Presets

**Branch**: `codex/yield-split-ui`
**Status**: ACTIVE
**Created**: 2026-03-16
**Last Updated**: 2026-05-13

## Current State

The current repo already has `useSplitConfig`, `usePendingYield`, and
`useAllocateYield` in `@green-goods/shared`. The stale work is the product and
governance surface: admin/client UI still has hardcoded split displays, no
operator-only `splitYield` action in the current vault flow, and preset editing
cannot safely ship while `setGardenTreasury` is still operator-accessible.

The accepted product model is:

- Protocol Treasury share is fixed and Green Goods governed.
- Operators may eventually adjust only the direct-funding vs hypercert remainder.
- Presets ship after treasury destination permissions are hardened.
- `splitYield` is permissionless onchain but visible only in operator admin for this pass.
- `setGardenTreasury` is not surfaced in UI and is handled inside this hub as Phase 2 contract/protocol hardening.

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Preserve live Protocol Treasury bps in UI writes | `setSplitRatio()` can change all three bps values, but product intent keeps treasury share Green Goods governed. |
| 2 | Preset chips, not a freeform slider/editor | Operators get a safe v1 control without exposing raw contract capability. |
| 3 | Presets live on `/community` Treasury | The split is garden-level policy; per-vault cards should execute distribution, not define policy. |
| 4 | Preset save requires confirmation | Operators see before/after percentages and the fixed Protocol Treasury share before submitting. |
| 5 | `splitYield` lives in `PositionCard` | Distribution is per garden+asset+vault and belongs in the vault workflow. |
| 6 | Client drawer is read-only | End users should see the live split config without mutation controls. |
| 7 | `setGardenTreasury` hardening is Phase 2 inside this hub | The contract exposes treasury destination changes more broadly than product intent; preset editing is gated until this is fixed. |
| 8 | Visibility and operator-only `splitYield` can proceed first | They do not expose treasury destination controls or preset mutation risk. |

## Phase Plan

### Phase 1: Live Visibility and Operator Distribution

- Replace hardcoded `DEFAULT_SPLIT_CONFIG` displays in admin and client with live `useSplitConfig`.
- Keep `/community` Treasury as the garden-level split visibility surface.
- Add operator-only `splitYield` to `/community/treasury/vault` / `PositionCard`.
- Surface pending yield, escrowed yield, loading, error, disabled, and no-op states.
- Keep preset editing controls hidden or disabled with a clear internal gate until Phase 2 passes.

### Phase 2: Contract / Protocol Hardening

- Harden `setGardenTreasury` so garden operators cannot change the Protocol Treasury destination.
- Treat the Protocol Treasury destination as Green Goods/protocol-governed.
- Add RED/GREEN contract tests proving the old operator path is rejected and the protocol-governed path still works.
- Refresh generated ABI/types only if the implementation changes the exposed ABI or type surface.
- Do not add treasury destination UI.

### Phase 3: Guarded Operator Presets

- Add shared preset helpers for Balanced, Direct funding, and Hypercerts.
- Add `useSetOperatorYieldSplit()` that accepts only the guarded preset/direct-funding-vs-hypercert input.
- Preserve the live Protocol Treasury bps and internally call `setSplitRatio()` with final values summing to `10000`.
- Add preset chips and confirmation dialog on `/community` Treasury after Phase 2 passes.
- Keep `ConvictionDrawer` read-only.

## Preset Math

Current accepted defaults use a fixed Protocol Treasury share of `270` bps and
an adjustable remainder of `9730` bps.

| Preset | Direct funding bps | Hypercert bps | Protocol Treasury bps |
|---|---:|---:|---:|
| Balanced | `4865` | `4865` | `270` |
| Direct funding | `7298` | `2432` | `270` |
| Hypercerts | `2433` | `7297` | `270` |

Implementation rule: compute from `10000 - protocolTreasuryBps`, round the direct-funding side deterministically, assign the remainder to hypercerts, and assert the final sum is exactly `10000`.

## Requirements Coverage

| Requirement | Planned Phase | Status |
|-------------|---------------|--------|
| `.plans` reflects current repo truth | Plan update | Complete |
| Lane handoffs exist for Claude/Codex dispatch | Plan update | Complete |
| Admin reads live split config | Phase 1 | Pending |
| Client drawer reads live split config | Phase 1 | Pending |
| Operators can trigger `splitYield` | Phase 1 | Pending |
| Pending and escrowed yield are visible | Phase 1 | Pending |
| Treasury destination is not editable in UI | All phases | Pending |
| `setGardenTreasury` is protocol/governance hardened | Phase 2 | Pending |
| Operators can choose guarded presets | Phase 3 | Blocked on Phase 2 |
| Protocol Treasury bps is preserved | Phase 3 | Pending |
| i18n strings cover all UI copy | Phases 1 and 3 | Pending |

## Impact Analysis

### Files to Create

- `packages/shared/src/hooks/yield/useSetOperatorYieldSplit.ts` - guarded preset mutation and preset helpers
- `packages/shared/src/hooks/yield/useYieldStatus.ts` - per-vault pending, escrowed, and share-status reads
- `packages/admin/src/components/Garden/YieldSplitPresetDialog.tsx` - operator preset confirmation dialog
- Focused shared/admin/client/contract tests for the changed behavior

### Files to Modify

- `packages/contracts/src/resolvers/Yield.sol` - Phase 2 `setGardenTreasury` permission hardening, exact shape confirmed by contract lane
- `packages/contracts/test/unit/YieldSplitter.t.sol` - RED/GREEN coverage for treasury destination permissions
- `packages/shared/src/types/gardens-community.ts` - preset types/helpers as needed
- `packages/shared/src/hooks/index.ts` and `packages/shared/src/index.ts` - public exports
- `packages/shared/src/i18n/{en,es,pt}.json` - direct funding, hypercert, and Protocol Treasury copy
- `packages/admin/src/components/Garden/GardenYieldCard.tsx` - live config and Phase 3 preset entry point
- `packages/admin/src/views/Community/components/CommunityTab.tsx` - current split rail and permission prop
- `packages/admin/src/components/Vault/PositionCard.tsx` - `splitYield`, pending, and escrowed status
- `packages/client/src/components/Dialogs/ConvictionDrawer.tsx` - live read-only split config

## Lane Ownership

| Lane | Owner | Branch | Notes |
|---|---|---|---|
| `ui` | Claude | `claude/ui/yield-split-ui` | Admin/client UI, copy, and component tests |
| `state_api` | Codex | `codex/state-api/yield-split-ui` | Shared hooks, preset helpers, mutation guard, invalidation |
| `contracts` | Codex | `codex/contracts/yield-split-ui` | Phase 2 `setGardenTreasury` hardening with TDD |
| `qa_pass_1` | Claude | `claude/qa-pass-1/yield-split-ui` | UX, copy, and regression review after implementation lanes pass |
| `qa_pass_2` | Codex | `codex/qa-pass-2/yield-split-ui` | Targeted command rerun and plan evidence closeout |

## Linear Sync Requirements

- Update PRD-351 title/body to `Yield Split Visibility and Operator Presets`.
- Ensure the parent body points to `.plans/active/yield-split-ui/`.
- Create or link missing lane issues for `ui`, `state_api`, and `contracts`.
- Ensure lane descriptions include the lane, owner, branch, and handoff paths from `status.json`.
- Confirm the linked `Signal Pool to Yield Wiring` project is still the right active project before keeping the routing there.
- If Linear tools are unavailable, leave `linear.lanes` empty and keep this pending sync requirement recorded in `status.json` history/notes.

## Validation Once Implementation Starts

Plan/project-management validation:

- `node scripts/harness/plan-hub.mjs validate`
- `node scripts/harness/plan-hub.mjs linear-sync --feature yield-split-ui --json`

Contract lane:

- `bun run --cwd packages/contracts test:match test/unit/YieldSplitter.t.sol`
- `bun run --cwd packages/contracts build:abis` if ABI output changes

State/API lane:

- `bun run --cwd packages/shared test src/__tests__/hooks/yield/useSetOperatorYieldSplit.test.ts src/__tests__/hooks/yield/useYieldStatus.test.ts`
- `bun run --cwd packages/shared typecheck`

UI lane:

- `bun run --cwd packages/admin test src/__tests__/components/Garden/GardenYieldCard.yield-split.test.tsx src/__tests__/components/Vault/PositionCard.yield-split.test.tsx`
- `bun run --cwd packages/client test src/__tests__/components/Dialogs/ConvictionDrawer.yield-split.test.tsx`
- `bun run lint:vocab`
- `bun run check:design-tokens`

Closeout:

- `node scripts/harness/plan-hub.mjs validate`
- `node scripts/harness/plan-hub.mjs linear-sync --feature yield-split-ui --json`
- `git status -sb`
