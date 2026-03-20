# Known Issues Registry

_Last updated: 2026-03-17_
_Source: Seeded from 2026-03-17-audit.md (v2)_

This registry tracks chronic, accepted, deferred, and monitored audit findings across cycles.
It is the single source of truth for long-lived findings that would otherwise bloat each audit report.

## How to Use

- The **audit skill** references this file in Part 0 (Previous Findings Verification) and Part 6 (Report Generation)
- Findings enter this registry when they reach **5+ cycles open**, or when marked ACCEPTED/DEFERRED/MONITORED
- Each entry records: original finding ID, first seen date, current status, monitoring conditions (if MONITORED), and last verified date
- The audit's **Part 9** (Triage & Routing) updates this registry at the end of each cycle

## Status Legend

| Status | Meaning | Escalation |
|--------|---------|------------|
| CHRONIC | Open 5+ cycles, no decision made yet | Continues to escalate |
| ACCEPTED | User decided finding is acceptable as-is | Stops permanently |
| DEFERRED | Fix requires major effort; deferred with rationale | Stops until rationale changes |
| MONITORED | Acknowledged, actively observed with revert conditions | Resets staleness to 1.0 each cycle |
| RESOLVED | Fixed and verified in a subsequent audit | Removed from active tracking |

---

## Chronic Findings

### KI-001: Hardcoded Hypercert Minter Addresses

- **Audit ID**: H1
- **First seen**: ~2026-02-18 (7 cycles)
- **Current status**: CHRONIC
- **Risk score**: 3 (impact) x 1 (likelihood) x 2.0 (staleness) = **6.0**
- **File**: `packages/shared/src/hooks/hypercerts/hypercert-contracts.ts:44-52`
- **Description**: Chain-specific contract addresses hardcoded as fallback map. Silent staleness risk if Hypercerts protocol redeploys. No automated health check or registry comparison exists.
- **Decision needed**: ACCEPT, DEFER, or add CI health check
- **Last verified**: 2026-03-17

### KI-002: God Object — WorkDashboard (861 lines)

- **Audit ID**: H2 (client)
- **First seen**: ~2026-02-01 (9 cycles)
- **Current status**: CHRONIC
- **Risk score**: 2 (impact) x 2 (likelihood) x 2.0 (staleness) = **8.0**
- **File**: `packages/client/src/views/Home/WorkDashboard/index.tsx`
- **Description**: 861 lines with 6+ queries, complex state, tab logic. Escalated from MEDIUM to HIGH at cycle 3.
- **Last verified**: 2026-03-17

### KI-003: God Object — GardenWork (873 lines)

- **Audit ID**: H3 (client)
- **First seen**: ~2026-02-01 (9 cycles)
- **Current status**: CHRONIC
- **Risk score**: 2 (impact) x 2 (likelihood) x 2.0 (staleness) = **8.0**
- **File**: `packages/client/src/views/Home/Garden/Work.tsx`
- **Description**: 873 lines mixing data fetching, approval flow, optimistic updates, and rendering.
- **Last verified**: 2026-03-17

### KI-004: God Object — Deployment View (958 lines)

- **Audit ID**: Architectural Anti-Patterns
- **First seen**: ~2026-02-18 (5 cycles)
- **Current status**: CHRONIC
- **Risk score**: 2 (impact) x 2 (likelihood) x 2.0 (staleness) = **8.0**
- **File**: `packages/admin/src/views/Deployment/index.tsx`
- **Description**: Largest file in codebase at 958 lines. Admin deployment view with complex multi-step deploy flow.
- **Last verified**: 2026-03-17

### KI-005: God Object — useVaultOperations (801 lines)

- **Audit ID**: Architectural Anti-Patterns
- **First seen**: ~2026-02-18 (5 cycles)
- **Current status**: CHRONIC
- **Risk score**: 2 (impact) x 2 (likelihood) x 2.0 (staleness) = **8.0**
- **File**: `packages/shared/src/hooks/vault/useVaultOperations.ts`
- **Description**: 801-line hook handling multiple vault operations (deposit, withdraw, strategy management).
- **Last verified**: 2026-03-17

### KI-006: God Object — error-tracking (753 lines)

- **Audit ID**: Architectural Anti-Patterns
- **First seen**: ~2026-02-18 (5 cycles)
- **Current status**: CHRONIC
- **Risk score**: 2 (impact) x 1 (likelihood) x 2.0 (staleness) = **4.0**
- **File**: `packages/shared/src/modules/app/error-tracking.ts`
- **Description**: Error tracking module with many error type handlers. Lower likelihood since it's mostly additive (new error types append, don't interleave).
- **Last verified**: 2026-03-17

### KI-007: God Object — TreasuryDrawer (728 lines)

- **Audit ID**: Architectural Anti-Patterns
- **First seen**: ~2026-02-18 (5 cycles)
- **Current status**: CHRONIC
- **Risk score**: 2 (impact) x 2 (likelihood) x 2.0 (staleness) = **8.0**
- **File**: `packages/client/src/components/Dialogs/TreasuryDrawer.tsx`
- **Description**: Complex drawer component mixing treasury display, transaction history, and vault interactions.
- **Last verified**: 2026-03-17

### KI-008: setInterval Singleton Leak in Job Queue

- **Audit ID**: M1
- **First seen**: ~2026-02-18 (7 cycles)
- **Current status**: CHRONIC
- **Risk score**: 2 (impact) x 1 (likelihood) x 2.0 (staleness) = **4.0**
- **File**: `packages/shared/src/modules/job-queue/index.ts:872`
- **Description**: `startCleanupScheduler()` guards against double-start but lacks AbortSignal integration. If hot-reloaded during development, old interval leaks. Production risk is minimal (singleton).
- **Recommendation**: DEFER (production singleton, dev-only risk) or add AbortSignal.
- **Last verified**: 2026-03-17

---

## Accepted Findings

_(none yet — populate as user marks findings ACCEPTED)_

---

## Deferred Findings

_(none yet — populate as user marks findings DEFERRED)_

---

## Monitored Findings

_(none yet — populate as user marks findings MONITORED)_

---

## Resolved Findings

| KI-ID | Finding | Resolved Date | Resolved In |
|-------|---------|---------------|-------------|
| _(none yet)_ | | | |
