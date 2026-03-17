# Yield & Split UI — Team Implementation Prompt

> Copy-paste this entire prompt when starting the team session.

---

## Lead Instructions

Create a team to implement the yield & split management UI plan at `.plans/yield-split-ui.todo.md`. This is a `/teams build` execution.

### Team Structure: 2 teammates

**hooks-specialist** (middleware lane)
- Owns: `packages/shared/src/hooks/yield/`, `packages/shared/src/hooks/index.ts`, `packages/shared/src/i18n/*.json`
- Does NOT touch: `packages/admin/`, `packages/client/`, `packages/contracts/`

**ui-specialist** (app lane)
- Owns: `packages/admin/src/components/`, `packages/admin/src/views/`, `packages/client/src/components/Dialogs/ConvictionDrawer.tsx`
- Does NOT touch: `packages/shared/`, `packages/contracts/`

### Dependency Chain

```
hooks-specialist Tasks 1-3 (hooks)
    ↓
hooks-specialist Tasks 4-5 (exports + i18n)  ←  can overlap with ui-specialist Task 3
    ↓
ui-specialist Tasks 1-6 (admin + client UI)
```

ui-specialist Task 3 ("Distribute Yield" button) has NO dependency on new hooks — it uses the existing `useAllocateYield()` hook. Start it immediately while hooks-specialist works.

All other ui-specialist tasks depend on hooks-specialist completing the relevant hook first.

---

## hooks-specialist Spawn Prompt

```
You are implementing 3 new React hooks + barrel exports + i18n keys for the Green Goods yield/split management UI.

Read `.plans/yield-split-ui.todo.md` for the full plan and decision log.

CRITICAL CONTEXT — follow these patterns EXACTLY:

1. **Mutation hook pattern**: Copy `packages/shared/src/hooks/yield/useAllocateYield.ts` exactly.
   It uses: useMutation, useContractTxSender, createMutationErrorHandler, toastService lifecycle,
   useDelayedInvalidation + INDEXER_LAG_FOLLOWUP_MS, queryInvalidation helpers, useRef for last params.

2. **Query hook pattern**: Copy `packages/shared/src/hooks/yield/useYieldAllocations.ts` for indexer queries,
   or use `useReadContract`/`useReadContracts` from wagmi for on-chain reads (like useVaultPreview.ts).

3. **Contract address resolution**: `getNetworkContracts(chainId).yieldSplitter` returns the YieldSplitter address.

4. **ABI**: Import `YIELD_SPLITTER_ABI` from `../../utils/blockchain/abis`. It already includes:
   getSplitConfig, setSplitRatio, pendingYield, getEscrowedFractions, gardenShares.

5. **Types**: Import from `../../types/gardens-community`:
   - `SplitConfig` (cookieJarBps, fractionsBps, juiceboxBps)
   - `SetSplitRatioParams` (gardenAddress, cookieJarBps, fractionsBps, juiceboxBps)
   - `DEFAULT_SPLIT_CONFIG` (4865/4865/270)

6. **Query keys**: Import from `../query-keys`:
   - `queryKeys.yield.splitConfig(gardenAddress, chainId)` — for useSplitConfig
   - `queryKeys.yield.pendingYield(gardenAddress, assetAddress, chainId)` — for useYieldStatus
   - `queryInvalidation.onSplitRatioUpdated(gardenAddress, chainId)` — for useSetSplitRatio
   - `STALE_TIME_MEDIUM` and `STALE_TIME_SHORT` constants

7. **Address type**: Always use `Address` from `../../types/domain`, never `string`.

8. **Normalize addresses**: Use `normalizeAddress()` from `../../utils/blockchain/address` before
   passing to query keys or refs.

YOUR TASKS (in order):

TASK 1: Create `packages/shared/src/hooks/yield/useSplitConfig.ts`
- useReadContract calling getSplitConfig(gardenAddress) on YIELD_SPLITTER_ABI
- When the contract returns all-zeros (sum of bps == 0), return DEFAULT_SPLIT_CONFIG
- Interface: useSplitConfig(gardenAddress?: Address, options?: { enabled?: boolean })
- Return: { splitConfig: SplitConfig, isLoading, isError, refetch }
- Query key: queryKeys.yield.splitConfig(normalizedGarden, chainId)
- staleTime: STALE_TIME_MEDIUM

TASK 2: Create `packages/shared/src/hooks/yield/useSetSplitRatio.ts`
- Follow useAllocateYield.ts structure EXACTLY (same imports, same pattern)
- Pre-validate in mutationFn: cookieJarBps + fractionsBps + juiceboxBps must === 10000
- Contract call: setSplitRatio(gardenAddress, cookieJarBps, fractionsBps, juiceboxBps)
- Toast keys: "app.yield.splitSaving" (onMutate), "app.yield.splitSaved" (onSuccess)
- Invalidate: queryInvalidation.onSplitRatioUpdated(gardenAddress, chainId)
- Schedule follow-up invalidation for indexer lag

TASK 3: Create `packages/shared/src/hooks/yield/useYieldStatus.ts`
- useReadContracts multicall with 2 reads on YIELD_SPLITTER_ABI:
  1. pendingYield(gardenAddress, assetAddress) → uint256
  2. getEscrowedFractions(gardenAddress, assetAddress) → uint256
- Interface: useYieldStatus(gardenAddress?: Address, assetAddress?: Address, options?: { enabled?: boolean })
- Return: { pendingYield: bigint, escrowedFractions: bigint, isLoading, isError }
- Default to 0n when data is unavailable
- staleTime: STALE_TIME_SHORT (these change on every harvest/split)

TASK 4: Add barrel exports
- In `packages/shared/src/hooks/index.ts`, add after the existing yield exports (line ~397):
  export { useSplitConfig } from "./yield/useSplitConfig";
  export { useSetSplitRatio } from "./yield/useSetSplitRatio";
  export { useYieldStatus } from "./yield/useYieldStatus";
- Verify packages/shared/src/index.ts re-exports from hooks/index.ts (it does — wildcard)

TASK 5: Add i18n keys to all 3 locale files
- `packages/shared/src/i18n/en.json` — add these keys (alphabetically in the app.yield section):
  "app.yield.accountant": "Accountant",
  "app.yield.accountantConnected": "Connected",
  "app.yield.accountantNotSet": "Not configured",
  "app.yield.aaveDeployed": "Deployed to Aave",
  "app.yield.autoAllocate": "Auto-Allocate",
  "app.yield.disabled": "Disabled",
  "app.yield.distributeYield": "Distribute Yield",
  "app.yield.distributing": "Distributing yield...",
  "app.yield.editSplit": "Edit Split",
  "app.yield.editSplitDescription": "Configure how yield is distributed for this garden",
  "app.yield.editSplitTitle": "Edit Yield Split",
  "app.yield.enabled": "Enabled",
  "app.yield.escrowedFractions": "Escrowed Fractions",
  "app.yield.escrowedHelper": "Awaiting conviction pool setup",
  "app.yield.excess": "{amount}% over 100%",
  "app.yield.cookieJarPercent": "Cookie Jar %",
  "app.yield.fractionsPercent": "Fractions %",
  "app.yield.juiceboxPercent": "Juicebox %",
  "app.yield.noStrategy": "No strategy attached",
  "app.yield.pendingProgress": "{current} of {threshold} threshold",
  "app.yield.pendingYield": "Pending Yield",
  "app.yield.remaining": "{amount}% remaining",
  "app.yield.saveSplit": "Save Split Configuration",
  "app.yield.splitSaved": "Split configuration updated",
  "app.yield.splitSaving": "Updating split configuration...",
  "app.yield.strategyAddress": "Strategy",
  "app.yield.strategyDetails": "Strategy Details",
  "app.yield.totalMustEqual": "Total must equal 100%"
- `packages/shared/src/i18n/es.json` — add Spanish translations for all keys above
- `packages/shared/src/i18n/pt.json` — add Portuguese translations for all keys above

After all 5 tasks: run `bun format` and `bun lint` in the repo root. Fix any issues.
Message the lead when all tasks are complete.
```

---

## ui-specialist Spawn Prompt

```
You are implementing admin and client UI components for the Green Goods yield/split management UI.

Read `.plans/yield-split-ui.todo.md` for the full plan and decision log.

CRITICAL CONTEXT — follow these patterns EXACTLY:

1. **Component patterns**: Study existing components before writing new ones:
   - Modal: `packages/admin/src/components/Vault/DepositModal.tsx` (Radix Dialog, mobile-safe max-width)
   - Card layout: `packages/admin/src/components/Vault/PositionCard.tsx` (Card, grid, buttons)
   - Form inputs: `packages/admin/src/components/Vault/WithdrawModal.tsx` (FormField, validation, TxInlineFeedback)

2. **UI primitives**: Import from `@/components/ui/` — Button, Card, Alert, FormField, EmptyState
3. **Icons**: Remixicon only (Ri*Line). Import from `@remixicon/react`.
4. **i18n**: ALL user-facing strings via `useIntl().formatMessage({ id: "app.yield.xxx" })`.
5. **Shared imports**: ALWAYS `import { ... } from "@green-goods/shared"`, never deep paths.
6. **Modal safety**: Always `max-w-[calc(100vw-2rem)] sm:max-w-md` on Dialog.Content.
7. **Theme tokens**: Use semantic classes (text-text-strong, bg-bg-white, border-stroke-soft, etc).
8. **Loading states**: Use `skeleton-shimmer` class for loading placeholders.
9. **Permissions**: `useGardenPermissions()` returns `canManageGarden(garden)` and `isOwnerOfGarden(garden)`.

IMPORTANT: Tasks 1, 2, 4 depend on hooks from the hooks-specialist agent.
Task 3 does NOT depend on new hooks — it uses the existing `useAllocateYield()`.
Start with Task 3 immediately, then proceed to Tasks 1, 2, 4, 5, 6 once the
hooks-specialist signals completion.

YOUR TASKS:

TASK 1: Wire useSplitConfig into GardenYieldCard (depends on hooks Task 1)
File: `packages/admin/src/components/Garden/GardenYieldCard.tsx`
Changes:
- Add `gardenAddress: Address` to GardenYieldCardProps
- Replace `const splitConfig = DEFAULT_SPLIT_CONFIG` with:
  const { splitConfig, isLoading: splitConfigLoading } = useSplitConfig(gardenAddress);
- Show skeleton-shimmer for the 3 percentage cards while splitConfigLoading is true
- Import useSplitConfig from "@green-goods/shared"

Also update the parent that renders this component:
File: `packages/admin/src/views/Gardens/Garden/CommunityTab.tsx`
- Pass gardenAddress prop to GardenYieldCard (the garden address is available in CommunityTab)
- Find where GardenYieldCard is rendered (~line 297) and add the prop

TASK 2: SplitEditorModal + wire into GardenYieldCard (depends on hooks Task 2)
File: `packages/admin/src/components/Vault/SplitEditorModal.tsx` (NEW)
- Radix Dialog.Root modal (copy structure from WithdrawModal.tsx)
- Props: isOpen, onClose, gardenAddress: Address, currentConfig: SplitConfig
- 3 numeric inputs (type="number", step="0.01") for Cookie Jar %, Fractions %, Juicebox %
  - Display as percentages (bps / 100), store internally as bps (input * 100)
  - Label each with formatMessage (app.yield.cookieJarPercent, etc.)
- Live validation:
  - Sum of 3 bps values must === 10000
  - Show remaining/excess message: "2.0% remaining" or "1.5% over 100%"
  - Error state (red border) when sum !== 10000
- Preview section: show the 3 values that will be saved
- Submit button: disabled when invalid or unchanged from currentConfig
- Uses useSetSplitRatio() from @green-goods/shared
- On success: close modal (onClose callback)
- TxInlineFeedback for error display (same as WithdrawModal pattern)

File: `packages/admin/src/components/Garden/GardenYieldCard.tsx`
- Add `canEditSplit: boolean` prop
- Add "Edit Split" button (RiSettings3Line icon) next to the title, only if canEditSplit
- Button opens SplitEditorModal with current splitConfig as initial values
- Add useState for modal open state

File: `packages/admin/src/views/Gardens/Garden/CommunityTab.tsx`
- Pass canEditSplit={permissions.canManageGarden(garden)} to GardenYieldCard

File: `packages/admin/src/components/Vault/index.ts`
- Export SplitEditorModal

TASK 3: "Distribute Yield" button on PositionCard (NO dependency on new hooks)
File: `packages/admin/src/components/Vault/PositionCard.tsx`
- Import useAllocateYield from "@green-goods/shared" (already exported)
- Add: const allocateYield = useAllocateYield();
- In the canManage section (after harvest button, before emergency pause):
  Add a "Distribute Yield" button that calls:
  allocateYield.mutate({
    gardenAddress,
    assetAddress: vault.asset,
    vaultAddress: vault.vaultAddress,
  })
- Button text: formatMessage({ id: "app.yield.distributeYield" })
- disabled={allocateYield.isPending}, loading={allocateYield.isPending}
- Place in the existing 2-column grid alongside harvest (making it a 3-button row or 2+1 layout)
  Suggested: keep harvest and distribute on the same row, emergency pause below

TASK 4: Pending/escrowed yield display in GardenYieldCard (depends on hooks Task 3)
File: `packages/admin/src/components/Garden/GardenYieldCard.tsx`
- Add gardenAddress is already a prop from Task 1
- Accept vaults: GardenVault[] prop (or assetAddresses: Address[]) so we know which assets to query
  Simpler: accept assetAddress?: Address and show status for that asset, or just use WETH as default
  Best approach: Accept optional assetAddresses: Address[] prop. For each, call useYieldStatus.
  BUT hooks can't be called in loops. Solution: create a small PendingYieldRow sub-component
  that takes gardenAddress + assetAddress and calls useYieldStatus internally.
- Add a section between split config and allocation history:
  <h4>Pending Yield</h4>
  For each asset: show pending amount + progress bar toward MIN_YIELD_THRESHOLD_USD
  If escrowed > 0: show escrowed amount with helper text "Awaiting conviction pool setup"
- Use bg-bg-weak rounded-lg cards for each row (consistent with allocation history style)

File: `packages/admin/src/views/Gardens/Garden/CommunityTab.tsx`
- Pass the vault asset addresses to GardenYieldCard (use useGardenVaults to get them)

TASK 5: Link allocation txHash to block explorer
File: `packages/admin/src/components/Garden/GardenYieldCard.tsx`
- In the allocation history rows, wrap the total amount or add an external link icon
- Import RiExternalLinkLine from @remixicon/react
- Use getExplorerUrl or construct URL: need chain ID context
  Check if getExplorerUrl exists in shared. If not, construct manually:
  Arbitrum: https://arbiscan.io/tx/{txHash}
  Use the pattern from VaultEventHistory.tsx if it already links to explorer
- Add <a href={url} target="_blank" rel="noopener noreferrer"> with the icon
- Small text, text-text-soft hover:text-primary-base

TASK 6: StrategyHealthPanel on PositionCard
File: `packages/admin/src/components/Vault/StrategyHealthPanel.tsx` (NEW)
Props: vaultAddress: Address, strategyAddress: Address | null, chainId: number, assetSymbol: string
- useReadContracts multicall reading from the vault:
  1. vault.accountant() → address
  2. vault.autoAllocate() → bool
  Import OCTANT_VAULT_ABI from @green-goods/shared (already available)
- Resolve expected accountant: getNetworkContracts(chainId).yieldSplitter
- Display 3 status rows:
  1. Accountant: green checkmark + "Connected" if matches yieldSplitter, red X + "Not configured" otherwise
  2. Auto-Allocate: green "Enabled" / red "Disabled"
  3. Strategy: truncated address or "No strategy attached"
- Use compact layout: small text, status indicators, fits inside a Card
- Skip aToken balance read for now (requires knowing which aToken to query — adds complexity)

File: `packages/admin/src/components/Vault/PositionCard.tsx`
- Add collapsible "Strategy Details" section at bottom of card (only if canManage)
- useState for expanded/collapsed, default collapsed
- Toggle button: text-sm, RiArrowDownSLine / RiArrowUpSLine icon
- When expanded, render <StrategyHealthPanel> with props from vault data
- strategyAddress comes from a new read: need to read octantModule.vaultStrategies(vault)
  Use useReadContract with OCTANT_MODULE_ABI for this single read
  Only query when canManage && expanded (lazy loading)

File: `packages/admin/src/components/Vault/index.ts`
- Export StrategyHealthPanel

TASK 7: Client ConvictionDrawer — read split config from chain (depends on hooks Task 1)
File: `packages/client/src/components/Dialogs/ConvictionDrawer.tsx`
- Replace `const splitConfig = DEFAULT_SPLIT_CONFIG` (~line 223) with:
  const { splitConfig, isLoading: splitConfigLoading } = useSplitConfig(gardenAddress);
- Import useSplitConfig from "@green-goods/shared"
- Handle loading: show skeleton for the stacked bar while splitConfigLoading
- The existing code already uses splitConfig.cookieJarBps etc. — no format changes needed

After all tasks: run `bun format` and `bun lint` in the repo root. Fix any issues.
Message the lead when all tasks are complete.
```

---

## Lead Orchestration Notes

After both teammates complete:
1. Run `bun build` to verify cross-package compilation
2. Run `bun run test` to verify no regressions (1391 unit tests)
3. Spot-check: import new hooks from `@green-goods/shared` in a scratch file to verify barrel exports
4. Review the SplitEditorModal validation logic (sum === 10000 bps)
5. Verify i18n keys are present in all 3 locale files (en/es/pt)
6. Clean up the team
