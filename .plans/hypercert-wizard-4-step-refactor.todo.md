# Hypercert Wizard 4-Step Refactor

**Status**: Planning → In Progress → Done
**Branch**: feature/hypercerts-minting

## Problem Summary

The current hypercert minting wizard has **5 steps** with several UX issues:

1. **Suboptimal order**: Preview comes before Distribution, so users see incomplete data
2. **Duplicated step indicators**: The final "Mint" step shows both the wizard StepIndicator AND MintProgress's internal 4-step indicator
3. **Confusing mental model**: Step 5 (Mint) is a status display, not an interactive form step

### Current Flow (5 steps)
```
1. Select Attestations → 2. Add Metadata → 3. Preview → 4. Distribution → 5. Mint (status)
```

### Desired Flow (4 steps)
```
1. Select Attestations → 2. Add Metadata → 3. Configure Distribution → 4. Preview & Mint
```

## Requirements Coverage

| Requirement | Planned Step | Status |
|-------------|--------------|--------|
| Reorder to logical flow | Steps 1-4 | ⏳ |
| Preview shows distribution info (full table) | Step 5 | ⏳ |
| Remove duplicate step indicator | Step 5 | ⏳ |
| Preview becomes final step with mint action | Step 6 | ⏳ |
| Add distribution pie chart (both steps) | Step 8 | ⏳ |
| Show gas estimation before mint | Step 9 | ⏳ |
| Navigate to detail on success | Step 10 | ⏳ |
| Update i18n keys | Step 7 | ⏳ |

## UI Design Decisions (Confirmed)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Preview detail level | **Full table** | Complete allowlist with addresses, units, percentages |
| Metadata organization | **Keep flat** | Current layout works, no changes needed |
| Distribution visualization | **Pie chart** | Add donut chart showing percentage breakdown |
| Chart placement | **Both steps** | Show in Distribution (step 3) AND Preview (step 4) |
| Chart labels | **>5% only** | Label significant allocations, group small as "Others" |
| Step summaries | **None** | Users can navigate back - keep UI clean |
| Mint confirmation | **None** | Preview step is sufficient, submit button is clear |
| Chart library | **Recharts** | Popular, good TS support, ~40KB gzipped |
| Mint transition | **Inline replace** | Replace preview content with MintProgress in same step |
| Gas estimation | **Yes** | Show estimated tx cost before user confirms |
| Success flow | **Navigate to detail** | Redirect to hypercert detail page immediately |

## CLAUDE.md Compliance

- [x] Hooks in shared package (`useCreateHypercertWorkflow`)
- [x] i18n for UI strings (update step descriptions)
- [x] State management in shared package (`useHypercertWizardStore`)
- [ ] New dependency (Recharts) - check if already in workspace

## Impact Analysis

### Files to Modify

| File | Changes |
|------|---------|
| `packages/admin/src/components/hypercerts/HypercertWizard.tsx` | Reorder steps, update rendering, integrate preview+mint |
| `packages/shared/src/stores/useHypercertWizardStore.ts` | Change MAX_STEP 5→4 |
| `packages/shared/src/hooks/hypercerts/useCreateHypercertWorkflow.ts` | Update canProceed for new step order |
| `packages/admin/src/components/hypercerts/steps/HypercertPreview.tsx` | Add allowlist table, MintProgress, gas estimate |
| `packages/admin/src/components/hypercerts/steps/DistributionConfig.tsx` | Add pie chart component |
| `packages/shared/src/i18n/en.json` | Update step descriptions |
| `packages/shared/src/i18n/es.json` | Update step descriptions |
| `packages/shared/src/i18n/pt.json` | Update step descriptions |
| `package.json` (admin or shared) | Add recharts dependency if not present |

### Files to Create

| File | Purpose |
|------|---------|
| `packages/admin/src/components/hypercerts/DistributionChart.tsx` | Reusable pie chart for distribution visualization |

### Files to Deprecate

- `MintProgress` as standalone step (integrated into Preview)

## Implementation Steps

### Step 1: Add Recharts Dependency
**Files**: `packages/admin/package.json` or `packages/shared/package.json`
**Details**:
- Check if recharts already exists in workspace
- If not: `cd packages/admin && bun add recharts`
- Recharts is tree-shakeable, only import PieChart, Pie, Cell, ResponsiveContainer

### Step 2: Update Store Constants
**Files**: `packages/shared/src/stores/useHypercertWizardStore.ts`
**Details**:
- Change `MAX_STEP` from `5` to `4`

### Step 3: Update Workflow Validation
**Files**: `packages/shared/src/hooks/hypercerts/useCreateHypercertWorkflow.ts`
**Details**:
- Update `canProceed` switch cases for new step meanings:
  - Step 1: Attestations (unchanged)
  - Step 2: Metadata (unchanged)
  - Step 3: Distribution (was step 4 validation)
  - Step 4: Preview & Mint (always true, submit handled separately)
- Remove step 5 case

### Step 4: Update Steps Array in Wizard
**Files**: `packages/admin/src/components/hypercerts/HypercertWizard.tsx`
**Details**:
- Reorder `steps` array:
  ```typescript
  [
    { id: "attestations", ... },    // Step 1 (unchanged)
    { id: "metadata", ... },        // Step 2 (unchanged)
    { id: "distribution", ... },    // Step 3 (was step 4)
    { id: "preview", ... },         // Step 4 (was step 3, now includes mint)
  ]
  ```
- Remove step 5 "mint" from array
- Update step 4 title/description to reflect "Preview & Mint"

### Step 5: Reorder Step Rendering
**Files**: `packages/admin/src/components/hypercerts/HypercertWizard.tsx`
**Details**:
- Update conditional rendering:
  ```typescript
  {currentStep === 1 && <AttestationSelector ... />}
  {currentStep === 2 && <MetadataEditor ... />}
  {currentStep === 3 && <DistributionConfig ... />}
  {currentStep === 4 && <HypercertPreview ... />}
  ```
- Remove `{currentStep === 5 && <MintProgress ... />}`

### Step 6: Create Distribution Pie Chart Component
**Files**: `packages/admin/src/components/hypercerts/DistributionChart.tsx`
**Details**:
- Create reusable `DistributionChart` component
- Props: `allowlist: AllowlistEntry[]`, `totalUnits: bigint`
- Use Recharts PieChart with ResponsiveContainer
- Color palette from design system (primary, success, warning, etc.)
- Label segments >5%, group others as "Others" slice
- Show legend with all recipients
- Hover tooltip showing exact units and percentage

### Step 7: Add Pie Chart to Distribution Step
**Files**: `packages/admin/src/components/hypercerts/steps/DistributionConfig.tsx`
**Details**:
- Import and add `DistributionChart` above or beside the table
- Layout: Chart on left/top, table on right/bottom (responsive)
- Only show chart when allowlist has entries

### Step 8: Enhance Preview Component
**Files**: `packages/admin/src/components/hypercerts/steps/HypercertPreview.tsx`
**Details**:
- Add new props: `allowlist`, `mintingState`, `chainId`, `gasEstimate`
- Add distribution section with:
  - `DistributionChart` component (same as step 3)
  - Full allowlist table (address, units, percentage)
- Add gas estimate display section
- Integrate `MintProgress` component inline
- Conditional render: show preview when `mintingState.status === 'idle'`, show MintProgress otherwise
- Smooth inline transition when minting starts

### Step 9: Add Gas Estimation
**Files**: `packages/admin/src/components/hypercerts/HypercertWizard.tsx`, `packages/shared/src/hooks/hypercerts/`
**Details**:
- Create `useGasEstimate` hook or add to existing minting hook
- Estimate gas when user reaches preview step
- Pass estimate to HypercertPreview component
- Display formatted cost (e.g., "~0.0012 ETH")
- Handle estimation errors gracefully (show "Unable to estimate")

### Step 10: Update Success Navigation
**Files**: `packages/admin/src/components/hypercerts/HypercertWizard.tsx`
**Details**:
- Current `onComplete` callback already receives `hypercertId`
- Verify the callback navigates to `/gardens/{gardenId}/hypercerts/{hypercertId}`
- Ensure navigation happens immediately on `confirmed` status

### Step 11: Update i18n Strings
**Files**: `packages/shared/src/i18n/en.json`, `es.json`, `pt.json`
**Details**:
- Update `app.hypercerts.wizard.step.preview.title` to "Preview & Mint"
- Update `app.hypercerts.wizard.step.preview.description`
- Add new keys for gas estimation display
- Add keys for distribution chart (legend, "Others" label)
- Remove or repurpose `app.hypercerts.wizard.step.mint.*` keys

### Step 12: Update Validation Messages
**Files**: `packages/admin/src/components/hypercerts/HypercertWizard.tsx`
**Details**:
- Update `validationMessage` useMemo switch case numbers:
  - Case 3 now validates distribution (was case 4)

## Validation

- [ ] TypeScript passes: `cd packages/admin && npx tsc --noEmit`
- [ ] Shared TypeScript: `cd packages/shared && npx tsc --noEmit`
- [ ] Lint passes: `bun lint`
- [ ] Tests pass: `bun test`
- [ ] Build succeeds: `bun build`
- [ ] Manual testing: Complete wizard flow in browser
- [ ] Pie chart renders correctly with various allowlist sizes
- [ ] Gas estimate displays properly
- [ ] Successful mint navigates to detail page

## Testing Scenarios

1. **Happy path**: Select attestations → Enter metadata → Configure distribution (see pie chart) → Preview (see chart + table + gas) → Mint → Redirects to detail page
2. **Navigation**: Can navigate back to any previous step
3. **Draft restore**: Saved drafts restore correctly with new step numbers
4. **Validation**: Cannot proceed past step 3 with invalid allowlist
5. **Error handling**: Mint failure shows error in preview screen, retry works
6. **Chart edge cases**:
   - Single recipient (100% pie)
   - Many small recipients (grouped as "Others")
   - Empty allowlist (no chart shown)
7. **Gas estimation**: Shows estimate, handles errors gracefully
8. **Responsive**: Layout works on mobile and desktop

## Visual Design Notes

### Pie Chart Specifications
```
- Type: Donut chart (hollow center)
- Size: ~200px diameter, responsive
- Colors: Use CSS variables from design system
  - Primary slice: var(--color-primary-base)
  - Secondary: var(--color-success-base)
  - Tertiary: var(--color-warning-base)
  - Additional: cycle through palette
  - Others: var(--color-bg-soft)
- Labels: Only show for segments >5%
- Center: Can show total units or "Distribution"
- Legend: Below chart, show all recipients with color swatches
- Hover: Tooltip with exact percentage and units
```

### Preview Layout (Step 4)
```
+------------------------------------------+
| [Hypercert Card Preview]   | [Details]   |
| - Image                    | - Garden    |
| - Title                    | - Scopes    |
| - Description              | - Timeframe |
|                            | - Units     |
+------------------------------------------+
| Distribution                             |
| +----------------+  +------------------+ |
| | [Pie Chart]    |  | [Allowlist Table]| |
| |                |  | Addr | Units | % | |
| +----------------+  +------------------+ |
+------------------------------------------+
| Gas Estimate: ~0.0012 ETH                |
+------------------------------------------+
| [When minting: MintProgress replaces all]|
+------------------------------------------+
```

## Migration Notes

- Draft persistence uses `stepNumber` - existing drafts on steps 4-5 may need handling
- Consider: On load, if stepNumber > 4, reset to step 4 (preview)
- Or: Add migration logic in `loadDraft` to remap old step numbers

## Dependencies

- **recharts**: `^2.x` - Charting library for pie chart
  - Tree-shakeable, import only: `PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip`
  - Peer dep: React 16.8+

## Estimated Effort

| Step | Complexity | Estimate |
|------|------------|----------|
| 1-5 (Core refactor) | Medium | 2-3 hours |
| 6-7 (Pie chart) | Medium | 1-2 hours |
| 8 (Preview enhancement) | High | 2-3 hours |
| 9 (Gas estimation) | Medium | 1-2 hours |
| 10-12 (Polish) | Low | 1 hour |
| Testing | Medium | 1-2 hours |
| **Total** | | **8-13 hours** |
