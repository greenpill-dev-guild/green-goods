# Audit Report - 2026-02-09

## Branch: `feature/octant-defi-vaults`

## Executive Summary

- **Files analyzed**: ~50 modified/new files across contracts, shared, client, admin, indexer
- **Critical**: 1 | **High**: 8 | **Medium**: 12 | **Low**: 7

The Octant DeFi Vaults feature is well-structured overall. Vault hooks follow correct error handling patterns (`createMutationErrorHandler`), types are well-defined, and the Solidity module uses proper access control. However, there are **systemic barrel import violations** across the codebase, **hardcoded token addresses** in the vault utility layer, and **`string` types used for Ethereum addresses** in component props (Rule #5).

---

## Critical Findings

### C1. Hardcoded Token Addresses in `vaults.ts` Utility
**File**: `packages/shared/src/utils/blockchain/vaults.ts:6-40`
**Severity**: CRITICAL

Two large lookup tables (`ASSET_SYMBOLS_BY_CHAIN`, `ASSET_DECIMALS_BY_CHAIN`) hardcode ERC-20 token addresses across 4 chains. This violates the contract integration rule ("Import deployment artifacts, never hardcode addresses") and will silently fail when new tokens are added or addresses change.

**Recommendation**: Move these to deployment artifacts or fetch dynamically via `IERC20Metadata.symbol()` / `IERC20Metadata.decimals()` (which the Solidity contract already does via `_getAssetSymbol`).

---

## High Severity Findings

### H1. Systemic Barrel Import Violations (Rule #11)
**Severity**: HIGH
**Scope**: 40+ files across `packages/client/src/` and `packages/admin/src/`

Deep imports bypass `@green-goods/shared` barrel exports throughout the codebase. **~183+ violations** across client (~133) and admin (~50+). This is not limited to the vault feature -- it's a pre-existing, codebase-wide pattern that suggests either a deliberate tree-shaking trade-off or an incomplete migration.

**Vault-specific violations**:
- `packages/admin/src/views/Treasury/index.tsx:1` - `@green-goods/shared/hooks`
- `packages/admin/src/views/Treasury/index.tsx:2-7` - `@green-goods/shared/utils`
- `packages/admin/src/views/Gardens/Garden/Vault.tsx:1` - `@green-goods/shared/hooks`
- `packages/admin/src/views/Gardens/Garden/Vault.tsx:2` - `@green-goods/shared/utils`
- `packages/admin/src/components/Vault/PositionCard.tsx:8-14` - `@green-goods/shared/utils`
- `packages/admin/src/components/Vault/DepositModal.tsx:5-7` - `@green-goods/shared/utils`
- `packages/admin/src/components/Vault/VaultEventHistory.tsx:7` - `@green-goods/shared/utils`
- `packages/admin/src/components/Vault/WithdrawModal.tsx:9-13` - `@green-goods/shared/utils`
- `packages/admin/src/components/Vault/DonationAddressConfig.tsx:1-2` - `@green-goods/shared/hooks`, `@green-goods/shared/utils`
- `packages/client/src/components/Dialogs/TreasuryDrawer.tsx:13-19` - `@green-goods/shared/utils`

**Pre-existing violations** (not vault-related): 30+ files with deep imports to `/hooks`, `/utils`, `/components`, `/providers`, `/stores`, `/config`, `/modules`.

### H2. Address Type Violations (Rule #5)
**Severity**: HIGH
**Scope**: All vault component props + data layer

Component interfaces use `string` instead of `Address` for Ethereum addresses:

- `packages/admin/src/components/Vault/PositionCard.tsx:21` - `gardenAddress: string`
- `packages/admin/src/components/Vault/DepositModal.tsx:18` - `gardenAddress: string`
- `packages/admin/src/components/Vault/VaultEventHistory.tsx:12` - `gardenAddress: string`
- `packages/admin/src/components/Vault/WithdrawModal.tsx:23` - `gardenAddress: string`
- `packages/admin/src/components/Vault/DonationAddressConfig.tsx:9` - `gardenAddress: string`
- `packages/client/src/components/Dialogs/TreasuryDrawer.tsx:29` - `gardenAddress: string`
- `packages/shared/src/utils/blockchain/vaults.ts:48` - `assetAddress: string` param
- `packages/shared/src/modules/data/vaults.ts:217,252,290` - `gardenAddress: string` params

This causes frequent `as \`0x${string}\`` casts throughout the code (e.g., `TreasuryDrawer.tsx:71-76`, `DepositModal.tsx:79-83`, `PositionCard.tsx:56-57`).

### H3. Excessive `as` Type Assertions in Vault Operations
**Severity**: HIGH
**Scope**: Vault component files

All vault components rely heavily on unsafe type casts:
- `as \`0x${string}\`` appears 20+ times across vault files
- `as unknown as Abi` appears 8 times in `useVaultOperations.ts`

These hide potential type mismatches and undermine TypeScript's safety guarantees.

### H4. Duplicate `ZERO_ADDRESS` Constants
**Severity**: HIGH
**Scope**: 3 files

`ZERO_ADDRESS` is defined independently in:
1. `packages/shared/src/utils/blockchain/vaults.ts:4`
2. `packages/shared/src/hooks/vault/useVaultPreview.ts:7`
3. `packages/shared/src/hooks/vault/useVaultOperations.ts:27`

Should be a single export from `@green-goods/shared`.

### H5. Solidity: Partial Observability in `emergencyPause`
**File**: `packages/contracts/src/modules/Octant.sol:186-198`
**Severity**: HIGH → **MEDIUM** (revised: `StrategyShutdownFailed` event exists)

```solidity
try IOctantStrategy(strategy).shutdown() { } catch {
    emit StrategyShutdownFailed(garden, asset, strategy);
}
emit EmergencyPaused(garden, asset, msg.sender);
```

The emergency pause emits `StrategyShutdownFailed(garden, asset, strategy)` when `strategy.shutdown()` fails, providing observability. However, the `EmergencyPaused` event is always emitted regardless of shutdown success, which could mislead UIs into showing a "paused" state when the strategy is still active. The catch block also discards the error reason bytes.

**Recommendation**: Include error reason bytes in the `StrategyShutdownFailed` event (e.g., `StrategyShutdownFailed(garden, asset, strategy, bytes reason)`) and/or add a `bool shutdownSucceeded` field to `EmergencyPaused` so UIs can distinguish the two states.

### H6. `console.warn/error` in Production Code (Rule #12)
**Severity**: HIGH
**Scope**: 25+ instances in `packages/shared/src/`

Key offenders:
- `packages/shared/src/utils/storage/form.ts:10,19,28` - `console.warn` in form draft storage
- `packages/shared/src/modules/job-queue/index.ts:165,177,221,447,460,805,812` - `console.warn` in job queue
- `packages/shared/src/hooks/utils/useAsyncEffect.ts:111,194` - `console.error` in utility hooks
- `packages/shared/src/workflows/authMachine.ts:540` - `console.warn` in auth machine
- `packages/shared/src/workflows/authServices.ts:216` - `console.error` in auth services
- `packages/shared/src/config/appkit.ts:85` - `console.warn` in config
- `packages/shared/src/components/Toast/toast.service.tsx:363,370` - `console.error` in toast

All should use the `logger` service.

---

## Medium Severity Findings

### M1. Missing Error Handling in `onDeposit`/`onWithdraw` Callbacks
**File**: `packages/client/src/components/Dialogs/TreasuryDrawer.tsx:67-80,202-214`
**Severity**: MEDIUM

The `onDeposit` and `onWithdraw` async handlers use `mutateAsync` but have no try/catch wrapper. While the mutation's `onError` callback handles the error, if `mutateAsync` throws, the promise rejection propagates to the component.

### M2. `useGardenVaults` Called with `undefined` Garden Address
**File**: `packages/admin/src/views/Treasury/index.tsx:17`
**Severity**: MEDIUM

```typescript
const { vaults, isLoading: vaultsLoading } = useGardenVaults(undefined, { enabled: true });
```

This fetches ALL vaults across ALL gardens. If the query isn't designed for this (no garden filter), it could return incomplete data or cause performance issues with many gardens.

### M3. Solidity: Unbounded Loop in `supportedAssetList`
**File**: `packages/contracts/src/modules/Octant.sol:146-163,203-213,371-378`
**Severity**: MEDIUM

Multiple functions iterate over `supportedAssetList` which grows unboundedly. The `_supportedAssetExists` function is O(n) and called during `setSupportedAsset`. If many assets are added over time, gas costs increase linearly.

### M4. Solidity: Multiple Silent `try/catch` Blocks
**File**: `packages/contracts/src/modules/Octant.sol:81-87,102-104,190,212,315,321,329-331,354-358,363-367`
**Severity**: MEDIUM

12 empty `catch` blocks in the contract. While documented as "best-effort" in some cases, this pattern makes debugging extremely difficult and can hide critical failures.

### M5. Manual Form Validation Instead of React Hook Form (Rule #8)
**File**: `packages/admin/src/components/Vault/DonationAddressConfig.tsx:20-23`
**Severity**: MEDIUM

Uses manual `useState` for value, editing state, and error, instead of React Hook Form + Zod schema as required by Rule #8.

### M6. `useGardenVaults` with `undefined` Triggers `getAllGardenVaults`
**File**: `packages/shared/src/hooks/vault/useGardenVaults.ts` (needs verification)
**Severity**: MEDIUM

The query key changes behavior based on whether `gardenAddress` is provided. When `undefined` is passed, it likely fetches all vaults chain-wide, which could be expensive and doesn't match the hook's name semantics.

### M7. `toastService` Import Bypasses Barrel
**File**: `packages/shared/src/hooks/vault/useVaultOperations.ts:6`
**Severity**: MEDIUM

```typescript
import { toastService } from "../../components/toast";
```

Internal shared package imports use relative paths that bypass the barrel. While internal to shared, this creates coupling to file structure.

### M8. Chained `useMemo` in TreasuryDrawer
**File**: `packages/client/src/components/Dialogs/TreasuryDrawer.tsx:46-56`
**Severity**: MEDIUM (Rule #9)

`parsedShares` useMemo depends on `inputError` (output of another useMemo at line 46). These could be combined into a single computation.

---

## Lint Status

**Workspace lint is currently FAILING** (exit code 1):

- **Error**: `packages/client/src/components/Navigation/TopNav.tsx:120` -- `popoverTarget` flagged as unknown property by `eslint-plugin-react(no-unknown-property)`. This is a valid HTML Popover API attribute; likely an oxlint gap. Suppress with inline comment or update config.
- **Warning**: `packages/shared/src/components/Progress/SubmissionProgress.tsx:161` -- `aria-label` uses template literal. False positive (template literals resolve to strings at runtime).

---

## Low Severity Findings

### L1. TODO Comments in Production Code
**Severity**: LOW

- `packages/admin/src/components/Garden/CreateGardenSteps/TeamStep.tsx:21` - Extract hook
- `packages/shared/src/hooks/gardener/useGardenerProfile.ts:127` - Replace with GraphQL query
- `packages/shared/src/modules/data/eas.ts:390` - Pagination
- `packages/client/src/views/Home/WorkDashboard/index.tsx:364` - Scalability concern
- `packages/indexer/src/EventHandlers.ts:1018` - ENS handlers

### L2. `formatTokenAmount` Missing Dynamic Decimals in Event History
**File**: `packages/admin/src/components/Vault/VaultEventHistory.tsx:80-81`
**Severity**: LOW

```typescript
event.amount !== null ? formatTokenAmount(event.amount, 18) : ...
```

Hardcodes 18 decimals for all assets. Should use `getVaultAssetDecimals(event.asset, event.chainId)`.

### L3. `normalizeAddress` Uses Lowercase Cast
**File**: `packages/shared/src/modules/data/vaults.ts:152-154`
**Severity**: LOW

```typescript
function normalizeAddress(address: string): Address {
  return address.toLowerCase() as Address;
}
```

EIP-55 checksum addresses are destroyed by `.toLowerCase()`. While this works for comparison, the checksummed version should be preserved for display.

### L4. Vault Utility Functions Don't Use `Address` Type
**File**: `packages/shared/src/utils/blockchain/vaults.ts:42,47,57`
**Severity**: LOW

Functions `isZeroAddressValue`, `getVaultAssetSymbol`, `getVaultAssetDecimals` accept `string` parameters instead of `Address`.

### L5. No Hook Defined Outside Shared
**Severity**: LOW (positive finding)

The hook boundary rule is respected -- no hooks are defined in client or admin.

---

## Dead Code Analysis

### Potential Dead Code
- `ZERO_ADDRESS` export in `packages/shared/src/utils/blockchain/vaults.ts:4` -- also defined locally in 2 hook files
- `getAllGardenVaults` in `packages/shared/src/modules/data/vaults.ts:234` -- verify if actually used by the `useGardenVaults(undefined)` path

---

## Skill & Configuration Drift

| Reference | Location | Status |
|-----------|----------|--------|
| `useTimeout` | architectural-rules.md | OK |
| `useDelayedInvalidation` | architectural-rules.md | OK |
| `useEventListener` | architectural-rules.md | OK |
| `useWindowEvent` | architectural-rules.md | OK |
| `useDocumentEvent` | architectural-rules.md | OK |
| `useAsyncEffect` | architectural-rules.md | OK |
| `useAsyncSetup` | architectural-rules.md | OK |
| `useOnlineStatus` | data-layer SKILL.md | **DRIFT** - not exported from shared |
| `useServiceWorkerUpdate` | data-layer SKILL.md | OK |
| `useJobQueue` | data-layer SKILL.md | OK |
| `parseContractError` | error-handling SKILL.md | OK |
| `createMutationErrorHandler` | error-handling SKILL.md | OK |
| `logger` | shared | OK |
| `toastService` | shared | OK |
| `eventBus` | skills | **DRIFT** - not exported from shared |
| `Address` type | shared | OK |
| All domain types | shared | OK |

### Provider Nesting Order (Rule #13) Drift
**Documented**: `WagmiProvider > QueryClientProvider > AppKitProvider > AuthProvider > ...`
**Actual (client)**: `AppKitProvider > AuthProvider > AppProvider` (WagmiProvider/QueryClientProvider are internal to AppKitProvider)
**Actual (admin)**: `QueryClientProvider > AppKitProvider > AuthProvider > AppProvider` (no explicit WagmiProvider)

The documented hierarchy is misleading — `WagmiProvider` is bundled inside `AppKitProvider` internally. Documentation should be updated to reflect actual nesting.

### Drift Recommendations
- Remove `useOnlineStatus` references from skill docs or implement the hook
- Remove `eventBus` references from skill docs or implement the utility
- Update Rule #13 provider nesting documentation to reflect that `WagmiProvider` is internal to `AppKitProvider`

---

## Architectural Violations Summary

| Rule | Violation Count | Severity |
|------|----------------|----------|
| Rule #5 (Address Types) | 7+ new files | HIGH |
| Rule #8 (Form Validation) | 1 file | MEDIUM |
| Rule #9 (Chained useMemo) | 1 file | MEDIUM |
| Rule #11 (Barrel Imports) | 40+ files (systemic) | HIGH |
| Rule #12 (Console Cleanup) | 25+ instances | HIGH |
| Hardcoded Addresses | 1 file (vaults.ts) | CRITICAL |

---

## Additional Findings (Deep Review)

### H7. Missing Error Handling in Allowance Check
**File**: `packages/shared/src/hooks/vault/useVaultOperations.ts:92-106`
**Severity**: HIGH

The `useVaultDeposit` mutation reads the ERC-20 allowance with `readContract()` and casts the result to `bigint` without validation. If the read fails (non-standard token, network error), the result could be undefined, and `undefined < params.amount` would cause unexpected behavior in the approval flow.

### H8. Unvalidated `useReadContracts` Results in Preview
**File**: `packages/shared/src/hooks/vault/useVaultPreview.ts:44-56`
**Severity**: HIGH

All five multicall results are destructured and cast to `bigint` without checking `status === 'failure'`. Failed contract reads silently become `0n`, masking real errors from the UI.

### M9. Query Key with Empty String Fallback
**File**: `packages/shared/src/hooks/vault/useVaultDeposits.ts:25-26`
**Severity**: MEDIUM

When `normalizedGarden` is undefined, an empty string `""` is used in the query key. This could cause cache collisions.

### M10. Dead Code: Donation Address Check in `harvest()`
**File**: `packages/contracts/src/modules/Octant.sol:170-181`
**Severity**: MEDIUM

`harvest()` requires a donation address (`NoDonationAddress` revert) but never passes it to `strategy.report()`. The check exists to prevent harvesting before donation is configured, but the donation address itself is unused in the function body — it's set on the strategy separately via `setDonationAddress`. The check is architecturally correct but could be made more explicit.

### M11. Test Mocks Use `as never` Assertions
**File**: `packages/shared/src/__tests__/hooks/vault/useVaultOperations.test.ts:312,317`
**Severity**: MEDIUM

Tests use `as never` to force type mismatches, defeating the purpose of typed tests.

### M12. ABI Type Mismatch Root Cause
**Severity**: MEDIUM

The repeated `as unknown as Abi` pattern (8 instances in `useVaultOperations.ts`) stems from ABI definitions not using `as const` assertions. Fixing the ABI source types would eliminate all double-casts.

### L6. Missing Dynamic Decimals in Event Amount Display
**File**: `packages/admin/src/components/Vault/VaultEventHistory.tsx:80-81`
**Severity**: LOW

`formatTokenAmount(event.amount, 18)` hardcodes 18 decimals. Should use `getVaultAssetDecimals(event.asset, event.chainId)`.

### L7. `normalizeAddress` Destroys EIP-55 Checksums
**File**: `packages/shared/src/modules/data/vaults.ts:152-154`
**Severity**: LOW

`.toLowerCase()` destroys checksum information. Fine for comparison but should preserve checksummed form for display.

---

## Recommendations (Priority Order)

### Fix Before Merge
1. **[CRITICAL]** Replace hardcoded token address lookups with dynamic resolution or deployment artifacts
2. **[HIGH]** Add validation to `readContract` result in `useVaultDeposit` allowance check (H7)
3. **[HIGH]** Check `status === 'failure'` on multicall results in `useVaultPreview` before casting to bigint (H8)
4. **[HIGH]** Fix barrel import violations in all new vault files (`@green-goods/shared/hooks` → `@green-goods/shared`)
5. **[HIGH]** Use `Address` type for all `gardenAddress`/`assetAddress` props in vault components
6. **[HIGH]** Consolidate `ZERO_ADDRESS` into a single shared export
7. **[MEDIUM]** Improve `emergencyPause` observability — include error reason bytes in `StrategyShutdownFailed` event and/or add `shutdownSucceeded` to `EmergencyPaused` (note: `StrategyShutdownFailed` event already exists)

### Short Term
8. **[MEDIUM]** Fix ABI type definitions to use `as const` and eliminate `as unknown as Abi` double-casts
9. **[MEDIUM]** Migrate `DonationAddressConfig` to React Hook Form + Zod
10. **[MEDIUM]** Replace `console.warn/error` with `logger` in shared package (batch fix)
11. **[MEDIUM]** Consider adding a max-length cap for `supportedAssetList` in the Solidity contract
12. **[MEDIUM]** Fix query key empty string fallback in `useVaultDeposits`

### Technical Debt
13. **[LOW]** Use dynamic decimals in `VaultEventHistory` instead of hardcoded `18`
14. **[LOW]** Update skill docs to remove `useOnlineStatus` and `eventBus` references
15. **[LOW]** Update Rule #13 provider nesting documentation to match actual `AppKitProvider` wrapping
16. **[LOW]** Fix `as never` assertions in vault test mocks
