# Evaluation Gates

## Gate 1: Model correctness
- [ ] `bun run test` passes — all existing + new tests
- [ ] Expense sum matches old targetAnnualOpex for each preset (backward compat)
- [ ] coverageRatio unchanged for preset defaults

## Gate 2: Type safety
- [ ] `tsc --noEmit` passes with zero errors

## Gate 3: Build
- [ ] `bun run build` succeeds with no warnings

## Gate 4: Visual
- [ ] Runway panel shows green margin or red burn
- [ ] Upside panel shows values across 3 stages
- [ ] Expense line visible on projection chart
- [ ] Monthly toggle applies to new expense/margin values
- [ ] Dark mode renders correctly for all new panels
