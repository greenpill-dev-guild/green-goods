# Protocol Economics Simulator — Specification

## Data Model Changes

### New fields added to `RevenueExplorerInputs`

#### Expense fields (replace targetAnnualOpex)
| Field | Type | Default (Bootstrap) | Default (Hybrid) | Default (Protocol Scale) |
|-------|------|---------------------|-------------------|--------------------------|
| teamCompensation | $/yr | 60000 | 100000 | 180000 |
| infrastructure | $/yr | 5000 | 12000 | 30000 |
| gasSponsorship | $/yr | 3000 | 8000 | 20000 |
| legalCompliance | $/yr | 5000 | 15000 | 30000 |
| operational | $/yr | 7000 | 15000 | 30000 |
| operatorIncentives | $/yr | 10000 | 15000 | 30000 |
| gardenerIncentives | $/yr | 10000 | 15000 | 30000 |
| **Sum** | | **100000** | **180000** | **350000** |

Sums match existing `targetAnnualOpex` values exactly → backward compatible.

#### Treasury & retro fields
| Field | Type | Default (Bootstrap) | Default (Hybrid) | Default (Protocol Scale) |
|-------|------|---------------------|-------------------|--------------------------|
| startingTreasury | $ | 50000 | 200000 | 500000 |
| retroObligation | $ | 80000 | 80000 | 80000 |
| retroCashPercent | % | 40 | 50 | 30 |

#### Token fields
| Field | Type | Default (Bootstrap) | Default (Hybrid) | Default (Protocol Scale) |
|-------|------|---------------------|-------------------|--------------------------|
| tokenSupply | number | 10000000 | 10000000 | 10000000 |
| contributorAllocationPercent | % | 20 | 20 | 15 |
| operatorAllocationPercent | % | 15 | 15 | 15 |
| gardenerAllocationPercent | % | 15 | 15 | 20 |
| revenueMultiple | number | 5 | 8 | 12 |

### targetAnnualOpex becomes computed

`targetAnnualOpex` is removed from `RevenueExplorerInputs` and from `INPUT_SECTIONS`. It becomes a derived value:

```
totalExpenses = teamCompensation + infrastructure + gasSponsorship + legalCompliance + operational + operatorIncentives + gardenerIncentives
```

All existing code that reads `inputs.targetAnnualOpex` uses `totalExpenses` instead (passed through or computed inline).

### New fields in `RevenueSummary`

| Field | Formula |
|-------|---------|
| totalExpenses | sum of 7 expense fields |
| netMargin | totalAnnualRevenue - totalExpenses |
| monthlyBurn | totalExpenses > totalAnnualRevenue ? (totalExpenses - totalAnnualRevenue) / 12 : 0 |
| monthlySavings | totalAnnualRevenue > totalExpenses ? (totalAnnualRevenue - totalExpenses) / 12 : 0 |
| runwayMonths | monthlyBurn > 0 ? (startingTreasury - retroCashDrain) / monthlyBurn : Infinity |
| treasuryAfterOneYear | (startingTreasury - retroCashDrain) + netMargin |
| retroCashDrain | retroObligation * retroCashPercent / 100 |
| impliedValuation | totalAnnualRevenue * revenueMultiple |
| tokenPrice | impliedValuation / tokenSupply (0 if supply is 0) |

### Token upside computed per-stage

Not stored in RevenueSummary — computed at the UI layer by calling `calculateRevenueSummary` with each preset's inputs and extracting `tokenPrice`. Displayed in a 3×3 grid.

### SCALABLE_KEYS updates

Expense fields do NOT go in SCALABLE_KEYS (they're policy, not adoption). Treasury, retro, and token fields also excluded.

### INPUT_KEYS and INPUT_SECTIONS updates

- `targetAnnualOpex` removed from INPUT_KEYS
- New section 4: "Costs & compensation" (7 expense fields, sliders on teamCompensation and operatorIncentives)
- New section 5: "Treasury & token" (startingTreasury, retroObligation, retroCashPercent, tokenSupply, contributorAllocationPercent, operatorAllocationPercent, gardenerAllocationPercent, revenueMultiple)
- Section 3 "Treasury and non-protocol revenue" renamed to "Offchain revenue" (keeps grantsContracts, licensing, revnetRevenue, protocolPrincipal, principalApy — targetAnnualOpex removed)

### Projection chart expense overlay

`ProjectionYearData` gains `totalExpenses: number`. The chart renders a dashed line for expenses, making the revenue-vs-cost crossover visible.
