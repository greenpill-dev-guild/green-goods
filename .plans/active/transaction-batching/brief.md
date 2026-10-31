# Transaction Batching and Recovery

**Stage:** active. **Created:** 2026-10-23. **Scope:** Phase 1 implementation authorized; later phases remain planned.

Reduce repeated signing and make interrupted actions recoverable for both passkey and connected-wallet users. Deliver this in the requested order: shared batching and recovery, garden settings, adding members, deposits, then bulk work approvals.

The repository already has transaction senders, wallet atomic calls, EAS multi-attestations, and a durable work queue. Connect and harden those capabilities before adding more bulk actions.

## Delivery sequence

| Phase | User outcome | Passkeys | Connected wallets | Exit condition |
|---|---|---|---|---|
| 1. Shared batching and recovery | Check interrupted actions without blindly sending them again | Checkpoint an atomic Kernel UserOperation and verify execution | Discover capability; persist call IDs or transaction hashes; retain all receipts | Recovery, identity-change, and duplicate-tab tests pass |
| 2. Garden settings | Save changed fields together and see what actually saved | One approval request for a supported batch within budget | One batch request when supported; otherwise sequential saves with durable progress | No lost draft, false success, or repeat of confirmed fields |
| 3. Adding members | Add the reviewed list with fewer signing requests | Bounded atomic groups | Atomic groups or sequential fallback selected before sending | Duplicates, invalid rows, and partial progress have explicit outcomes |
| 4. Deposits | Approve and deposit in one step, and never repeat a deposit whose outcome is unknown | The approval and deposit in one atomic UserOperation | One batch request when supported; otherwise today's approve then deposit, with both signatures shown | No double deposit; a reverted atomic group leaves no allowance; an unknown outcome stays pending after reload |
| 5. Bulk work approvals | Review individually, then record selected decisions together | EAS `multiAttest` in one UserOperation per group | EAS `multiAttest` in one ordinary transaction per group | Each decision retains its metadata and verified attestation identity |
| 6–12. Remaining actions | Fewer prompts on pool, creation, Karma, marketplace, campaign jar, action edit, and Octant flows | Atomic groups through the enablement list | Atomic groups when supported; otherwise today's steps | One slice per PR; see [the slice table](plan.todo.md#slices) |

“One request” means one application submission request. A wallet may require additional signers or confirmations. Gas savings and confirmation latency must be measured.

## Scope and success

Initial product surfaces are the admin garden editor, member dialog, deposit modals, and Hub work queue, plus the client's funding cards and endowment sheet, which share the deposit hooks. Shared owns execution and recovery for both authentication rails. Existing client/PWA uploads, single-item actions, and commitment-pool callers receive compatibility checks; new client bulk interfaces are deferred.

Deposits joined this plan on 2026-10-30. They reach funders and gardeners, not only stewards, and a vault deposit can take three prompts. They follow members so that the first live batches carry no funds. On the same day the user asked to finish every action that can batch, so [the plan](plan.todo.md#slices) now defines one slice per PR for all of them and lists the few that will not batch, with reasons.

Success means fewer signing requests for the same completed action, no retry of confirmed items within an operation, visible unresolved outcomes after reload, and unchanged review rules and account identity. Recovery is local to the browser origin; it is not global exactly-once execution.

No contract deployment, schema change, wallet upgrade, dependency change, new relayer, or cross-chain transaction is planned. Role removal, assessment batching, voucher deposits and issuer steps, marketplace expansion, and automatic offline submission of admin decisions are outside this hub.

Phase 1 is on draft PR #1208, which `develop` was merged into on 2026-10-30. [The continuation handoff](handoffs/continuation.md) has the current state, and the first publication is recorded in [the publication handoff](handoffs/publication.md). [The limits follow-up](handoffs/phase-1-compatibility.md) and [foundation handoff](handoffs/phase-1.md) remain historical. Real Kernel execution passed on an isolated fork; authenticated signing and configured paymaster acceptance remain pending. [status.json](status.json) retains execution truth for all phases.

## Related ownership

- [Steward Cockpit UX Fixes](../../active/steward-cockpit-ux/brief.md) delivered existing settings progress and review behavior. This is successor scope, not a reopening.
- [Passkey account continuity](../../active/passkey-account-continuity/brief.md) owns sign-in and account identity; preserve its account recipes and addresses.
- [PWA interface simplification](../../backlog/pwa-interface-simplification/brief.md) owns client journey changes and is not a prerequisite for this rollout. Deposits change only the progress and recovery states on existing client surfaces.
- The [architecture contract](../../../.claude/context/codebase-architecture.md) governs the shared seam. [spec.md](spec.md) records the selected design; [plan.todo.md](plan.todo.md) gives checkpoints; [eval.md](eval.md) defines proof.
