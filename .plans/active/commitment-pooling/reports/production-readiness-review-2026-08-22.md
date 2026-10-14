# Commitment Pooling production-readiness review

Date: 2026-08-22 PDT / 2026-08-23 UTC  
Checkpoint: pre-deploy  
Accountable release and hosted-indexer owner: Afolabi Aiyeloja

## Verdict

This checkpoint does not approve a production release yet.

| Release tier | Verdict | Reason |
| --- | --- | --- |
| Core pooling and read stack | `REQUEST_CHANGES` | The contracts, indexer source, and shared source are ready, but the hosted indexer still serves the old schema, Arbitrum protocol ownership has not moved to the approved Safe, and the integrated application candidate is not yet frozen as a clean commit. |
| Settlement and value activation | `COMMENT_ONLY` | The settlement contracts are deployed and paused, and both live-state verifiers pass. Activation remains intentionally blocked on human-controlled ownership, Celo Safe threshold, routing, ping/ack, and separately authorized value-canary operations. |

Component verdicts are narrower than the release-tier verdicts and grant no transaction, deployment,
cutover, unpause, or value authority.

| Component | Pre-deploy verdict |
| --- | --- |
| Contracts: deployed identity and core behavior | `APPROVE` |
| Contracts: ownership and release configuration | `COMMENT_ONLY` |
| Contracts: settlement/value activation | `COMMENT_ONLY` |
| Indexer: source, schema, handlers, and static configuration | `APPROVE` |
| Indexer: hosted production deployment and cutover | `REQUEST_CHANGES` |
| Shared: source contract and local candidate-schema compatibility | `APPROVE` |
| Shared: production read-back and availability flip | `COMMENT_ONLY` |

## Authorization boundary

This review made repository changes and ran local, forked, and read-only live checks. It did not:

- broadcast a contract transaction;
- transfer ownership or change a Safe;
- deploy, reindex, promote, or roll back Envio;
- change application availability;
- unpause settlement;
- send a ping, acknowledgment, canary, or value;
- write to Linear.

The post-deploy checkpoint remains pending separate human authorization and completed operations.

## Frozen inputs

| Input | Value |
| --- | --- |
| Deployed Solidity source commit | `fab5daef2eebbe83c1d444f6c148c682e122f1c3` |
| Application base commit | `2cd115a1ded15ff6c886c6bda1fb33d5e242770c` on `develop` |
| Review-owned implementation patch hash | `fe961b26f01c66571884012cc77f2f7a70d351bcda36c3de4876ae721fb78081` |
| Release manifest hash | `0x0c442d179ff865a484c5c2bd2a03501950a982fe03177cbab9dcbd1fd731cca9` |
| Indexer config hash | `0x3b4b1c5b6173c0e90a6aedbdbfb439f91166625ba2e820aa0e7eec90d82b0599` |
| Root lockfile SHA-256 | `a137edb9610812b5575d52f98c7b1a4313b390d686e8589ce08a5217975d9a04` |
| Bun / Node / Foundry | `1.3.14` / `22.22.1` / `1.7.1` |
| Envio | `3.6.1` |
| Validation policy | repository `readiness`, `critical`, contracts + indexer + shared selector |

The application candidate is not fully frozen: the review-owned patch is uncommitted, and the shared
checkout also contains unrelated Commitment Loop Walk work. Freeze a clean commit after accepting this
patch, then treat any ABI, storage, address, start-block, schema, handler, query-contract, lockfile, or
validation-policy change as invalidating its corresponding receipt.

## Findings

### P1 - Hosted production Envio does not contain the release schema

At `2026-08-23T01:57:01.622Z`, the public hosted endpoint returned HTTP 200 and current Arbitrum
chain progress, but GraphQL introspection did not contain `CommitmentPool`,
`CreditRegistryConfiguration`, or `SettlementConfiguration`. It reported only Sepolia and Arbitrum
chain metadata; Celo was absent.

This is a deterministic production gap, not a local-source defect. Core availability must stay
`deployed-not-available` until a hosted candidate is deployed, fully replayed, read back, and proven
against sentinel records and aggregate counts.

Owner: Afolabi Aiyeloja / hosted indexer cutover.  
Disposition: `REQUEST_CHANGES`.

### P1 - Tier 1 still requires Arbitrum Safe ownership

The Arbitrum release verifier passed all 138 live checks. The approved protocol Safe resolved as the
exact 2-of-6 owner set, and the dry run produced eight ready, fail-closed ownership boundaries. The
live contracts remain owned by the deployment sender because no transfer was authorized in this
review.

Owner: Afolabi Aiyeloja / human release ceremony.  
Disposition: `COMMENT_ONLY` until mined receipts and Safe-owner-phase verification exist.

### P1 - Celo protocol Safe is below policy

The Celo release verifier passed all 159 deployment-phase checks and confirmed the executor remains
paused with value caps at zero. The ownership dry run failed closed because the live Celo protocol
Safe is 1-of-4. The frozen target is 2-of-4 and the repository floor is threshold at least 2 with at
least 3 owners.

Owner: Afolabi Aiyeloja / Safe owners.  
Disposition: `COMMENT_ONLY`; this blocks Tier 2 only while settlement remains paused and unavailable.

### P1 - The final application release SHA is not cleanly frozen

The reviewed application base is `2cd115a1...`, but the accepted indexer/configuration corrections
and this evidence report are still a working-tree patch. Unrelated Commitment Loop Walk changes were
present before and during this review and were preserved. No production receipt should be attached to
the base SHA alone.

Owner: release owner.  
Disposition: `REQUEST_CHANGES`; commit only the accepted scoped patch, freeze the new SHA, and rerender
the readiness plan before operations.

### P2 - Full historical replay and rollback anchor remain post-authorization evidence

The disposable empty-database lifecycle passed, including mined Pooling and CreditRegistry pause
events through local Envio. The source replay suites also converge across normal, reverse, duplicate,
stale, and replay delivery. A separately addressable hosted candidate or disposable full-production
historical replay was not created in this checkpoint.

Before hosted deployment, record the exact current hosted version as the rollback anchor. Cutover must
stop, or roll back if already in place, on any of:

- schema or GraphQL contract mismatch;
- stalled head or unacceptable indexing lag;
- missing known deployment receipts or sentinel records;
- pool, cycle, commitment, confirmation, settlement, or aggregate count divergence;
- public query errors or privacy-boundary regression.

Owner: hosted indexer cutover owner.  
Disposition: `BLOCKED` pending hosted capability and authorization.

### P2 - SettlementModule has minimal code-size margin

`SettlementModule` is 24,495 bytes, only 81 bytes below the EIP-170 limit. The current deployed
candidate and build pass, so this is not a release blocker, but any future contract change must rerun
the production size gate and cannot be folded into release preparation.

Owner: contracts maintainers.  
Disposition: accepted release risk for the pinned deployed implementation.

### P3 - Saved Offers are disabled and out of scope

No non-test client or admin consumer imports the Saved Offers hooks or API. The dormant query keys are
chain-scoped but not owner/session-scoped. Saved Offers remain disabled and out of this release. Before
future enablement, add owner/session isolation and prove account-switch and logout behavior.

Owner: future Saved Offers lane.  
Disposition: `OUT_OF_SCOPE`.

## Requirements matrix

| Requirement | Status | Evidence | Accountable owner |
| --- | --- | --- | --- |
| Deployed Solidity and application candidates identified separately | `SATISFIED` | Deployed source `fab5daef...`; application base `2cd115a1...` | Release owner |
| Clean final application SHA | `MISSING` | Review patch is not committed; unrelated concurrent changes remain | Release owner |
| Manifest, lock, and living handoff agree | `SATISFIED` | Manifest/lock reproduce `0x0c442d...cca9`; old handoff hash superseded | Contracts/release engineering |
| Envio runtime and docs agree | `SATISFIED` | Package and docs now pin `3.6.1` | Indexer |
| CreditRegistry exact address and safe start boundary | `SATISFIED` | Arbitrum config pins `0xcfF1...6A34`; chain start precedes deployment block `493971794` | Indexer |
| Release updater prevents missing/replaced/duplicate release contracts | `SATISFIED` | Updater and boundary negative tests cover Pooling, Registry, Settlement, CreditRegistry, and Celo executor | Contracts/indexer |
| Deployed proxies, implementations, libraries, owners, pauses, and code hashes match | `SATISFIED` | 138 Arbitrum and 159 Celo live checks passed | Contracts |
| Storage/UUPS layout remains compatible | `SATISFIED` | 15 baselines and 3 ERC-7201 namespaces passed | Contracts |
| Core pooling behavior and 18-pool activation state | `SATISFIED` | 2,050 contract tests, 37 fork tests, fresh live state; Pooling unpaused | Contracts |
| Arbitrum protocol ownership by approved Safe | `BLOCKED` | Dry run ready at exact 2-of-6; transfer not authorized | Human release owner |
| Settlement stays unavailable during Tier 1 | `SATISFIED` | SettlementModule, CreditRegistry, and Celo executor paused; route/dispatcher/value caps zero | Contracts/shared |
| Celo Safe meets threshold policy | `BLOCKED` | Live dry run resolves 1-of-4 and fails closed | Safe owners |
| Route, ping/ack, canary, and value authority | `BLOCKED` | No operation authorized; zero-value configuration preserved | Human release owner |
| Frozen 58-event indexer boundary and replay convergence | `SATISFIED` | 286 indexer tests, one governed pending integration in default suite | Indexer |
| Empty-database local mined lifecycle | `SATISFIED` | `test:contract-events`: 12/12 passed using disposable Anvil/Postgres/Hasura/Envio | Indexer |
| Disposable full historical production replay | `BLOCKED` | Requires hosted candidate or equivalent credentials/capability | Hosted indexer owner |
| Hosted schema, Celo chain, sentinels, and aggregate counts | `MISSING` | Production endpoint serves old schema and has no Celo metadata | Hosted indexer owner |
| Hosted rollback anchor recorded before cutover | `BLOCKED` | Current endpoint exists, but exact deploy/version anchor is not recorded in this checkpoint | Hosted indexer owner |
| Shared selections match candidate schema | `SATISFIED` | 282/282 selected fields match local candidate schema | Shared |
| Shared cache/disclosure isolation | `SATISFIED` | Chain/viewer/garden/filter/account tests pass; Saved Offers disabled | Shared |
| Offline jobs are idempotent and exclude value movement | `SATISFIED` | Six allowed offline job kinds; no funding, settlement, or transfer job | Shared |
| Hosted shared-query read-back | `BLOCKED` | Candidate schema is not deployed | Shared/indexer |
| Ontology remains unavailable before read-back | `SATISFIED` | `check:ontology` passed; capability remains `deployed-not-available` | Shared/release owner |
| Downstream deterministic builds | `SATISFIED` | Sepolia root build plus agent and docs builds passed | Release owner |
| Authenticated Brave production runtime check | `BLOCKED` | Runs only after indexer and application deployment | Client/admin QA owner |
| Linear mirrors current coordination state | `SATISFIED` | Live read: PRD-721/722/723/686 Done; PRD-731 In Progress | Release owner |
| Broadcast, deployment, cutover, or value authority | `OUT_OF_SCOPE` | Explicitly excluded from this checkpoint | Human release owner |

## Corrections implemented

- Pinned the deployed Arbitrum `CreditRegistry` address in Envio configuration while preserving a
  start block before its deployment.
- Extended the deployment-to-Envio updater and negative tests to fail closed on missing, duplicate,
  replaced, or late-start release contracts across Arbitrum and Celo.
- Updated Envio documentation from `3.2.1` to the installed `3.6.1` runtime.
- Regenerated the release lock and bound the manifest to the corrected indexer configuration.
- Reconciled the living release handoff with the current manifest hash and the live Celo 1-of-4 Safe.
- Recorded Saved Offers as disabled and out of scope rather than silently treating dormant code as
  production-ready.

No contract ABI, Solidity storage, deployment address, or deployed implementation changed.

## Validation receipts

Every command below was run against the same working candidate. Deterministic failures stopped their
dependent lane; environment-only failures were retried only after the missing capability changed.

| Risk | Expected signal and stop condition | Receipt |
| --- | --- | --- |
| Validation-policy drift | Critical readiness selector resolves every required package lane; stop if blocked or malformed | Ready: format, lint, ABI, all package tests/typechecks/builds, contracts verify |
| Manifest/config drift | Manifest and lock reproduce exact hashes; stop on any mismatch | Passed, manifest `0x0c442d...cca9` |
| Contract behavior regression | Full production verifier has zero failed contract/script/gas checks | Passed: 2,050 Solidity, 289 script, 3 gas-boundary tests |
| Storage or deployability regression | All baselines match and every deployable contract is below EIP-170 | Passed: 15 baselines, 3 namespaces; SettlementModule margin 81 bytes |
| Live deployment drift | Every address, implementation, runtime hash, owner phase, pause, and immutable matches | Passed: 138 Arbitrum, 159 Celo |
| Ownership tool safety | Dry run re-reads exact Safe and fails closed below policy | Arbitrum passed 8 boundaries; Celo expected fail at live 1-of-4 |
| Indexer boundary drift | Exact release contracts and deployment-or-earlier start blocks; stop on missing/replacement/duplicate | Passed: 5 negative boundary tests, 15 contracts on 3 chains |
| Indexer handler/replay regression | All frozen handlers and replay cases converge | Passed: 286, with 1 governed pending real integration in the default suite |
| Empty-database lifecycle | Mined Pooling/Credit events appear through disposable local Envio; stop on service or entity mismatch | Passed: 12/12 after isolated rerun |
| Shared contract regression | Full typecheck and shared tests pass | Passed: 3,930 tests, 1 governed skip |
| Ontology/structure drift | Generated ontology and source boundary remain deterministic | Passed: 50 ontology tests and source-structure check |
| Repository regression | Format, lint, full tests, and deterministic root build all pass | Passed; client 865, admin 659, agent 270, docs 28, plus package suites above |
| Conditional build coverage | Selected agent/docs builds and ABI artifact comparison pass | Passed |
| Plan Hub integrity | All feature hubs validate; stop on schema or reference failure | Passed: 44 hubs; existing clean-commit receipt debt remains baselined through 2026-09-05 |
| Hosted runtime compatibility | Required GraphQL types, Celo progress, sentinels, and counts exist; stop on any absence | Failed as expected against old hosted deployment; remains a release blocker |

The first sandboxed indexer and contract verifier attempts could not bind loopback ports. Their exact
commands passed after loopback capability was granted. The first full local contract-event attempt then
hit a transient unhealthy disposable Postgres container under concurrent load; the isolated rerun
passed all 12 checks. No failed product assertion was reused as passing evidence.

## Authorized-operations handoff

After a clean SHA is frozen, the human-controlled order remains:

1. Record the exact current hosted Envio deployment/version as rollback anchor and prepare a separately
   addressable candidate when supported.
2. Execute and receipt-verify the Arbitrum ownership ceremony. Do not infer approval from the green dry run.
3. Deploy/replay the hosted indexer candidate and verify schema, chain progress, all 18 pools, representative
   cycles/commitments/confirmations, settlement records, aggregates, lag, and public privacy constraints.
4. Only after hosted convergence, flip ontology availability, rebuild/deploy consumers, and run authenticated
   Brave read-only production checks.
5. Return the Tier 1 post-deploy verdict.
6. Separately raise the Celo protocol Safe threshold, complete Celo ownership and route receipts, and keep
   both peers paused until message-only ping/ack is authorized and verified.
7. Run a separately authorized minimum-value G$ canary and return the Tier 2 verdict.

Any failed post-operation receipt leaves the corresponding tier unapproved. Tier 2 remains independent of
Tier 1 while settlement is paused, unavailable, and absent from the released user journey.
