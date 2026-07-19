# Conviction Pool Config Onchain

**Slug**: `conviction-pool-config-onchain`
**Stage**: `backlog`
**Priority**: `p2`
**Created**: `2026-05-07`
**Parent**: `admin-design-revamp` (cleanup B1)

## Problem

`useConvictionProposalsForPool` falls back to a hard-coded `FALLBACK_POOL_CONFIG = { decayRate: 1n, pointsPerVoter: 100n, memberCount: 1 }` because no hook reads pool config from the chain. `decay()` and `pointsPerVoter()` views exist on `HYPERCERT_SIGNAL_POOL_ABI` and are readable today, but `memberCount` has no on-chain enumeration: `IVotingPowerRegistry` exposes only `isMember(member)` plus per-member power, and the Envio schema has no `Voter` entity. Shipping the two readable values alone with `memberCount=1` would scale the conviction-percent denominator wrong in any multi-member garden, so all three values stay stubbed.

## Desired Outcome

- New hook `useHypercertSignalPoolConfig(poolAddress)` reads `decay()` + `pointsPerVoter()` from `HYPERCERT_SIGNAL_POOL_ABI`.
- Decision recorded on member-count enumeration: either add a contract view (e.g. `memberCount()` or an iterator) **or** add a `Voter` / membership entity to `packages/indexer/schema.graphql` and surface a count via GraphQL.
- Both halves land together so the conviction-percent denominator stays correct for the live UI.
- `FALLBACK_POOL_CONFIG` removed from `packages/shared/src/hooks/conviction/useConvictionProposalsForPool.ts:164`; `BLOCKS_PER_DAY` and `DEFAULT_THRESHOLD_PERCENT` reviewed for removal/replacement in `packages/shared/src/utils/conviction/derivation.ts`.

## Scope Notes

- **In scope**: hook design, contract ABI extension OR indexer schema addition, derivation cleanups, useConvictionProposalsForPool refactor.
- **Out of scope**: B2 (per-member supporter count) and B3 (threshold formula port) — separate plans.

## Success Signal

A multi-member garden's conviction percent on `/community/governance` divides by the real on-chain member count (not 1), and the decay/pointsPerVoter values reflect the deployed pool config.

## References

- Cleanup investigation: `.plans/active/admin-design-revamp/handoffs/claude-cleanup.md` § "B1–B3 investigation".
- Affected files: `packages/shared/src/hooks/conviction/useConvictionProposalsForPool.ts`, `packages/shared/src/utils/conviction/derivation.ts`, `packages/contracts/src/...` (ABI), `packages/indexer/schema.graphql` (alternative).
