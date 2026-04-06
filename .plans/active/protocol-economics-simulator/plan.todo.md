# Protocol Economics Simulator — Implementation Plan

**Feature Slug**: `protocol-economics-simulator`
**Status**: ACTIVE
**Created**: 2026-04-04

## Decision Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Replace targetAnnualOpex with computed sum of 7 expense fields | Granular cost modeling; preset sums match old values exactly for backward compat |
| 2 | Expense fields are NOT scalable (not in SCALABLE_KEYS) | Costs are policy decisions, not adoption outcomes |
| 3 | Token upside computed at UI layer per-stage, not stored in RevenueSummary | Avoids coupling the model to preset definitions; keeps the summary pure |
| 4 | retroCashDrain is a one-time treasury hit, not annual | Retro compensation is a past obligation, not recurring |
| 5 | Treasury & token fields in their own input section | Conceptually different from expense modeling; cleaner separation |
| 6 | Expense line on projection chart as dashed line, not stacked area | Revenue streams stay as stacked area; expense as overlay makes crossover clear |

## Requirements Coverage

| Requirement | Step | Status |
|-------------|------|--------|
| Expense breakdown replaces single opex | 1-2 | ⏳ |
| Treasury runway with starting balance | 3 | ⏳ |
| Retro compensation (cash + token split) | 3 | ⏳ |
| Token upside at each stage | 4 | ⏳ |
| Operator/gardener incentive costs | 1-2 | ⏳ |
| Upside panel (3×3 grid) | 6 | ⏳ |
| Runway panel | 6 | ⏳ |
| Expense line on projection chart | 5 | ⏳ |
| Preset backward compatibility | 2 | ⏳ |
| Test coverage | 7 | ⏳ |

## CLAUDE.md Compliance
- [x] No hooks needed (docs package, not shared)
- [x] No i18n needed (docs site, not client/admin)
- [x] No deployment artifacts (docs component only)
- [x] CSS modules pattern maintained
- [x] Tests via bun test (model is pure functions)

## Impact Analysis

### Files to Modify
- `docs/src/components/docs/protocolRevenueModel.ts` — Types, presets, sections, calculations
- `docs/src/components/docs/ProtocolRevenueExplorer.tsx` — New state, panels, layout
- `docs/src/components/docs/RevenueProjectionChart.tsx` — Expense line overlay
- `docs/src/components/docs/ProtocolRevenueExplorer.module.css` — New panel styles
- `docs/src/components/docs/protocolRevenueModel.test.ts` — New + updated tests

### Files to Create
None — all changes are within existing files.

## Test Strategy
- **Existing tests**: 6 stage classification tests reference targetAnnualOpex directly — all must be updated to use expense fields that sum to same value
- **New model tests**: expense sum, runway calculations (positive/negative/zero margin), retro cash drain, token price at different multiples
- **Regression**: preset summaries must produce identical totalAnnualRevenue and stage.id as before

---

## Implementation Steps

### Step 1: Expand RevenueExplorerInputs and INPUT_KEYS
**Files**: `protocolRevenueModel.ts`
**Changes**:
- Add 15 new fields to `RevenueExplorerInputs` (7 expense, 3 treasury/retro, 5 token)
- Remove `targetAnnualOpex` from interface
- Update `INPUT_KEYS` array: remove targetAnnualOpex, add all 15 new keys
- Add `EXPENSE_KEYS` constant array (the 7 expense fields)
- Add `computeTotalExpenses(inputs)` helper function
**Verify**: TypeScript will show errors everywhere targetAnnualOpex was used — that's expected, fixed in step 2

### Step 2: Update presets, INPUT_SECTIONS, and calculation logic
**Files**: `protocolRevenueModel.ts`
**Changes**:
- Update all 3 preset objects: replace `targetAnnualOpex` with 7 expense fields + 3 treasury/retro + 5 token fields (sums must match old opex values)
- Remove targetAnnualOpex from section 3, rename section 3 to "Offchain revenue"
- Add INPUT_SECTIONS[3]: "Costs & compensation" (7 expense fields, sliders on teamCompensation max:300000, operatorIncentives max:100000, gardenerIncentives max:100000)
- Add INPUT_SECTIONS[4]: "Treasury & token" (8 fields: startingTreasury max:1000000, retroObligation, retroCashPercent, tokenSupply, contributorAllocationPercent, operatorAllocationPercent, gardenerAllocationPercent, revenueMultiple)
- Update `calculateRevenueSummary`: replace all `inputs.targetAnnualOpex` references with `computeTotalExpenses(inputs)`. Add new fields to RevenueSummary: totalExpenses, netMargin, monthlyBurn, monthlySavings, runwayMonths, treasuryAfterOneYear, retroCashDrain, impliedValuation, tokenPrice
- Update `classifyStage`: uses computeTotalExpenses(inputs) instead of inputs.targetAnnualOpex
- Update `buildInsights`: same replacement + add margin-based insight
- Expense fields are NOT added to SCALABLE_KEYS
**Verify**: `npx tsc --noEmit` passes

### Step 3: Update tests for new model
**Files**: `protocolRevenueModel.test.ts`
**Changes**:
- Update `zeroInputs()` helper: remove targetAnnualOpex, add all 15 new fields (zeroed)
- Update 6 classifyStage tests: replace `inputs.targetAnnualOpex = X` with individual expense fields that sum to X (e.g., `inputs.teamCompensation = X`)
- Update bootstrap snapshot test (line 41): update expected values if any changed (should be identical since sums match)
- Add new test group "expense and runway":
  - `computeTotalExpenses sums all 7 fields correctly`
  - `positive margin → runwayMonths is Infinity, monthlySavings > 0`
  - `negative margin → runwayMonths is finite, monthlyBurn > 0`
  - `retro cash drain reduces treasuryAfterOneYear`
  - `token price scales linearly with revenue multiple`
  - `zero token supply → tokenPrice is 0`
**Verify**: `bun run test` — all pass

### Step 4: Update projection model for expenses
**Files**: `protocolRevenueModel.ts`
**Changes**:
- Add `totalExpenses` field to `ProjectionYearData` interface
- In `projectRevenue()`: compute and store totalExpenses per year (expenses are fixed, not scaled — same every year)
- In `monteCarloProjection()`: no change needed (it only tracks totalAnnualRevenue)
**Verify**: `bun run test` still passes, projection tests still work

### Step 5: Update chart with expense line
**Files**: `RevenueProjectionChart.tsx`
**Changes**:
- Accept `totalExpenses` prop (the fixed annual expense amount)
- Add a dashed `<Line>` (recharts `ReferenceLine` or `Line` with constant Y value) showing the expense level as a horizontal reference
- Color: red/coral dashed line with label "Opex"
- The crossover point where stacked revenue areas exceed the expense line is visually obvious
**Verify**: TypeScript passes

### Step 6: Update component with new panels and state
**Files**: `ProtocolRevenueExplorer.tsx`
**Changes**:
- Update import of `computeTotalExpenses` from model
- Inline card: replace yield-take KPI with "Net margin" KPI (green/red). Keep coverage, req. TVL, req. principal.
- Break-even callout: works same way (coverageRatio < 1)
- Export JSON: add totalExpenses, netMargin, runwayMonths, treasuryAfterOneYear, tokenPrice to computed payload
- Pass `totalExpenses` to `RevenueProjectionChart` for expense line
- **New: Runway panel** in result pane (after summary panel):
  - Net margin (green text if positive, red if negative)
  - Monthly burn or monthly savings
  - Runway in months (or "Sustainable" if infinite)
  - Treasury after 1 year
  - Retro cash drain shown as a line item
- **New: Upside panel** in result pane (after onchain/offchain):
  - Compute token price at each stage: `calculateRevenueSummary(getPresetInputs(id))` for each preset, multiply by revenueMultiple, divide by tokenSupply
  - 3×3 grid: rows = Contributor / Operator / Gardener, columns = Bootstrap / Hybrid / Protocol Scale
  - Each cell shows: allocation % × tokenSupply × tokenPrice = total value, and per-token value
  - Use current scenario's token params (allocation %, supply, multiple) but each stage's revenue
- Monthly toggle: apply divisor to all new expense/margin/runway values
**Verify**: TypeScript passes

### Step 7: CSS for new panels
**Files**: `ProtocolRevenueExplorer.module.css`
**Changes**:
- `.runwayPanel` — same shape as existing `.panel`
- `.marginPositive` / `.marginNegative` — green/red text colors
- `.runwayBar` — horizontal bar showing runway proportion (optional, like split track)
- `.upsideGrid` — 3×3 CSS grid with header row/column
- `.upsideCell` — compact value display
- `.upsideHeader` — column/row header styling
- `.expenseLine` — if any custom chart styling needed
- Dark mode rules for all new classes
- Responsive: upside grid stacks on mobile
**Verify**: `bun run build` passes

### Step 8: Update MDX page copy
**Files**: `docs/docs/builders/specs/revenue-explorer.mdx`
**Changes**:
- Update intro paragraph to reflect the expanded scope (expenses, runway, token upside)
- Update QuickAnswer to mention cost modeling and upside
- Update "How to read the outputs" section with new metrics (net margin, runway, token price)
**Verify**: `bun run build` passes, page renders

---

## Validation

```bash
cd docs
bun run test          # All model tests pass
npx tsc --noEmit      # Zero type errors  
bun run build         # Docusaurus builds clean
```

Visual checks:
- Preset comparison still shows correct values
- Switching presets updates expense fields
- Runway panel shows "Sustainable" when revenue > expenses
- Runway panel shows months when burning
- Upside panel shows increasing values from Bootstrap → Protocol Scale
- Expense dashed line visible on projection chart
- Monthly toggle divides all new values by 12
- Dark mode renders all new panels correctly
- Export JSON includes new fields
