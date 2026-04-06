# Principles Audit Report - 2026-04-03

## Executive Summary
- **Packages analyzed**: shared, contracts, client, admin, indexer, agent
- **Mode**: Single-agent
- **Principle groups audited**: SOLID, DRY/KISS/YAGNI/SOC, EDA/ADR/C4, ACID/BASE/CAP
- **Previous audit**: 2026-04-02 (13 findings)

### Scorecard

| Principle | Score | Top Issue | Effort |
|-----------|-------|-----------|--------|
| S (SRP) | YELLOW | Indexer shared.ts (782 LOC) mixes type definitions, constants, ID helpers, and metadata parsing | M |
| O (OCP) | GREEN | TransactionSender factory + SDK constant lookup patterns are extensible | -- |
| L (LSP) | GREEN | TransactionSender implementations remain substitutable | -- |
| I (ISP) | YELLOW | Barrel export surface (932 LOC, 24 export blocks) still forces all consumers to parse full surface | M |
| D (DIP) | GREEN | Hooks depend on abstractions; deployment artifacts used; SDK constants for contract resolution | -- |
| DRY | GREEN | Minimal cross-package duplication; shared package is canonical | -- |
| KISS | GREEN | useMintHypercert reduced to 348 LOC with services extracted; complexity well-managed | -- |
| YAGNI | YELLOW | setupWakeLockVisibilityHandler registers listener with empty body; deprecated INDEXER_LAG_FOLLOWUP_MS still exported + tested | S |
| SOC | YELLOW | WorkDashboard (730 LOC) still contains inline query construction + data aggregation logic | M |
| EDA | GREEN | JobQueueEventBus typed; listener cleanup handled; progressive invalidation replaces fixed delay | -- |
| ADR | GREEN | 18 ADRs in .plans/adr/ covering all major decisions | -- |
| C4 | YELLOW | L1/L2 clear; L3 module map still absent for shared package | S |
| ACID | GREEN | IndexedDB writes use atomic transactions | -- |
| BASE | GREEN | Progressive invalidation (2s/5s/15s) properly handles AP indexer lag | -- |
| CAP | GREEN | Stale-time tiers + progressive invalidation model AP nature of indexer | -- |

---

## Previous Findings Status

_Tracked from: 2026-04-02_

| ID | Finding | Status | Notes |
|----|---------|--------|-------|
| S1 | JobQueue module exceeds SRP (916 LOC) | **FIXED** | Down to 548 LOC. Job executors, analytics, and maintenance extracted into separate modules. |
| S2 | Auth provider monolithic (620 LOC) | **STILL OPEN** | 643 LOC. Context is now split into AuthStateValue/AuthActionsValue interfaces, but single provider file remains. |
| S3 | IPFS module mixes concerns (871 LOC) | **FIXED** | Split into ipfs/client.ts, ipfs/upload.ts, ipfs/resolve.ts, ipfs/pinata.ts. |
| I1 | Fat barrel export surface (912 LOC) | **STILL OPEN** | 932 LOC (slight increase from new exports). No sub-path exports added to package.json yet. |
| KISS1 | useMintHypercert orchestrates too many concerns (641 LOC) | **FIXED** | Down to 348 LOC. Service actors extracted to ./services/ directory. |
| SOC1 | Client Work view mixes concerns (873 LOC) | **FIXED** | Down to 646 LOC. Approval logic extracted to useWorkApprovalActions hook, metadata to useWorkMetadata. |
| SOC2 | WorkDashboard inline data aggregation (861 LOC) | **PARTIALLY FIXED** | Down to 730 LOC. Hooks extracted (useReviewerWorks, useMyOnlineWorks, useWorkApprovals) but inline query construction and aggregation remain. |
| SOC3 | Hook boundary violations in client Hero | **PARTIALLY FIXED** | useIsDarkMode moved to shared. useTunnelUrl still locally defined (annotated as exception). |
| SOC4 | Hook definitions in admin views | **FIXED** | useDashboardHeader renamed to getDashboardHeader (plain function). useStepConfigs remains as annotated exception. |
| ADR1 | No architecture decision records | **FIXED** | 18 ADRs created in .plans/adr/. |
| C4-1 | L3 module documentation missing | **STILL OPEN** | No module map added for shared package. |
| CAP1 | Fixed-delay invalidation for indexer lag | **FIXED** | Progressive invalidation (2s/5s/15s) implemented via INDEXER_LAG_SCHEDULE_MS + scheduleProgressiveInvalidation. |

---

## Findings by Principle

### SOLID

#### S1. Indexer shared.ts is a multi-responsibility utility file -- MEDIUM
- **Principle**: SRP
- **File**: `packages/indexer/src/handlers/shared.ts:1-782`
- **Issue**: This 782-line file contains: (1) ~30 local type definitions for event args and entities, (2) constant maps (CAPITAL_TYPE_MAP, DOMAIN_TYPE_MAP, etc.), (3) ~20 ID helper functions, (4) entity factory functions (createDefaultGarden, createDefaultGardenVault, createDefaultHypercert), (5) metadata parsing (parseHypercertMetadata, fetchJson), and (6) address normalization utilities. These are at least four distinct responsibility groups.
- **Evidence**: Lines 1-340 are pure type definitions. Lines 342-420 are constant maps. Lines 422-600 are ID and utility functions. Lines 600-782 are metadata parsing and entity factories.
- **Recommendation**: Split into `shared/types.ts` (event args + entity types), `shared/constants.ts` (maps), `shared/ids.ts` (ID helpers), and `shared/metadata.ts` (parsing + fetch). Re-export from `shared/index.ts` for backward compatibility.

#### S2. Auth provider remains monolithic -- MEDIUM (cycle 2)
- **Principle**: SRP
- **File**: `packages/shared/src/providers/Auth.tsx:1-643`
- **Issue**: While the context types are now split into AuthStateValue (read state) and AuthActionsValue (mutations), the provider implementation is still a single 643-LOC file managing XState lifecycle, session restoration, wagmi event bridging, and all auth actions.
- **Evidence**: Lines 62-100 define AuthStateValue with 14 fields. Lines 89-100 define AuthActionsValue with 10 actions. The provider wires all of these together.
- **Recommendation**: The split context pattern is an improvement. Consider extracting the wagmi bridge effects into a separate `useWagmiBridge` hook consumed by the provider. Priority: LOW (the XState machine carries most logic).

#### I1. Fat barrel export remains -- MEDIUM (cycle 2)
- **Principle**: ISP
- **File**: `packages/shared/src/index.ts:1-932`
- **Issue**: The barrel export is now 932 LOC with 24 export blocks. Every consumer still parses the full surface. Sub-path exports in package.json have not been added.
- **Evidence**: Lines 1-119 = component types+exports. Lines 123-147 = config. Lines 151-445 = hook types+exports (largest block). Lines 449-932 = modules, providers, stores, types, utils, workflows.
- **Recommendation**: Add sub-path exports to package.json: `@green-goods/shared/hooks`, `@green-goods/shared/components`, `@green-goods/shared/config`. This is non-breaking (main entry point preserved).

### Code Quality (DRY / KISS / YAGNI / SOC)

#### YAGNI1. Dead code: setupWakeLockVisibilityHandler -- LOW
- **Principle**: YAGNI
- **File**: `packages/shared/src/utils/app/wake-lock.ts:132-142`
- **Issue**: `setupWakeLockVisibilityHandler` registers a `visibilitychange` listener whose handler body is entirely commented out with a note "Don't automatically re-acquire". The function is exported from utils/index.ts but the listener does nothing.
- **Evidence**: Lines 135-141: the listener body contains only a comment and no-op conditional.
- **Recommendation**: Remove the function or implement the re-acquire logic if needed. Currently dead code.

#### YAGNI2. Deprecated constant still exported and tested -- LOW
- **Principle**: YAGNI
- **File**: `packages/shared/src/hooks/query-keys.ts:48-49`
- **Issue**: `INDEXER_LAG_FOLLOWUP_MS` is marked `@deprecated` but still exported from the barrel, re-exported from index.ts, and has a dedicated test assertion.
- **Evidence**: Line 49: `export const INDEXER_LAG_FOLLOWUP_MS = 2000 as const;` with `@deprecated` JSDoc. Test at `__tests__/hooks/query-keys.test.ts:64`.
- **Recommendation**: Search for consumers; if none remain, remove the export and test. If external consumers exist, keep but plan removal in next major.

#### SOC1. WorkDashboard still contains inline data aggregation -- MEDIUM (cycle 2)
- **Principle**: SOC
- **File**: `packages/client/src/views/Home/WorkDashboard/index.tsx:1-730`
- **Issue**: While several hooks have been extracted (useReviewerWorks, useMyOnlineWorks, useWorkApprovals), the component still contains inline useQuery calls (lines 136-146 for offline queue, lines 202-208 and 262-267 for approval fetching), manual deduplication logic (lines 159-175), and complex useMemo chains for filtering (lines 196-294).
- **Evidence**: Lines 136-146: inline useQuery with convertJobsToWorks inside the view. Lines 159-175: manual deduplication and sorting. Lines 224-294: multiple useMemo aggregations.
- **Recommendation**: Extract the offline queue query into a `useOfflineQueueWorks` hook. Extract the review aggregation logic into a `useWorkDashboardAggregation` hook. The component should compose hooks and render.

#### SOC2. useTunnelUrl still local in client Hero -- LOW (cycle 2)
- **Principle**: SOC (Hook Boundary)
- **File**: `packages/client/src/components/Layout/Hero.tsx:30-55`
- **Issue**: `useTunnelUrl` is still defined locally. It has an exception comment. This is a dev-only hook with polling logic.
- **Evidence**: Line 29: `// Exception to hook boundary: dev-only, non-exported, single-use infrastructure`
- **Recommendation**: The exception is documented and pragmatic. Reclassifying to INFO. No action needed.

#### SOC3. useStepConfigs in admin CreateAssessment -- LOW (cycle 2)
- **Principle**: SOC (Hook Boundary)
- **File**: `packages/admin/src/views/Gardens/Garden/CreateAssessment.tsx:33-70`
- **Issue**: `useStepConfigs` is a hook (calls useIntl) defined in the admin view. Documented as exception.
- **Evidence**: Line 32: `// Exception to hook boundary: view-specific i18n config, non-exported, single-use`
- **Recommendation**: The exception is documented. This is a view-specific config hook that wouldn't be reused elsewhere. Reclassifying to INFO. No action needed.

### Architecture (EDA / ADR / C4)

#### C4-1. L3 module documentation still absent in shared -- MEDIUM (cycle 2)
- **Principle**: C4
- **File**: `packages/shared/src/` (absence)
- **Issue**: The shared package (141k LOC) still lacks an inter-module dependency map. With 18 ADRs now covering high-level decisions, the gap is at L3 (component-level) showing how modules/, hooks/, workflows/, providers/, stores/, and utils/ relate.
- **Evidence**: No MODULES.md or C4 L3 diagram found.
- **Recommendation**: Add a `packages/shared/src/MODULES.md` with a dependency graph: config -> modules -> hooks -> providers -> workflows. Include data flow direction.

### Data (ACID / BASE / CAP)

_No new findings. Previous CAP1 (fixed-delay invalidation) is resolved via progressive invalidation._

---

## Known Issues Update

### KI-001: Hardcoded Hypercert Minter Addresses
- **Previous status**: CHRONIC (10 cycles)
- **Current status**: **IMPROVED** -- Fallback map replaced with SDK `CONSTANTS.DEPLOYMENTS` lookup. Sepolia fallback remains but is now sourced from the SDK itself (auto-updates with SDK version).
- **File**: `packages/shared/src/hooks/hypercerts/hypercert-contracts.ts:45-57`
- **Recommendation**: Downgrade to MONITORED. The SDK dependency means addresses update automatically with `@hypercerts-org/sdk` package upgrades. Only risk is SDK version staleness.

### KI-002: WorkDashboard (730 LOC, down from 838)
- **Previous status**: CHRONIC (12 cycles)
- **Current status**: STILL CHRONIC -- improved but still above threshold.
- **Progress**: Hooks extracted (useReviewerWorks, useMyOnlineWorks). Down 108 lines. Inline queries and aggregation remain.

### KI-005: useVaultOperations (664 LOC, down from 801)
- **Previous status**: CHRONIC (8 cycles)
- **Current status**: **IMPROVED** -- down 137 lines to 664 LOC.
- **Recommendation**: Continue monitoring.

### KI-006: error-tracking (753 LOC, unchanged)
- **Previous status**: CHRONIC (8 cycles)
- **Current status**: UNCHANGED
- **Recommendation**: Keep at CHRONIC. Low likelihood of issues.

### KI-007: TreasuryDrawer (728 LOC)
- **Previous status**: CHRONIC (8 cycles)
- **Current status**: UNCHANGED (728 LOC)
- **Recommendation**: Keep at CHRONIC.

### KI-008: setInterval Singleton Leak
- **Previous status**: CHRONIC (10 cycles)
- **Current status**: IMPROVED -- JobQueue now uses dedicated JobMaintenance class with cleanup methods (startCleanupScheduler/stopCleanupScheduler). Still no AbortSignal integration but risk is mitigated.
- **Recommendation**: Downgrade to MONITORED.

---

## Priority Queue

Top fixes ordered by severity x effort:

1. **Split indexer shared.ts into focused modules** -- SRP -- `packages/indexer/src/handlers/shared.ts` -- Effort: M
2. **Add sub-path exports to shared package.json** -- ISP -- `packages/shared/src/index.ts` + `packages/shared/package.json` -- Effort: M
3. **Extract WorkDashboard inline queries/aggregation into hooks** -- SOC -- `packages/client/src/views/Home/WorkDashboard/index.tsx` -- Effort: M
4. **Add L3 module map for shared package** -- C4 -- `packages/shared/src/` -- Effort: S
5. **Remove dead setupWakeLockVisibilityHandler** -- YAGNI -- `packages/shared/src/utils/app/wake-lock.ts` -- Effort: S
6. **Remove deprecated INDEXER_LAG_FOLLOWUP_MS** -- YAGNI -- `packages/shared/src/hooks/query-keys.ts` -- Effort: S

---

## Trend (last 2 audits)

| Principle | 2026-04-02 | 2026-04-03 | Delta |
|-----------|-----------|-----------|-------|
| S (SRP) | YELLOW | YELLOW | = (different top issue) |
| O (OCP) | GREEN | GREEN | = |
| L (LSP) | GREEN | GREEN | = |
| I (ISP) | YELLOW | YELLOW | = |
| D (DIP) | GREEN | GREEN | = |
| DRY | GREEN | GREEN | = |
| KISS | YELLOW | **GREEN** | +1 (useMintHypercert fixed) |
| YAGNI | GREEN | **YELLOW** | -1 (dead code found) |
| SOC | YELLOW | YELLOW | = (improved but not resolved) |
| EDA | GREEN | GREEN | = |
| ADR | **RED** | **GREEN** | +2 (18 ADRs created) |
| C4 | YELLOW | YELLOW | = |
| ACID | GREEN | GREEN | = |
| BASE | GREEN | GREEN | = |
| CAP | GREEN | GREEN | = |

**Net improvement: +2 principles improved, 1 regressed (minor), 5 of 13 previous findings fully resolved.**

---

## Next Steps

> **This audit is read-only.** To apply fixes, reply with:
> - `fix critical` -- address Critical findings only (none this cycle)
> - `fix all` -- address all findings by priority
> - `fix S1, SOC1` -- address specific findings by ID
> - `fix YAGNI1, YAGNI2` -- quick cleanup items
