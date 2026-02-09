# Action Creation Flow - Deep Audit

> Audit date: 2026-02-07 | Branch: feature/hats-protocol-v2

## Overview

Full audit of the action creation/editing flow in the admin package, covering state management, data flow, component design, effects, and architectural compliance. Findings are relevant to the **garden creation flow** which shares many of the same components (`FormWizard`, `FileUploadField`, `InstructionsBuilder`) and patterns (`useXxxOperations`, Zod schemas, IPFS uploads).

---

## Architecture Map

### Component Hierarchy

```
/actions (Actions index)
  └─ /actions/create (CreateAction - 4-step wizard)
       ├─ FormWizard (multi-step shell)
       │   ├─ StepIndicator (progress bar)
       │   └─ renderStep() switch → inline JSX for all 4 steps
       │       ├─ Step 0: Title + dates
       │       ├─ Step 1: Capitals + media (FileUploadField)
       │       ├─ Step 2: InstructionsBuilder
       │       │   ├─ MediaConfigSection
       │       │   ├─ DetailsConfigSection → InputFieldEditor[]
       │       │   └─ ReviewConfigSection
       │       └─ Step 3: Review summary
       └─ onSubmit → IPFS upload → registerAction()

  └─ /actions/:id (ActionDetail - read-only)

  └─ /actions/:id/edit (EditAction - flat form)
       ├─ Basic fields (title, dates) via useState
       ├─ InstructionsBuilder (toggle edit mode)
       └─ handleSubmit → conditional updates per field
```

### Data Flow

```
User Input → React Hook Form (CreateAction) / useState (EditAction)
    → Zod validation (CreateAction only)
    → IPFS upload (media files + instructions JSON)
    → useActionOperations hook
        → simulateTransaction() (dry run)
        → walletClient.writeContract() (on-chain)
        → useDelayedInvalidation (5s refetch)
    → Indexer picks up events → GraphQL API
    → useActions() query → UI update
```

---

## Files Audited

| File | Lines | Role |
|------|-------|------|
| `packages/admin/src/views/Actions/CreateAction.tsx` | 382 | Wizard view with inline Zod schema |
| `packages/admin/src/views/Actions/EditAction.tsx` | 232 | Flat form with raw useState |
| `packages/admin/src/views/Actions/ActionDetail.tsx` | 107 | Read-only detail view |
| `packages/admin/src/components/Action/InstructionsBuilder.tsx` | 106 | Tab-based instruction config editor |
| `packages/admin/src/components/Action/MediaConfigSection.tsx` | 239 | Media validation settings |
| `packages/admin/src/components/Action/DetailsConfigSection.tsx` | 362 | Dynamic form input builder |
| `packages/admin/src/components/Action/ReviewConfigSection.tsx` | 43 | Review section settings |
| `packages/admin/src/components/Form/FormWizard.tsx` | 158 | Multi-step wizard shell |
| `packages/admin/src/components/Form/StepIndicator.tsx` | 122 | Step progress visualization |
| `packages/admin/src/components/FileUploadField.tsx` | 207 | File upload with compression |
| `packages/shared/src/hooks/action/useActionOperations.ts` | 539 | Contract interaction hook |
| `packages/shared/src/utils/action/templates.ts` | 183 | Instruction templates |
| `packages/shared/src/utils/action/parsers.ts` | 75 | Action UID parsing utilities |
| `packages/shared/src/types/domain.ts` | 345+ | Action/WorkInput/Capital types |

---

## Findings

### Category 1: State Management

#### FINDING-1: EditAction uses raw useState (HIGH)

**Location**: `packages/admin/src/views/Actions/EditAction.tsx:29-35`

CreateAction correctly uses `useForm<CreateActionForm>` + Zod. EditAction has 6 separate `useState` calls with zero validation. Empty titles, `endTime < startTime`, and malformed instruction configs can all be submitted.

```typescript
// EditAction.tsx - no validation anywhere
const [title, setTitle] = useState("");
const [startTime, setStartTime] = useState<Date>(new Date());
const [endTime, setEndTime] = useState<Date>(new Date());
const [instructionConfig, setInstructionConfig] = useState(defaultTemplate);
const [isEditingInstructions, setIsEditingInstructions] = useState(false);
const [isLoadingInstructions, setIsLoadingInstructions] = useState(false);
```

**Violates**: Architectural Rule #8 (React Hook Form + Zod for all forms)

**Fix**: Create `useEditActionForm(action)` in shared package, mirror `useWorkForm.ts` pattern.

---

#### FINDING-2: useActionOperations is 539 lines of copy-paste (HIGH)

**Location**: `packages/shared/src/hooks/action/useActionOperations.ts`

6 functions (`registerAction`, `updateActionTitle`, `updateActionStartTime`, `updateActionEndTime`, `updateActionInstructions`, `updateActionMedia`) all repeat the identical pattern:

```
wallet guard → setIsLoading(true) → simulateTransaction() → executeWithToast() → scheduleBackgroundRefetch() → parseContractError() → setIsLoading(false)
```

**Additional issue**: Single shared `isLoading` state means if two operations fire, the first to complete clears loading for both.

**Fix**: Use factory pattern from `createGardenOperation.ts` (already exists at `packages/shared/src/hooks/garden/createGardenOperation.ts`).

---

#### FINDING-3: Zod schema defined inline in view component (MEDIUM)

**Location**: `packages/admin/src/views/Actions/CreateAction.tsx:21-59`

`createActionSchema` and `instructionInputSchema` are defined at the top of the view file. Not reusable by EditAction, tests, or other consumers.

**Fix**: Move to `packages/shared/src/hooks/action/useActionForm.ts` alongside form hooks.

---

### Category 2: Component Design

#### FINDING-4: 230-line renderStep() switch statement (HIGH)

**Location**: `packages/admin/src/views/Actions/CreateAction.tsx:125-355`

All 4 wizard steps are inline JSX in a single function. Issues:
- Case 1 defines `CAPITALS_OPTIONS` array on every render (line 195-204)
- Case 3 uses `form.getValues()` which doesn't trigger re-renders (review step won't update if user goes back and changes values)
- Makes the file hard to navigate and test

**Fix**: Extract to `components/Action/steps/{BasicsStep,CapitalsMediaStep,InstructionsStep,ReviewStep}.tsx`

---

#### FINDING-5: Duplicated "tag list" UI pattern (MEDIUM)

**Locations**:
- `MediaConfigSection.tsx:14-46` (needed shots + optional shots = 2 instances)
- `DetailsConfigSection.tsx:168-179` (select options in InputFieldEditor = 1 instance)

The "text input + add button + removable items + Enter key handler" pattern appears 3-4 times with identical structure but different variable names.

**Fix**: Extract `TagListInput` component to `components/Form/TagListInput.tsx`.

---

#### FINDING-6: FileUploadField blob URL memory leak (MEDIUM)

**Location**: `packages/admin/src/components/FileUploadField.tsx:123-128`

```typescript
const getFilePreviewUrl = (file: File): string | null => {
  if (previewableImageTypes.has(file.type)) {
    return URL.createObjectURL(file); // Called on EVERY render, never revoked
  }
  return null;
};
```

Blob URLs accumulate without cleanup. CLAUDE.md explicitly warns: "Always revoke blob URLs."

**Fix**: Track URLs in `useRef<Map>`, add cleanup `useEffect`.

---

#### FINDING-7: InstructionsBuilder tab content unmounts on switch (LOW)

**Location**: `packages/admin/src/components/Action/InstructionsBuilder.tsx:71-90`

Conditional rendering (`activeTab === "media" && <MediaConfigSection />`) destroys component state on tab switch. Currently works because all state is lifted to parent, but prevents future use of local editing state.

**Deferred**: Not a real bug today.

---

### Category 3: Effects & Data Flow

#### FINDING-8: No per-step validation in wizard (MEDIUM)

**Location**: `packages/admin/src/views/Actions/CreateAction.tsx:357-359`

```typescript
const handleNext = () => {
  setCurrentStep((prev) => Math.min(prev + 1, stepConfigs.length - 1));
};
```

Blindly increments without validating. User can reach step 4 with empty title, then gets validation error on submit. React Hook Form supports `form.trigger(fieldNames)` for per-step validation.

**Fix**: Add `STEP_FIELDS` mapping and call `form.trigger()` before advancing.

---

#### FINDING-9: EditAction IPFS fetch has no async safety (MEDIUM)

**Location**: `packages/admin/src/views/Actions/EditAction.tsx:47-68`

```typescript
useEffect(() => {
  async function loadInstructions() {
    // No AbortController, no isMounted guard
    const response = await fetch(action.instructions);
    const config = await response.json();
    setInstructionConfig(config); // State update after unmount risk
  }
  loadInstructions();
}, [action?.instructions]);
```

**Violates**: Architectural Rule #3 (async cleanup race prevention)

**Fix**: Use `useAsyncEffect` from `@green-goods/shared` or manual AbortController.

---

#### FINDING-10: IPFS upload response not validated (LOW)

**Location**: `packages/admin/src/views/Actions/CreateAction.tsx:91-94`

```typescript
const mediaUploads = await Promise.all(
  data.media.map((file: File) => uploadFileToIPFS(file))
);
const mediaCIDs = mediaUploads.map((upload: { cid: string }) => upload.cid);
// Assumes cid exists without checking
```

If IPFS upload partially fails or returns unexpected shape, corrupted data goes on-chain.

---

### Category 4: Architectural Compliance

#### FINDING-11: console.error in production code (LOW)

**Locations**:
- `EditAction.tsx:57` - `console.error("Failed to load instructions:", error)`
- `EditAction.tsx:119` - `console.error("Failed to update action:", error)`
- `FileUploadField.tsx:86` - `console.error("File processing failed:", error)`

**Violates**: Architectural Rule #12

**Fix**: Replace with `debugError` from `@green-goods/shared`.

---

#### FINDING-12: Deep imports from @green-goods/shared (LOW)

**Locations**:
- `CreateAction.tsx:9` - `import { useActionOperations } from "@green-goods/shared/hooks"`
- `CreateAction.tsx:10` - `import { debugError } from "@green-goods/shared/utils/debug"`
- `EditAction.tsx:10` - `import { useActionOperations, useActions } from "@green-goods/shared/hooks"`
- `FormWizard.tsx:1` - `import { cn } from "@green-goods/shared/utils"`

**Violates**: Architectural Rule #11 (barrel import enforcement)

**Fix**: Import from `@green-goods/shared` root.

---

#### FINDING-13: Manual UID parsing instead of utility (LOW)

**Location**: `packages/admin/src/views/Actions/EditAction.tsx:86`

```typescript
const actionUID = id!.split("-")[1]; // Manual string splitting
```

`parseActionUID()` already exists at `packages/shared/src/utils/action/parsers.ts` specifically for this.

---

#### FINDING-14: No unsaved changes warning (LOW)

Neither CreateAction nor EditAction warns before navigation if form has changes. User can accidentally lose complex instruction configurations.

**Deferred**: New feature, not quality fix.

---

## Positive Patterns Found

These are done well and should be preserved/replicated:

- **CreateAction** correctly uses React Hook Form + Zod (just needs schema extraction)
- **FormWizard** has proper timer cleanup, ARIA live regions, screen reader announcements
- **useActionOperations** uses `useDelayedInvalidation` for indexer sync (Rule #1 compliant)
- **useActionOperations** simulates transactions before execution (catches errors pre-submission)
- **InstructionsBuilder** has clean state lifting with typed `updateUIConfig` helper
- **FileUploadField** has good security: `sanitizeFileName()` strips HTML meta-characters
- **Templates** (`packages/shared/src/utils/action/templates.ts`) are well-structured and reusable

---

## Shared Components Used by Both Action and Garden Flows

These components and patterns are used across both action creation and garden creation:

| Component/Pattern | Action Flow | Garden Flow | Notes |
|-------------------|-------------|-------------|-------|
| `FormWizard` | CreateAction wizard | Garden creation wizard | Same component, different steps |
| `StepIndicator` | Used via FormWizard | Used via FormWizard | Shared |
| `FileUploadField` | Media upload (step 1) | Banner image upload | Same blob URL leak |
| `useXxxOperations` factory | `useActionOperations` | `useGardenOperations` | Garden already uses factory pattern |
| `createXxxOperation` | Needs creation (FINDING-2) | `createGardenOperation.ts` exists | Garden is the reference pattern |
| `useXxxForm` hooks | Needs creation (FINDING-3) | Check if garden has this | Should both follow `useWorkForm.ts` |
| `toastService` | Used in submit handlers | Used in submit handlers | Consistent |
| `uploadFileToIPFS` | Media + instructions | Banner images | Same IPFS integration |
| `useDelayedInvalidation` | Indexer sync after tx | Indexer sync after tx | Both correctly use this |
| Barrel imports | Multiple violations | Check garden flow | Rule #11 |

---

## Reference Patterns in Codebase

These existing patterns should be followed for any fixes:

| Pattern | Reference File | Use For |
|---------|---------------|---------|
| Form hook + Zod schema | `packages/shared/src/hooks/work/useWorkForm.ts` | Creating `useActionForm.ts`, `useGardenForm.ts` |
| Operation factory | `packages/shared/src/hooks/garden/createGardenOperation.ts` | Creating `createActionOperation.ts` |
| Async effect safety | `packages/shared/src/hooks/utils/useAsyncEffect.ts` | Fixing IPFS fetch in EditAction |
| Delayed invalidation | `packages/shared/src/hooks/utils/useTimeout.ts` | Already used correctly in `useActionOperations` |
| Action UID parsing | `packages/shared/src/utils/action/parsers.ts` | Replacing manual `id.split("-")` calls |
| Query keys | `packages/shared/src/hooks/query-keys.ts` | `queryKeys.actions.byChain(chainId)` |

---

## Implementation Plan (3 Batches)

### Batch 1: Shared Foundation
1. Create `packages/shared/src/hooks/action/useActionForm.ts` (Zod schemas + form hooks)
2. Create `packages/shared/src/hooks/action/createActionOperation.ts` (factory)
3. Refactor `useActionOperations.ts` to use factory (539 → ~80-100 lines)
4. Fix barrel exports in `packages/shared/src/index.ts`

### Batch 2: Wizard Step Extraction (depends on Batch 1)
1. Extract 4 step components from `CreateAction.tsx` renderStep()
2. Add per-step validation via `form.trigger()`
3. Slim down CreateAction to ~80-100 lines
4. Fix deep imports, use `useCreateActionForm`

### Batch 3: EditAction Unification (depends on Batch 1)
1. Convert EditAction to React Hook Form with `useEditActionForm`
2. Fix async IPFS fetch with `useAsyncEffect`
3. Use `parseActionUID` utility
4. Fix barrel imports and `console.error`

### Verification
```bash
bun format && bun lint && bun --filter shared test && bun --filter admin test && bun --filter shared build && bun --filter admin build
```
