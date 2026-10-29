# Dual-chain steward Safes

Accepted 29 October 2026: complete the family issuer's release tooling and automatically reconcile its steward Safes on Arbitrum and Gnosis. Live deployment and activation remain separate operator boundaries.

## Decisions

| Decision | Reason |
|---|---|
| Extend the source publisher with a native Safe; retain the existing publisher for single-destination releases | One source observer slot can reconcile locally and send the same canonical role revision remotely without replacing deployed releases |
| Native eligibility reads canonical role authority on every signature check and explicitly denies unavailable or remapped authority | Failed cleanup or callbacks must never preserve a revoked signature |
| Reuse one locked Hats/Safe deployment policy on both chains | Dependency hashes, threshold, modules and delegatecall permissions have one owner |
| Bound and isolate reconciliation from CCIP dispatch | A failure in one branch cannot discard the other; both have permissionless recovery |
| Bind release plans, rehearsals and readback to the source revision, exact nonces, peers and top-Hat counters | Stale or partially executed releases must be reconciled rather than broadcast again |

The current policy remains one valid registered steward signing alone and two signatures for two or more reconciled owners. No bootstrap signer is permitted in the dual-Safe release. Gnosis membership changes remain asynchronous and require funded CCIP delivery. This work does not change who may grant garden roles.

## Execution

1. Add dual-Safe release-plan rejection/acceptance proof and the native publisher with shared deployment policy.
2. Prove automatic add/remove through the real source Hats callback, immediate native revocation, cleanup/transport failure isolation, and destination delivery/replay behavior on isolated forks.
3. Extend the package-owned release command with bound deployment/rehearsal/readback and activation preparation. Preserve existing single-Safe plans and committed-source checks.
4. Refresh the private family package with concrete source/destination inputs, operator steps and remaining human/live gates.
5. Run the selector's critical checks and review every changed line. Record uncommitted worktree evidence honestly; no commit-attributed passing claim until the relevant paths are clean.

## State / failure matrix

| Boundary | Expected result |
|---|---|
| Grant a source steward through HatsModule | Native owner is added; canonical CCIP revision is dispatched when funded |
| Revoke a source steward | Native signature is invalid immediately; local cleanup and destination dispatch run independently |
| Local cleanup fails | Native eligibility denies; remote revocation still dispatches; permissionless reconciliation retries |
| Transport is unfunded or fails | Local owner state follows source; queued revision remains available for retry |
| Old or duplicate remote delivery | Cannot restore newer revoked authority or create duplicate ownership |
| Source authority unavailable or remapped | Native eligibility returns explicit denial; refresh does not invent a transport state |
| Roster goes to zero and later recovers | No signature is accepted at zero; source grants recover both Safes |
| Manifest/nonce/dependency/receipt drift | Release preparation/execution fails before further writes |

Owning capability: `StewardRolePublisher` owns canonical revision/transport; the new native publisher owns source Safe eligibility/reconciliation; the shared Safe deployment helper owns dependency and locked-gate policy. The existing release CLI owns planning, execution boundaries and persisted evidence. No application UI or dependencies need changing.

Linear preservation manifest was checked: RESR-73 remains Done; no Linear fields were changed. Current work is an accepted follow-up, not a reopening of the research decision.

Implemented boundaries: version-2 planning and exact deployment simulation; a bounded single-chain
CREATE command with a durable intent and canonical receipt adoption; private activation drafts and
current-state coordination readback. Existing version-1 preparation stays available.

Focused behavior proof on 29 October: six production Arbitrum cases pass with cold transaction
isolation, including a four-steward roster and cleanup exhausting its complete gas allowance while
revocation still dispatches. Thirteen Gnosis cases pass, including dual-Safe updates, stale delivery,
zero-roster recovery and locked configuration. The CLI and focused release tests pass. The native
suite joins the maintained voucher fork shard, with an additional production/cold run; no test is
exempted. This is a test-harness change, not a weakened validation gate.

Run the selector's complete critical contract override before a release decision. The exact local
gate, source revision, deployment rehearsal, activation draft and task/phase record belong in the
private family package. No live deployment or activation is asserted here. Additional collective
token issuance and service terms remain later activation work; these Safe tools do not mint tokens
or grant source issuer authority.

The recorded private direct-Hat native-Safe experiment is superseded by the constructor-locked
native publisher: no setup steward or manual source owner-list procedure is part of this design.
Private operator identities and live ceremony evidence stay outside this public repository.
