# Yield & Split Management UI

**Branch**: `feature/yield-split-ui`
**Status**: ACTIVE
**Created**: 2026-03-16
**Last Updated**: 2026-03-16

## Problem Statement

The contract-side vault strategy autoallocate fix is complete (9/9 E2E tests pass), but the UI only covers the first half of the yield pipeline (deposit → harvest). Operators cannot:

1. **Edit split ratios** — Contract supports `setSplitRatio()` per garden, but no hook or UI exists
2. **Trigger yield distribution** — `splitYield()` is permissionless and `useAllocateYield()` hook exists, but no button surfaces it
3. **See pending/escrowed yield** — Contract tracks `pendingYield` and `escrowedFractions` but neither is displayed
4. **See actual split config** — Both admin `GardenYieldCard` and client `ConvictionDrawer` hardcode `DEFAULT_SPLIT_CONFIG` instead of reading from chain
5. **See strategy health** — No visibility into accountant wiring, auto-allocate status, or Aave deployment
6. **See allocation details** — History shows totals but no per-proposal breakdown or explorer links

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Read split config from chain, not indexer | `getSplitConfig(garden)` is a single-slot read — fast enough for direct on-chain query. No need to add indexer schema for split config. Avoids indexer lag on config changes. |
| 2 | New `useSplitConfig()` hook uses `useReadContract` | Follows `useVaultPreview` pattern. Single contract read, not multicall — `getSplitConfig` returns a struct in one call. |
| 3 | New `useSetSplitRatio()` follows `useAllocateYield` pattern | Same mutation structure: `useContractTxSender`, `createMutationErrorHandler`, toast lifecycle, `queryInvalidation.onSplitRatioUpdated`. |
| 4 | Split editor is a modal, not inline edit | Inline editing 3 coupled numeric fields with validation (sum = 10000 bps) is error-prone. Modal provides a focused form with preview and explicit save. |
| 5 | Split editor shows bps as percentages (2 decimal) | Users think in percentages, not basis points. Convert on display (÷100) and on submit (×100). Validate in bps space (integers, sum = 10000). |
| 6 | "Distribute Yield" button on PositionCard, not GardenYieldCard | Distribution is per-vault (garden+asset+vault), which aligns with PositionCard's scope. GardenYieldCard is on the Community tab — wrong location for vault-specific actions. |
| 7 | Pending/escrowed yield reads use `useReadContracts` multicall | Two separate reads (`pendingYield` + `getEscrowedFractions`) for the same garden+asset — batch them. Follows PositionCard diagnostic reads pattern. |
| 8 | Strategy health panel is a collapsible section in PositionCard | Avoids a new page. Shows accountant, autoAllocate, aToken balance, strategy address. Collapsed by default to keep card compact. |
| 9 | Allocation history links txHash to block explorer | Use existing `getExplorerUrl(chainId, txHash, 'tx')` utility. Simple `<a>` tag with `target="_blank"`. |
| 10 | Phase approach: hooks first, then admin UI, then client sync | Hooks are the foundation. Admin is the primary operator surface. Client gets synced last (lower priority). |
| 11 | Access control for split editor: operator/owner OR protocol owner | Matches contract: `setSplitRatio` checks `_requireOperatorOrOwner(garden)` with protocol owner override. Hook validates on-chain before submitting. |
| 12 | Pending yield display shows progress toward threshold | "3.20 / $7.00 threshold" with a simple progress bar. More actionable than just showing the raw amount. |

## Requirements Coverage

| Requirement | Planned Step | Status |
|-------------|--------------|--------|
| Read split config from chain per garden | Steps 1-2 | ⏳ |
| Edit split ratios (operator/owner) | Steps 3-4 | ⏳ |
| Trigger splitYield from UI | Step 5 | ⏳ |
| Display pending yield with threshold progress | Steps 6-7 | ⏳ |
| Display escrowed fractions amount | Steps 6-7 | ⏳ |
| Link allocation txHash to block explorer | Step 8 | ⏳ |
| Show strategy health diagnostics | Step 9 | ⏳ |
| Client ConvictionDrawer reads real split config | Step 10 | ⏳ |
| i18n for all new strings (en/es/pt) | Step 11 | ⏳ |

## CLAUDE.md Compliance

- [x] ALL hooks in `@green-goods/shared` (Steps 1, 3, 6)
- [x] Barrel exports from shared index (Steps 1, 3, 6)
- [x] i18n for UI strings (Step 11)
- [x] Address type enforcement (all hooks use `Address`)
- [x] No package-specific .env files
- [x] Deployment artifacts for contract addresses (existing `getNetworkContracts`)
- [ ] Validate: `bun format && bun lint && bun run test && bun build`

## Impact Analysis

### Files to Create
- `packages/shared/src/hooks/yield/useSplitConfig.ts` — on-chain split config query
- `packages/shared/src/hooks/yield/useSetSplitRatio.ts` — split ratio mutation
- `packages/shared/src/hooks/yield/useYieldStatus.ts` — pending + escrowed reads
- `packages/admin/src/components/Vault/SplitEditorModal.tsx` — split ratio editor modal
- `packages/admin/src/components/Vault/StrategyHealthPanel.tsx` — collapsible strategy diagnostics

### Files to Modify
- `packages/shared/src/hooks/index.ts` — add new hook exports
- `packages/shared/src/index.ts` — re-export new hooks from barrel
- `packages/shared/src/i18n/en.json` — new yield/split i18n keys
- `packages/shared/src/i18n/es.json` — Spanish translations
- `packages/shared/src/i18n/pt.json` — Portuguese translations
- `packages/admin/src/components/Garden/GardenYieldCard.tsx` — read from chain, add edit button, show pending/escrowed, link txHash
- `packages/admin/src/components/Vault/PositionCard.tsx` — add "Distribute Yield" button, strategy health panel
- `packages/admin/src/components/Vault/index.ts` — export new components
- `packages/client/src/components/Dialogs/ConvictionDrawer.tsx` — read split config from chain

## Test Strategy

- **Unit tests**: Not applicable — hooks are thin wrappers around wagmi/TanStack Query (consistent with existing yield hooks which have zero unit tests)
- **Integration tests**: Manual verification against Arbitrum fork (existing `bun run test:fork` suite covers contract side)
- **Storybook**: `SplitEditorModal.stories.tsx`, `StrategyHealthPanel.stories.tsx` — visual verification of form states, validation, loading/error
- **E2E**: Manual admin flow test: read config → edit → save → verify on-chain → trigger split

## Implementation Steps

### Step 1: `useSplitConfig` hook — read split config from chain
**Files**: `packages/shared/src/hooks/yield/useSplitConfig.ts`
**Details**:
- `useReadContract` calling `YIELD_SPLITTER_ABI.getSplitConfig(gardenAddress)`
- Resolve `yieldSplitter` address via `getNetworkContracts(chainId)`
- Return `{ splitConfig: SplitConfig, isLoading, isError, refetch }`
- When result is all-zeros (unconfigured garden), return `DEFAULT_SPLIT_CONFIG`
- Query key: `queryKeys.yield.splitConfig(gardenAddress, chainId)`
- `staleTime: STALE_TIME_MEDIUM` (consistent with allocation queries)

**Verification**: TypeScript compiles, hook can be imported from `@green-goods/shared`

### Step 2: Wire `useSplitConfig` into GardenYieldCard
**Files**: `packages/admin/src/components/Garden/GardenYieldCard.tsx`, `packages/admin/src/views/Gardens/Garden/CommunityTab.tsx`
**Details**:
- Replace `const splitConfig = DEFAULT_SPLIT_CONFIG` with `useSplitConfig(gardenAddress)`
- Add `gardenAddress: Address` to `GardenYieldCardProps`
- Thread `gardenAddress` from `CommunityTab.tsx` where the card is rendered
- Show loading skeleton for the 3 percentage cards while split config loads

**Verification**: GardenYieldCard shows real on-chain config (or defaults if unconfigured)

### Step 3: `useSetSplitRatio` hook — mutation to update split config
**Files**: `packages/shared/src/hooks/yield/useSetSplitRatio.ts`
**Details**:
- Follow `useAllocateYield` pattern exactly:
  - `useContractTxSender` for transaction
  - `createMutationErrorHandler({ source: "useSetSplitRatio", toastContext: "split ratio update" })`
  - Toast lifecycle: `onMutate` loading → `onSuccess` dismiss + success toast → `onError` dismiss + error handler
  - Invalidate via `queryInvalidation.onSplitRatioUpdated(gardenAddress, chainId)`
  - Schedule follow-up invalidation via `useDelayedInvalidation` (indexer lag)
- Params: `SetSplitRatioParams` (already defined in types)
- Pre-validate: `cookieJarBps + fractionsBps + juiceboxBps === 10000`

**Verification**: TypeScript compiles, hook can be imported from `@green-goods/shared`

### Step 4: SplitEditorModal component + wire into GardenYieldCard
**Files**: `packages/admin/src/components/Vault/SplitEditorModal.tsx`, `packages/admin/src/components/Garden/GardenYieldCard.tsx`, `packages/admin/src/components/Vault/index.ts`
**Details**:
- **SplitEditorModal**:
  - Radix `Dialog.Root` (consistent with DepositModal/WithdrawModal pattern)
  - 3 numeric inputs: Cookie Jar %, Fractions %, Juicebox %
  - Display as percentages (2 decimal, e.g., "48.65"), store as bps integers
  - Live validation: sum must equal 100.00% (10000 bps). Show remaining/excess
  - Preview panel: "After save: 50.0% / 47.3% / 2.7%"
  - Submit button disabled when invalid or unchanged from current
  - Uses `useSetSplitRatio()` for mutation
  - Mobile safe: `max-w-[calc(100vw-2rem)] sm:max-w-md`
- **GardenYieldCard changes**:
  - Add "Edit Split" button (icon: `RiSettings3Line`) next to title — only visible to operators/owners
  - Pass `canEditSplit` prop from CommunityTab (derived from `useGardenPermissions`)
  - Opens SplitEditorModal with current config as initial values

**Verification**: Modal opens, validates input, submits transaction, card updates after success

### Step 5: "Distribute Yield" button on PositionCard
**Files**: `packages/admin/src/components/Vault/PositionCard.tsx`
**Details**:
- Add a "Distribute Yield" button next to the Harvest button (in the `canManage` section)
- Uses existing `useAllocateYield()` hook (already exported from shared)
- Needs `vaultAddress` from the `GardenVault` prop (already available)
- Disabled when `gardenShares == 0` (nothing to distribute) — BUT we don't read this yet, so initially just enable it always and let the contract revert with `NoVaultShares` if empty
- Phase 2 optimization: read `gardenShares(garden, vault)` to conditionally enable

**Verification**: Button visible for managers, calls `splitYield()`, toast on success/error

### Step 6: `useYieldStatus` hook — read pending yield + escrowed fractions
**Files**: `packages/shared/src/hooks/yield/useYieldStatus.ts`
**Details**:
- `useReadContracts` multicall with 2 reads:
  1. `YIELD_SPLITTER_ABI.pendingYield(gardenAddress, assetAddress)` → `uint256`
  2. `YIELD_SPLITTER_ABI.getEscrowedFractions(gardenAddress, assetAddress)` → `uint256`
- Resolve `yieldSplitter` via `getNetworkContracts(chainId)`
- Return `{ pendingYield: bigint, escrowedFractions: bigint, isLoading, isError }`
- Query key: `queryKeys.yield.pendingYield(gardenAddress, assetAddress, chainId)`
- `staleTime: STALE_TIME_SHORT` — these values change on every harvest/split

**Verification**: TypeScript compiles, returns real values on Arbitrum fork

### Step 7: Display pending/escrowed yield in GardenYieldCard
**Files**: `packages/admin/src/components/Garden/GardenYieldCard.tsx`
**Details**:
- Add a new section between the split config and allocation history
- **Pending yield**: Show amount + progress bar toward `MIN_YIELD_THRESHOLD_USD`
  - "2.30 WETH pending (3.20 / $7.00 threshold)" — needs asset context
  - Since GardenYieldCard is per-garden (not per-asset), aggregate across assets or show per-asset rows
  - Decision: show per-asset rows, one for each vault's asset. Requires knowing the garden's vault assets.
  - Accept `vaults: GardenVault[]` prop or `gardenAddress` and use `useGardenVaults` internally
  - Simpler: accept `gardenAddress` and call `useYieldStatus` for each known vault asset (WETH, DAI)
- **Escrowed fractions**: "48.65 WETH escrowed (awaiting conviction pool)" — info callout

**Verification**: Pending and escrowed amounts appear with correct values

### Step 8: Link allocation txHash to block explorer
**Files**: `packages/admin/src/components/Garden/GardenYieldCard.tsx`
**Details**:
- Import `getExplorerUrl` from shared (or build `${explorerBase}/tx/${txHash}`)
- Wrap the total amount or a link icon next to each allocation row with `<a href={explorerUrl} target="_blank" rel="noopener noreferrer">`
- Use `RiExternalLinkLine` icon from Remixicon

**Verification**: Allocation rows link to correct block explorer tx page

### Step 9: Strategy health panel on PositionCard
**Files**: `packages/admin/src/components/Vault/StrategyHealthPanel.tsx`, `packages/admin/src/components/Vault/PositionCard.tsx`
**Details**:
- **StrategyHealthPanel** (collapsible via `useState`):
  - Reads via `useReadContracts` multicall:
    1. `vault.accountant()` → compare to yieldSplitter address
    2. `vault.autoAllocate()` → boolean
    3. `octantModule.vaultStrategies(vault)` → strategy address
    4. `aToken.balanceOf(strategy)` → Aave deployed amount (needs strategy + aToken addresses)
  - Display as 4 status rows:
    - Accountant: ✓ Connected / ✗ Not set (with address)
    - Auto-allocate: ✓ Enabled / ✗ Disabled
    - Strategy: address (truncated) or "None"
    - Aave deployed: amount + asset symbol
  - Only visible to operators/owners (prop: `canManage`)
- **PositionCard**: Add toggle button "Strategy Details" that shows/hides StrategyHealthPanel
- Collapsed by default, renders panel only when expanded (lazy)

**Verification**: Panel shows correct accountant, autoAllocate, strategy address, aToken balance

### Step 10: Client ConvictionDrawer — read split config from chain
**Files**: `packages/client/src/components/Dialogs/ConvictionDrawer.tsx`
**Details**:
- Replace `const splitConfig = DEFAULT_SPLIT_CONFIG` with `useSplitConfig(gardenAddress)`
- The stacked bar chart and percentage labels already use `splitConfig.cookieJarBps / 100` — no format changes needed
- Handle loading state: show skeleton bar while config loads

**Verification**: ConvictionDrawer shows real on-chain split config

### Step 11: i18n keys for all new UI strings
**Files**: `packages/shared/src/i18n/en.json`, `packages/shared/src/i18n/es.json`, `packages/shared/src/i18n/pt.json`
**Details**:
- New keys needed:
  ```
  app.yield.editSplit — "Edit Split"
  app.yield.editSplitTitle — "Edit Yield Split"
  app.yield.editSplitDescription — "Configure how yield is distributed for this garden"
  app.yield.cookieJarPercent — "Cookie Jar %"
  app.yield.fractionsPercent — "Fractions %"
  app.yield.juiceboxPercent — "Juicebox %"
  app.yield.totalMustEqual — "Total must equal 100%"
  app.yield.remaining — "{amount}% remaining"
  app.yield.excess — "{amount}% over 100%"
  app.yield.saveSplit — "Save Split Configuration"
  app.yield.splitSaved — "Split configuration updated"
  app.yield.splitSaving — "Updating split configuration..."
  app.yield.distributeYield — "Distribute Yield"
  app.yield.distributing — "Distributing yield..."
  app.yield.pendingYield — "Pending Yield"
  app.yield.pendingProgress — "{current} of {threshold} threshold"
  app.yield.escrowedFractions — "Escrowed Fractions"
  app.yield.escrowedHelper — "Awaiting conviction pool setup"
  app.yield.strategyDetails — "Strategy Details"
  app.yield.accountant — "Accountant"
  app.yield.accountantConnected — "Connected"
  app.yield.accountantNotSet — "Not configured"
  app.yield.autoAllocate — "Auto-Allocate"
  app.yield.enabled — "Enabled"
  app.yield.disabled — "Disabled"
  app.yield.aaveDeployed — "Deployed to Aave"
  app.yield.strategyAddress — "Strategy"
  app.yield.noStrategy — "No strategy attached"
  ```
- Add corresponding keys to es.json and pt.json (translations)

**Verification**: `bun lint` passes, no missing i18n key warnings

### Step 12: Barrel exports and final wiring
**Files**: `packages/shared/src/hooks/index.ts`, `packages/shared/src/index.ts`
**Details**:
- Add to `packages/shared/src/hooks/index.ts`:
  ```
  export { useSplitConfig } from "./yield/useSplitConfig";
  export { useSetSplitRatio } from "./yield/useSetSplitRatio";
  export { useYieldStatus } from "./yield/useYieldStatus";
  ```
- Verify these are re-exported from `packages/shared/src/index.ts` (the hooks barrel re-exports everything)

**Verification**: `bun build` succeeds, all imports resolve from `@green-goods/shared`

## Validation

- [ ] `bun format` passes
- [ ] `bun lint` passes
- [ ] `bun run test` passes (1391 unit tests)
- [ ] `bun build` succeeds
- [ ] Manual test on Arbitrum fork: read config → edit → save → trigger split
- [ ] Admin GardenYieldCard shows real on-chain config
- [ ] Client ConvictionDrawer shows real on-chain config
- [ ] Split editor validates sum = 100%, submits tx, updates display
- [ ] Distribute Yield button triggers splitYield and shows toast
- [ ] Pending/escrowed yield amounts display correctly
- [ ] Strategy health panel shows correct wiring status
- [ ] Allocation history links to block explorer
