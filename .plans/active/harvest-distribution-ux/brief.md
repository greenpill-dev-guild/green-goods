# Harvest Distribution Completion

**Slug**: `harvest-distribution-ux`
**Stage**: `active`
**Priority**: `p2`
**Created**: `2026-08-26T18:29:53.626Z`
**Linear Issue**: `PRD-763`

## Problem

Harvest confirms successfully after moving vault shares into the Yield Resolver, but it does not
run the resolver's separate `splitYield()` transaction. Admin currently reports the first step as
complete without showing that distribution is still pending, so operators can reasonably expect
Cookie Jar funds that have not moved yet.

## Desired Outcome

- Operators complete harvest and eligible distribution through one guided admin action.
- Partial success, Safe submission, and below-threshold states remain visible and retryable.
- Confirmation names the configured destinations and estimated split before any transaction.
- Contract permissions, split configuration, and routing behavior do not change.

## Scope Notes

- In scope: shared yield status and transaction workflow hooks, the admin vault position card,
  localized copy, privacy-safe telemetry, focused tests, Storybook states, and authenticated QA.
- Out of scope: contract changes, deployment, client/indexer changes, presets, treasury governance,
  automatic background execution, and production transactions.
- This hub owns the vault harvest-to-distribution operator flow only. Hypercert minting remains a
  separate workflow, and Green Goods has no canonical Season-close mutation or read model today.
- Related backlog: `.plans/backlog/yield-split-ui/` and Linear `PRD-351` remain parked.

## Success Signal

An operator can see whether yield is accruing, waiting, submitted, or distributed, and a confirmed
eligible workflow refreshes the Cookie Jar and vault state without claiming success after harvest
alone.
