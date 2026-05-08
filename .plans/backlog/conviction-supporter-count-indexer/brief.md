# Conviction Supporter Count (Indexer)

**Slug**: `conviction-supporter-count-indexer`
**Stage**: `backlog`
**Priority**: `p2`
**Created**: `2026-05-07`
**Parent**: `admin-design-revamp` (cleanup B2)

## Problem

The conviction proposal card surfaces a per-hypercert supporter count, but the data layer has no source for distinct-voter count today. `getConvictionWeights()` returns aggregate weight per hypercert; `getVoterAllocations(voter)` requires enumerating voters, which the chain does not expose. The Envio schema does not index allocations either. `countSupporters` therefore returns a `1-or-0` placeholder based on whether aggregate weight is non-zero (`packages/shared/src/hooks/conviction/useConvictionProposalsForPool.ts:187-189`).

## Desired Outcome

- New `Allocation` entity in `packages/indexer/schema.graphql`, keyed by `(chainId, pool, hypercertId, voter)`, indexed off the `AllocationUpdated` (or equivalent) event the signal pool emits.
- New shared hook `useHypercertSupporters(poolAddress, hypercertId)` returns the distinct-voter count via GraphQL aggregate.
- Replace the `countSupporters` placeholder in `useConvictionProposalsForPool.ts` with the hook output.

## Scope Notes

- **In scope**: indexer schema entity + handler, GraphQL aggregate query, shared hook, replacement of placeholder.
- **Out of scope**: B1 (pool config) and B3 (threshold formula) — separate plans. ENS resolution of supporters (separate UX flow). Per-supporter allocation amounts (this plan only counts distinct supporters).

## Success Signal

The conviction proposal card on `/community/governance` shows an accurate distinct-supporter count for each hypercert, and the count updates within an indexer block of new allocations being submitted.

## References

- Cleanup investigation: `.plans/active/admin-design-revamp/handoffs/claude-cleanup.md` § "B1–B3 investigation".
- Affected files: `packages/indexer/schema.graphql`, `packages/indexer/src/...`, `packages/shared/src/hooks/conviction/useConvictionProposalsForPool.ts`.
