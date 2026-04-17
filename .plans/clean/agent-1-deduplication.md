# Agent 1: Deduplication & DRY Findings

## HIGH-CONFIDENCE (safe to fix)

### 1. Tx Error Formatting Boilerplate (5 instances)
The pattern `classifyTxError` + `formatMessage` for title/message is copy-pasted across 4 modal components:
- `admin/src/components/Work/CookieJarDepositModal.tsx` (lines 86-106)
- `admin/src/components/Work/CookieJarWithdrawModal.tsx` (lines 79-99)
- `admin/src/components/Vault/DepositModal.tsx` (lines 139-159)
- `admin/src/components/Vault/WithdrawModal.tsx` (lines 117-137)

Each has the identical ~20-line block:
```ts
const txErrorView = useMemo(() => classifyTxError(mutation.error), [mutation.error]);
const txErrorTitle = formatMessage({ id: txErrorView.titleKey, ... });
const txErrorMessage = txErrorView.kind === "cancelled" ? ... : ...;
```

**Fix**: Extract a `useTxErrorMessages(error)` hook in shared that returns `{ view, title, message }`.

### 2. TradeHistoryTable Local Duplicates (3 functions)
`admin/src/components/hypercerts/TradeHistoryTable.tsx` defines three local functions that duplicate shared utilities:
- `truncateAddress()` (line 34) -- duplicates `truncateAddress` from `@green-goods/shared` (same 6...4 behavior)
- `formatTimestamp()` (line 25) -- duplicates `formatDate` from `@green-goods/shared` (identical month/day/year formatting when called with `{ month: "short", day: "numeric", year: "numeric" }`)

**Fix**: Replace local functions with shared imports.

### 3. Dead `formatDateRange` in CreateAssessmentSteps/shared.tsx
`admin/src/components/Assessment/CreateAssessmentSteps/shared.tsx` exports `formatDateRange` (line 259) that is never imported anywhere. The shared package's `formatDateRange` in `shared/utils/time.ts` has identical logic.

**Fix**: Remove the dead export.

### 4. Missing `getBlockExplorerTxUrl` Export from Shared Barrel
`shared/src/utils/eas/explorers.ts` exports `getBlockExplorerTxUrl`, `getBlockExplorerAddressUrl`, `getBlockExplorerTokenUrl`. Only the address and token versions are exported from `shared/src/index.ts`. Components in admin manually construct `${blockExplorer}/tx/${txHash}` instead of using the utility.

Affected files constructing tx URLs inline:
- `admin/src/components/hypercerts/TradeHistoryTable.tsx`
- `admin/src/components/hypercerts/steps/MintProgress.tsx`
- `admin/src/components/Vault/VaultEventHistory.tsx`
- `admin/src/views/Gardens/Garden/HypercertDetail.tsx`

**Fix**: Export `getBlockExplorerTxUrl` from shared barrel, then use it in admin components.

## MEDIUM (needs judgment)

### 5. Dialog Overlay/Content Chrome (10 instances)
The Radix Dialog overlay+content class strings are copy-pasted across 10 modal components with slight variations in `max-w-*` and animation durations. A `DialogShell` wrapper component could reduce this, but the variation in max-width and z-index per modal makes this a judgment call.

### 6. Cookie Jar Deposit/Withdraw Modal Structure
`CookieJarDepositModal` and `CookieJarWithdrawModal` share ~70% identical structure (dialog chrome, jar select, amount input, error feedback). However, they differ in: withdraw has purpose field + max button, deposit has min deposit check + wallet balance. Consolidating would create a complex conditional component.

### 7. GardenMetadata getExplorerUrl (address-only)
`admin/src/components/Garden/GardenMetadata.tsx` defines a local `getExplorerUrl` function (line 55) that handles address/token/nft URL construction. This duplicates the shared `getBlockExplorerAddressUrl` and `getBlockExplorerTokenUrl` utilities. However, it also handles an NFT case not covered by shared.

## LOW (risky/unclear)

### 8. Agent formatAddress
`agent/src/handlers/utils.ts` has a local `formatAddress` that duplicates shared logic. But the comment explains this is intentional: the shared package has browser-only dependencies that don't work in the Node.js agent environment.

### 9. Client getStatusColor Wrapper
`client/src/components/Cards/Work/WorkCard.tsx` defines `getStatusColor` (line 72) as a trivial wrapper around `getStatusColors().combined`. Single-use, 2 lines -- not worth extracting.
