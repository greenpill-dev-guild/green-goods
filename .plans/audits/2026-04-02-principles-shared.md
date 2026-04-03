# Principles Audit Report - 2026-04-02 (shared)

## Executive Summary
- **Package analyzed**: `packages/shared/src/` (targeted)
- **Mode**: Single-agent
- **Principle groups audited**: SOLID, DRY/KISS/YAGNI/SOC, EDA/ADR/C4, ACID/BASE/CAP
- **Previous audit**: 2026-04-02 (full codebase)

### Scorecard

| Principle | Score | Top Issue | Effort |
|-----------|-------|-----------|--------|
| S (SRP) | GREEN | JobQueue refactored to 548 LOC; IPFS split into 5 files; Auth split into state/actions | -- |
| O (OCP) | GREEN | Factory pattern in transactions; single harmless switch in useWorkForm | -- |
| L (LSP) | GREEN | TransactionSender implementations substitutable; mock parity confirmed | -- |
| I (ISP) | YELLOW | Barrel export `index.ts` (928 LOC) still exposes 160+ symbols; no sub-path exports | M |
| D (DIP) | GREEN | Hooks depend on abstractions; deployment artifacts used; no hardcoded addresses | -- |
| DRY | YELLOW | 17 mutation hooks use deprecated fixed-delay invalidation; progressive version exists but only 1 hook migrated | S |
| KISS | GREEN | useMintHypercert refactored to 348 LOC with extracted service actors | -- |
| YAGNI | GREEN | No dead exports found; stub handlers intentionally minimal | -- |
| SOC | GREEN | Auth provider split into AuthStateContext + AuthActionsContext; hook boundary clean in shared | -- |
| EDA | GREEN | JobQueueEventBus typed; listener cleanup handled; scheduler yields between jobs | -- |
| ADR | GREEN | 8 ADRs created covering all major architectural decisions | -- |
| C4 | GREEN | MODULES.md provides comprehensive L3 component map | -- |
| ACID | GREEN | IndexedDB writes use atomic transactions with abort-on-failure | -- |
| BASE | GREEN | Optimistic updates with rollback; progressive invalidation infrastructure built | -- |
| CAP | GREEN | Stale-time tiers model AP indexer; progressive invalidation addresses lag | -- |

---

## Previous Findings Status

_Tracked from: 2026-04-02 full codebase audit_

| ID | Finding | Status | Notes |
|----|---------|--------|-------|
| S1 | JobQueue 916 LOC SRP violation | FIXED | Refactored to 548 LOC; executors (120 LOC), analytics (189 LOC), maintenance (152 LOC) extracted |
| S2 | Auth provider monolithic 620 LOC | FIXED | Split into AuthStateContext + AuthActionsContext at line 113-114; computed values memoized |
| S3 | IPFS module 871 LOC mixes concerns | FIXED | Split into ipfs/client.ts (298), upload.ts (257), resolve.ts (276), pinata.ts (201) |
| I1 | Fat barrel export 912 LOC | STILL OPEN (cycle 2) | Now 928 LOC. No sub-path exports added to package.json |
| KISS1 | useMintHypercert 641 LOC | FIXED | Refactored to 348 LOC; service actors extracted to ./services/ |
| ADR1 | Zero ADRs exist | FIXED | 8 ADRs created in .plans/adr/ covering all major decisions |
| C4-1 | L3 module docs missing | FIXED | MODULES.md created with comprehensive module map |
| CAP1 | Fixed 2s indexer lag | PARTIALLY FIXED | Progressive invalidation infrastructure built; only 1 of 18 hooks migrated |

---

## Findings by Principle

### SOLID

#### I1. Fat barrel export surface (cycle 2) -- HIGH

- **Principle**: ISP
- **File**: `packages/shared/src/index.ts:1-928`
- **Issue**: The barrel export now totals 928 LOC (up from 912) with approximately 170+ type exports, 120+ value exports, and 60+ component exports. All consumers parse this entire surface for any single import. The file itself notes "re-export via subpath import recommended" for providers, stores, and workflows (lines 541, 561, 925), but no sub-path exports are configured in `package.json`.
- **Evidence**: Lines 541, 561, 925 contain comments recommending subpath imports but `package.json` has no `exports` field with subpaths.
- **Recommendation**: Add `exports` field to `package.json` with sub-path entries for `@green-goods/shared/hooks`, `@green-goods/shared/components`, `@green-goods/shared/config`, `@green-goods/shared/providers`, `@green-goods/shared/stores`, `@green-goods/shared/workflows`. Keep the root barrel for backward compatibility.
- **Escalation**: Cycle 2. Escalate to HIGH per the 3-cycle rule if not addressed by next audit.

### Code Quality (DRY / KISS / YAGNI / SOC)

#### DRY1. Deprecated fixed-delay invalidation not migrated -- HIGH

- **Principle**: DRY
- **File**: 17 hooks across `hooks/vault/`, `hooks/work/`, `hooks/conviction/`, `hooks/cookie-jar/`, `hooks/garden/`, `hooks/yield/`
- **Issue**: `INDEXER_LAG_FOLLOWUP_MS` (2000ms fixed delay) is marked `@deprecated` at `hooks/query-keys.ts:48`, with `INDEXER_LAG_SCHEDULE_MS` (progressive 2s/5s/15s) as the replacement. The progressive infrastructure (`scheduleProgressiveInvalidation`, `useProgressiveInvalidation`) is fully built and exported. However, only 1 of 18 mutation hooks (`useSetDecay`) has been migrated. The remaining 17 still use the deprecated single-shot 2s delay.
- **Evidence**: `useSetDecay.ts` uses `useProgressiveInvalidation` + `INDEXER_LAG_SCHEDULE_MS`. All other mutation hooks (useVaultDeposit, useVaultWithdraw, useHarvest, useEmergencyPause, useWorkMutation, useWorkApproval, useBatchWorkApproval, useCookieJarDeposit, useCookieJarWithdraw, useCookieJarAdmin x5, useCreateGardenWorkflow, useSetPointsPerVoter, useSetRoleHatIds, useRegisterHypercert, useDeregisterHypercert, useAllocateHypercertSupport, useSetConvictionStrategies, useCreateGardenPools, useAllocateYield) still import `INDEXER_LAG_FOLLOWUP_MS`.
- **Recommendation**: Batch-migrate all 17 hooks: replace `useDelayedInvalidation` with `useProgressiveInvalidation`, replace `INDEXER_LAG_FOLLOWUP_MS` with `INDEXER_LAG_SCHEDULE_MS`. Each migration is a 3-line change per hook. Remove the deprecated export once all consumers are migrated.

#### DRY2. Mutation boilerplate pattern repeated across hooks -- MEDIUM

- **Principle**: DRY
- **File**: `hooks/vault/useVaultOperations.ts`, `hooks/work/useWorkMutation.ts`, `hooks/work/useWorkApproval.ts`, `hooks/cookie-jar/useCookieJarDeposit.ts`, `hooks/work/useBatchWorkApproval.ts`
- **Issue**: Five hooks repeat an identical 15-line tail pattern: `useMutationLock`, `useBeforeUnloadWhilePending`, a `useCallback` wrapper for `mutateAsync` that calls `runWithLock`, and a `mutate` wrapper that discards the promise. The pattern appears verbatim in each file.
- **Evidence**: Compare `useVaultDeposit` lines 396-412 with `useWorkApproval` lines 530-546 -- identical structure. `useVaultOperations.ts` repeats this 5 times (once per vault operation hook).
- **Recommendation**: Extract a `useSafeMutation(mutation, lockKey?)` utility that wraps `useMutationLock` + `useBeforeUnloadWhilePending` + the mutate/mutateAsync callbacks. Each hook call site reduces from 15 lines to 1. This also prevents future drift if the pattern needs to evolve.

### Architecture (EDA / ADR / C4)

No new findings. All previous findings (ADR1, C4-1) are FIXED.

### Data (ACID / BASE / CAP)

#### CAP1. Progressive invalidation infrastructure built but not deployed (cycle 2) -- MEDIUM

- **Principle**: CAP (via BASE)
- **File**: `hooks/query-keys.ts:48-66`
- **Issue**: The progressive invalidation system (`INDEXER_LAG_SCHEDULE_MS = [2_000, 5_000, 15_000]`) correctly models eventual consistency under variable indexer lag. However, 17 of 18 mutation hooks still use the deprecated fixed 2s delay. Under heavy indexer load or slow block times, the 2s delay may be insufficient, causing stale reads after mutations.
- **Evidence**: Same as DRY1 -- progressive infrastructure exists but is not deployed. Only `useSetDecay` has been migrated.
- **Recommendation**: Same as DRY1. This is the same finding viewed through the CAP lens. Migrating the hooks fixes both the DRY violation and the CAP concern simultaneously.
- **Escalation**: Cycle 2 (was CAP1/LOW in previous audit, now MEDIUM due to progressive fix existing but not deployed).

---

## Priority Queue

Top fixes ordered by severity and effort:

1. **Migrate 17 hooks to progressive invalidation** -- DRY/CAP -- 17 hooks across shared -- Effort: S (mechanical 3-line change per hook)
2. **Add sub-path exports to shared package.json** -- ISP -- `packages/shared/package.json` + `packages/shared/src/index.ts` -- Effort: M
3. **Extract useSafeMutation utility** -- DRY -- `hooks/utils/useSafeMutation.ts` -- Effort: S

---

## Trend (last N audits)

| Principle | 2026-04-02 (full) | 2026-04-02 (shared) | Direction |
|-----------|-------------------|---------------------|-----------|
| S (SRP) | YELLOW | GREEN | Improved (3 findings fixed) |
| O (OCP) | GREEN | GREEN | Stable |
| L (LSP) | GREEN | GREEN | Stable |
| I (ISP) | YELLOW | YELLOW | Unchanged (cycle 2) |
| D (DIP) | GREEN | GREEN | Stable |
| DRY | GREEN | YELLOW | Regressed (new findings from deeper analysis) |
| KISS | YELLOW | GREEN | Improved (useMintHypercert fixed) |
| YAGNI | GREEN | GREEN | Stable |
| SOC | YELLOW | GREEN | Improved (Auth split, SOC3/SOC4 were client/admin) |
| EDA | GREEN | GREEN | Stable |
| ADR | RED | GREEN | Improved (8 ADRs created) |
| C4 | YELLOW | GREEN | Improved (MODULES.md created) |
| ACID | GREEN | GREEN | Stable |
| BASE | GREEN | GREEN | Stable |
| CAP | GREEN | GREEN | Stable (finding is MEDIUM, not RED) |

---

## Next Steps

> **This audit is read-only.** To apply fixes, reply with:
> - `fix critical` -- address HIGH findings (I1, DRY1)
> - `fix all` -- address all findings by priority
> - `fix DRY1` -- migrate deprecated invalidation hooks
> - `fix I1` -- add sub-path exports
> - `fix DRY2` -- extract useSafeMutation utility
