# Continue transaction batching

Finish the remaining plan from this batching checkpoint. Read `status.json`, `plan.todo.md`, and `spec.md` first. The completed work is Phase 1 shared transport, recovery, reviewed budgets, and queue-reference compatibility. No product action calls the new batch API yet.

## State on 2026-10-30

PR #1208 merged to `develop` as `2376e5b84`. Slice 1D, #1396, merged as `a2fdc723a` and answered its six review findings: five are fixed, and operation IDs stay unscoped, with the reason in [the spec](../spec.md#recovery-rules-added-on-2026-10-30). Slice 1E, on branch `fix/batch-recovery-races`, fixes the four findings from review of #1396.

Proof for 1D, with RED first. The first run, at 05:58:45 UTC, had 8 failures: 4 assertions on real behavior and 4 on the missing release function. The second, at 06:03:48 UTC, had 8 more: 7 assertions on the same round of behavior and a budget test corrected once to fail for the right reason. At 06:05:07 UTC, 13 focused files passed 228 tests with 6 existing skips, and both Shared typechecks passed. For 1E, on 2026-10-31, 4 new tests failed on behavior at 07:35:27 UTC, and at 07:37:31 UTC the same 13 files passed 234 tests with 6 existing skips, with both Shared typechecks passing. Each PR records the gate and CI results for its final head.

Next: garden settings (slice 2). It needs the user's passkey and approval to broadcast for its live proof. [The plan](../plan.todo.md#slices) defines every slice after that.

## Start here

1. Start with [publication.md](publication.md) for the isolated `develop` base, implementation commit, and current proof. Confirm the PR head, clean working tree, and validation status. The original 35 unpublished parent commits were excluded from this branch.
2. Read [the Phase 1 foundation](phase-1.md) and [limits follow-up](phase-1-compatibility.md) as historical evidence for that source snapshot. Current source/receipt evidence must be refreshed after any base migration. Do not infer that old full-suite results establish current readiness.
3. Work through [the slices](../plan.todo.md#slices) in order. Garden settings also proves the first live batches (decision 14), which closes checkpoint 1.6. Follow the plan skill start gate and repository validation selector. Later-phase checkboxes remain open.

## Boundaries

- Keep the shared batch service authoritative for prepared intent, reviewed budget, durable references, execution ownership, and read-only recovery. Domain permissions and per-item receipt verification stay with the caller.
- Preserve existing native EAS batching in client Upload all. Existing wallet pool batching, hypercert batch listing, and card endowment paths are not missing features; inspect their behavior before any migration.
- Live Gnosis/account/profile migration and device-authenticator QA belong to another session. Standalone probes from this lane were stopped after the user clarified the overlap. Do not resume them from this handoff. A live batch through garden settings is this plan's own work and needs the user's approval to broadcast.
- This checkpoint authorizes no deployment, live transaction broadcast, account upgrade, merge, dependency change, or unrelated cleanup. Further publication follows the user's current instruction and the ship workflow.

## Evidence and remaining work

The original limits snapshot passed 180 focused tests with six existing skips, both Shared typechecks, lint, formatting, and independent ontology guards. Real software P-256-signed Kernel 0.3.1/0.3.3 operations passed eight isolated-fork outcomes. These do not certify live sponsorship or device signing. Full Shared validation had failures in unchanged files; a focused recheck passed but the full rerun reproduced a language-test failure and was interrupted. Two inherited auth source-policy violations were also present on that original base. Keep failed, interrupted, unrun, and passing evidence distinct.

Use the PR body and publication handoff for the final branch, base, commit, and current proof. The hub remains active and all implementation lanes remain uncertified until their required fresh receipts exist.
