# Principles Audit Report — Client Package — 2026-04-02

## Executive Summary
- **Package analyzed**: `packages/client/src/` (targeted)
- **Mode**: Single-agent
- **Principle groups audited**: SOLID, DRY/KISS/YAGNI/SOC, EDA/ADR/C4, ACID/BASE/CAP
- **Previous audit**: 2026-04-02 (full codebase) — client findings SOC1, SOC2, SOC3

### Scorecard

| Principle | Score | Top Issue | Effort |
|-----------|-------|-----------|--------|
| S (SRP) | YELLOW | WorkDashboard (838 LOC) owns data fetching, aggregation, filtering, badge rendering, and UI | M |
| O (OCP) | GREEN | WorkViewSection status handling uses clean if-chain; no switch requiring modification | — |
| L (LSP) | GREEN | No substitutability issues found in client package | — |
| I (ISP) | GREEN | Client imports exactly what it needs from `@green-goods/shared` barrel | — |
| D (DIP) | GREEN | All hook access through shared; deployment artifacts used properly; no hardcoded addresses | — |
| DRY | YELLOW | PendingTab and CompletedTab are structurally identical — 150-line templates differing by 5 strings | S |
| KISS | GREEN | Components are generally straightforward; complex logic lives in shared hooks | — |
| YAGNI | GREEN | No dead exports or unused feature flags found | — |
| SOC | YELLOW | WorkDashboard still contains significant data aggregation logic that belongs in shared | M |
| EDA | GREEN | Event listener cleanup is thorough; jobQueueEventBus subscriptions properly unsubscribed | — |
| ADR | N/A | Package-level — deferred to full-codebase audit | — |
| C4 | GREEN | Clean component hierarchy: views > components > shared hooks. No deep import violations | — |
| ACID | N/A | No direct IndexedDB writes in client; delegated to shared JobQueue | — |
| BASE | GREEN | Offline-first patterns correctly implemented via shared hooks (useOffline, useWorks offline merge) | — |
| CAP | GREEN | Client treats indexer data as AP correctly; no assumptions of strong consistency | — |

---

## Previous Findings Status

_Tracked from: 2026-04-02 full-codebase audit_

| ID | Finding | Status | Notes |
|----|---------|--------|-------|
| SOC1 | Client Work view mixes approval logic, metadata fetching, and rendering | **FIXED** | `useWorkApprovalActions()` and `useWorkMetadata()` hooks now in shared; view is 646 LOC (was 873) and primarily composes hooks + renders |
| SOC2 | Client WorkDashboard contains inline data aggregation | **STILL OPEN** | `fetchApprovalsByRecipients` still called directly in WorkDashboard; data aggregation (operator gardens, reviewer gardens, combined pending) remains in the view |
| SOC3 | Hook boundary violations in client Hero component | **PARTIALLY FIXED** | `useIsDarkMode()` moved to shared; `useTunnelUrl()` remains in Hero.tsx (documented exception at line 23: "dev-only, non-exported, single-use infrastructure") |

---

## Findings by Principle

### SOLID

#### CS1. WorkDashboard remains a data aggregation layer — HIGH

- **Principle**: SRP
- **File**: `packages/client/src/views/Home/WorkDashboard/index.tsx:1-838`
- **Issue**: At 838 LOC, this view component still performs significant business logic: it fetches gardens, determines operator/evaluator garden IDs (with an on-chain multicall at line 165), fetches operator works with online/offline merge and deduplication, fetches approvals from multiple sources, computes combined pending/completed work sets, and renders the UI. The component has 8 `useQuery` calls and 6+ `useMemo` derivations for data aggregation.
- **Evidence**: Lines 134-181 perform a multicall to determine evaluator status. Lines 191-250 fetch operator works with per-garden online/offline merge. Lines 343-409 fetch and aggregate approvals from multiple sources. Lines 357-468 compute filtered work lists.
- **Recommendation**: Extract into shared hooks: `useReviewerGardenIds(address)` (combines operator + evaluator garden detection), `useOperatorWorks(gardenIds)` (online/offline merge), `useWorkDashboardAggregation()` (combines all data sources). The view should compose these and render.

#### CS2. WorkDashboard query key bypasses queryKeys helpers — MEDIUM

- **Principle**: DIP (implicit)
- **File**: `packages/client/src/views/Home/WorkDashboard/index.tsx:404`
- **Issue**: One query uses a raw string array `["approvals", "byMyWorkGardens", activeAddress, [...myWorkGardenIds].sort()]` instead of the `queryKeys.*` helpers used everywhere else in the codebase. This breaks the pattern that all query keys go through the centralized `queryKeys` object, making invalidation harder to trace.
- **Evidence**: Line 404 — all other queries in the same file use `queryKeys.gardens.byChain()`, `queryKeys.operatorWorks.byAddress()`, `queryKeys.queue.uploading()`, etc.
- **Recommendation**: Add `queryKeys.approvals.byMyWorkGardens(address, gardenIds)` to `packages/shared/src/hooks/query-keys.ts` and use it here.

### Code Quality (DRY / KISS / YAGNI / SOC)

#### CD1. PendingTab and CompletedTab are near-identical — MEDIUM

- **Principle**: DRY
- **File**: `packages/client/src/views/Home/WorkDashboard/Pending.tsx` and `packages/client/src/views/Home/WorkDashboard/Completed.tsx`
- **Issue**: These two 155-line files are structurally identical — they share the same loading/error/empty/list rendering template and differ only in 5 i18n message IDs and the empty state emoji. The layout, button styles, spacing, and data flow are copy-pasted.
- **Evidence**: Both files have identical structures: header with count/error, flex-1 overflow area, Loader state, error state with retry, empty state, and MinimalWorkCard list with stagger animation. Diff would show ~140 identical lines.
- **Recommendation**: Extract a shared `WorkListTab` component that accepts: `items`, `isLoading`, `isFetching`, `hasError`, `errorMessage`, `emptyIcon`, `emptyTitle`, `emptyDescription`, `countMessageId`, `onWorkClick`, `onRefresh`, `renderBadges`, `headerContent`. Both Pending and Completed become 10-line wrappers.

#### CD2. Raw setTimeout in Hero component — LOW

- **Principle**: SOC (React Patterns Rule 1)
- **File**: `packages/client/src/components/Layout/Hero.tsx:81,90`
- **Issue**: Two `setTimeout` calls with manual `clearTimeout` cleanup are used for auto-resetting copy success/error states. The codebase rule (`.claude/rules/react-patterns.md` Rule 1) says "Never use raw setTimeout/setInterval in hooks. Use useTimeout()."
- **Evidence**: Lines 79-95 use raw `setTimeout`/`clearTimeout` instead of `useTimeout()` from shared. Both have proper cleanup, so this is not a leak — just a pattern inconsistency.
- **Recommendation**: Replace with `useTimeout()` for consistency. Low priority since cleanup is correct.

#### CD3. Focus trap logic duplicated across WorkDashboard and ModalDrawer — LOW

- **Principle**: DRY
- **File**: `packages/client/src/views/Home/WorkDashboard/index.tsx:101-132` and `packages/client/src/components/Dialogs/ModalDrawer.tsx:66-96`
- **Issue**: The focus trap implementation (Tab/Shift+Tab cycling, close button auto-focus) is duplicated verbatim between WorkDashboard and ModalDrawer. Both use the same querySelector for focusable elements, the same first/last element cycling logic, and the same auto-focus pattern.
- **Evidence**: Lines 101-132 in WorkDashboard and lines 66-96 in ModalDrawer are functionally identical.
- **Recommendation**: Extract a `useFocusTrap(dialogRef)` hook in shared (or use an existing library like `focus-trap-react`). This is INFO-level since the duplication is localized to two files.

### Architecture (EDA / C4)

#### CE1. Event listener cleanup is thorough — POSITIVE

- **Principle**: EDA
- **File**: Multiple client files
- **Evidence**: All `addEventListener` calls have corresponding `removeEventListener` in cleanup functions. `SiteHeader.tsx:41`, `ModalDrawer.tsx:95`, `PullToRefresh.tsx:235-239`, `WorkDashboard/index.tsx:131` — all properly cleaned up. The `jobQueueEventBus.onMultiple` subscription at `WorkDashboard/index.tsx:323-333` returns an unsub function and is properly returned from useEffect.

#### CE2. No deep imports from shared — POSITIVE

- **Principle**: C4 (L4)
- **File**: All client source files
- **Evidence**: Grep confirms zero deep imports from `@green-goods/shared/*` in production code. The only deep imports are in test utilities (`__tests__/setupTests.ts` and `__tests__/test-utils.tsx`) which import from `@green-goods/shared/testing` — a legitimate sub-path export for test infrastructure.

#### CE3. No console.log in production code — POSITIVE

- **Principle**: C4 / Error Handling
- **File**: All client source files
- **Evidence**: No `console.log`, `console.warn`, or `console.error` in any non-test file. All logging goes through the shared `logger` service. The only console usage is in test setup (`ErrorBoundary.test.tsx`) to suppress expected error boundary output.

### Data (BASE)

#### CB1. Offline-first patterns correctly delegated — POSITIVE

- **Principle**: BASE
- **File**: `packages/client/src/views/Home/Garden/Work.tsx`, `packages/client/src/views/Home/WorkDashboard/index.tsx`
- **Evidence**: Offline work detection uses `work.id.startsWith("0xoffline_")` consistently. Online/offline merge logic in WorkDashboard correctly prefers online versions and deduplicates by time window. The `useWorks(gardenId, { offline: true })` pattern in Work.tsx delegates merge to shared. The `UploadingTab` correctly separates offline queue items from online work.

---

## Priority Queue

Top fixes ordered by severity x effort:

1. **Extract data aggregation hooks from WorkDashboard** — SRP/SOC — `views/Home/WorkDashboard/index.tsx` — Effort: M
2. **Add missing queryKeys helper for approvals** — DIP — `views/Home/WorkDashboard/index.tsx:404` — Effort: S
3. **Extract shared WorkListTab component** — DRY — `views/Home/WorkDashboard/Pending.tsx + Completed.tsx` — Effort: S
4. **Replace raw setTimeout with useTimeout in Hero** — SOC — `components/Layout/Hero.tsx:81,90` — Effort: S
5. **Extract useFocusTrap hook** — DRY — `views/Home/WorkDashboard/index.tsx + components/Dialogs/ModalDrawer.tsx` — Effort: S

---

## Trend (client-focused audits)

| Principle | 2026-04-02 (full) | 2026-04-02 (client) |
|-----------|-------------------|---------------------|
| S (SRP) | YELLOW | YELLOW |
| O (OCP) | GREEN | GREEN |
| L (LSP) | GREEN | GREEN |
| I (ISP) | YELLOW | GREEN |
| D (DIP) | GREEN | GREEN |
| DRY | GREEN | YELLOW |
| KISS | YELLOW | GREEN |
| YAGNI | GREEN | GREEN |
| SOC | YELLOW | YELLOW |
| EDA | GREEN | GREEN |
| C4 | YELLOW | GREEN |
| ACID | GREEN | N/A |
| BASE | GREEN | GREEN |
| CAP | GREEN | GREEN |

Notes: Client-scoped audit reveals DRY issues (PendingTab/CompletedTab duplication) not visible at the full-codebase level. SOC1 from the prior audit is fixed (Work view refactored). SOC2 remains open.

---

## Next Steps

> **This audit is read-only.** To apply fixes, reply with:
> - `fix critical` — address Critical findings only
> - `fix all` — address all findings by priority
> - `fix CS1, CD1` — address specific findings by ID
