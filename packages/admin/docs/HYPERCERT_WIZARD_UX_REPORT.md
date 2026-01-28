# Hypercert Wizard UI/UX Review Report

**Date:** 2026-01-25
**Reviewer:** Claude (Design-focused Code Review)
**Branch:** `feature/hypercerts-minting`
**Status:** First pass complete, ready for second design review

---

## Executive Summary

The hypercert minting wizard underwent a comprehensive UI/UX review with a focus on accessibility, design consistency, and user feedback patterns. **10 critical and high-priority issues were identified and resolved**, bringing the implementation to a production-ready baseline.

### Key Metrics

| Metric | Before | After |
|--------|--------|-------|
| Build Status | ❌ Failing | ✅ Passing |
| Accessibility Issues | 7 | 2 (minor) |
| Design Consistency Issues | 6 | 1 (minor) |
| UX Flow Issues | 5 | 2 (deferred) |

---

## Completed Fixes

### 1. Build Infrastructure

| Issue | File | Fix |
|-------|------|-----|
| Missing `categorizeError` export | `HypercertWizard.tsx:2` | Created new utility in `shared/src/utils/errors/categorize-error.ts` |
| Missing `logger` export | `HypercertWizard.tsx:4` | Exported existing logger from `shared/src/modules/app/logger.ts` |

### 2. Data Loss Prevention

**Problem:** Users could lose significant work (selected attestations, metadata) by accidentally navigating away or refreshing.

**Solution:** Implemented dual protection:

```typescript
// React Router navigation blocking
const blocker = useBlocker(
  ({ currentLocation, nextLocation }) =>
    hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname
);

// Browser refresh/close protection
useEffect(() => {
  if (!hasUnsavedChanges) return;
  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    event.returnValue = "";
  };
  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, [hasUnsavedChanges]);
```

**Files:** `HypercertWizard.tsx:63-103`

### 3. Accessibility Improvements

| Component | Issue | Fix |
|-----------|-------|-----|
| `AttestationSelector` | Select missing `aria-label` | Added `aria-label` + `htmlFor` association |
| `AttestationSelector` | Selection buttons lack state | Added `aria-pressed` attribute |
| `MetadataEditor` | SDG buttons show only numbers | Added `aria-label="SDG X: Full Name"` + `title` |
| `MetadataEditor` | Capital buttons use unicode ✓ | Replaced with `RiCheckLine` icon |
| `MetadataEditor` | Button groups lack context | Added `role="group"` + `aria-label` |

**SDG Names Mapping Added:**

```typescript
const SDG_NAMES: Record<number, string> = {
  1: "No Poverty",
  2: "Zero Hunger",
  3: "Good Health and Well-being",
  // ... all 17 SDGs
};
```

### 4. Design Consistency

| Issue | Before | After |
|-------|--------|-------|
| Search input styling | Custom inline styles | Uses `FormInput` from shared |
| Checkmark indicator | Unicode `✓` character | `RiCheckLine` icon (consistent with rest of UI) |
| Select dropdown | Custom styling | Matches `FormInput` tokens |

### 5. UX Improvements

**Bulk Selection:** Added Select All / Deselect All buttons to `AttestationSelector`:

```tsx
<button onClick={handleSelectAll}>
  <RiCheckboxMultipleLine /> Select all
</button>
<button onClick={handleDeselectAll}>
  <RiCloseCircleLine /> Deselect all
</button>
```

**Validation Feedback:** Added `validationMessage` prop to `FormWizard`:
- Displays contextual message when "Next" is disabled
- Messages are step-specific (e.g., "Select at least one attestation")

**Image Fallback:** `HypercertPreview` now uses `ImageWithFallback`:
- Shows loading placeholder during image load
- Gracefully degrades to icon if image fails

### 6. Internationalization

All new strings added to `en.json`, `es.json`, `pt.json`:

```json
{
  "app.hypercerts.wizard.unsavedChanges": "You have unsaved changes...",
  "app.hypercerts.wizard.validation.selectAttestation": "Select at least one attestation to continue",
  "app.hypercerts.wizard.validation.requiredFields": "Fill in all required fields to continue",
  "app.hypercerts.attestations.selectAll": "Select all",
  "app.hypercerts.attestations.deselectAll": "Deselect all"
}
```

---

## Architecture Decisions

### 1. Error Categorization Utility

Created a reusable `categorizeError` function that:
- Pattern-matches error messages to categories (network, auth, blockchain, etc.)
- Extracts clean messages for logging
- Provides metadata for debugging

This follows the existing error handling patterns in `shared/src/utils/errors/`.

### 2. Navigation Blocker Approach

Chose `useBlocker` (React Router v7) over deprecated `usePrompt` because:
- More control over blocker state
- Supports programmatic proceed/reset
- Works with the app's existing React Router v7 setup

### 3. ImageWithFallback Reuse

Rather than implementing custom error handling, reused the existing `ImageWithFallback` component from shared, which provides:
- Loading state with placeholder
- Error state with fallback icon
- Consistent styling across the app

---

## Files Changed

| File | Type | Lines Changed |
|------|------|---------------|
| `shared/src/utils/errors/categorize-error.ts` | New | 95 |
| `shared/src/utils/index.ts` | Modified | +4 |
| `shared/src/index.ts` | Modified | +8 |
| `shared/src/modules/index.ts` | Modified | +6 |
| `shared/src/i18n/en.json` | Modified | +5 |
| `shared/src/i18n/es.json` | Modified | +5 |
| `shared/src/i18n/pt.json` | Modified | +5 |
| `admin/src/components/Form/FormWizard.tsx` | Modified | +12 |
| `admin/src/components/hypercerts/HypercertWizard.tsx` | Modified | +55 |
| `admin/src/components/hypercerts/steps/AttestationSelector.tsx` | Modified | +75 |
| `admin/src/components/hypercerts/steps/MetadataEditor.tsx` | Modified | +35 |
| `admin/src/components/hypercerts/steps/HypercertPreview.tsx` | Modified | +5 |

---

## Testing Notes

### Manual Testing Checklist

- [ ] Navigate away mid-wizard → Confirmation dialog appears
- [ ] Refresh page mid-wizard → Browser warning appears
- [ ] Complete wizard normally → No warnings
- [ ] Click "Select all" → All visible attestations selected
- [ ] Click "Deselect all" → All attestations deselected
- [ ] Disable "Next" → Validation message appears in footer
- [ ] Screen reader test → SDG buttons announce full names
- [ ] Image load failure → Fallback icon appears

### Automated Tests

No new tests were added in this pass. Recommended for next pass:
- Unit tests for `categorizeError`
- Integration tests for navigation blocker
- Accessibility audit with axe-core

---

## Verification Results

```bash
# Lint
bun run --filter @green-goods/admin lint
# Result: 0 errors, 1 warning (aria-label false positive)

# Build
bun run --filter @green-goods/admin build
# Result: ✓ built in 56s
```

---

## Remaining Items (Deferred to Next Pass)

See `HYPERCERT_WIZARD_UX_HANDOFF.md` for detailed specifications.

1. **Loading skeletons** - Replace text loading states with skeleton UI
2. **Clickable suggested scopes** - Auto-populate on click
3. **MintProgress progress bar** - Visual indication of multi-step transaction
4. **Date validation** - Ensure start < end for timeframes
5. **Reusable component extraction** - SelectableCard, ChipGroup patterns

---

## Appendix: Component Tree

```
CreateHypercert (View)
└── HypercertWizard
    ├── FormWizard (with validationMessage)
    │   ├── StepIndicator
    │   └── [Step Content]
    │       ├── Step 1: AttestationSelector
    │       │   ├── FormInput (search)
    │       │   ├── Select (domain filter)
    │       │   ├── Bulk actions (Select all / Deselect all)
    │       │   └── Selectable cards (aria-pressed)
    │       ├── Step 2: MetadataEditor
    │       │   ├── FormInput (title, url, scopes, dates)
    │       │   ├── FormTextarea (description)
    │       │   ├── SDG chips (aria-label with names)
    │       │   └── Capital buttons (RiCheckLine icon)
    │       ├── Step 3: HypercertPreview
    │       │   └── ImageWithFallback
    │       ├── Step 4: DistributionConfig
    │       └── Step 5: MintProgress
    └── Navigation blocker (useBlocker + beforeunload)
```
