# Signal Pool → Yield Wiring Supplement

**Slug**: `signal-pool-yield-wiring`
**Stage**: `active`
**Priority**: `p1`
**Created**: `2026-03-16`
**Target**: `2026-05-15`

## Problem

Yield routing to fractions is incomplete. Once vault yield starts flowing, `splitYield()` can escrow the fractions leg indefinitely because `gardenHypercertPools[garden]` is unset for deployed gardens, and some treasury paths still strand yield when no treasury mapping exists. The mint flow creates pools after the vault wiring step, so auto-wiring never happens without follow-up work.

## Desired Outcome

- New and repaired gardens auto-wire hypercert pools into `YieldResolver`
- Operators can verify or recover wiring without an owner-only manual step
- Treasury fallbacks route safely to the garden TBA instead of stranding funds
- Existing deployed gardens have a clear migration and backfill path
- Pool identity is typed and verified; no contract, migration, shared hook, or admin status surface relies on trimmed array index to decide which pool is the HypercertSignal pool

## Scope Notes

- In scope: contract changes, shared/admin fallback wiring verification, migration/backfill
- Out of scope: redesigning conviction pools, new indexer schema, yield split UI polish beyond wiring status

## Success Signal

After the upgrade, a garden can create pools and route yield to conviction/fraction paths without a separate owner-run wiring step.
