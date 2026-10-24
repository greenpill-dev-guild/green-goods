# Transaction Batching and Recovery

**Stage:** active. **Created:** 2026-10-23. **Scope:** Phase 1 implementation authorized; later phases remain planned.

Reduce repeated signing and make interrupted actions recoverable for both passkey and connected-wallet users. Deliver this in the requested order: shared batching and recovery, garden settings, adding members, then bulk work approvals.

The repository already has transaction senders, wallet atomic calls, EAS multi-attestations, and a durable work queue. Connect and harden those capabilities before adding more bulk actions.

## Delivery sequence

| Phase | User outcome | Passkeys | Connected wallets | Exit condition |
|---|---|---|---|---|
| 1. Shared batching and recovery | Check interrupted actions without blindly sending them again | Checkpoint an atomic Kernel UserOperation and verify execution | Discover capability; persist call IDs or transaction hashes; retain all receipts | Recovery, identity-change, and duplicate-tab tests pass |
| 2. Garden settings | Save changed fields together and see what actually saved | One approval request for a supported batch within budget | One batch request when supported; otherwise sequential saves with durable progress | No lost draft, false success, or repeat of confirmed fields |
| 3. Adding members | Add the reviewed list with fewer signing requests | Bounded atomic groups | Atomic groups or sequential fallback selected before sending | Duplicates, invalid rows, and partial progress have explicit outcomes |
| 4. Bulk work approvals | Review individually, then record selected decisions together | EAS `multiAttest` in one UserOperation per group | EAS `multiAttest` in one ordinary transaction per group | Each decision retains its metadata and verified attestation identity |

“One request” means one application submission request. A wallet may require additional signers or confirmations. Gas savings and confirmation latency must be measured.

## Scope and success

Initial product surfaces are the admin garden editor, member dialog, and Hub work queue. Shared owns execution and recovery for both authentication rails. Existing client/PWA uploads, single-item actions, and commitment-pool callers receive compatibility checks; new client bulk interfaces are deferred.

Success means fewer signing requests for the same completed action, no retry of confirmed items within an operation, visible unresolved outcomes after reload, and unchanged review rules and account identity. Recovery is local to the browser origin; it is not global exactly-once execution.

No contract deployment, schema change, wallet upgrade, dependency change, new relayer, or cross-chain transaction is planned. Role removal, assessment batching, deposits, marketplace expansion, and automatic offline submission of admin decisions are outside this hub.

Phase 1 implementation is underway in the dedicated worktree. Its develop-based checkpoint and current proof are recorded in [the publication handoff](handoffs/publication.md). [The limits follow-up](handoffs/phase-1-compatibility.md) and [foundation handoff](handoffs/phase-1.md) remain historical. Real Kernel execution passed on an isolated fork; authenticated signing and configured paymaster acceptance remain pending. [status.json](status.json) retains execution truth for all phases.

## Related ownership

- [Steward Cockpit UX Fixes](../../active/steward-cockpit-ux/brief.md) delivered existing settings progress and review behavior. This is successor scope, not a reopening.
- [Passkey account continuity](../../active/passkey-account-continuity/brief.md) owns sign-in and account identity; preserve its account recipes and addresses.
- [PWA interface simplification](../../backlog/pwa-interface-simplification/brief.md) owns client journey changes and is not a prerequisite for this admin rollout.
- The [architecture contract](../../../.claude/context/codebase-architecture.md) governs the shared seam. [spec.md](spec.md) records the selected design; [plan.todo.md](plan.todo.md) gives checkpoints; [eval.md](eval.md) defines proof.
