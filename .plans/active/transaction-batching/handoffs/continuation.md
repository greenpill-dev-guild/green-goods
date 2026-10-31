# Continue transaction batching

Finish the remaining plan from this batching checkpoint. Read `status.json`, `plan.todo.md`, and `spec.md` first. The completed work is Phase 1 shared transport, recovery, reviewed budgets, and queue-reference compatibility. Product UI batching for settings, member additions, deposits, and bulk work review is not implemented.

## Refresh on 2026-10-30

`develop` at `974b69ac9` is merged into this branch, 182 merges later than the last base. Conflicts were two import hunks in `passkey-sender.ts`, one seam fingerprint, and four generated digests. `develop` had already adopted the Kernel receipt guards this PR ported, so the seam's inputs now match `develop` and its entry needed no new review.

The 24 Oct CI failures are gone on the merged tree. The type error in `batch-senders.test.ts` needed a fix. `useContractTxSender` and `HomeGarden` passed once `develop`'s fixtures came in. Sixteen focused Shared files passed 272 tests with six existing skips, `HomeGarden` passed 14, and both Shared typechecks passed. These ran on the merge before the follow-up commits; the PR records the gate and CI results for its final head.

The same pass restored `wallet-sender.ts`'s null check on `value`. The port had also removed that file's reasoning comments to stay under the 500-line cap for a modified file, so checkpoint 1.11 moves its atomic batch code out and brings them back.

Next: merge this PR once it is green and the user agrees, then checkpoints 1.9 to 1.11, then garden settings.

## Start here

1. Start with [publication.md](publication.md) for the isolated `develop` base, implementation commit, and current proof. Confirm the PR head, clean working tree, and validation status. The original 35 unpublished parent commits were excluded from this branch.
2. Read [the Phase 1 foundation](phase-1.md) and [limits follow-up](phase-1-compatibility.md) as historical evidence for that source snapshot. Current source/receipt evidence must be refreshed after any base migration. Do not infer that old full-suite results establish current readiness.
3. Finish checkpoints 1.9 to 1.11, then implement garden settings, adding members, deposits, and bulk work reviews in that order. Garden settings also proves the first live batches (decision 14), which closes checkpoint 1.6. Follow the plan skill start gate and repository validation selector. Later-phase checkboxes remain open.

## Boundaries

- Keep the shared batch service authoritative for prepared intent, reviewed budget, durable references, execution ownership, and read-only recovery. Domain permissions and per-item receipt verification stay with the caller.
- Preserve existing native EAS batching in client Upload all. Existing wallet pool batching, hypercert batch listing, and card endowment paths are not missing features; inspect their behavior before any migration.
- Live Gnosis/account/profile migration and device-authenticator QA belong to another session. Standalone probes from this lane were stopped after the user clarified the overlap. Do not resume them from this handoff. A live batch through garden settings is this plan's own work and needs the user's approval to broadcast.
- This checkpoint authorizes no deployment, live transaction broadcast, account upgrade, merge, dependency change, or unrelated cleanup. Further publication follows the user's current instruction and the ship workflow.

## Evidence and remaining work

The original limits snapshot passed 180 focused tests with six existing skips, both Shared typechecks, lint, formatting, and independent ontology guards. Real software P-256-signed Kernel 0.3.1/0.3.3 operations passed eight isolated-fork outcomes. These do not certify live sponsorship or device signing. Full Shared validation had failures in unchanged files; a focused recheck passed but the full rerun reproduced a language-test failure and was interrupted. Two inherited auth source-policy violations were also present on that original base. Keep failed, interrupted, unrun, and passing evidence distinct.

Use the PR body and publication handoff for the final branch, base, commit, and current proof. The hub remains active and all implementation lanes remain uncertified until their required fresh receipts exist.
