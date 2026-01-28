# Hypercert Wizard Final Polish - Agent Handoff

**Objective:** Elevate the hypercert minting wizard from 8.5/10 to 9.5-10/10 by implementing the remaining UI/UX improvements identified in the design review.

**Current State:** The wizard is functional and well-structured with good accessibility foundations. Recent improvements added skeleton loading, clickable suggested scopes, visual progress bar, date validation, and enhanced empty states.

---

## Context & Key Files

### Wizard Components (modify these)
```
packages/admin/src/components/hypercerts/
├── HypercertWizard.tsx              # Main orchestrator
└── steps/
    ├── AttestationSelector.tsx       # Step 1 - Work selection
    ├── MetadataEditor.tsx            # Step 2 - Form fields
    ├── HypercertPreview.tsx          # Step 3 - Preview card
    ├── DistributionConfig.tsx        # Step 4 - Token allocation
    └── MintProgress.tsx              # Step 5 - Minting status
```

### Shell Components (modify these)
```
packages/admin/src/components/Form/
├── FormWizard.tsx                    # Wizard shell with navigation
└── StepIndicator.tsx                 # Progress header
```

### Views (modify these)
```
packages/admin/src/views/Gardens/Garden/
├── Hypercerts.tsx                    # List view
└── HypercertDetail.tsx               # Detail view
```

### i18n Files (add new keys)
```
packages/shared/src/i18n/
├── en.json
├── es.json
└── pt.json
```

### Design System Reference
- Tailwind v4 with Green Goods tokens
- See `packages/shared/src/styles/` for design tokens
- Use `cn()` utility from `@green-goods/shared/utils` for conditional classes
- Icons from `@remixicon/react`

---

## High Priority Tasks (Must Do)

### 1. Add Required Field Indicators

**Goal:** Visually indicate which fields are required with an asterisk (*).

**Files:** `MetadataEditor.tsx`

**Specification:**

```tsx
// Add a RequiredLabel component or inline the asterisk
<label>
  {formatMessage({ id: "app.hypercerts.metadata.title" })}
  <span className="ml-0.5 text-error-base" aria-hidden="true">*</span>
</label>
```

**Required fields to mark:**
- Title (required)
- Work Scope (required - at least one)
- Work Timeframe Start (required)
- Work Timeframe End (required)

**i18n:** Add `"app.form.required": "Required"` for screen reader text.

**Accessibility:** Add `aria-required="true"` to required inputs and visually hidden "(required)" text.

---

### 2. Make Completed Steps Clickable

**Goal:** Allow users to click on completed steps to navigate back without using the Back button repeatedly.

**Files:** `StepIndicator.tsx`, `FormWizard.tsx`

**Specification:**

In `StepIndicator.tsx`:
```tsx
interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void; // NEW PROP
}

// In the render, make completed steps clickable:
{completed ? (
  <button
    type="button"
    onClick={() => onStepClick?.(index)}
    className="flex h-6 w-6 ... cursor-pointer hover:ring-2 hover:ring-primary-light"
    aria-label={formatMessage(
      { id: "app.hypercerts.wizard.goToStep" },
      { step: step.title }
    )}
  >
    <RiCheckboxCircleLine className="h-3.5 w-3.5" />
  </button>
) : (
  // ... existing non-clickable span
)}
```

In `FormWizard.tsx`:
- Pass `onStepClick` handler that calls the workflow's `goToStep(index)` function
- Only allow clicking completed steps (index < currentStep)

In `HypercertWizard.tsx`:
- Add `goToStep` to the workflow hook or implement step navigation logic

**i18n keys:**
```json
"app.hypercerts.wizard.goToStep": "Go to {step}"
```

---

### 3. Focus Management on Step Transitions

**Goal:** When navigating to a new step, focus the first interactive element for keyboard users.

**Files:** `FormWizard.tsx`, each step component

**Specification:**

Option A - Ref-based (preferred):
```tsx
// In FormWizard.tsx
const contentRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  // Focus first focusable element in step content after transition
  const firstFocusable = contentRef.current?.querySelector<HTMLElement>(
    'input, button, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  firstFocusable?.focus();
}, [currentStep]);

// Wrap children
<div ref={contentRef} className="mx-auto max-w-4xl ...">
  {children}
</div>
```

Option B - Step-specific autofocus:
```tsx
// In AttestationSelector.tsx
<FormInput
  id="attestation-search"
  autoFocus // Add this
  ...
/>
```

---

### 4. Add Hypercert Image to Detail View

**Goal:** Display the hypercert NFT image in the detail view for visual verification.

**Files:** `HypercertDetail.tsx`

**Specification:**
```tsx
import { ImageWithFallback } from "@green-goods/shared";

// In the main content section, add image display:
{hypercert.image && (
  <section className="rounded-lg border border-stroke-soft bg-bg-white p-6 shadow-sm">
    <h3 className="text-sm font-semibold text-text-strong">
      {formatMessage({ id: "app.hypercerts.detail.image" })}
    </h3>
    <div className="mt-3 aspect-square max-w-xs overflow-hidden rounded-lg border border-stroke-soft">
      <ImageWithFallback
        src={hypercert.image}
        alt={hypercert.title || formatMessage({ id: "app.hypercerts.detail.imageAlt" })}
        className="h-full w-full object-cover"
      />
    </div>
  </section>
)}
```

**i18n keys:**
```json
"app.hypercerts.detail.image": "Hypercert Image",
"app.hypercerts.detail.imageAlt": "Hypercert NFT image"
```

**Note:** Ensure `HypercertRecord` type includes `image?: string` field. Check the indexer/GraphQL schema.

---

## Medium Priority Tasks (Should Do)

### 5. Truncate Addresses with Copy Button

**Goal:** Make long Ethereum addresses scannable with copy functionality.

**Files:** `DistributionConfig.tsx`

**Specification:**

```tsx
import { RiFileCopyLine } from "@remixicon/react";

function TruncatedAddress({ address, label }: { address: string; label?: string }) {
  const { formatMessage } = useIntl();
  const [copied, setCopied] = useState(false);

  const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-1">
      <span title={address} className="font-mono text-xs">
        {label || truncated}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="rounded p-0.5 text-text-sub hover:bg-bg-weak hover:text-text-strong"
        aria-label={formatMessage({ id: "app.common.copyAddress" })}
      >
        {copied ? (
          <RiCheckLine className="h-3 w-3 text-success-base" />
        ) : (
          <RiFileCopyLine className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}
```

Replace the raw address display in the distribution table with this component.

**i18n keys:**
```json
"app.common.copyAddress": "Copy address",
"app.common.copied": "Copied!"
```

---

### 6. Add Loading Skeletons to List/Detail Views

**Goal:** Replace text loading indicators with skeleton placeholders.

**Files:** `Hypercerts.tsx`, `HypercertDetail.tsx`

**Specification for Hypercerts.tsx:**
```tsx
{isLoading && (
  <div className="grid gap-4">
    {[1, 2, 3].map((i) => (
      <div
        key={i}
        className="animate-pulse rounded-lg border border-stroke-soft bg-bg-white p-4"
      >
        <div className="flex justify-between">
          <div className="space-y-2">
            <div className="h-5 w-48 rounded bg-bg-soft" />
            <div className="h-3 w-32 rounded bg-bg-soft" />
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-24 rounded bg-bg-soft" />
            <div className="h-8 w-28 rounded bg-bg-soft" />
          </div>
        </div>
        <div className="mt-3 flex gap-4">
          <div className="h-4 w-24 rounded bg-bg-soft" />
          <div className="h-4 w-32 rounded bg-bg-soft" />
          <div className="h-4 w-40 rounded bg-bg-soft" />
        </div>
      </div>
    ))}
  </div>
)}
```

**Specification for HypercertDetail.tsx:**
```tsx
{isLoading && (
  <div className="space-y-6">
    <div className="animate-pulse rounded-lg border border-stroke-soft bg-bg-white p-6">
      <div className="flex justify-between">
        <div className="space-y-2 flex-1">
          <div className="h-6 w-64 rounded bg-bg-soft" />
          <div className="h-4 w-full max-w-md rounded bg-bg-soft" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-32 rounded bg-bg-soft" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="h-4 w-24 rounded bg-bg-soft" />
        <div className="h-4 w-20 rounded bg-bg-soft" />
        <div className="h-4 w-28 rounded bg-bg-soft" />
      </div>
    </div>
  </div>
)}
```

---

### 7. Add Edit Shortcuts in Preview Step

**Goal:** Allow quick navigation back to edit specific fields from the preview.

**Files:** `HypercertPreview.tsx`

**Specification:**
```tsx
interface HypercertPreviewProps {
  // ... existing props
  onEditMetadata?: () => void; // NEW - navigates to step 2
}

// Add edit button next to metadata section header:
<div className="flex items-center justify-between">
  <p className="text-xs uppercase tracking-wide text-text-soft">
    {formatMessage({ id: "app.hypercerts.preview.workScope" })}
  </p>
  {onEditMetadata && (
    <button
      type="button"
      onClick={onEditMetadata}
      className="text-xs text-primary-base hover:underline"
    >
      {formatMessage({ id: "app.hypercerts.preview.edit" })}
    </button>
  )}
</div>
```

**i18n keys:**
```json
"app.hypercerts.preview.edit": "Edit"
```

In `HypercertWizard.tsx`, pass the handler:
```tsx
<HypercertPreview
  // ... existing props
  onEditMetadata={() => goToStep(2)} // Navigate to metadata step
/>
```

---

## Low Priority Tasks (Nice to Have)

### 8. i18n Footer Button Labels

**Goal:** Internationalize the hard-coded "Back", "Cancel", "Submitting…" labels.

**Files:** `FormWizard.tsx`

**Specification:**
```tsx
// Add useIntl hook
const { formatMessage } = useIntl();

// Replace hard-coded strings:
<button>
  <RiArrowLeftLine className="h-4 w-4" />
  {formatMessage({ id: "app.wizard.back" })}
</button>

<button>
  {formatMessage({ id: "app.wizard.cancel" })}
</button>

{isSubmitting ? (
  <>
    <RiLoader4Line className="h-4 w-4 animate-spin" />
    {formatMessage({ id: "app.wizard.submitting" })}
  </>
) : (
  submitLabel
)}
```

**i18n keys:**
```json
"app.wizard.back": "Back",
"app.wizard.cancel": "Cancel",
"app.wizard.submitting": "Submitting…"
```

---

### 9. Add Time Estimate During Minting

**Goal:** Set user expectations for minting duration.

**Files:** `MintProgress.tsx`

**Specification:**
```tsx
// Add helper text below progress bar:
{!isComplete && !isFailed && (
  <p className="mt-1 text-xs text-text-sub">
    {formatMessage({ id: "app.hypercerts.mint.status.helper" })}
    {" "}
    <span className="text-text-soft">
      {formatMessage({ id: "app.hypercerts.mint.timeEstimate" })}
    </span>
  </p>
)}
```

**i18n keys:**
```json
"app.hypercerts.mint.timeEstimate": "This usually takes 30-60 seconds."
```

---

### 10. Add aria-current to Active Step

**Goal:** Improve screen reader navigation in step indicator.

**Files:** `StepIndicator.tsx`

**Specification:**
```tsx
<li
  key={step.id}
  aria-current={active ? "step" : undefined} // ADD THIS
  className={cn(...)}
>
```

---

### 11. Character Count for Description

**Goal:** Show users how much they've typed in the description field.

**Files:** `MetadataEditor.tsx`

**Specification:**
```tsx
const MAX_DESCRIPTION_LENGTH = 1000; // Or whatever limit makes sense

<div className="relative">
  <FormTextarea
    id="hypercert-description"
    // ... existing props
    maxLength={MAX_DESCRIPTION_LENGTH}
  />
  <span className="absolute bottom-2 right-2 text-xs text-text-soft">
    {draft.description.length}/{MAX_DESCRIPTION_LENGTH}
  </span>
</div>
```

---

## Validation Checklist

After implementing changes, verify:

- [ ] `bun run --filter @green-goods/admin lint` passes
- [ ] `bun run --filter @green-goods/admin build` succeeds
- [ ] `npx tsc --noEmit` in admin package has no errors
- [ ] All new i18n keys added to en.json, es.json, pt.json
- [ ] Tab through entire wizard flow - focus order is logical
- [ ] Screen reader test: step changes announced, required fields indicated
- [ ] Mobile test: 320px-375px widths work correctly
- [ ] Complete happy path: create hypercert end-to-end

---

## Design Tokens Reference

| Token | Usage |
|-------|-------|
| `bg-bg-soft` | Skeleton placeholder color |
| `text-error-base` | Required asterisk, error text |
| `text-primary-base` | Edit links, interactive text |
| `border-stroke-soft` | Card borders |
| `hover:ring-2 hover:ring-primary-light` | Focus/hover states |

---

## Expected Outcome

After completing these tasks:
- **Required field indicators** make form requirements clear
- **Clickable steps** reduce navigation friction
- **Focus management** improves keyboard accessibility
- **Hypercert image** provides visual verification
- **Address truncation** improves scannability
- **Loading skeletons** reduce perceived wait time
- **Edit shortcuts** streamline the editing workflow

**Target quality: 9.5-10/10**

---

## Commands

```bash
# Start dev server
bun dev  # Then visit http://localhost:3002

# Lint
bun run --filter @green-goods/admin lint

# Type check
cd packages/admin && npx tsc --noEmit

# Build
bun run --filter @green-goods/admin build

# Full validation
bun format && bun lint && bun run --filter @green-goods/admin build
```
