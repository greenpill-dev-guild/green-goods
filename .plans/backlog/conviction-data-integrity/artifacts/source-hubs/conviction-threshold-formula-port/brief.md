# Conviction Threshold Formula Port

**Slug**: `conviction-threshold-formula-port`
**Stage**: `backlog`
**Priority**: `p2`
**Created**: `2026-05-07`
**Parent**: `admin-design-revamp` (cleanup B3)

## Problem

`deriveThreshold` returns a fixed `DEFAULT_THRESHOLD_PERCENT = 75` (`packages/shared/src/utils/conviction/derivation.ts:49`) because `HYPERCERT_SIGNAL_POOL_ABI` exposes neither `threshold()` nor `minThresholdPoints()`. The vendor `CVStrategy` reference in `packages/contracts/src/mocks/CVStrategy.sol` carries `minThresholdPoints` + `maxRatio`, but those getters are not on the deployed pool's ABI. As a result, every conviction proposal renders the same 75% threshold tick.

## Desired Outcome

Pick one of:

- (a) Extend `HYPERCERT_SIGNAL_POOL_ABI` to surface `minThresholdPoints()` + `maxRatio()` (or equivalent), then port the vendor formula into `deriveThreshold`.
- (b) Port the formula directly into `deriveThreshold` if the inputs (decay, pointsPerVoter, hypercert weight) are already known on the client and only the ratios are missing — depends on (B1) landing first.

`deriveThreshold(_poolConfig, _weight)` signature stays stable; only the internals change.

## Scope Notes

- **In scope**: ABI extension or shared util port; tests for the formula's per-branch correctness; visual verification on `/community/governance` proposal cards.
- **Out of scope**: full strategy mechanics (passing/funding logic happens elsewhere). B1 / B2 — separate plans, but B1's decay+pointsPerVoter reads are likely a prerequisite.

## Success Signal

Each conviction proposal on `/community/governance` renders a per-hypercert threshold tick that matches the contract's actual passing threshold under decay and member count, not a fixed 75%.

## References

- Cleanup investigation: `.plans/active/admin-design-revamp/handoffs/claude-cleanup.md` § "B1–B3 investigation".
- Affected files: `packages/shared/src/utils/conviction/derivation.ts`, `packages/contracts/src/...` (ABI source), `packages/contracts/src/mocks/CVStrategy.sol` (vendor reference).
