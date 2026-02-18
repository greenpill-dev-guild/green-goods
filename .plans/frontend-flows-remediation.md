# Frontend Flows Remediation Plan

> **Date**: 2026-02-17
> **Branch**: feature/ens-integration
> **Method**: 5-agent pair-lane review (middleware pair + app pair + integration lead)
> **Scope**: 6 flows — work submission, work approval, garden creation, assessment creation, yield/vault deposit, hypercert minting
> **Files Reviewed**: 60+ across `packages/shared`, `packages/client`, `packages/admin`
> **Status**: PLAN — 5 Critical, 16 High, 26 Medium, 20 Low findings

---

## Overall Assessment

The codebase shows a clear evolutionary quality gradient: **newer flows (hypercert mint, vault/yield) follow excellent patterns**, while the **assessment flow predates those patterns** and concentrates the most critical issues. The target architecture already exists — this is a propagation problem, not a design problem.

**Critical path**: Assessment machine refactor → Hypercert machine stabilization → Error handling standardization → i18n pass → Type safety sweep → Offline/draft gaps → Accessibility fixes

---

## Issue Summary

| Severity | Count | Primary Sources |
|----------|-------|-----------------|
| **Critical** | 5 | Assessment machine (3), Hypercert machine (1), Missing import (1) |
| **High** | 16 | Error handling (4), Type safety (3), i18n (3), UX gaps (3), Error boundaries (1), Query cache (1), DRY (1) |
| **Medium** | 26 | Stale closures, accessibility, responsive tables, component size, batch UX, toast patterns |
| **Low** | 20 | Unnecessary wrappers, empty types, magic numbers, naming |

---

## Phase 1: Critical Fixes (Blocking)

### 1.1 Refactor Assessment XState Machine

**Findings**: C1, C2, H3, H6

The assessment machine is the single biggest reliability risk. It uses an older pattern incompatible with the rest of the codebase.

**Current state**:
- Uses `createMachine()` without `setup()` — no typed actions/guards
- `submitting` state relies on external `SUCCESS`/`FAILURE` events (not invoked actors)
- `retry()` sends RETRY then immediately calls `submitCreation()` which sends SUBMIT — race condition
- `submitCreation()` uses `window.ethereum` directly — bypasses Wagmi/AppKit, breaks passkey auth
- `CreateAssessmentForm` type duplicated in workflow + hook files

**Target state** (match `createGarden` and `mintHypercert` patterns):
- Migrate to `setup()` with typed actors, guards, and actions
- Replace external event dispatch with `invoke: { src: fromPromise(...) }` + `onDone`/`onError`
- Use `useWalletClient()` from Wagmi instead of `window.ethereum`
- Single `CreateAssessmentForm` type definition in `types/`

**Files to modify**:
- `packages/shared/src/workflows/createAssessment.ts` — full machine rewrite
- `packages/shared/src/hooks/assessment/useCreateAssessmentWorkflow.ts` — remove imperative `submitCreation()`, wire invoked actor
- `packages/shared/src/types/` — new `assessment.ts` or add to existing domain types

**Validation**: `cd packages/shared && bun run test` + verify assessment flow in client and admin

---

### 1.2 Stabilize Hypercert Mint Machine (Ref-Based Wallet Clients)

**Finding**: C3

`useMintHypercert` recreates the entire XState machine when `walletClient`/`authMode`/`smartAccountClient` changes. Active mint progress is lost on wallet reconnect.

**Current state**:
```typescript
// useMintHypercert.ts:124
const machine = useMemo(() =>
  mintHypercertMachine.provide({ actors: { ... } }),
  [authMode, chainId, eoaAddress, smartAccountClient, walletClient]  // machine recreated!
);
```

**Target state**:
- Store `walletClient`, `smartAccountClient`, `eoaAddress` in refs
- Read from refs inside actor implementations
- Machine `useMemo` depends only on `chainId` (which legitimately requires a restart)

**Files to modify**:
- `packages/shared/src/hooks/hypercerts/useMintHypercert.ts` — refactor to ref-based actor injection

**Validation**: `cd packages/shared && bun run test` + test wallet reconnect during active mint

---

### 1.3 Fix Missing Type Import

**Finding**: C4

`ApprovalJobPayload` used as type assertion but never imported in `Work.tsx:326`.

**Files to modify**:
- `packages/client/src/views/Home/Garden/Work.tsx` — add `type ApprovalJobPayload` to import from `@green-goods/shared`

**Validation**: `cd packages/client && bun build`

---

## Phase 2: High-Priority Fixes

### 2.1 Add Toast Notifications for Mint Failures

**Finding**: H16

When minting fails, error is only stored in XState context and logged. No user-facing toast.

**Files to modify**:
- `packages/shared/src/hooks/hypercerts/useMintHypercert.ts:436-449` — add `toastService.error()` when machine transitions to failed states

**Validation**: `cd packages/shared && bun run test`

---

### 2.2 Standardize Error Handling on `createMutationErrorHandler()`

**Findings**: H7, H8, H16, integration review finding #2

Four different error handling patterns are active. Target: `createMutationErrorHandler()` everywhere.

**Hooks to migrate**:
- `packages/shared/src/hooks/work/useWorkMutation.ts` — replace inline `parseAndFormatError()` with `createMutationErrorHandler()`
- `packages/shared/src/hooks/work/useBatchWorkApproval.ts` — replace raw `debugLog` with `createMutationErrorHandler()`
- `packages/shared/src/hooks/work/useBatchWorkSync.ts` — add `logger.error()` + analytics to `onError`
- `packages/shared/src/hooks/work/useWorkApprovals.ts:104,108` — add `logger.warn()` to empty catch blocks
- `packages/shared/src/hooks/garden/createGardenOperation.ts:307` — convert dynamic `parseContractError` import to static

**Validation**: `cd packages/shared && bun run test`

---

### 2.3 Fix `Address` Type Imports (Rule 5 Sweep)

**Findings**: H2, H11, app-driver M3, app-observer H-Rule5

Replace `Address` from `viem` with `Address` from `@green-goods/shared` across all files.

**Files to fix**:
- `packages/shared/src/hooks/work/useWorkMutationWithProgress.ts:19,22` — `string` → `Address | null`
- `packages/shared/src/hooks/vault/useGardenVaults.ts:2` — import from domain types
- `packages/shared/src/hooks/vault/useVaultDeposits.ts:2` — import from domain types
- `packages/shared/src/hooks/vault/useVaultEvents.ts:2` — import from domain types
- `packages/shared/src/hooks/garden/createGardenOperation.ts:196-197` — `string` → `Address`
- `packages/admin/src/views/Gardens/Garden/Hypercerts.tsx:11` — import from shared
- `packages/admin/src/views/Gardens/Garden/HypercertDetail.tsx:21` — import from shared
- `packages/client/src/views/Home/Garden/index.tsx:31` — import from shared
- `packages/client/src/views/Home/WorkDashboard/index.tsx:38` — import from shared
- `packages/shared/src/hooks/query-keys.ts:123-199` — `string` → `Address` for gardenAddress params

**Validation**: `bun build` (all packages)

---

### 2.4 Add Mount Guards to Async Effects (Rule 3)

**Finding**: H1

**Files to fix**:
- `packages/shared/src/hooks/work/useWorkImages.ts:35-58` — add `isMounted` guard or use `useAsyncEffect`

**Validation**: `cd packages/shared && bun run test`

---

### 2.5 Fix Query Cache Fragmentation

**Finding**: H5

`useGardenAssessments` query key includes `limit` but `queryFn` doesn't pass it.

**Files to fix**:
- `packages/shared/src/hooks/assessment/useGardenAssessments.ts:10-18` — either pass `limit` to `getGardenAssessments()` or remove from query key

**Validation**: `cd packages/shared && bun run test`

---

### 2.6 Extract Duplicated ENS Fee Logic

**Finding**: H4

**Files to fix**:
- `packages/shared/src/hooks/garden/useCreateGardenWorkflow.ts` — extract `estimateCCIPFee()` helper, use in both `submitGarden` and `estimateCreationCost`

**Validation**: `cd packages/shared && bun run test`

---

### 2.7 Add `useTimeout` for Batch Indexer Lag

**Finding**: H8

`useBatchWorkApproval` does immediate invalidation only — no follow-up for indexer lag.

**Files to fix**:
- `packages/shared/src/hooks/work/useBatchWorkApproval.ts:223-228` — add `useTimeout` + `INDEXER_LAG_FOLLOWUP_MS` matching `useWorkApproval.ts` pattern

**Validation**: `cd packages/shared && bun run test`

---

### 2.8 i18n Pass on Admin Views

**Finding**: H13

~50% of admin views have hardcoded English strings.

**Files to fix**:
- `packages/admin/src/views/Gardens/Garden/Assessment.tsx` — all strings
- `packages/admin/src/views/Gardens/Garden/WorkDetail.tsx` — all strings
- `packages/admin/src/views/Actions/index.tsx` — all strings
- `packages/admin/src/views/Actions/ActionDetail.tsx` — all strings
- `packages/admin/src/views/Actions/EditAction.tsx` — all strings
- `packages/admin/src/views/Contracts/index.tsx` — all strings
- `packages/admin/src/views/Deployment/index.tsx` — all strings
- `packages/admin/src/views/Gardens/Garden/HypercertDetail.tsx` — marketplace section strings

**Validation**: `cd packages/admin && bun build && bun lint`

---

### 2.9 Add Component-Level Error Boundaries (Admin)

**Finding**: H12

Only a single app-level `ErrorBoundary` exists. Key sections need local boundaries.

**Files to modify**:
- `packages/admin/src/views/Gardens/Garden/Detail.tsx` — wrap yield/roles/community sections
- `packages/admin/src/views/Gardens/Garden/WorkDetail.tsx` — wrap review form
- `packages/admin/src/views/Gardens/Garden/CreateAssessment.tsx` — wrap wizard

**Validation**: `cd packages/admin && bun build`

---

### 2.10 Fix Blank Screen on Garden Not Found

**Finding**: H14

`Garden/index.tsx` returns `null` when `!garden` — no loading/error distinction.

**Files to fix**:
- `packages/client/src/views/Home/Garden/index.tsx:146` — check `isLoading` before showing error state

**Validation**: `cd packages/client && bun build`

---

### 2.11 Remove `console.debug` in Production

**Finding**: H15

**Files to fix**:
- `packages/client/src/views/Profile/Account.tsx:405` — replace with `logger.debug()` or remove

**Validation**: `cd packages/client && bun lint`

---

### 2.12 Fix Marketplace Approval Transaction Receipt

**Finding**: H9

`useMarketplaceApprovals` doesn't await transaction receipt — approval may not confirm before next tx.

**Files to fix**:
- `packages/shared/src/hooks/hypercerts/useMarketplaceApprovals.ts:65-71` — add `waitForTransactionReceipt()` after `sendTransaction()`

**Validation**: `cd packages/shared && bun run test`

---

## Phase 3: Medium-Priority Improvements

### 3.1 Assessment Table Accessibility (C5)

- `packages/admin/src/views/Gardens/Garden/Assessment.tsx:75-132` — wrap in `overflow-x-auto`, add `aria-label`, `scope="col"` on `<th>`

### 3.2 Add `role="alert"` to Error States

- `packages/admin/src/views/Gardens/Garden/Assessment.tsx:57-61`
- `packages/admin/src/views/Gardens/Garden/HypercertDetail.tsx:153-156`
- `packages/admin/src/views/Actions/index.tsx` (empty state)
- `packages/admin/src/views/Dashboard/index.tsx` (error block)

### 3.3 Add `type="button"` to Non-Submit Buttons

- `packages/admin/src/views/Dashboard/index.tsx:309`
- `packages/admin/src/views/Deployment/index.tsx:172`

### 3.4 Fix Loading States for ActionDetail and EditAction

- `packages/admin/src/views/Actions/ActionDetail.tsx:10-18` — add `isLoading` check
- `packages/admin/src/views/Actions/EditAction.tsx:95-103` — add `isLoading` check

### 3.5 Fix Timer Rule 1 Violations in Client

- `packages/client/src/views/Home/index.tsx:114` — replace `setTimeout` with `useTimeout()`
- `packages/client/src/views/Home/WorkDashboard/Uploading.tsx:87-88` — replace `window.setTimeout` with `useTimeout()`
- `packages/shared/src/hooks/hypercerts/useHypercertDraft.ts:247` — replace `setTimeout` with `useTimeout()`

### 3.6 Fix Stale Closures in Draft Hooks

- `packages/shared/src/hooks/work/useDraftAutoSave.ts:89-154` — use ref for `formData` or primitive deps
- `packages/shared/src/hooks/work/useDraftResume.ts:69-112` — extract `draftId` as primitive dep

### 3.7 Add Focus Trap to WorkDashboard Modal

- `packages/client/src/views/Home/WorkDashboard/index.tsx:729-808` — add focus trap

### 3.8 Add Keyboard Close to Feedback Drawer

- `packages/client/src/views/Home/Garden/Work.tsx:546` — add Escape key handler + visible close button

### 3.9 Fix CreateAction Step Validation

- `packages/admin/src/views/Actions/CreateAction.tsx:343-345` — add `trigger()` per-step validation

### 3.10 Fix Silent ENS Fee Error Swallowing

- `packages/shared/src/hooks/garden/useCreateGardenWorkflow.ts:133-136,271-273` — add `logger.warn()` to catch blocks

### 3.11 Fix `useMarketplaceApprovals` Non-Null Assertion

- `packages/shared/src/hooks/hypercerts/useMarketplaceApprovals.ts:40-41` — conditional query key pattern

### 3.12 Reduce `useMintHypercert` Effect Over-Firing

- `packages/shared/src/hooks/hypercerts/useMintHypercert.ts:431-464` — diff values before writing to store

### 3.13 Move Logger Calls Out of Component Body

- `packages/shared/src/hooks/hypercerts/useMintHypercert.ts:117-122` — move into useEffect

### 3.14 Responsive Table Wrappers

- `packages/admin/src/views/Gardens/Garden/Assessment.tsx` — wrap in `overflow-x-auto`
- `packages/admin/src/views/Contracts/index.tsx:83-125` — wrap in `overflow-x-auto`

### 3.15 Touch Target Sizes

- `packages/admin/src/views/Gardens/Garden/Hypercerts.tsx:166-180` — add `min-h-[44px]`

### 3.16 Form Labels in WorkDetail

- `packages/admin/src/views/Gardens/Garden/WorkDetail.tsx:419-425,441-447` — add `aria-labelledby` or use `<label>`

### 3.17 Treasury Empty State

- `packages/admin/src/views/Treasury/index.tsx:99-103` — match icon + title pattern from other views

### 3.18 Fix Non-Null Assertions in `useWorkMutation`

- `packages/shared/src/hooks/work/useWorkMutation.ts:113-114,132-133,177-179` — add explicit null checks

---

## Phase 4: Offline/Draft Persistence Gaps

### 4.1 Add Draft Persistence to Assessment Creation

Assessment is a complex multi-step form with zero draft support. If the user navigates away, all data is lost.

**Approach**: Follow the `useHypercertDraft` pattern — IndexedDB-backed auto-save with debounced writes.

**Files to create/modify**:
- `packages/shared/src/hooks/assessment/useAssessmentDraft.ts` — new hook
- `packages/shared/src/hooks/assessment/useCreateAssessmentWorkflow.ts` — integrate draft loading/saving

### 4.2 Add Draft Persistence to Garden Creation

Same gap — multi-step wizard with no persistence.

**Files to create/modify**:
- `packages/shared/src/hooks/garden/useGardenDraft.ts` — new hook
- `packages/shared/src/hooks/garden/useCreateGardenWorkflow.ts` — integrate draft loading/saving

---

## Phase 5: Form Validation Standardization

### 5.1 Migrate Garden Creation Validation to RHF + Zod

Replace manual XState guard validation with Zod schema.

**Files to modify**:
- `packages/shared/src/hooks/garden/useCreateGardenForm.ts` — new hook with Zod schema
- `packages/shared/src/workflows/createGarden.ts:92-128` — simplify guards to check form validity

### 5.2 Migrate Assessment Validation to RHF + Zod

Replace inline XState guard validation with Zod schema.

**Files to modify**:
- `packages/shared/src/hooks/assessment/useAssessmentForm.ts` — new hook with Zod schema
- `packages/shared/src/workflows/createAssessment.ts:62-76` — simplify guards

---

## Execution Order

```
Phase 1 (Critical)     ── Assessment machine + Hypercert stabilization + missing import
  ↓
Phase 2 (High)         ── Error handling + types + i18n + error boundaries + UX gaps
  ↓
Phase 3 (Medium)       ── Accessibility + timer cleanup + stale closures + responsive + a11y
  ↓
Phase 4 (Offline)      ── Draft persistence for assessment + garden
  ↓
Phase 5 (Validation)   ── RHF + Zod migration for garden + assessment forms
```

## Validation Gate Per Phase

| Phase | Command | Gate |
|-------|---------|------|
| 1 | `cd packages/shared && bun run test && cd ../client && bun build` | All tests pass, client builds |
| 2 | `bun format && bun lint && bun run test && bun build` | Full workspace validation |
| 3 | `bun format && bun lint && bun run test && bun build` | Full workspace validation |
| 4 | `cd packages/shared && bun run test` | Shared tests pass |
| 5 | `cd packages/shared && bun run test` | Shared tests pass |

---

## Lane Ownership (for `/teams ship`)

| Lane | Phase 1 | Phase 2 | Phase 3 | Phase 4-5 |
|------|---------|---------|---------|-----------|
| **middleware** (shared) | 1.1, 1.2 | 2.1, 2.2, 2.4, 2.5, 2.6, 2.7, 2.12 | 3.5, 3.6, 3.10-3.13, 3.18 | 4.1, 4.2, 5.1, 5.2 |
| **app** (client + admin) | 1.3 | 2.8, 2.9, 2.10, 2.11 | 3.1-3.4, 3.7-3.9, 3.14-3.17 | — |
| **chain** (contracts + indexer) | — | — | — | — |
