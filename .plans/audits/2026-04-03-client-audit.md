# Audit Report - 2026-04-03 (Client Package)

## Executive Summary

- **Packages analyzed**: client (7 modified files, 2 deleted files) | **Mode**: Single-agent | **Baseline**: uncommitted working tree vs d6095d27
- **Critical**: 0 | **High**: 1 | **Medium**: 2 | **Low**: 2
- **Security (contracts)**: N/A (client-only audit)
- **Dead code**: Pending (knip blocked by 1Password CLI timeout)
- **Tests**: 25 passed / 1 file failed (2 tests) | **Coverage**: Not measured (build prerequisite failed)
- **Build**: FAILS -- missing barrel exports in shared `index.ts`
- **Lint**: 0 errors (client scope), 158 solhint warnings (contracts scope, out of scope)
- **Architectural violations**: 0 hooks outside shared, 0 package .env files, 0 hardcoded addresses in production code

### Chronic findings (risk score > 8.0)

- **KI-002**: God object WorkDashboard -- still 727 lines (down from 838). Risk score **8.0**. 13th cycle.
- **KI-007**: God object TreasuryDrawer -- still 728 lines. Risk score **8.0**. 9th cycle.

### Executive Delta (since 2026-04-03 shared audit)

- **Scope**: Uncommitted working tree changes in client package only (7 modified, 2 deleted, net -814 lines)
- **Findings opened**: 5 (H1-new, M1-new, M2-new, L1-new, L2-new) | **Findings closed**: 1 (H4 FIXED) | **Net**: +4
- **Risk score trend**: Incomplete (first client-scoped audit in current cycle)
- **Key changes**:
  - **H4 FIXED**: `HomeGardenWork.test.tsx` now mocks `useWorkApprovalActions` and `useWorkMetadata`
  - **WorkDashboard reduction**: 838 -> 727 lines (-111). Deleted `Pending.tsx` and `Completed.tsx` (308 lines), replaced with generic `WorkListTab.tsx` (150 lines). Extracted `fetchApprovalsByRecipients` to shared. Replaced manual focus trap with `useFocusTrap`. Replaced manual reviewer garden detection with `useReviewerGardenIds`/`useReviewerWorks`.
  - **Work.tsx reduction**: ~880 -> 646 lines (-234). Extracted approval logic to `useWorkApprovalActions` hook in shared. Extracted metadata fetching to `useWorkMetadata` hook in shared. Removed inline state management (7 `useState` calls removed, 3 handlers removed).
  - **ModalDrawer.tsx**: Replaced 30-line manual focus trap with `useFocusTrap(dialogRef, { enabled: isOpen })` single-line call.
  - **Hero.tsx**: Moved `useIsDarkMode` to shared (was inline). Replaced two raw `setTimeout` effects with `useTimeout` hook. Annotated `useTunnelUrl` with hook boundary exception comment.
  - **Pattern adoption**: `useFocusTrap`, `useTimeout`, `useReviewerGardenIds`, `useReviewerWorks`, `useWorkApprovalActions`, `useWorkMetadata` -- all from shared.

---

## Previous Findings Status

_Cross-referenced from: 2026-04-03 shared audit and Known Issues Registry_

### Client-Specific Findings

| ID | Finding | File | Status | Cycles Open | Risk Score | Notes |
|----|---------|------|--------|-------------|------------|-------|
| H4 | Client test missing `useWorkMetadata` mock | `client/__tests__/views/HomeGardenWork.test.tsx` | **FIXED** | -- | -- | Mock now includes `useWorkApprovalActions` and `useWorkMetadata` |
| KI-002 | God object WorkDashboard (838 lines) | `client/views/Home/WorkDashboard/index.tsx` | **STILL OPEN** (improved) | 13 | **8.0** | Down to 727 lines (-111). Pending/Completed tabs consolidated into `WorkListTab`. |
| KI-007 | God object TreasuryDrawer (728 lines) | `client/components/Dialogs/TreasuryDrawer.tsx` | **STILL OPEN** (unchanged) | 9 | **8.0** | Not in diff scope. 728 lines. |

---

## New Findings

### H1-new. Missing barrel exports break client build (NEW)

- **File**: `packages/shared/src/index.ts` (affects client build)
- **Risk score**: 12.0 (impact=4 x likelihood=3 x staleness=1.0)
- **Confidence**: HIGH
- **Issue**: The client build fails with:
  ```
  "useFocusTrap" is not exported by "packages/shared/src/index.ts"
  ```
  Three hooks are exported from `packages/shared/src/hooks/index.ts` (in uncommitted changes) but NOT re-exported from the shared barrel `packages/shared/src/index.ts`:
  - `useFocusTrap` -- imported by `ModalDrawer.tsx:1` and `WorkDashboard/index.tsx:17`
  - `useReviewerGardenIds` -- imported by `WorkDashboard/index.tsx:19`
  - `useReviewerWorks` -- imported by `WorkDashboard/index.tsx:20`
- **Recommendation**: Add these three exports to the appropriate block in `packages/shared/src/index.ts`. This is a prerequisite for any further client work.

### M1-new. TopNav test missing `useFocusTrap` mock (NEW)

- **File**: `packages/client/src/__tests__/components/TopNav.test.tsx:14-24`
- **Risk score**: 4.0 (impact=2 x likelihood=2 x staleness=1.0)
- **Confidence**: HIGH
- **Issue**: Two tests fail ("shows notification bell when user is an operator" and "shows notification badge with pending count for operators") because the `@green-goods/shared` mock at line 14 does not include `useFocusTrap`. When `isOperator=true`, TopNav renders a component that uses `ModalDrawer`, which calls `useFocusTrap`. Vitest throws: `No "useFocusTrap" export is defined on the "@green-goods/shared" mock`.
- **Recommendation**: Add `useFocusTrap: vi.fn()` to the mock object at line 14 of `TopNav.test.tsx`.

### M2-new. Hardcoded aria-label string not internationalized (NEW)

- **File**: `packages/client/src/views/Home/WorkDashboard/index.tsx:705`
- **Risk score**: 2.0 (impact=1 x likelihood=2 x staleness=1.0)
- **Confidence**: HIGH
- **Issue**: The close button uses `aria-label="Close modal"` as a raw English string instead of `intl.formatMessage(...)`. Every other aria-label in the changed files is properly internationalized. The ModalDrawer component at line 124 correctly uses `formatMessage({ id: "app.common.close" })` for the same purpose.
- **Recommendation**: Replace with `aria-label={intl.formatMessage({ id: "app.common.close", defaultMessage: "Close" })}` to match the ModalDrawer pattern.

### L1-new. Empty catch block in useTunnelUrl (NEW)

- **File**: `packages/client/src/components/Layout/Hero.tsx:43`
- **Risk score**: 1.0 (impact=1 x likelihood=1 x staleness=1.0)
- **Confidence**: HIGH (classified as intentional-with-fallback, borderline)
- **Issue**: `.catch(() => {})` swallows fetch errors silently. This is dev-only infrastructure (`import.meta.env.DEV` guard at line 34) and polling will retry on the next interval, so it's effectively an intentional fallback. However, per error handling rules, even dev-only catch blocks should at minimum log.
- **Recommendation**: Accept as-is (dev-only, self-healing via polling). If preferred, add `logger.debug("Tunnel poll failed")` for debuggability.

### L2-new. Raw setInterval in useTunnelUrl (NEW)

- **File**: `packages/client/src/components/Layout/Hero.tsx:47`
- **Risk score**: 1.0 (impact=1 x likelihood=1 x staleness=1.0)
- **Confidence**: HIGH
- **Issue**: Uses raw `setInterval` instead of the shared interval/timeout pattern (React rules, Rule 1). However, the hook properly clears the interval in the cleanup function (line 48-51) and has a `cancelled` flag for race prevention (line 36,41). The comment at line 29 explicitly marks this as an exception: "dev-only, non-exported, single-use infrastructure."
- **Recommendation**: Accept as-is. The exception annotation is valid -- this is dev-only polling infrastructure with proper cleanup.

---

## Test Findings

### Client: 213 passed, 2 failed (1 test file)

| File | Tests | Status | Failure Reason |
|------|-------|--------|----------------|
| `TopNav.test.tsx` | 6 passed / 2 failed | FAIL | Missing `useFocusTrap` in shared mock (M1-new) |
| `HomeGardenWork.test.tsx` | 1 passed | PASS | Mock updated correctly for new hooks |
| All others (24 files) | 206 passed | PASS | -- |

### Source map warnings (non-blocking)

Multiple `@storacha/client` source map files missing (ENOENT). These are harmless Vite warnings from a third-party dependency with incomplete source maps. Not a finding.

---

## Refactoring Quality Assessment

The uncommitted changes represent a well-executed refactoring:

1. **Pending/Completed -> WorkListTab consolidation** -- Two nearly-identical 154-line tab components (`PendingTab`, `CompletedTab`) replaced with a single 150-line generic `WorkListTab` accepting message descriptors and badge renderers. Eliminates duplication while preserving all functionality.

2. **Focus trap extraction** -- Manual 30-line `useEffect` focus trap implementations in both `ModalDrawer` and `WorkDashboard` replaced with single `useFocusTrap()` calls. This hook is properly exported from `hooks/index.ts` but needs barrel export (H1-new).

3. **Work.tsx decomposition** -- 7 `useState` calls and ~230 lines of approval/metadata logic extracted to shared hooks (`useWorkApprovalActions`, `useWorkMetadata`). Clean separation of concerns.

4. **Hero.tsx cleanup** -- `useIsDarkMode` moved to shared (was a local 12-line hook). Two raw `setTimeout` effects consolidated into a single `useTimeout` call. Net -45 lines.

5. **WorkDashboard reviewer logic** -- Inline `fetchApprovalsByRecipients` callback (23 lines), garden fetching with evaluator detection (~80 lines), and work fetching per garden (~50 lines) replaced with three shared hooks. Clean hook boundary compliance.

---

## Architectural Anti-Patterns (client-specific, top by risk score)

| Anti-Pattern | Location | Lines | Cycles Open | Risk Score | Severity | Notes |
|--------------|----------|-------|-------------|------------|----------|-------|
| God object | `client/views/Home/WorkDashboard/index.tsx` | 727 | 13 | 8.0 | HIGH (CHRONIC) | Down from 838 (-111). Consolidation of Pending/Completed tabs helped. Still above 700. |
| God object | `client/components/Dialogs/TreasuryDrawer.tsx` | 728 | 9 | 8.0 | HIGH (CHRONIC) | Unchanged this cycle. Not in diff scope. |
| God object | `client/views/Home/Garden/Work.tsx` | 646 | -- | 2.0 | MEDIUM | Down from ~880. Under 700-line threshold. On track. |
| God object | `client/components/Layout/Hero.tsx` | 428 | -- | 1.0 | LOW | Down from ~473. Under threshold. |

---

## Skill & Configuration Drift

| Reference | Location | Status |
|-----------|----------|--------|
| Hook locations | validate-hook-location.sh | OK (0 hooks outside shared, `useTunnelUrl` exception annotated) |
| Package .env files | find packages/client | OK (none found) |
| Hardcoded addresses | grep 0x... | OK (only in Storybook stories) |
| Barrel imports | grep deep paths | OK (all imports from `@green-goods/shared`) |

---

## Recommendations (Priority Order)

1. **Fix H1-new: Add missing barrel exports** -- `useFocusTrap`, `useReviewerGardenIds`, `useReviewerWorks` to `packages/shared/src/index.ts`. This unblocks the client build. (High, H1-new, risk=12.0)
2. **Fix M1-new: Add `useFocusTrap` mock to TopNav test** -- Add `useFocusTrap: vi.fn()` to the mock. Fixes 2 test failures. (Medium, M1-new, risk=4.0)
3. **Continue reducing WorkDashboard** -- At 727 lines (down from 838), consider extracting badge renderers (~40 lines), refresh handlers (~20 lines), or the `renderTabContent` block into a sub-component. (High, KI-002, risk=8.0)
4. **Fix M2-new: Internationalize close button aria-label** -- Quick fix in WorkDashboard line 705. (Medium, M2-new, risk=2.0)
5. **Commit this changeset** -- After fixing H1-new and M1-new, the working tree represents a significant quality improvement: 1 finding fixed, 814 net lines removed, 2 dead files removed, 6 shared hooks adopted.
