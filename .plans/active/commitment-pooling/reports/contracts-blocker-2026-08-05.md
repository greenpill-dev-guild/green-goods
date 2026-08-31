# PRD-721 contracts blockers

## Current status

**NOT BLOCKED.** The branch-mirror blocker recorded after `4256623d0` was withdrawn on 2026-08-05
and the contracts lane is back to in progress.

The reviewer who raised the branch mismatch withdrew that finding on re-review: the canonical
machine-lane branch and the dispatched execution-sub-lane branch are two different fields *by
design*, and the plan already says so (`plan.todo.md` Decision Log #19). Plan Hub validation passes
against the current values, so there was never anything to reconcile and no `plan-hub.mjs` change is
required. Details in "Withdrawn blocker" below.

## Resolved blocker status — production bounds evidence

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

## Withdrawn blocker — canonical branch mirror

**WITHDRAWN 2026-08-05.** The two branch values are intentionally different fields, not a mismatch.
Recording this as a blocker halted valid PRD-721 work and requested an unnecessary validator change.

### Issue as originally recorded

The fresh reviewer correctly observed that this run's actual branch is
`feature/build-commitment-pooling-contracts`, while the machine-lane branch in `status.json` and
the handoff signal are `codex/contracts/commitment-pooling`. Replacing those signals with the
actual branch makes Plan Hub validation fail. Its enforcing source is `scripts/harness/plan-hub.mjs`,
which is outside the dispatch's permitted paths (`packages/contracts/**` and
`.plans/active/commitment-pooling/**`).

### Exact evidence

- `status.json:169-181` keeps the Plan Hub machine-lane branch convention and records this blocker.
- `status.json:274-283` separately records the actual dispatched execution branch.
- `scripts/harness/plan-hub.mjs:128-132` defines the contracts lane branch as
  `codex/contracts/${slug}`.
- `scripts/harness/plan-hub.mjs:1677-1680` rejects any other lane branch.
- With the reviewer-proposed value applied, the exact command returned:

```text
node scripts/harness/plan-hub.mjs validate
.plans/active/commitment-pooling: lane "contracts" branch must be "codex/contracts/commitment-pooling"
```

- Restoring the validator-owned machine-lane signal keeps the plan valid while
  `execution_sub_lanes.contracts.branch` truthfully records
  `feature/build-commitment-pooling-contracts`.

### Options considered

1. **Authorize a narrow Plan Hub follow-up.** Teach the validator to accept an
   explicit dispatched integration-branch override, then change the canonical lane signal and
   rerun validation. Rejected on re-review: it solves a problem that does not exist.
2. Switch this run to `codex/contracts/commitment-pooling`. Rejected: the dispatch explicitly
   prohibits branch creation or switching and requires the current feature branch before commits.
3. Leave the feature branch in the canonical field despite failed validation. Rejected: this would
   knowingly leave the active plan invalid.
4. Retain the machine-lane convention and the separate actual execution branch. **Selected.** This
   is not a compromise: it is what Decision Log #19 already specifies, and Plan Hub validates it.

### Resolution (2026-08-05)

Option 4 was already the correct state, and it is not a partial satisfaction of the reviewer
finding — the finding itself was withdrawn. `plan.todo.md` Decision Log #19 establishes that
`status.json` carries only Plan Hub's canonical machine lanes while detailed workstreams live in
`execution_sub_lanes`; the branch fields follow that same split. Keeping the convention in
`lanes.contracts.branch` and the dispatched branch in `execution_sub_lanes.contracts.branch` is the
design, not a workaround.

Verified on 2026-08-05:

```text
node scripts/harness/plan-hub.mjs validate
Validated 41 feature hubs.
```

Actions taken: the branch-mirror blocker was withdrawn, both branch fields were left in their
intended places, and `lanes.contracts` plus `execution_sub_lanes.contracts` returned to
`in_progress`. Option 1's recommended `scripts/harness/plan-hub.mjs` edit is **not** required and
should not be pursued — no validator change, deployment, or broadcast is involved.
