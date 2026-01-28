# Hypercert Wizard UI/UX Design Pass - Handoff Document

**Purpose:** This document provides context and specifications for the next UI/UX design pass on the hypercert minting wizard.

**Previous Work:** See `HYPERCERT_WIZARD_UX_REPORT.md` for completed fixes.

---

## Quick Context

The hypercert wizard is a 5-step form that allows garden operators to:
1. Select approved work attestations to bundle
2. Configure metadata (title, description, scopes, timeframes, SDGs, capitals)
3. Preview the hypercert before minting
4. Configure token distribution among contributors
5. Mint on-chain with progress feedback

**Key Files:**

```text
packages/admin/src/
├── components/hypercerts/
│   ├── HypercertWizard.tsx          # Main orchestrator
│   └── steps/
│       ├── AttestationSelector.tsx   # Step 1
│       ├── MetadataEditor.tsx        # Step 2
│       ├── HypercertPreview.tsx      # Step 3
│       ├── DistributionConfig.tsx    # Step 4
│       └── MintProgress.tsx          # Step 5
├── components/Form/
│   ├── FormWizard.tsx               # Wizard shell
│   └── StepIndicator.tsx            # Progress header
└── views/Gardens/Garden/
    ├── CreateHypercert.tsx          # Entry view
    ├── Hypercerts.tsx               # List view
    └── HypercertDetail.tsx          # Detail view
```

**Design System:** Uses Tailwind v4 with Green Goods design tokens (see `packages/shared/src/styles/`).

---

## Outstanding UI/UX Items

### Priority 1: High Impact

#### 1.1 Loading Skeletons (AttestationSelector)

**Current State:**
```tsx
{isLoading && (
  <div className="rounded-lg border border-stroke-soft bg-bg-white p-6 text-sm text-text-sub">
    {formatMessage({ id: "app.hypercerts.attestations.loading" })}
  </div>
)}
```

**Desired State:**
- Replace with skeleton cards matching attestation card dimensions
- 3-4 skeleton placeholders with pulse animation
- Reduces perceived load time and prevents layout shift

**Reference:** Use the skeleton pattern from the design system or create `AttestationCardSkeleton`:
```tsx
<div className="animate-pulse rounded-lg border border-stroke-soft bg-bg-white p-4">
  <div className="flex justify-between">
    <div className="space-y-2">
      <div className="h-4 w-32 rounded bg-bg-soft" />
      <div className="h-3 w-24 rounded bg-bg-soft" />
    </div>
    <div className="h-6 w-16 rounded-full bg-bg-soft" />
  </div>
  <div className="mt-3 flex gap-2">
    <div className="h-5 w-20 rounded-full bg-bg-soft" />
    <div className="h-5 w-16 rounded-full bg-bg-soft" />
  </div>
</div>
```

---

#### 1.2 Clickable Suggested Scopes (MetadataEditor)

**Current State:**
```tsx
<FormInput
  helperText={suggestedWorkScopes.length
    ? formatMessage({ id: "..." }, { value: suggestedWorkScopes.join(", ") })
    : undefined}
/>
```
The suggested scopes appear as helper text that users must manually copy.

**Desired State:**
- Render suggested scopes as clickable chips below the input
- Clicking a chip auto-populates (appends to) the input value
- Chips visually indicate "add" action (+ icon or border style)

**Specification:**
```tsx
{suggestedWorkScopes.length > 0 && (
  <div className="mt-1 flex flex-wrap gap-1">
    <span className="text-xs text-text-sub">Suggested:</span>
    {suggestedWorkScopes.map((scope) => (
      <button
        key={scope}
        type="button"
        onClick={() => {
          const current = draft.workScopes;
          if (!current.includes(scope)) {
            onUpdate({ workScopes: [...current, scope] });
          }
        }}
        className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-primary-light px-2 py-0.5 text-xs text-primary-base hover:bg-primary-lighter"
      >
        <RiAddLine className="h-3 w-3" />
        {scope}
      </button>
    ))}
  </div>
)}
```

---

#### 1.3 MintProgress Visual Progress Bar

**Current State:**
```tsx
// MintProgress.tsx shows text status only
<p className="text-sm text-text-sub">{statusMessage}</p>
```

**Desired State:**
- Multi-step progress bar showing: Upload Metadata → Upload Allowlist → Sign Transaction → Confirm
- Each step shows: pending (gray), in-progress (animated), complete (green check), error (red)
- Visual continuity with the wizard's StepIndicator

**Specification:**
```tsx
const MINT_STEPS = [
  { id: "metadata", label: "Uploading metadata" },
  { id: "allowlist", label: "Uploading allowlist" },
  { id: "signing", label: "Signing transaction" },
  { id: "confirming", label: "Confirming on-chain" },
];

// Map mintingState.status to step index
const currentMintStep = {
  idle: -1,
  uploading_metadata: 0,
  uploading_allowlist: 1,
  building_userop: 2,
  pending: 2,
  confirmed: 3,
  failed: getCurrentFailedStep(),
};
```

---

### Priority 2: Medium Impact

#### 2.1 Date Range Validation (MetadataEditor)

**Current State:** No validation that work start < work end, or that impact timeframe is sensible relative to work timeframe.

**Desired State:**
- Inline validation error when start > end
- Warning (not error) when impact start is before work start
- Use FormInput's `error` prop for display

**Specification:**
```tsx
const workDateError = useMemo(() => {
  if (draft.workTimeframeStart && draft.workTimeframeEnd) {
    if (draft.workTimeframeStart > draft.workTimeframeEnd) {
      return formatMessage({ id: "app.hypercerts.metadata.error.dateRange" });
    }
  }
  return undefined;
}, [draft.workTimeframeStart, draft.workTimeframeEnd]);
```

i18n key to add:
```json
"app.hypercerts.metadata.error.dateRange": "Start date must be before end date"
```

---

#### 2.2 Distribution Table Responsive Overflow (DistributionConfig)

**Current State:**
```tsx
<div className="grid-cols-[2fr_1fr_1fr_auto]">
```
Fixed grid can cause horizontal overflow on narrow screens (<375px).

**Desired State:**
- Address column uses `truncate` with expandable tooltip
- Or: Table becomes vertically stacked cards on mobile
- Or: Horizontal scroll container with shadow indicators

**Recommendation:** The simplest fix is truncation with title:
```tsx
<span className="truncate max-w-[120px] sm:max-w-none" title={entry.address}>
  {formatAddress(entry.address, { variant: "short" })}
</span>
```

---

#### 2.3 Empty State Enhancement (Hypercerts.tsx)

**Current State:**
```tsx
<p className="mt-2 text-sm text-text-sub">
  {formatMessage({ id: "app.hypercerts.list.empty.description" })}
</p>
```

**Desired State:**
- Add illustration or icon
- Brief explanation of what hypercerts are
- Prominent CTA button to create first hypercert

**Reference:** Follow the pattern used in other empty states in the admin dashboard.

---

### Priority 3: Nice to Have

#### 3.1 Extract Reusable Components

**SelectableCard Pattern:**
The attestation selection card pattern could be extracted:
```tsx
interface SelectableCardProps {
  selected: boolean;
  onSelect: () => void;
  badge?: string;
  selectedBadge?: string;
  children: ReactNode;
}
```

**ChipGroup/RadioPills Pattern:**
The SDG buttons, Capital buttons, and Distribution mode selector all use similar patterns:
```tsx
interface ChipGroupProps<T> {
  options: T[];
  selected: T[];
  onChange: (selected: T[]) => void;
  renderLabel: (option: T) => ReactNode;
  multiSelect?: boolean;
}
```

---

#### 3.2 Focus Trap in Wizard

When the wizard is open, keyboard users can tab outside the wizard content to sidebar/header. Consider adding focus trap for better accessibility.

**Library:** `focus-trap-react` or manual implementation with `tabindex`.

---

#### 3.3 Step Change Announcements

Add `aria-live` region to announce step transitions:
```tsx
<div aria-live="polite" className="sr-only">
  {`Step ${currentStep + 1} of ${steps.length}: ${steps[currentStep].title}`}
</div>
```

---

## Design Tokens Reference

Key tokens used in the wizard (from `packages/shared/src/styles/`):

| Token | Usage |
|-------|-------|
| `bg-bg-white` | Card backgrounds |
| `bg-bg-weak` | Page background, disabled states |
| `bg-primary-lighter` | Selected state backgrounds |
| `border-stroke-soft` | Default borders |
| `border-primary-base` | Selected/active borders |
| `text-text-strong` | Primary text |
| `text-text-sub` | Secondary text |
| `text-text-disabled` | Disabled text |
| `text-primary-base` | Primary accent text |
| `text-error-base` | Error text |
| `text-warning-dark` | Warning text |

---

## Testing Checklist for Next Pass

### Visual Regression

- [ ] All steps render correctly at 320px, 768px, 1024px, 1440px
- [ ] Dark mode (if applicable)
- [ ] High contrast mode

### Accessibility

- [ ] Tab order is logical through entire wizard
- [ ] All interactive elements reachable by keyboard
- [ ] Screen reader announces step changes
- [ ] Color contrast meets WCAG AA

### UX Flows

- [ ] Happy path: Create hypercert end-to-end
- [ ] Error path: Network failure during mint
- [ ] Edge case: 0 attestations available
- [ ] Edge case: 100+ attestations (virtualization?)

---

## Commands for Development

```bash
# Start admin dev server
bun dev  # Then visit http://localhost:3002

# Run linting
bun run --filter @green-goods/admin lint

# Run build
bun run --filter @green-goods/admin build

# Start Storybook (for component isolation)
bun run --filter @green-goods/shared storybook
```

---

## Questions for Product/Design

1. **Bulk selection scope:** Should "Select All" select ALL attestations or just filtered results?
   - Current: Filters only
   - Alternative: All with filter indication

2. **Draft persistence:** Should drafts auto-save and persist across sessions?
   - `useHypercertDraft` hook exists but unclear if it persists to localStorage

3. **Distribution defaults:** Should default mode be "equal" or "proportional to work count"?
   - Current: Falls back based on distributionMode state

4. **Image generation:** Where does `metadata.image` come from? Is it always available?
   - Need to confirm for fallback UX

---

## Contact

For questions about the completed work, refer to:
- `HYPERCERT_WIZARD_UX_REPORT.md` - Detailed implementation notes
- Git history on `feature/hypercerts-minting` branch
- CLAUDE.md for codebase conventions
