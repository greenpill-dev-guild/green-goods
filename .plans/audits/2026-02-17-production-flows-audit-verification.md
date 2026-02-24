# Production Flows Audit — False Positive Verification

**Date**: 2026-02-17 | **Branch**: `feature/ens-integration` | **Source Audit**: `2026-02-17-production-flows-audit.md`

---

## Executive Summary

Verified all 47 Critical+High findings from the production flows audit against actual source code. Found **9 false positives** and **5 severity-overstated** issues.

| | Original Count | False Positive | Partially True | Confirmed Real |
|---|---|---|---|---|
| **Critical** | 18 | **3** | 0 | **15** |
| **High** | 29 | **6** | **5** | **18** |
| **Total** | 47 | **9** | **5** | **33** |

**Revised verdict**: Still NOT PRODUCTION READY (15 critical + 18 high), but scope is ~19% smaller than originally reported.

### Per-Flow Accuracy

| Flow | Checked | Real | False Positive | Partial |
|---|---|---|---|---|
| Work Submission | 9 | 5 | 3 | 1 |
| Work Approval | 7 | 3 | 4 | 0 |
| Create Garden | 9 | 6 | 0 | 2 |
| Create Assessment | 8 | 6 | 1 | 1 |
| Vault | 5 | 2 | 1 | 1 |
| Hypercert | 9 | 9 | 0 | 0 |

---

## False Positives (9 total)

### Flow 1: Work Submission — 3 false positives

#### C2 `AudioRecorder.tsx:126-139` — Blob URL race between cancel and onstop
**Claimed**: CRITICAL | **Verdict**: FALSE POSITIVE

`onstop` runs after `mediaRecorder.stop()` is called synchronously by `handleCancel()`. The `handleCancel` properly revokes `previewUrl` if it exists (line 178). No race condition — the handler updates state synchronously, and cancel properly cleans up.

#### C3 `db.ts:226-269` — Object URLs created outside IndexedDB transaction
**Claimed**: CRITICAL | **Verdict**: FALSE POSITIVE

Object URLs are created **inside** the IndexedDB transaction (line 233 `mediaResourceManager.createUrl()`). On transaction failure, `mediaResourceManager.cleanupUrls(id)` is called (line 266). File serialization happens before the transaction (correct — `arrayBuffer()` can't run inside a transaction). Atomicity is maintained.

#### H4 `db.ts:35-92` — cleanupStaleUrls() silently hides quota exceeded
**Claimed**: HIGH | **Verdict**: FALSE POSITIVE

The error IS logged via `logger.error("Failed to cleanup stale URLs", { error })` at line 129. Not silent — the audit missed the logging call.

---

### Flow 2: Work Approval — 4 false positives

#### C1 `useBatchWorkApproval.ts:157-176` — Batch optimistic updates leave cache inconsistent
**Claimed**: CRITICAL | **Verdict**: FALSE POSITIVE

Optimistic updates are per-item with `_isPending: true` flags. The `onError` handler performs a **full rollback** from `previousStates` snapshot captured in `onMutate`. TanStack Query guarantees `onMutate` → `mutationFn` → `onSuccess`/`onError` lifecycle ordering. Cache cannot be left inconsistent.

#### H3 `useBatchWorkApproval.ts:267-279` — Error rollback conditional on context
**Claimed**: HIGH | **Verdict**: FALSE POSITIVE

TanStack Query guarantees `onMutate` always runs before `mutationFn`. The `context?.previousStates` check is defensive but redundant — there's no code path where context is missing after `onMutate` completes successfully.

#### H4 `Work.tsx:379-384` — Race in useEffect clearing optimistic status
**Claimed**: HIGH | **Verdict**: FALSE POSITIVE

The condition `if (optimisticStatus && work?.status && work.status === optimisticStatus)` requires all three conditions to be true. When `work.status` is `undefined` during refetch, the condition safely fails. No race.

#### H5 `WorkApprovalDrawer.tsx:50` — useWindowEvent stale closure on feedbackMode
**Claimed**: HIGH | **Verdict**: FALSE POSITIVE

`handleEscape` uses `useCallback` with `[feedbackMode, handleCancelFeedback]` in deps. The `useWindowEvent` hook (via `useEventListener`) stores handler in a ref (line 72) and updates it when handler changes (lines 81-83). No stale closure — the ref-based pattern ensures the latest handler is always called.

---

### Flow 4: Create Assessment — 1 false positive

#### H2 `createAssessment.ts:170-185` — retryCount not cleared on success
**Claimed**: HIGH | **Verdict**: FALSE POSITIVE

`CreateAssessment.tsx:119` calls `resetWorkflow()` on mount via `useEffect`, which sends `RESET` event → triggers `clearContext` action → resets `retryCount: 0`. Stale state cannot persist across workflow instances due to reset-on-mount pattern.

---

### Flow 5: Vault — 1 false positive

#### H2 `useVaultOperations.ts:48,116-123` — Toast state tracking broken
**Claimed**: HIGH | **Verdict**: FALSE POSITIVE

Toast tracking is correct: single toast ID created in `onMutate()`, stored in `activeToastId.current`, reused to update message (approve → depositing) via same ID, dismissed in `onSuccess()`. The multi-step deposit pattern (approve → deposit) properly updates the same toast.

---

## Partially True — Severity Overstated (5 total)

### Flow 1: Work Submission

#### H3 `useDraftAutoSave.ts:101-169` — Draft created but setDraftImages() fails
**Claimed**: HIGH | **Revised**: MEDIUM

Draft without images is possible if `setDraftImages()` fails, but the error IS logged and tracked, and the function returns `null` indicating failure. The caller can detect the issue. Not completely silent.

### Flow 3: Create Garden

#### H5 `useCreateGardenWorkflow.ts:150-152` — getParams() returns null when submit guard passes
**Claimed**: HIGH | **Revised**: LOW

The actor has an explicit null check at line 151 that throws `"Garden form is incomplete"`. Code handles this defensively. The root cause is the stale guard (H2), not a missing null check.

#### H7 `useCreateGardenWorkflow.ts:369-372` — Store reset saves empty form to IndexedDB
**Claimed**: HIGH | **Revised**: LOW

The subscription does fire on `storeReset()`, but `hasMeaningfulProgress()` guard (line 168 in useGardenDraft.ts) checks for non-empty name/slug/description before saving. Empty forms are filtered out.

### Flow 4: Create Assessment

#### H1 `useAssessmentDraft.ts:224-237` — Auto-save interval cascade
**Claimed**: HIGH | **Revised**: LOW

The effect recreates intervals when `saveDraft` ref changes, but writes only occur when `hasMeaningfulProgress(params)` is true, and the default interval is 60 seconds. Not "IndexedDB hammering" — more of an interval instability concern.

### Flow 5: Vault

#### H3 `DepositModal.tsx:63-66` + `WithdrawModal.tsx:50-63` — No vault pause subscription
**Claimed**: HIGH | **Revised**: LOW

No active subscription to pause state, but this is a narrow edge case (requires external actor to pause vault while modal is open). The primary fix needed is C1 (missing validation in submit button), not a subscription.

---

## Confirmed Real Issues — Revised Priority Matrix

### P0: Before Any User Traffic (5 confirmed critical)

1. **Vault C2** — Withdraw lacks slippage protection (`minAssetsOut`)
   - Location: `useVaultOperations.ts:199-214`
   - Risk: Fund loss on unfavorable exchange rate moves
   - Note: Deposit HAS slippage protection (1% default); withdraw does not

2. **Hypercert C1+C4** — Session nonce collision + no chain reset
   - Location: `client.ts:138,166,182-184`
   - Risk: Invalid/duplicate marketplace orders; cross-chain nonce leakage
   - Fix: Per-chain nonce Map, atomic increment

3. **Hypercert C2** — Empty hypercertId on log extraction failure
   - Location: `useMintHypercert.ts:272-277,281`
   - Risk: User sees "success" with blank ID; signal pool registration silently fails
   - Fix: Throw error instead of fallback to `""`

4. **Vault C1** — Paused vaults not validated before tx submission
   - Location: `DepositModal.tsx:240-249`, `WithdrawModal.tsx:224-231`
   - Risk: Users waste gas on transactions the contract will reject

5. **Work Sub H1** — MediaRecorder not stopped on unmount
   - Location: `AudioRecorder.tsx:53-64`
   - Risk: Resource leak; recorder stays active after navigation

### P1: Before Beta (10 confirmed issues)

6. **Assessment C1+C2** — `void draft.saveDraft()` / `void draft.clearDraft()`
   - Silent data loss on IndexedDB failure; stale drafts persist after success

7. **Assessment C3** — `startCreation()` + `submitCreation()` called without draft save guarantee
   - Location: `CreateAssessment.tsx:173-174`

8. **Assessment C4** — IPFS evidence upload partial failure continues silently
   - Location: `useCreateAssessmentWorkflow.ts:118-138`
   - `Promise.allSettled` allows missing evidence; only logs warning

9. **Garden C1** — Dual persistence (sessionStorage + IndexedDB) without sync
   - Location: `useCreateGardenStore.ts:267-282` + `useGardenDraft.ts:74-278`

10. **Garden C2** — Auto-save interval fires after `clearDraft()`, re-persisting data
    - Location: `useCreateGardenWorkflow.ts:254-259` + `useGardenDraft.ts:225-267`

11. **Approval C2** — Job queue cleanup errors silently logged; causes duplicate submissions
    - Location: `useBatchWorkSync.ts:122-140`

12. **Approval H2** — Transaction timeout continues silently (no user toast)
    - Location: `wallet-submission.ts:213-219,371-378`

13. **Hypercert H1** — UserOp receipt not validated (result discarded)
    - Location: `useCreateListing.ts:136`

14. **Hypercert H5** — Nonce defaults to `0n` on RPC failure
    - Location: `useCreateListing.ts:78-79`, `signing.ts:117-119`

15. **Assessment C5** — Metrics JSON error conflates parse failure with IPFS upload failure
    - Location: `useCreateAssessmentWorkflow.ts:142-153`

### P2: Before GA (8 confirmed issues)

16. **Garden H1** — `void draft.clearDraft()` swallows IndexedDB errors
17. **Garden H2** — Machine guards depend on stale event data, not current state
18. **Garden H3** — `submitGarden` actor lacks isMounted guard
19. **Garden H4** — Machine created with empty deps; refs updated separately (fragile closures)
20. **Garden H6** — sessionStorage clears on tab close; IndexedDB persists (asymmetric)
21. **Approval H1** — Async `jobQueue.processJob` lacks isMounted guard
22. **Work Sub H2** — Optimistic cache entry persists if component unmounts mid-mutation
23. **Work Sub H6** — AudioContext not closed when recording stops (resource leak)

### P3: Polish (5 lower-severity confirmed issues)

24. **Work Sub H5** — Wagmi receipt polling continues in background after timeout
25. **Work Sub C1** — Permission denied cleanup (effectively non-issue; resources never initialized)
26. **Hypercert H2** — No retry for signature timeout; user must restart entire flow
27. **Hypercert H3** — No `staleTime` on approval query; unnecessary RPC calls
28. **Hypercert H4** — GardensModule zero address silently skips pool registration
29. **Vault H1** — Immediate cache invalidation (by design; mitigated with delayed follow-up)
30. **Assessment H3** — EAS signer errors produce generic message

---

## Cross-Cutting Themes — Verified Status

| Theme | Audit Claim | Verification |
|---|---|---|
| Fire-and-forget async (`void asyncFn()`) | Valid pattern concern | **CONFIRMED** — 8+ instances across drafts/clears |
| Missing unmount guards | Valid pattern concern | **CONFIRMED** — but TanStack Query mitigates some cases |
| Transaction timeout doesn't cancel | Valid pattern concern | **PARTIALLY TRUE** — timeout timer IS cancelled; underlying wagmi polling is not |
| Cache invalidation vs indexer lag | Valid pattern concern | **CONFIRMED** — inconsistently applied; `useDelayedInvalidation` exists but not used everywhere |

---

## Recommended Shared Abstractions — Revised

### 1. `useTransactionLifecycle()` hook (from original audit)
Still recommended. Resolves ~25% of confirmed HIGH findings (down from 30% due to false positives removed).

### 2. Lint rule banning `void asyncFn()` (from original audit)
Still recommended. Root cause of 4 CRITICAL data loss findings (Assessment C1-C2, Garden H1, Garden C2).

### 3. `cleanupAllResources()` in AudioRecorder (from original audit)
Still recommended but lower priority. C2 blob URL race is false positive, but H1 (unmount) and H6 (AudioContext) are real.

### 4. **NEW**: Per-chain nonce isolation in marketplace client
Not in original audit recommendations. Required to fix Hypercert C1+C4. Replace global `sessionOrderNonce` with a `Map<number, bigint>` keyed by chainId.

### 5. **NEW**: Receipt validation helper
Not in original audit recommendations. Required to fix Hypercert H1. Wrap `getUserOperationReceipt` / `waitForTransactionReceipt` with status checking.
