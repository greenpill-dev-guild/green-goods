# Garden Creation & Assessment Flow — Production Readiness Review

**Date**: 2026-02-18
**Branch**: `feature/ens-integration`
**Scope**: Garden creation, assessment creation, and work submission flows across shared hooks, state machines, stores, providers, modules, and client/admin views.
**Files reviewed**: 90+ across `packages/shared/`, `packages/client/`, `packages/admin/`, `packages/contracts/`

---

## Important Findings (3)

### 1. Assessment machine: no `CLOSE` transition in `submitting` state

**File**: `packages/shared/src/workflows/createAssessment.ts:157-173`
**Severity**: Important
**Status**: [ ] To fix

The `createAssessmentMachine`'s `submitting` state has no `CLOSE` event handler. If the EAS attestation + IPFS uploads take a long time (which they can), the user is stuck with no way to abort. The garden creation machine correctly includes this escape hatch.

**Fix**: Add `on: { CLOSE: { target: "idle", actions: "clearContext" } }` to the `submitting` state, matching `createGardenMachine`.

```diff
 submitting: {
   entry: "clearError",
   invoke: {
     src: "submitAssessment",
     input: ({ context }) =>
       context.assessmentParams as AssessmentWorkflowParams & { gardenId: Address },
     onDone: { target: "success", actions: "storeTxHash" },
     onError: { target: "error", actions: ["storeFailure", "incrementRetry"] },
   },
+  on: {
+    CLOSE: { target: "idle", actions: "clearContext" },
+  },
 },
```

---

### 2. Partial IPFS upload failure not surfaced to user

**File**: `packages/shared/src/hooks/assessment/useCreateAssessmentWorkflow.ts:131-149`
**Severity**: Important
**Status**: [ ] To fix

When evidence media uploads partially fail (some succeed, some rejected via `Promise.allSettled`), the code logs a warning but continues with only the successful uploads. The user sees a "success" attestation that is missing evidence files with no indication of the partial failure.

**Fix**: After detecting partial failures, surface a warning toast before continuing. Example:

```ts
if (failed.length > 0) {
  logger.warn("Some evidence media uploads failed", { ... });
  // Surface to user
  toastService.warning({
    title: `${failed.length} of ${params.evidenceMedia.length} files failed to upload`,
    message: "The assessment was created with partial evidence. You can add more files later.",
    context: "assessment creation",
  });
}
```

---

### 3. Gardener/operator UX gap in garden creation wizard

**File**: `packages/shared/src/stores/useCreateGardenStore.ts:246-263`, `packages/shared/src/hooks/garden/useCreateGardenWorkflow.ts:192-219`
**Severity**: Important (UX, not code bug)
**Status**: [ ] Design decision needed

The garden creation form collects gardeners and operators in the "Team" step (Zod schema requires `min(1)` for both). The review step displays them. But the contract's `GardenConfig` struct doesn't include team members — `mintGarden` only grants the `Owner` role to `msg.sender`. The collected addresses are silently dropped after minting.

**Options**:
- **(a) Remove team step** — simplest, but loses the onboarding guidance
- **(b) Auto-add members post-mint** — call `HatsModule.grantRole` for each gardener/operator after the `mintGarden` tx succeeds. Requires multiple additional on-chain transactions and wallet confirmations.
- **(c) Clarify UX** — keep the team step but clearly label it as "planned team members" and redirect to garden management page post-creation with a prompt to add them. Remove `min(1)` Zod requirement or make it advisory.

---

## Moderate Findings (6)

### 4. `zodResolver(schema as any)` type escape in work form

**File**: `packages/shared/src/hooks/work/useWorkForm.ts:113`
**Status**: [ ] To fix

The `as any` cast bypasses type checking between the dynamic Zod schema and `WorkFormData`. Pin `@hookform/resolvers` to a version with clean types, or add a runtime assertion.

### 5. 10+ ref/useEffect pairs for mutable dependencies

**File**: `packages/shared/src/hooks/garden/useCreateGardenWorkflow.ts:116-165`
**Status**: [ ] To fix

10 separate `useRef` + `useEffect` pairs keep refs current for the XState machine actor. Fragile if new deps are added. Consolidate into a `useLatestRef` utility or a single deps-object ref.

### 6. Triple context nesting for backward compatibility

**File**: `packages/shared/src/providers/Work.tsx:407-413`
**Status**: [ ] Track for cleanup

`WorkSelectionContext`, `WorkFormContext`, and legacy `WorkContext` all rendered. The `useWork()` hook is marked `@deprecated`. Track removal of legacy context.

### 7. `validateWorkSubmissionContext` defaults `minRequired` to 1

**File**: `packages/shared/src/modules/work/work-submission.ts:145`
**Status**: [ ] To fix

Default of 1 minimum image may surprise callers when the selected action sets `mediaInfo.required = false` (which should allow 0 images). The `WorkProvider` correctly passes the computed value, but direct callers would get the wrong default. Change default to 0 or make the parameter required.

### 8. Assessment draft: no auto-save on store changes

**File**: `packages/shared/src/hooks/assessment/useAssessmentDraft.ts:226-239`
**Status**: [ ] To fix

Unlike `useGardenDraft` which subscribes to Zustand store changes with debounced saves, the assessment draft only saves on periodic intervals (60s) and explicit `saveDraft()` calls. Up to 60 seconds of form data could be lost on tab close.

### 9. `debugError` instead of `logger` in CreateAction

**File**: `packages/admin/src/views/Actions/CreateAction.tsx:79`
**Status**: [ ] To fix

Per TypeScript Rule 12, production code should use `logger` from shared. The `debugError` utility only logs when debug mode is enabled. Action creation failures should always be logged and the error toast should include context fields.

---

## Minor Findings (5)

### 10. Type assertions in machine actions

**File**: `packages/shared/src/workflows/createGarden.ts:69`
**Status**: [ ] Low priority

`(event as SubmitDoneEvent).output` is safe because XState guarantees event type in `onDone`, but newer XState versions provide typed `event` in `assign()`.

### 11. `asessmentFetchStatus` typo

**Files**: `packages/client/src/components/Features/Garden/Assessments.tsx:20,26`, `packages/client/src/views/Home/Garden/index.tsx`
**Status**: [ ] To fix

Prop name missing an 's': `asessmentFetchStatus` → `assessmentFetchStatus`. Requires updating both the component definition and all consumers.

### 12. `ADDRESS_REGEX` dead export

**File**: `packages/shared/src/stores/useCreateGardenStore.ts:58`
**Status**: [ ] To fix

Exported from barrel (`stores/index.ts`) but never imported by any consumer. Can be removed.

### 13. `const` declarations inside switch cases without block scope

**File**: `packages/admin/src/views/Actions/CreateAction.tsx:153,308`
**Status**: [ ] Low priority

`const` declared in switch cases without `{}` blocks. Functional but a linter anti-pattern.

### 14. Audio notes read from store without snapshot

**File**: `packages/shared/src/providers/Work.tsx:243`
**Status**: [ ] Low priority

`useWorkFlowStore.getState().audioNotes` is read synchronously during submission without `.slice()` snapshot, unlike images which are correctly snapshot'd.

---

## Verified Non-Issues

- **Deploy button disabled on estimation error** — initially flagged but user can close the dialog and click "Deploy garden" again, which resets the error state. Not a real blocker.
- **Garden draft auto-save reference equality** — correctly documented in code comments; Zustand's `set()` creates new object references on every update, so `===` comparison works.

---

## Architecture Positives

- XState machines for flow control with clean state/event separation
- IndexedDB draft persistence with race condition handling (`loadRequestIdRef`)
- Transaction simulation before `writeContract` to catch reverts pre-gas
- Optimistic cache updates with rollback in `useWorkMutation`
- Mutation locking + `beforeunload` warning during pending transactions
- Split contexts in `WorkProvider` for render optimization
- Full analytics tracking (started/success/failed) on every flow
- Graceful CCIP fee estimation degradation (returns 0n on failure)
