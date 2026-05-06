# Principles Audit Report - 2026-04-15

## Executive Summary
- **Packages analyzed**: shared, contracts, client, admin, indexer, agent
- **Mode**: Single-agent
- **Principle groups audited**: SOLID, DRY/KISS/YAGNI/SOC, EDA/ADR/C4, ACID/BASE/CAP
- **Previous audit**: 2026-04-03 (9 findings, 6 known issues)

### Scorecard

| Principle | Score | Top Issue | Effort |
|-----------|-------|-----------|--------|
| S (SRP) | YELLOW | Admin Hub view (1376 LOC) handles 4 pipeline stages, sheet orchestration, route resolution, search/filter, and rendering | L |
| O (OCP) | GREEN | TransactionSender factory + SDK constant lookup patterns are extensible | -- |
| L (LSP) | GREEN | TransactionSender implementations remain substitutable | -- |
| I (ISP) | GREEN | Sub-path exports added to package.json; barrel (1013 LOC) retained for backward compat | -- |
| D (DIP) | GREEN | Hooks depend on abstractions; deployment artifacts used; SDK constants for contract resolution | -- |
| DRY | YELLOW | `useMediaQuery` duplicated identically in admin Hub and CanvasLayout; not in shared | S |
| KISS | GREEN | Previous useMintHypercert resolved; no new over-engineering found | -- |
| YAGNI | YELLOW | `setupWakeLockVisibilityHandler` still empty; `INDEXER_LAG_FOLLOWUP_MS` still deprecated+exported+tested | S |
| SOC | YELLOW | Hub view contains pipeline routing, data aggregation, sheet orchestration, and all 4 stage renderers in one file | L |
| EDA | GREEN | JobQueueEventBus typed; listener cleanup handled; progressive invalidation working | -- |
| ADR | GREEN | 20 ADRs in .plans/adr/ (up from 18) | -- |
| C4 | GREEN | MODULES.md added for shared package L3 documentation | -- |
| ACID | GREEN | IndexedDB writes use atomic transactions | -- |
| BASE | GREEN | Progressive invalidation properly handles AP indexer lag | -- |
| CAP | GREEN | Stale-time tiers + progressive invalidation model AP nature of indexer | -- |

---

## Previous Findings Status

_Tracked from: 2026-04-03_

| ID | Finding | Status | Notes |
|----|---------|--------|-------|
| S1 | Indexer shared.ts multi-responsibility (782 LOC) | **FIXED** | Now 3 LOC re-exporting types.ts, constants.ts, helpers.ts |
| S2 | Auth provider monolithic (643 LOC) | **STILL OPEN** | 643 LOC unchanged. Split context types (AuthStateValue/AuthActionsValue) in use but single file remains. |
| I1 | Fat barrel export (932 LOC) | **FIXED** | Sub-path exports added to package.json (components, config, hooks, i18n, modules, providers, stores, types, utils, workflows). Barrel is 1013 LOC but consumers can now use domain sub-paths. |
| YAGNI1 | Dead setupWakeLockVisibilityHandler | **STILL OPEN** | 142 LOC file, handler body still empty. Not exported from main barrel but exported from utils barrel. |
| YAGNI2 | Deprecated INDEXER_LAG_FOLLOWUP_MS | **STILL OPEN** | Still exported from config/query-keys/constants.ts:39, test at query-keys.test.ts:64. |
| SOC1 | WorkDashboard inline data aggregation (730 LOC) | **FIXED** | Down to 503 LOC. Data aggregation extracted to work-dashboard-utils.ts. Hooks (useReviewerWorks, useMyOnlineWorks, useWorkApprovals) properly consumed. |
| SOC2 | useTunnelUrl local in client Hero | INFO | Documented exception, no action needed. |
| SOC3 | useStepConfigs in admin CreateAssessment | INFO | Documented exception, no action needed. |
| C4-1 | L3 module documentation missing | **FIXED** | MODULES.md added with import policy, public entrypoints, and dependency graph. |

---

## Findings by Principle

### SOLID

#### S1. Admin Hub view is a 1376-LOC monolith -- HIGH
- **Principle**: SRP
- **File**: `packages/admin/src/views/Hub/index.tsx:1-1376`
- **Issue**: This single file handles: (1) route resolution and pipeline stage state machine (lines 67-111), (2) a local `useMediaQuery` hook definition (lines 113-126), (3) skeleton and inspector sub-components (lines 128-294), (4) data fetching and aggregation across works/assessments/hypercerts/allocations (lines 296-460), (5) four independent `useMemo` queue computations (pendingWorks, assessmentQueue, certificationQueue, historyEvents -- lines 480-540), (6) sheet orchestration with route sync (lines 564-665), (7) FAB configuration (lines 672-734), and (8) four separate render functions for each pipeline stage (lines 925-1228). These are at least five distinct responsibility groups.
- **Evidence**: The HubView component alone spans lines 296-1376 (1080 LOC). It contains 25+ useState/useMemo/useEffect hooks and 4 render* functions that each constitute a full stage view.
- **Recommendation**: Extract per-stage renderers into separate components (`HubWorkStage`, `HubAssessStage`, `HubCertifyStage`, `HubHistoryStage`). Extract queue computations into a `useHubPipelineData` hook in shared. Extract sheet descriptor resolution into `useHubSheetContent`. The HubView should compose these and render the shell.

#### S2. Auth provider remains monolithic -- LOW (cycle 3)
- **Principle**: SRP
- **File**: `packages/shared/src/providers/Auth.tsx:1-643`
- **Issue**: Still 643 LOC. Split context types (AuthStateValue/AuthActionsValue) are in use with `useAuthState()` and `useAuthActions()` selectors, but the provider file remains a single unit managing XState lifecycle, session restoration, and wagmi bridging.
- **Evidence**: No change from 2026-04-03.
- **Recommendation**: Downgrade priority. The XState machine carries most logic, and the split selectors prevent unnecessary re-renders. The remaining provider is mostly glue. Only act if file grows beyond 700 LOC.

### Code Quality (DRY / KISS / YAGNI / SOC)

#### DRY1. useMediaQuery duplicated in admin -- MEDIUM
- **Principle**: DRY
- **File**: `packages/admin/src/views/Hub/index.tsx:113-126` and `packages/admin/src/components/Layout/CanvasLayout.tsx:48-61`
- **Issue**: Two identical `useMediaQuery` hook implementations exist in the admin package. Both use `window.matchMedia` with event listener cleanup. Shared exports `useContainerQuery` (ResizeObserver-based) and `useIsDarkMode` but no viewport media query hook. The shared `useDebouncedValue` hook exists but is not equivalent.
- **Evidence**: Both functions: `function useMediaQuery(query: string): boolean { ... useState + useEffect + matchMedia ... }` -- identical logic, identical cleanup.
- **Recommendation**: Extract `useMediaQuery` to `packages/shared/src/hooks/ui/useMediaQuery.ts`, export from shared barrel. Update both admin consumers to import from shared. This is a cross-component utility that belongs in shared per the hook boundary rule.

#### YAGNI1. Dead setupWakeLockVisibilityHandler -- LOW (cycle 3)
- **Principle**: YAGNI
- **File**: `packages/shared/src/utils/app/wake-lock.ts:132-142`
- **Issue**: Handler body is still empty (comment-only). Exported from utils/index.ts but NOT from main barrel (not in index.ts). Has no consumers outside the export chain.
- **Evidence**: Lines 135-141: listener body is `// Don't automatically re-acquire - the calling code should manage this`.
- **Recommendation**: Remove function. No barrel export means no external consumer.

#### YAGNI2. Deprecated INDEXER_LAG_FOLLOWUP_MS still exported and tested -- LOW (cycle 3)
- **Principle**: YAGNI
- **File**: `packages/shared/src/config/query-keys/constants.ts:39`
- **Issue**: `INDEXER_LAG_FOLLOWUP_MS = 2000` is marked `@deprecated` but still exported from config/query-keys/index.ts and has a test at query-keys.test.ts:64. The replacement `INDEXER_LAG_SCHEDULE_MS` is in active use.
- **Evidence**: The constant is exported but no consumer uses it (progressive invalidation uses INDEXER_LAG_SCHEDULE_MS).
- **Recommendation**: Remove constant, update config/query-keys/index.ts export, and remove test assertion.

#### SOC1. Hub view mixes 5+ concerns in one file -- HIGH
- **Principle**: SOC
- **File**: `packages/admin/src/views/Hub/index.tsx:1-1376`
- **Issue**: Same file as S1. In addition to SRP, this violates SOC because: (1) route-to-stage resolution logic (application routing) is mixed with (2) data aggregation (domain logic), (3) sheet orchestration (UI infrastructure), and (4) per-stage rendering (presentation). The hook boundary rule requires hooks in shared, yet `useMediaQuery` is defined locally.
- **Evidence**: Local `useMediaQuery` at line 113 violates the hook boundary. Raw `setTimeout` for search debounce at line 324 violates React Patterns Rule 1 (should use `useDebouncedValue` from shared).
- **Recommendation**: See S1 recommendation. Additionally: replace raw setTimeout debounce with `useDebouncedValue` hook from shared, and move `useMediaQuery` to shared.

#### SOC2. Hook boundary violations in admin -- MEDIUM
- **Principle**: SOC (Hook Boundary)
- **File**: `packages/admin/src/views/Hub/index.tsx:113`, `packages/admin/src/components/Layout/CanvasLayout.tsx:48`, `packages/admin/src/views/Gardens/Garden/WorkDetail/index.tsx:38`, `packages/admin/src/components/Hypercerts/HypercertWizard/wizardSteps.ts:6,37`, `packages/admin/src/components/Hypercerts/HypercertWizard/useWizardData.ts:36`
- **Issue**: Six hooks defined in admin rather than shared: `useMediaQuery` (x2), `useResolvedWorkDetail`, `useWizardSteps`, `useValidationMessage`, `useWizardData`. The Hypercert wizard hooks (useWizardData, useWizardSteps, useValidationMessage) are view-specific orchestration hooks. `useResolvedWorkDetail` is a data-fetching hook that composes shared hooks.
- **Evidence**: All call React hooks internally (useState, useEffect, useMemo, or shared hooks like useGardens, useWorks, etc.).
- **Recommendation**: `useMediaQuery` -- move to shared (duplicate code, general utility). `useResolvedWorkDetail` -- consider moving to shared as it composes multiple shared data hooks. The Hypercert wizard hooks are tightly coupled to admin-specific wizard UI; document as exceptions. `useMediaPreview` in client/WorkCard.tsx:73 is single-use and component-scoped -- INFO only.

### Architecture (EDA / ADR / C4)

_No new findings. ADRs at 20 (up from 18). MODULES.md resolves C4-1._

### Data (ACID / BASE / CAP)

_No new findings. Progressive invalidation and stale-time tiers continue working correctly._

---

## Known Issues Update

### KI-001: Hardcoded Hypercert Minter Addresses
- **Previous status**: MONITORED
- **Current status**: MONITORED -- SDK CONSTANTS.DEPLOYMENTS lookup in use. No regression.

### KI-002: WorkDashboard
- **Previous status**: CHRONIC (12 cycles)
- **Current status**: **RESOLVED** -- Down to 503 LOC. Data aggregation extracted to work-dashboard-utils.ts. Hooks properly consumed from shared. No inline query construction remains.

### KI-005: useVaultOperations
- **Previous status**: CHRONIC (8 cycles)
- **Current status**: **RESOLVED** -- Split into re-export facade (6 LOC) with useVaultDeposit, useVaultWithdraw, useHarvest, useEmergencyPause, useEnableAutoAllocate as separate files.

### KI-006: error-tracking
- **Previous status**: CHRONIC (8 cycles)
- **Current status**: **RESOLVED** -- Split into error-breadcrumbs.ts, error-categories.ts, error-events.ts. Original file is now 30-line re-export facade.

### KI-007: TreasuryDrawer
- **Previous status**: CHRONIC (8 cycles)
- **Current status**: **RESOLVED** -- Split into index.tsx (190), TreasuryTabContent.tsx (239), CookieJarCard.tsx (178), MyDepositRow.tsx (157). No single file exceeds 240 LOC.

### KI-008: setInterval Singleton Leak
- **Previous status**: MONITORED
- **Current status**: MONITORED -- JobMaintenance class with startCleanupScheduler/stopCleanupScheduler still in use.

### KI-009: Admin Hub monolith (NEW)
- **Status**: NEW
- **File**: `packages/admin/src/views/Hub/index.tsx:1-1376`
- **Issue**: 1376 LOC view mixing routing, data aggregation, sheet orchestration, and 4 pipeline stage renderers.
- **Risk**: Highest single-file complexity in any frontend package. Exceeds SRP threshold by 4.5x.

---

## Priority Queue

Top fixes ordered by severity x effort:

1. **Extract Hub pipeline stages into sub-components** -- SRP+SOC -- `packages/admin/src/views/Hub/index.tsx` -- Effort: L
2. **Move useMediaQuery to shared** -- DRY+SOC -- `packages/admin/src/views/Hub/index.tsx:113` + `packages/admin/src/components/Layout/CanvasLayout.tsx:48` -- Effort: S
3. **Replace raw setTimeout debounce in Hub with useDebouncedValue** -- SOC -- `packages/admin/src/views/Hub/index.tsx:322-328` -- Effort: S
4. **Move useResolvedWorkDetail to shared** -- SOC -- `packages/admin/src/views/Gardens/Garden/WorkDetail/index.tsx:38` -- Effort: S
5. **Remove dead setupWakeLockVisibilityHandler** -- YAGNI -- `packages/shared/src/utils/app/wake-lock.ts:132-142` -- Effort: S
6. **Remove deprecated INDEXER_LAG_FOLLOWUP_MS** -- YAGNI -- `packages/shared/src/config/query-keys/constants.ts:39` -- Effort: S

---

## Trend (last 3 audits)

| Principle | 2026-04-02 | 2026-04-03 | 2026-04-15 | Delta |
|-----------|-----------|-----------|-----------|-------|
| S (SRP) | YELLOW | YELLOW | YELLOW | = (new top issue: Hub) |
| O (OCP) | GREEN | GREEN | GREEN | = |
| L (LSP) | GREEN | GREEN | GREEN | = |
| I (ISP) | YELLOW | YELLOW | **GREEN** | +1 (sub-path exports added) |
| D (DIP) | GREEN | GREEN | GREEN | = |
| DRY | GREEN | GREEN | **YELLOW** | -1 (useMediaQuery duplication) |
| KISS | YELLOW | GREEN | GREEN | = |
| YAGNI | GREEN | YELLOW | YELLOW | = |
| SOC | YELLOW | YELLOW | YELLOW | = (new top issue: Hub) |
| EDA | GREEN | GREEN | GREEN | = |
| ADR | RED | GREEN | GREEN | = |
| C4 | YELLOW | YELLOW | **GREEN** | +1 (MODULES.md added) |
| ACID | GREEN | GREEN | GREEN | = |
| BASE | GREEN | GREEN | GREEN | = |
| CAP | GREEN | GREEN | GREEN | = |

**Net: +2 principles improved (ISP, C4), 1 regressed (DRY). 4 of 6 chronic known issues resolved (KI-002, KI-005, KI-006, KI-007).**

---

## Next Steps

> **This audit is read-only.** To apply fixes, reply with:
> - `fix critical` -- address HIGH findings (S1/SOC1 Hub refactor)
> - `fix all` -- address all findings by priority
> - `fix DRY1, YAGNI1, YAGNI2` -- quick wins (useMediaQuery + dead code cleanup)
> - `fix S1` -- Hub refactor only
