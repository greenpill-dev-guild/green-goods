# PRD-721 contracts blocker — production bounds evidence

## Status

**RESOLVED BY HUMAN DIRECTION** on `feature/build-commitment-pooling-contracts` after `076c8937d`.

On 2026-08-05 Afo authorized production-path-first implementation, followed by exact-path and
canonical-event benchmarking at 8/16/24/32/40. The current value 32 remains provisional until the
measured table and pure ABI getters reconcile. The authorization explicitly excludes broadcast and
live chain-state mutation.

The Assessment v3 malformed-word security finding is fixed and independently re-reviewed. The
remaining P1 finding cannot be resolved faithfully without changing the current frozen-bound basis
or first implementing the production paths the original ordering said must follow the freeze.

## Issue

`test/CommitmentPoolingBounds.t.sol` benchmarks an isolated synthetic contract with bespoke
storage, loops, and events. It does not call `CommitmentPoolingModule` production entry points or an
exact shared internal implementation used by those entry points. The current module is only a
storage/initializer/getter scaffold, so the required creation, approval-credit, Ready evaluation,
replay, roster/work freeze, evidence, confirmer, and create-to-finalize paths do not yet exist to
measure.

The handoff requires this order:

1. Measure 8/16/24/32.
2. Freeze all five values and pure getters.
3. Only then implement the bounded production loops.

The independent review correctly requires the production entry points, or their exact shared
internal implementation, plus the next candidate above 32 before those values can be called frozen.
The two requirements cannot both be satisfied by the current checkpoint without a human-approved
correction to the implementation order or the meaning of the bound.

## Exact evidence

- `.plans/active/commitment-pooling/handoffs/codex-contracts.md:401-415` requires benchmark →
  freeze → production-loop implementation ordering.
- `.plans/active/commitment-pooling/handoffs/codex-contracts.md:469-477` requires worst-case
  creation, approval credit, Ready evaluation, event payload, and replay coverage.
- `packages/contracts/test/CommitmentPoolingBounds.t.sol:6-150` defines a standalone synthetic
  target and bespoke `RequirementsBench`, `LinkedWorksBench`, `ContributorsBench`, `EvidenceBench`,
  and `ConfirmersBench` events.
- `packages/contracts/src/modules/CommitmentPooling.sol:18-148` contains storage, initialization,
  getters, policy, and read-through functions only; the required production paths are absent.
- `packages/contracts/src/interfaces/ICommitmentPoolingModule.sol:347-470` defines the canonical
  production events that the synthetic vector events do not reproduce.

The exact Bun-wrapped bounds command still passes:

```text
bun run --filter @green-goods/contracts test:match -- test/CommitmentPoolingBounds.t.sol
PASS — 1 test
```

A local rerun in the fix session reproduced the committed raw table exactly. The two independent
reviews reported a different fresh gas vector at the same logical head. Payload sizes agreed. That
cross-run gas disagreement is not the primary blocker, but it reinforces that the table must be
replaced with reconciled production-path evidence rather than treated as an immutable safety fact.

## Options considered

### Implement production paths, then remeasure

Implement the complete spec-owned bounded entry points and shared internal helpers first. Run the
8/16/24/32 matrix plus at least the next candidate against those exact paths, then update getters,
tests, and the handoff table from the measured result.

This produces the strongest evidence but reverses the current freeze-before-loops order and expands
the correction into the remaining CommitmentPoolingModule implementation.

### Define 32 as a human-approved product cap

Keep 32 independently of the maximum safe measured value and amend the specification so the
benchmark proves only that the chosen product cap is transaction/indexer safe.

This is an architecture/product decision, not an implementation inference. It also requires a
real production-path benchmark at 32.

### Unfreeze the current getters immediately

Make the five getters fail closed until production measurement completes and return the lane/table
to provisional status.

This prevents downstream consumption but changes the already-declared getter semantics and does not
itself provide the missing production measurements.

## Resolution

The first option is approved. Complete the exact production bounded paths, then remeasure
8/16/24/32/40 before declaring any value frozen. PRD-721 is active again, while downstream lanes
remain prohibited from copying the current value 32 until the table and getters reconcile.

Do not silently preserve the synthetic freeze, select a different constant, change a canonical
event, or treat “not measured” as evidence that the next size is unsafe.

## Unaffected work

- Commit `3172341aa` correctly rejects non-canonical Assessment v3 uint8 words.
- Assessment v2 compatibility, resolver activation ordering, CommitmentRegistry accounting,
  WorkApproval/GardenToken callback behavior, and all six required storage layouts remain green.
- No deployment, broadcast, live authority change, schema registration, or chain mutation occurred.
