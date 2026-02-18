# Frontend Flows Audit — Best Practices Report

> **Date**: 2026-02-17
> **Branch**: `feature/ens-integration`
> **Scope**: UI, React, UX, and state management audit across 6 core frontend flows
> **Method**: 3 parallel Explore agents, ~70+ source files analyzed

---

## Flows Analyzed

| # | Flow | Agent | Key Files |
|---|------|-------|-----------|
| 1 | Work Submission | work-auditor | `client/views/Home/Garden/Work.tsx`, `shared/hooks/work/useWorkMutation.ts`, `useWorkImages.ts`, `stores/useWorkFlowStore.ts` |
| 2 | Work Approval | work-auditor | `client/views/Home/Garden/WorkApprovalDrawer.tsx`, `admin/views/Gardens/Garden/WorkDetail.tsx`, `shared/hooks/work/useWorkApproval.ts`, `useBatchWorkApproval.ts`, `useBatchWorkSync.ts` |
| 3 | Create Garden | garden-auditor | `admin/views/Gardens/CreateGarden.tsx`, `shared/hooks/garden/useCreateGardenWorkflow.ts`, `shared/workflows/createGarden.ts`, `shared/stores/useCreateGardenStore.ts` |
| 4 | Create Assessment | garden-auditor | `admin/views/Gardens/Garden/CreateAssessment.tsx`, `admin/components/Assessment/CreateAssessmentSteps/*`, `shared/hooks/assessment/useCreateAssessmentWorkflow.ts`, `shared/workflows/createAssessment.ts` |
| 5 | Vault Deposit | financial-auditor | `admin/components/Vault/DepositModal.tsx`, `DonationAddressConfig.tsx`, `shared/hooks/vault/useGardenVaults.ts`, `useVaultDeposits.ts`, `useVaultEvents.ts` |
| 6 | Mint Hypercert | financial-auditor | `admin/views/Gardens/Garden/HypercertDetail.tsx`, `shared/hooks/hypercerts/useMintHypercert.ts`, `useMarketplaceApprovals.ts`, `shared/workflows/mintHypercert.ts` |

---

## Strengths Across All Flows

1. **Timer cleanup is excellent** — Every flow uses `useTimeout()` or `useDelayedInvalidation()`. Zero raw `setTimeout` calls found. Rule 1 fully compliant.
2. **Optimistic updates with rollback** — Work submission and approval have textbook optimistic cache updates with proper rollback on error.
3. **Offline-first architecture** — Work submission correctly branches wallet/passkey and online/offline paths with job queue integration.
4. **XState for complex workflows** — Garden, assessment, and hypercert minting all use XState machines with clean state charts, retry logic, and typed guards.
5. **Zustand selector discipline** — Every Zustand usage selects individual fields, never `(state) => state`. Rule 6 fully compliant.
6. **Session/crash recovery** — Both garden and hypercert flows persist in-progress state for recovery after page refresh.
7. **Smart retry in mint flow** — Resumes from last successful checkpoint (signing, allowlist, metadata) rather than restarting from scratch.
8. **Blob URL memory leak prevention** — `useWorkFlowStore` revokes all tracked object URLs on `reset()`.
9. **Ref-based wallet dependencies** — `useMintHypercert` and `useCreateGardenWorkflow` store wallet clients in refs so XState actors survive wallet reconnections.
10. **Transaction simulation before execution** — Create garden simulates the `mintGarden` call before spending gas.

---

## 14-Rule Compliance Matrix

| Rule | Work Sub | Work Appr | Garden | Assessment | Vault | Hypercert |
|------|----------|-----------|--------|------------|-------|-----------|
| 1. Timer Cleanup | PASS | PASS | PASS | PASS | PASS | PASS |
| 2. Event Listeners | N/A | PASS | N/A | N/A | N/A | N/A |
| 3. Async Races | PASS | N/A | N/A | N/A | N/A | N/A |
| 4. Error Handling | PASS | PASS | PASS | PASS | **FAIL** | **FAIL** |
| 5. Address Types | **FAIL** | PASS | **FAIL** | **FAIL** | PASS | **FAIL** |
| 6. Zustand Selectors | PASS | PASS | PASS | N/A | N/A | PASS |
| 7. Query Key Stability | PASS | PASS | PASS | PASS | PASS | **FAIL** |
| 8. Form Validation | N/A | **FAIL** | **FAIL** | PASS | **FAIL** | N/A |
| 9. Chained useMemo | PASS | PASS | PASS | PASS | **FAIL** | PASS |
| 10. Context Values | N/A | N/A | N/A | N/A | N/A | N/A |
| 11. Barrel Imports | PASS | PASS | PASS | PASS | PASS | **FAIL** |
| 12. Console.log | PASS | PASS | PASS | PASS | PASS | PASS |
| 13. Provider Order | PASS | PASS | PASS | PASS | PASS | PASS |
| 14. Bun Scripts | N/A | N/A | N/A | N/A | N/A | N/A |

**Most violated rules**: Rule 5 (Address types — 4 flows), Rule 8 (Form validation — 3 flows), Rule 4 (Error handling — 2 flows)

---

## All Issues by Severity

### HIGH (8 issues)

#### 1. Create Garden: No Zod validation schema (Rule 8)
- **Location**: `packages/shared/src/stores/useCreateGardenStore.ts:219-237`
- **Problem**: Validation via imperative `isStepValid()` with hardcoded checks. No Zod schema exists.
- **Fix**: Create `createGardenSchema` using Zod, use `zodResolver` with React Hook Form. Eliminates manual `canProceed`/`isReviewReady` logic.

#### 2. Create Garden: Dual store+machine navigation sync risk
- **Location**: `packages/admin/src/views/Gardens/CreateGarden.tsx:84-97`
- **Problem**: `goNext()` sends XState event AND `nextStep()` advances Zustand store. If either fails, UI shows wrong step.
- **Fix**: Make XState machine the single source of truth for step transitions. Store's `nextStep`/`previousStep` should be called as side effects of machine transitions (via XState actions).

#### 3. Vault Deposit: Token approval race condition
- **Location**: `packages/shared/src/hooks/vault/useVaultOperations.ts:76-97`
- **Problem**: Allowance check and approval are non-atomic. Between checking `allowance < params.amount` and sending approval tx, another tab/tx could modify allowance. USDT-style tokens that require `approve(0)` first could revert silently.
- **Fix**: After approval tx completes, verify new allowance meets required amount before deposit. Add USDT zero-approval handling.

#### 4. Mint Hypercert: MarketplaceApprovalGate hardcoded English strings (i18n)
- **Location**: `packages/shared/src/components/MarketplaceApprovalGate.tsx:23,38-39,44-46,49-50,65-66,71-72`
- **Problem**: 12+ user-facing strings hardcoded in English. Component calls `useIntl()` but stores it in unused `_intl`.
- **Fix**: Rename `_intl` to `{ formatMessage }` and replace all hardcoded strings with `formatMessage()` calls.

#### 5. Mint Hypercert: Missing staleTime on marketplace approval query
- **Location**: `packages/shared/src/hooks/hypercerts/useMarketplaceApprovals.ts:41-48`
- **Problem**: No `staleTime` set (defaults to 0ms). Every remount/refocus re-checks both approvals on-chain. These are one-time approvals that rarely change.
- **Fix**: Add `staleTime: STALE_TIME_LONG` to query config.

#### 6. Mint Hypercert: Error toast not internationalized
- **Location**: `packages/shared/src/hooks/hypercerts/useMintHypercert.ts:456-460`
- **Problem**: Error toast uses hardcoded `title: "Hypercert minting failed"`.
- **Fix**: Use `formatMessage` for toast title. Map known error patterns to i18n keys.

#### 7. Work Approval: Client WorkApprovalDrawer manual useState validation (Rule 8)
- **Location**: `packages/client/src/views/Home/Garden/WorkApprovalDrawer.tsx:30-32`
- **Problem**: Uses `useState` for `feedbackMode`, `inlineFeedback`, `confidence` with manual validation. Admin `WorkDetail.tsx` correctly uses RHF + Zod.
- **Fix**: Migrate to lightweight `useForm` setup, or document intentional divergence for simple 2-field mobile drawer.

#### 8. Create Assessment: Duplicate formatDateRange implementations (DRY)
- **Location**: `packages/admin/src/views/Gardens/Garden/Assessment.tsx:205-221` AND `packages/admin/src/components/Assessment/CreateAssessmentSteps/shared.tsx:190-213`
- **Problem**: Two different implementations with different signatures and logic paths.
- **Fix**: Consolidate into a single utility in `@green-goods/shared`.

### MEDIUM (16 issues)

| # | Flow | Issue | Location | Rule |
|---|------|-------|----------|------|
| 1 | Work Sub | Address imported from `viem` not shared | `useWorkMutation.ts:13` | Rule 5 |
| 2 | Work Sub | Non-null assertions on gardenAddress/actionUID | `useWorkMutation.ts:135,136,152,199,200` | Type safety |
| 3 | Work Appr | Missing `useWorkApproval.test.ts` | No file exists | Testing |
| 4 | Work Appr | Repetitive EAS data parsing (6x same pattern) | `useWorkApprovals.ts:61-102` | DRY |
| 5 | Work Appr | `useBatchWorkSync` error toast lacks context | `useBatchWorkSync.ts:191-203` | Rule 4 |
| 6 | Garden | `communityToken` typed as `string` not `Address` | `useCreateGardenStore.ts:16` | Rule 5 |
| 7 | Garden | Duplicated CCIP fee estimation logic | `useCreateGardenWorkflow.ts:128-147` and `:262-276` | DRY |
| 8 | Assessment | Machine `isValid` guard doesn't match Zod schema | `createAssessment.ts:118-131` vs `shared.tsx:16-77` | Defense-in-depth |
| 9 | Assessment | `gardenId` typed as `string` not `Address` | `CreateAssessment.tsx:52`, `createAssessment.ts:18` | Rule 5 |
| 10 | Assessment | No analytics tracking on submission | `useCreateAssessmentWorkflow.ts:44-146` | Observability |
| 11 | Assessment | Hardcoded English error banner | `CreateAssessment.tsx:230-248` | i18n |
| 12 | Vault | `as any` cast in `useVaultPreview` | `useVaultPreview.ts:37` | Type safety |
| 13 | Vault | Manual form validation in DepositModal + DonationAddressConfig | `DepositModal.tsx:52-55`, `DonationAddressConfig.tsx:24-26` | Rule 8 |
| 14 | Vault | Allowance catch block too broad (swallows RPC errors) | `useVaultOperations.ts:84-88` | Rule 4 |
| 15 | Hypercert | `as unknown as` casts in XState machine actions | `mintHypercert.ts:147-185` | Type safety |
| 16 | Hypercert | `mutateAsync` leaking unhandled rejection | `useMarketplaceApprovals.ts:115` | Error handling |

### LOW (12 issues)

| # | Flow | Issue | Location |
|---|------|-------|----------|
| 1 | Work Sub | `useAsyncEffect` depends on `[work]` object, not primitives | `Work.tsx:361` |
| 2 | Work Sub | Missing `useWorkMutation.test.ts` | No file exists |
| 3 | Work Sub | `useJobQueueEvents` callback may have stale `intl` ref | `Work.tsx:280` |
| 4 | Work Appr | Missing focus trap in `WorkApprovalDrawer` | `WorkApprovalDrawer.tsx:127-131` |
| 5 | Work Appr | Ad-hoc `_isPending`/`_txHash` cache properties not typed | `useWorkApproval.ts:239,324-325` |
| 6 | Work Appr | Redundant `isSubmitting` state alongside `mutation.isPending` | `WorkDetail.tsx:138,164,199,241` |
| 7 | Garden | No i18n for confirmation dialog error messages | `CreateGarden.tsx:129-136` |
| 8 | Assessment | `nextDisabled` logic runs every render (not memoized) | `CreateAssessment.tsx:210-221` |
| 9 | Vault | Chained useMemo (`selectedVault` -> `assetSymbol`) | `DepositModal.tsx:63-71` |
| 10 | Vault | Gas estimate displayed as ETH amount (should be gas units) | `DepositModal.tsx:227` |
| 11 | Vault | No vault deposit test coverage | No files exist |
| 12 | Hypercert | No `HypercertDetail` test coverage | No files exist |

---

## UX Gaps Summary

| Flow | Gap | Impact |
|------|-----|--------|
| Work Submission | No progress indicator during retry | Users don't know how long retry takes |
| Work Submission | Metadata error notice at page bottom | Users may miss the error |
| Work Approval | No loading spinner in client drawer submit | No visual feedback during processing |
| Work Approval | No undo/confirmation for rejections | On-chain attestations are irreversible |
| Work Approval | Batch approval lacks progress indication | "3 of 10" would help for large batches |
| Create Garden | Step indicator clicks skip validation | Users can land on review with empty fields |
| Create Garden | No unsaved changes warning | Navigating away loses form data silently |
| Create Assessment | No step click navigation (can't jump back) | Users must click Back repeatedly |
| Create Assessment | No confirmation before submission | EAS attestations cost gas |
| Create Assessment | Draft loading has no UI indicator | Users don't know if editing a draft |
| Create Assessment | Error banner not accessible (no `role="alert"`) | Screen readers won't announce errors |
| Vault Deposit | Form state lost on error | Users must re-enter amount after failure |
| Mint Hypercert | No user feedback during marketplace approval tx | Two-step flow with no intermediate toast |

---

## Architectural Patterns Comparison

### Form State Management

| Flow | Pattern | Quality |
|------|---------|---------|
| Create Assessment | React Hook Form + Zod + zodResolver | **Best** — reference architecture |
| Work Approval (admin) | React Hook Form + Zod + zodResolver | **Good** — matches reference |
| Work Approval (client) | Manual useState + validation | **Needs migration** |
| Create Garden | Zustand store + imperative validation | **Needs migration** |
| Vault Deposit | Manual useState + useMemo validation | **Needs migration** |
| Mint Hypercert | Zustand wizard store + machine validation | **Acceptable** — complex wizard state justifies Zustand |

### Workflow Orchestration

| Flow | Pattern | Quality |
|------|---------|---------|
| Mint Hypercert | XState machine with smart retry + session recovery | **Best** — reference for complex multi-step |
| Create Assessment | XState with transient validation state | **Very Good** — clean machine design |
| Create Garden | XState + Zustand dual navigation | **Needs refactor** — sync risk |
| Work Submission | Mutation hook with auth branching | **Good** — appropriate for single-step |
| Work Approval | Mutation hook with optimistic updates | **Good** — appropriate for single-step |
| Vault Deposit | Mutation hook with two-phase toast | **Good** — appropriate for approve+deposit |

---

## Top 5 Prioritized Recommendations

### 1. Standardize on RHF + Zod for all wizard forms
- **Resolves**: HIGH #1 (garden), HIGH #7 (work approval drawer), MEDIUM #13 (vault)
- **Reference**: Create Assessment flow (`CreateAssessment.tsx:80-85`)
- **Effort**: Medium — garden flow needs most work (replace Zustand form store with RHF)

### 2. Fix Address type inconsistency (Rule 5)
- **Resolves**: MEDIUM #1, #6, #9; HIGH #4 (partial — Address import in HypercertDetail)
- **Effort**: Low — search-and-replace `import { Address } from "viem"` and `gardenId: string`

### 3. Internationalize Mint Hypercert flow
- **Resolves**: HIGH #4, #6; MEDIUM #11
- **Effort**: Low-Medium — wire up existing `useIntl()` import, add message IDs

### 4. Fix token approval race condition in vault deposit
- **Resolves**: HIGH #3
- **Effort**: Low — add post-approval allowance verification + USDT zero-approval handling

### 5. Add missing hook-level tests
- **Resolves**: MEDIUM #3; LOW #2, #11, #12
- **Files needed**: `useWorkMutation.test.ts`, `useWorkApproval.test.ts`, vault hook tests, `HypercertDetail.test.tsx`
- **Effort**: Medium — follow existing test patterns in `useBatchWorkApproval.test.ts`

---

## Implementation Order

```
Phase 1 (Quick wins — LOW effort, HIGH impact):
  [ ] Fix Address type imports across 4 flows
  [ ] Add staleTime to marketplace approval query
  [ ] Fix mutateAsync -> mutate in MarketplaceApprovalGate
  [ ] Consolidate duplicate formatDateRange
  [ ] Fix chained useMemo in DepositModal
  [ ] Fix gas estimate display (gas units, not ETH)

Phase 2 (Form standardization — MEDIUM effort):
  [ ] Migrate Create Garden to RHF + Zod
  [ ] Make XState machine authoritative for garden step navigation
  [ ] Migrate Vault DepositModal to useDepositForm + Zod
  [ ] Extract EAS data parsing helper in useWorkApprovals

Phase 3 (i18n + UX polish — MEDIUM effort):
  [ ] Internationalize MarketplaceApprovalGate (12+ strings)
  [ ] Internationalize useMintHypercert error toasts
  [ ] Internationalize CreateAssessment error banner
  [ ] Add focus trap to WorkApprovalDrawer
  [ ] Add role="alert" to assessment error banner
  [ ] Add gas confirmation dialog to assessment flow

Phase 4 (Safety + Testing — MEDIUM effort):
  [ ] Fix token approval race condition
  [ ] Narrow allowance catch block (distinguish revert vs RPC errors)
  [ ] Add useWorkMutation.test.ts
  [ ] Add useWorkApproval.test.ts
  [ ] Add vault hook tests
  [ ] Add HypercertDetail view tests
  [ ] Add analytics tracking to assessment submission
```
