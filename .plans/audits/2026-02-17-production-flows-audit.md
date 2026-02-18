# Production Readiness Audit — Critical User Flows

**Date**: 2026-02-17 | **Branch**: `feature/ens-integration` | **Files Analyzed**: ~80+ across 6 flows

---

## Executive Summary

| Flow | Critical | High | Medium | Low | Verdict |
|------|----------|------|--------|-----|---------|
| **Work Submission** (audio/video MDR) | 3 | 6 | 6 | 3 | NOT READY |
| **Work Approval** | 2 | 5 | 4 | 3 | NOT READY |
| **Create Garden** | 2 | 7 | 4 | 3 | NOT READY |
| **Create Assessment** | 5 | 3 | 8 | 2 | NOT READY |
| **Vault Deposit/Withdraw** | 2 | 3 | 6 | 5 | NOT READY |
| **Mint Hypercert + Listing** | 4 | 5 | 5 | 5 | CONDITIONAL |
| **TOTALS** | **18** | **29** | **33** | **21** | **NOT READY** |

**Overall Verdict: NOT PRODUCTION READY** — 18 critical and 29 high-severity issues must be addressed.

---

## Cross-Cutting Themes (Systemic Patterns)

### Theme 1: Fire-and-Forget Async Operations
**Affected flows**: Create Garden, Create Assessment, Work Submission

Multiple places use `void someAsyncOperation()` for draft saves and clears. If IndexedDB fails (quota exceeded, permission denied), the user's data is silently lost with no feedback.

**Fix pattern**: Either `await` the operations or attach `.catch()` with user-facing error toast.

### Theme 2: Missing Unmount Guards on Async Operations
**Affected flows**: All six flows

Async operations in `useEffect` and mutation callbacks lack `isMounted` guards. If a user navigates away mid-transaction, state updates fire on unmounted components. Optimistic cache entries persist without cleanup.

**Fix pattern**: Use `useAsyncEffect` from `@green-goods/shared` (Rule 3) or add `isMounted` ref guards.

### Theme 3: Transaction Timeout Doesn't Cancel Background Work
**Affected flows**: Work Submission, Work Approval, Vault Deposit

`waitForReceiptWithTimeout` uses `Promise.race()` but the losing promise keeps running. The background `waitForTransactionReceipt` can resolve/reject after the user has moved on.

**Fix pattern**: Use `AbortController` to cancel the receipt polling on timeout.

### Theme 4: Cache Invalidation vs Indexer Lag
**Affected flows**: All transaction-based flows

Immediate `queryClient.invalidateQueries()` after tx confirmation causes stale balance flashes — queries refetch before the indexer has processed the block. The optimistic + poll pattern is correct but inconsistently applied.

**Fix pattern**: Use `useDelayedInvalidation` consistently (already in `@green-goods/shared`).

---

## Flow 1: Work Submission (Audio/Video MDR)

**Verdict**: NOT READY | 3 Critical, 6 High, 6 Medium, 3 Low

| # | Sev | Location | Issue |
|---|-----|----------|-------|
| C1 | **CRIT** | `AudioRecorder.tsx:158-161` | Permission denied path doesn't stop AnimationFrame loop or close AudioContext — repeated denials cause UI freeze |
| C2 | **CRIT** | `AudioRecorder.tsx:126-139` | `onstop` handler creates blob URL that leaks if cancel fires before onstop completes (race) |
| C3 | **CRIT** | `db.ts:226-269` | Object URLs created outside IndexedDB transaction boundary — partial job persistence possible |
| H1 | HIGH | `AudioRecorder.tsx:53-64` | Unmount cleanup doesn't call `mediaRecorderRef.current?.stop()` — recorder left in "recording" state |
| H2 | HIGH | `useWorkMutation.ts:280-283` | Optimistic cache entry never cleaned up if component unmounts mid-mutation |
| H3 | HIGH | `useDraftAutoSave.ts:101-169` | Draft created but `setDraftImages()` fails — inconsistent draft saved |
| H4 | HIGH | `db.ts:35-92` | `cleanupStaleUrls()` failure silently hides quota exceeded — next `addJob()` fails |
| H5 | HIGH | `wallet-submission.ts:74-99` | `Promise.race` timeout doesn't cancel background receipt polling |
| H6 | HIGH | `AudioRecorder.tsx:126-139` | AudioContext only closed on unmount, not when recording stops |

---

## Flow 2: Work Approval

**Verdict**: NOT READY | 2 Critical, 5 High, 4 Medium, 3 Low

| # | Sev | Location | Issue |
|---|-----|----------|-------|
| C1 | **CRIT** | `useBatchWorkApproval.ts:157-176` | Batch optimistic updates assume all-or-nothing but partial indexing failures leave cache inconsistent |
| C2 | **CRIT** | `useBatchWorkSync.ts:122-140` | Job queue cleanup errors silently logged — causes duplicate submissions on next sync |
| H1 | HIGH | `useWorkApproval.ts:142-168` | Async `jobQueue.processJob` lacks `isMounted()` guard |
| H2 | HIGH | `wallet-submission.ts:213-219,371-378` | Transaction timeout continues silently — no user toast, only debugLog |
| H3 | HIGH | `useBatchWorkApproval.ts:267-279` | Error rollback conditional on context — synchronous throw before `onMutate` leaves stale optimistic data |
| H4 | HIGH | `Work.tsx:379-384` | Race in useEffect clearing optimistic status when `work.status` is undefined during refetch |
| H5 | HIGH | `WorkApprovalDrawer.tsx:50` | `useWindowEvent` listener has stale closure on `feedbackMode` change |

---

## Flow 3: Create Garden

**Verdict**: NOT READY | 2 Critical, 7 High, 4 Medium, 3 Low

| # | Sev | Location | Issue |
|---|-----|----------|-------|
| C1 | **CRIT** | `useCreateGardenStore.ts:107-288` + `useGardenDraft.ts:74-278` | Dual persistence (sessionStorage + IndexedDB) without sync — form state diverges |
| C2 | **CRIT** | `useCreateGardenWorkflow.ts:254-259` + `useGardenDraft.ts:225-267` | Auto-save interval fires after `clearDraft()`, re-persisting cleared data |
| H1 | HIGH | `useCreateGardenWorkflow.ts:257,371` | `void draft.clearDraft()` — IndexedDB failures silently swallowed |
| H2 | HIGH | `createGarden.ts:92-130` | Machine guards depend only on event data, not internal state — stale guard failures |
| H3 | HIGH | `useCreateGardenWorkflow.ts:149-245` | `submitGarden` actor lacks `isMounted` guard |
| H4 | HIGH | `useCreateGardenWorkflow.ts:108-143` | Machine created with empty deps — refs updated separately creating fragile closures |
| H5 | HIGH | `useCreateGardenWorkflow.ts:150-152` | No validation that `getParams()` returns non-null when submit guard passes |
| H6 | HIGH | `useCreateGardenStore.ts:271-282` | sessionStorage clears on tab close while IndexedDB persists — asymmetric data loss |
| H7 | HIGH | `useCreateGardenWorkflow.ts:369-372` | Store subscription during `storeReset()` saves empty form to IndexedDB |

---

## Flow 4: Create Assessment

**Verdict**: NOT READY | 5 Critical, 3 High, 8 Medium, 2 Low

| # | Sev | Location | Issue |
|---|-----|----------|-------|
| C1 | **CRIT** | `useCreateAssessmentWorkflow.ts:224` | `void draft.saveDraft(params)` — silent data loss on IndexedDB failure |
| C2 | **CRIT** | `useCreateAssessmentWorkflow.ts:248` | `void draft.clearDraft()` — stale draft persists after success |
| C3 | **CRIT** | `CreateAssessment.tsx:173-174` | `startCreation()` + `submitCreation()` called synchronously without draft save guarantee |
| C4 | **CRIT** | `useCreateAssessmentWorkflow.ts:118-138` | IPFS evidence upload partial failure only logs warning — assessment created with missing evidence |
| C5 | **CRIT** | `useCreateAssessmentWorkflow.ts:142-153` | Metrics JSON error conflates parse failure with IPFS upload failure |
| H1 | HIGH | `useAssessmentDraft.ts:224-237` | Auto-save `saveDraft` dependency causes interval cascade — IndexedDB hammering |
| H2 | HIGH | `createAssessment.ts:170-185` | `retryCount` not cleared on success — stale state persists to next workflow |
| H3 | HIGH | `useCreateAssessmentWorkflow.ts:110-114` | EAS signer errors produce generic message — hard to diagnose wallet issues |

---

## Flow 5: Vault Deposit/Withdraw

**Verdict**: NOT READY | 2 Critical, 3 High, 6 Medium, 5 Low

| # | Sev | Location | Issue |
|---|-----|----------|-------|
| C1 | **CRIT** | `DepositModal.tsx:240-249` + `WithdrawModal.tsx:224-231` | Paused vaults not validated before tx — users waste gas on rejected transactions |
| C2 | **CRIT** | `useVaultOperations.ts:199-214` | **Withdraw lacks slippage protection** (`minAssetsOut`) — users can lose funds |
| H1 | HIGH | `useVaultOperations.ts:151-154,232-235` | Immediate cache invalidation before indexer processes — stale balance flash |
| H2 | HIGH | `useVaultOperations.ts:48,116-123` | Toast state tracking broken across approval+deposit steps |
| H3 | HIGH | `DepositModal.tsx:63-66` + `WithdrawModal.tsx:50-63` | No vault pause state subscription during modal lifetime |

---

## Flow 6: Mint Hypercert + Marketplace Listing

**Verdict**: CONDITIONAL PASS | 4 Critical, 5 High, 5 Medium, 5 Low

| # | Sev | Location | Issue |
|---|-----|----------|-------|
| C1 | **CRIT** | `client.ts:138,166` | Session nonce counter (`Date.now()`) has race condition — parallel calls get same nonce |
| C2 | **CRIT** | `useMintHypercert.ts:272-277` | Empty `hypercertId = ""` on log extraction failure — mint shows "success" but ID is blank |
| C3 | **CRIT** | `useMarketplaceApprovals.ts:39-50` | Race between approval check (UI) and tx submission — approval can be revoked between checks |
| C4 | **CRIT** | `client.ts:138,182-184` | Session nonce not reset on chain switch — nonce sequence spans chains |
| H1 | HIGH | `useCreateListing.ts:136` | UserOp receipt not validated (result ignored) — proceeds as confirmed when pending |
| H2 | HIGH | `useCreateListing.ts:87-94` | No retry for signature timeout — user must restart entire flow |
| H3 | HIGH | `useMarketplaceApprovals.ts:39-47` | No `staleTime` on approval query — can show stale approval state |
| H4 | HIGH | `useMintHypercert.ts:327-333` | GardensModule zero address silently skips pool registration — user unaware |
| H5 | HIGH | `useCreateListing.ts:78-79` | Nonce defaults to `0n` on RPC failure — invalid order signed silently |

---

## Priority Matrix — What to Fix First

### P0 (Before Any User Traffic)
1. **Vault withdraw slippage protection** — funds at risk (Vault C2)
2. **Vault pause validation** — wasted gas (Vault C1)
3. **AudioRecorder cleanup** — UI freezes (Work C1, C2)
4. **Hypercert nonce collision** — invalid orders (Hypercert C1, C4)
5. **Empty hypercertId on extraction failure** — lost mints (Hypercert C2)

### P1 (Before Beta)
6. All fire-and-forget `void draft.save/clear()` patterns (Assessment C1-C2, Garden H1)
7. Dual persistence sync in Create Garden (Garden C1-C2)
8. Partial IPFS upload data loss in Assessment (Assessment C4)
9. Batch approval optimistic update consistency (Approval C1)
10. Transaction timeout cancellation across all flows (Theme 3)

### P2 (Before GA)
11. Unmount guards on all async operations (Theme 2)
12. Cache invalidation timing (Theme 4)
13. Stale approval race in Hypercert (Hypercert C3)
14. Auto-save interval cascade in drafts
15. Retry count cleanup in state machines

---

## Recommended Shared Abstractions

### 1. `useTransactionLifecycle()` hook
Standardizes: timeout with `AbortController`, receipt polling, optimistic update + rollback on unmount, and user-facing toast on timeout. Resolves ~30% of HIGH findings.

### 2. Lint rule banning `void asyncFn()`
The fire-and-forget pattern appears 8+ times across drafts/clears and is the root cause of 4 CRITICAL data loss findings.

### 3. Single `cleanupAllResources()` in AudioRecorder
One function called from all exit paths: permission denial, stop, cancel, unmount.
