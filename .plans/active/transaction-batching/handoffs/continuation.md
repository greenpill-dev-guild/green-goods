# Continue transaction batching

Finish the remaining plan from this batching checkpoint. Read `status.json`, `plan.todo.md`, and `spec.md` first. The completed work is Phase 1 shared transport, recovery, reviewed budgets, and queue-reference compatibility. Product UI batching for settings, member additions, and bulk work review is not implemented.

## Start here

1. Confirm the current branch, PR base, clean working tree, and current validation evidence. The original snapshot was based on local commit `73f05a9177125d6509105659f5a724472343cc31`, with 35 parent commits absent from `origin/develop`; those parent commits belong to other work. The publication attempt isolates this task onto `develop`. Verify the final publication handoff before selecting a base or claiming current compatibility.
2. Read [the Phase 1 foundation](phase-1.md) and [limits follow-up](phase-1-compatibility.md) as historical evidence for that source snapshot. Current source/receipt evidence must be refreshed after any base migration. Do not infer that old full-suite results establish current readiness.
3. Complete the remaining Phase 1 composition/validation work, then implement garden settings, adding members, and bulk work reviews in that order. Follow the plan skill start gate and repository validation selector. Later-phase checkboxes remain open.

## Boundaries

- Keep the shared batch service authoritative for prepared intent, reviewed budget, durable references, execution ownership, and read-only recovery. Domain permissions and per-item receipt verification stay with the caller.
- Preserve existing native EAS batching in client Upload all. Existing wallet pool batching, hypercert batch listing, and card endowment paths are not missing features; inspect their behavior before any migration.
- Live Gnosis/account/profile migration and device-authenticator QA belong to another session. Standalone probes from this lane were stopped after the user clarified the overlap. Do not resume them from this handoff.
- This checkpoint authorizes no deployment, live transaction broadcast, account upgrade, merge, dependency change, or unrelated cleanup. Further publication follows the user's current instruction and the ship workflow.

## Evidence and remaining work

The original limits snapshot passed 180 focused tests with six existing skips, both Shared typechecks, lint, formatting, and independent ontology guards. Real software P-256-signed Kernel 0.3.1/0.3.3 operations passed eight isolated-fork outcomes. These do not certify live sponsorship or device signing. Full Shared validation had failures in unchanged files; a focused recheck passed but the full rerun reproduced a language-test failure and was interrupted. Two inherited auth source-policy violations were also present on that original base. Keep failed, interrupted, unrun, and passing evidence distinct.

Use the PR body and publication handoff for the final branch, base, commit, and current proof. The hub remains active and all implementation lanes remain uncertified until their required fresh receipts exist.
