# Commitment Pooling — Human Release Operations

## Status

- Execution sub-lane: `release_ops`
- Machine lane: none; human-owned authorization surface
- Accountable owner: Afolabi Aiyeloja
- Current state: pooling registered and unpaused; settlement value activation remains blocked
- Linear context: PRD-731

This handoff never authorizes an agent broadcast. The core-upgrade/deployment tier and
value-bearing CCIP settlement tier have separate operational evidence and authorization, but both
share the repository's blocking internal committed-range review, tested rollback, post-action
verification, and per-stage human authorization requirements. Protocol Safe ownership is now a
later activation prerequisite, not part of this paused deployment ceremony.

**Owner decision 2026-08-10.** For this release wave, internal review replaces a commissioned
external audit, the 48-hour timelock is waived in favor of Safe multisig approval, and the former
two-week testnet soak is withdrawn. The evidence ladder is local/fork confidence, Ethereum Sepolia
endpoint rehearsal where useful, Arbitrum One, then Celo. These waivers do not authorize a
broadcast or collapse the separate core-unpause, message-only ping, Safe/Zodiac value-authority,
minimum-value canary, and cap/unpause decisions.

The approved product sequence treats verified contract receipts and the exact indexer
address/start-block artifact diff as the handoff to PRD-722. The currently hosted production
indexer is older and remains untouched by this release ceremony; PRD-722 separately owns its
configuration, deployment/reindex, cutover/rollback, and live read-back. Commitment Pooling runtime
UI work follows the proven backend sequence without making the value tier a prerequisite.

**Owner decision 2026-08-11.** This deployment stops with every touched proxy paused and owned by
the frozen deployment sender. It does not transfer ownership, register/backfill the approved 18
gardens, or unpause core. Those three operations move together to a separately reviewed Product
issue. The protocol Safe remains the approved future owner, not the owner expected by this
ceremony's post-deploy verifier.

**Owner decision 2026-08-12.** Protocol Safe ownership transfer is deferred beyond this release.
The temporary deployment-sender owner may complete the exact paused registration backfill in this
release: canonical root token 0 as the Protocol pool first, then the other seventeen Garden pools.
The operator uses one password entry and one resumable command, verifies every direct zero-value
transaction and pool ID, and stops after registration boundary 18. Pooling unpause remains a
separate command and authorization. Peer wiring, Safe/Zodiac value authority, value movement,
canary, cap increases, and indexer activation remain outside this decision.

**Verified execution 2026-08-13.** The resumable deployer ceremony registered the root Protocol
pool first and all seventeen Garden pools while paused, then the separately authorized boundary 19
unpaused Commitment Pooling. The unpause transaction is
`0x69129f9cf15f537aca062770d579f13453700a09d01acd02910eecfb586227a4` at Arbitrum block
`493999183`. SettlementModule, CreditRegistry, and CeloSettlementExecutor remain deployer-owned;
SettlementModule and the Celo executor remain paused and have no Safe/Zodiac value authority.
The Celo executor's initializer already pinned the nonzero Arbitrum selector and SettlementModule
source peer, so that completed configuration boundary is tier 3 rather than future peer wiring.
Ownership transfer, message-only ping, value authority, canary, and indexer activation remain
separate ceremonies.

The exact executed plan and complete 19-boundary checkpoint are tracked at
`packages/contracts/.generated/runtime/42161-pool-backfill.json` and
`packages/contracts/.generated/runtime/42161-pool-backfill.checkpoint.json` so a clean checkout can
reverify every registration, pool ID, receipt block, and the separate unpause.

The completed `release:deploy:all`, `release:backfill:all`, and `release:unpause:pooling` broadcast
orchestrators and their placeholder authorization files are retired. They cannot replay a finished
mainnet ceremony. Receipt artifacts, recovery entrypoints, and the read-only Arbitrum/Celo release
verifiers remain available for historical evidence and current-state checks.

## Outputs

- A signed paused-deployment checklist covering the shared blocking security requirements and the ordered
  `AssessmentResolver` upgrade/schema preparation, pooling module/register/schema finalization,
  and `GardenToken`/`WorkApprovalResolver` upgrades and reverse wiring. Its terminal state is
  paused and deployment-sender owned.
- A current-release deployer-owned, root-Protocol-first paused backfill with eighteen verified
  registration receipts, plus a separately authorized pooling unpause command.
- A later follow-up for protocol-Safe ownership transfer.
- A separate signed value-tier checklist for Arbitrum `SettlementModule`, Celo `CeloSettlementExecutor`, and every enabled Safe/Zodiac configuration.
- For every authorized broadcast: signer set, transaction hash, block, artifact diff,
  bytecode/proxy/admin/peer verification, pause state, rollback owner, and an exact indexer
  address/start-block handoff. No hosted indexer mutation occurs in this lane.
- For the value tier: live official-directory route evidence, message-only ping/ack, calibrated delivery/acknowledgment service windows, native ETH/CELO fee-reserve health, audited Safe/Zodiac bounds, matching measured batch limits, a manual-execution runbook, minimum-value canary, observation record, and one authenticated-acknowledgment G$ exit proof.

## Proof limit

- Passing implementation tests proves neither live CCIP delivery nor authority to move value.
- A command dispatch or Celo execution without an authenticated success acknowledgment for that
  subject's current execution key and attempt is not “support arrived.”
- Timeout, manual-execution eligibility, or acknowledgment-fee shortage is not payment failure.
- Missing external evidence leaves the value tier blocked. No due date, lane GREEN, or deploy artifact grants authorization.

## Ownership matrix

| Evidence | Accountable owner | Producing party |
|---|---|---|
| Release authorization and broadcast window | Afolabi Aiyeloja | protocol release operator |
| Internal committed-range review disposition | Afolabi Aiyeloja | contracts implementer + independent reviewer |
| GoodDollar operating/token confirmation | Afolabi Aiyeloja | GoodDollar/Good Labs contact |
| CCIP router/peer/gas/fee-reserve health | Afolabi Aiyeloja | settlement implementer |
| Protocol Safe `0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19` | Afolabi Aiyeloja | protocol signers |
| Current deployment and rollback owner `green-goods-deployer` | Afolabi Aiyeloja | deployment operator |
| Deferred post-transfer rollback execution | Afolabi Aiyeloja | protocol Safe; deployment EOA proposes/co-ordinates |
| Greenpill Dev Guild recovery Safe `0x49fa954B6C2Cd14B4b3604EF1Cc17cED20a9E42C` | Afolabi Aiyeloja | Dev Guild signers; verify live on Celo |
| Garden Safe Zodiac Roles/caps | Afolabi Aiyeloja | settlement operator + named garden delegate |
| Direct CCIP lane + local/fork/endpoint evidence ladder | Afolabi Aiyeloja | QA/release operator + reviewer |
| Commitment Pooling replay/cutover/rollback with bare-address Garden compatibility | Afolabi Aiyeloja | indexer implementer |
| Message-only ping/ack and capped G$ canary | Afolabi Aiyeloja | settlement operator + QA witness |
| EntryPoint v0.7; Kernel `0.2.4` dual-testnet mechanics; Kernel `0.3.1` Arbitrum One/Celo Mainnet production derivation; bounded `42220` policy; passkey account; and included sponsored Celo Mainnet user-op evidence | Afolabi Aiyeloja | shared/wallet implementer + QA witness |

A replacement owner must be named in PRD-686/PRD-731 and this handoff before execution.

## Phases

1. **Core tier**: execute the following dependency-ordered stages only after the full repository
   security and core evidence gate passes. Each stage needs its own explicit human authorization,
   signer/owner verification, transaction receipt, persisted artifact, post-action verifier, and
   rollback checkpoint before the next stage:
   1. **Resolver/schema preparation**: upgrade the existing `AssessmentResolver` proxy in place;
      pin the canonical v2 schema UID if the live slot is zero, otherwise require the exact UID;
      deploy only the net-new
      `TestimonyResolver`; register AssessmentV3 against the upgraded existing
      Assessment resolver; set the v3 and Community Testimony UIDs while Community Testimony's
      module remains zero; and prove v2/v3 compatibility.
   2. **Module/register/schema finalization**: deploy the non-transferable
      `CommitmentRegistry` and `CommitmentPoolingModule` proxies paused; wire and verify their
      dependencies; reconcile the exact Community Testimony registry record; activate its
      verified module only after its UID and record are exact; set the final non-zero,
      pairwise-distinct schema UIDs; verify dependency/schema/proxy state; and keep the pooling
      module paused through the integration upgrades.
   3. **Integration upgrades and paused handoff**: upgrade the existing `GardenToken` and
      `WorkApprovalResolver` proxies in place; wire `setCommitmentPoolingModule` and
      `setCommitmentModule`; prove updater preservation plus post-upgrade storage, ownership,
      both-direction wiring, and rollback state while pooling remains paused. Stop with every
      touched proxy owned by `0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6`.

   **Activation correction (updated 2026-08-12).** Protocol-Safe transfer is deferred beyond this
   release. While the module remains deployment-sender owned and paused, the current release may
   execute the exact root-Protocol-first plus seventeen-Garden registration plan through the
   reviewed deployer path. It must prove every direct transaction receipt, pool ID, finalized
   inventory, owner, implementation, reverse integration link, and paused state, and stop after
   registration boundary 18. Core unpause remains separately authorized. The later ownership
   issue must reread the complete Safe owner set and threshold on each target chain and verify each
   transfer independently; it does not block this release's registration backfill.
   Rehearse the exact sequence locally and on pinned forks. Ethereum Sepolia may prove an endpoint
   rehearsal where useful but is not target-chain proof. Arbitrum One and Celo remain separate,
   explicitly authorized production stages.
2. **Value candidate preparation**: deploy both CCIP peers paused and with no Safe role/value authority; verify bytecode, proxy/admin, live official-directory router/selector/lane, peer, version, measured gas, code hashes, source/executor pause state, zero-or-matching batch limits, and fee monitoring.
3. **Message-only canary**: authorize ping/ack only after the internal review and Safe approval
   evidence pass. No G$ authority exists yet.
4. **Safe authority**: verify the deterministic Safe factory/singleton/initializer/salt
   evidence and exact 2-of-3 owners; `CeloSettlementExecutor` is not an owner; install one
   audited Zodiac Roles v2 modifier with the exact `bytes32 roleKey`, native
   `WithinAllowance(allowanceKey)`, canonical-G$ `transfer` condition tree, and
   transfer/batch/period gross-debit caps plus absolute/BPS fee limits. Probe zero-fee and
   sender-pays exact-net paths plus denied receiver-pays, source-as-recipient, target, selector,
   recipient-policy, fee-policy, and over-cap calls.
5. **Minimum-value canary**: separately authorize one capped Fulfilled-commitment command. Observe Arbitrum dispatch, Celo execution, Celo acknowledgment, Arbitrum Confirmed, indexer convergence, and UI “support arrived.”
6. **Observation/cap decision**: keep caps unchanged until the recorded observation window passes and the accountable owner explicitly authorizes any increase.

## Current rehearsal and activation ladder

The August 10 owner decision supersedes every earlier testnet/soak proposal retained in the dated
history below:

1. Pure tuple, version, replay, idempotency, persistence, and recovery proof.
2. Two distinct local processes with only serialized command/acknowledgment tuples and receipts
   crossing the boundary.
3. Separate pinned Arbitrum and Celo fork proof, including a freshly re-run read-only official
   lane/router/selector/code check.
4. Ethereum Sepolia endpoint rehearsal only where it adds evidence; it is never exact-route or
   target-chain proof and its artifacts never merge into canonical deployment state.
5. A separately authorized paused Arbitrum One candidate with no Safe value authority.
6. A separately authorized paused Celo candidate with no Safe value authority.
7. Separately authorized message-only ping and authenticated acknowledgment.
8. Separately authorized Safe/Zodiac value authority, then minimum-value canary, observation, and
   any later cap or production-unpause decision.

Configured Arbitrum Sepolia/Celo Sepolia network records and testnet deployment artifacts are not
release deliverables and must not be re-added. Local processes may use chain IDs `421614` and
`11142220` only as isolated local identities. No item above is broadcast authority by itself.

## Historical direct-lane and dual-chain proposals (superseded 2026-08-10)

> **Amendment 2026-08-06 (rehearsal target).** The **pooling** rehearsal no longer uses a testnet.
> It runs on an Arbitrum One fork —
> `bun run contracts:pooling:rehearse:arbitrum-fork` — against live Hats, EAS, and the live
> `WorkApprovalResolver`, because Hats has no Arbitrum Sepolia deployment. See `contract-spec.md`
> §7.3, amendment 2026-08-06.
>
> This changes nothing below. The **settlement** lane's CCIP evidence ladder is a separate
> problem: a fork cannot prove a cross-chain lane, so items 3–5 still need live chains. But the
> same question applies — Celo Sepolia has no published CCIP lane and Kernel `0.3.1` is
> unsupported there, so the settlement lane owner should re-derive whether items 3 and 4 buy
> anything a paired fork process does not. Recorded here as an open question for that lane, not
> resolved by this amendment.

> **Amendment 2026-08-06 (lane verified; ladder revision proposed).** Item 5's on-chain check now
> exists and passes as an automated read-only test:
> `bun run contracts:settlement:verify-lane` →
> `packages/contracts/test/fork/CrossChainSettlementLane.t.sol`. Celo Mainnet's CCIP router and
> chain selector were both **zero** in `deployments/networks.json` until this run; nothing
> cross-chain could be fork-tested against Celo at all. They are now the official Chainlink
> directory values, **verified on chain rather than trusted**:
>
> | | Arbitrum One | Celo Mainnet |
> |---|---|---|
> | router | `0x141fa059441E0ca23ce184B6A78bafD2A517DdE8` | `0xfB48f15480926A4ADf9116Dca468bDd2EE6C5F62` |
> | chain selector | `4949039107694359620` | `1346049177634351622` |
>
> Observed 2026-08-06 against live Arbitrum One and Celo Mainnet forks: both addresses report
> `typeAndVersion() == "Router 1.2.0"`; `isChainSupported` is **true in both directions**; and both
> directions quote a non-zero native fee for a message-only, zero-token payload
> (Arbitrum→Celo ≈ 5.84e13 wei ETH, Celo→Arbitrum ≈ 2.14e18 wei CELO). A bogus selector returns
> false, so those trues mean something, and the test asserts `block.chainid` on both forks so a
> misconfigured RPC cannot verify some other chain's lane and report it as Celo's. The test reads
> the routers and selectors out of `networks.json` rather than hardcoding them, so a pass proves
> the *shipped config* is live.
>
> **Proposed ladder revision — settlement lane's call, not made here.** Items 3 and 4 are
> recommended for removal:
>
> - **Item 3 (Celo Sepolia Safe/Zodiac rehearsal)** uses a surrogate token and Kernel `0.2.4`
>   against production `0.3.1`, on a chain with no published CCIP lane. It rehearses a different
>   wallet stack moving a different asset over a lane that does not exist.
> - **Item 4 (ephemeral Arbitrum Sepolia↔Ethereum Sepolia proof)** demonstrates that Chainlink's
>   transport works, on a pair that will never be used. That is not in question.
>
> Replacement ladder, cheapest first:
>
> 1. pure tuple/versioning/replay tests, no chain;
> 2. per-side fork tests;
> 3. a **paired-fork round trip** carrying the command and the acknowledgment by hand (see the
>    testing pattern below);
> 4. read-only live lane verification — **shipped, green, and re-runnable today**;
> 5. ONE message-only, zero-value ping and acknowledgment on the real Arbitrum One↔Celo Mainnet
>    lane;
> 6. the minimum-value canary and recorded observation period (unchanged, item 7 below).
>
> What forks genuinely cannot prove — DON liveness, real delivery latency, destination gas under
> congestion — comes from step 5 alone. The Safe/Zodiac signer ceremony is a human process and is
> not bought by any testnet rehearsal. Items 6 and 7 below are unchanged.

### Cross-chain testing pattern (settlement lane)

The repo already solved this for ENS; the settlement lane should build on it rather than
re-derive it. `packages/contracts/test/fork/CrossChainENS.t.sol` is the working precedent:

1. `vm.createFork` for each chain, then alternate with `vm.selectFork`;
2. build the payload on the source fork and hand-encode a `Client.Any2EVMMessage`;
3. deliver it on the destination fork with `vm.prank(router)` followed by
   `receiver.ccipReceive(message)`.

This is sound because a CCIP receiver's entire trust model is "the router called me, from this
source selector, with this sender." Impersonating the real router on a fork exercises exactly that
boundary, with real contracts on both ends. The only simulated part is Chainlink's transport —
their audited infrastructure, not ours. Same reasoning as the pooling fork decision: simulate only
what belongs to someone else.

`CrossChainSettlementLane.t.sol` adds the other half — proving the real lane between those two
chains is published, supported, and priced — so a paired-fork round trip is testing a route that
demonstrably exists.

Celo Sepolia is active. Chainlink's official directory currently publishes the direct
Arbitrum One↔Celo Mainnet route in both directions at v1.5.0, but does not list the exact
Arbitrum Sepolia↔Celo Sepolia pair. The prior “no active Celo testnet” statement was
inaccurate. It is replaced, not waived, by:

1. deterministic dual-process local command/ack tests;
2. separate pinned Arbitrum/Celo fork processes;
3. Celo Sepolia Safe/Zodiac rehearsal with a test-only fee-aware G$ surrogate;
4. an ephemeral Arbitrum Sepolia↔Ethereum Sepolia CCIP rehearsal labeled as endpoint proof, not
   exact-route proof, whose artifacts never merge into the canonical registry;
   Celo Sepolia adds CCIP endpoint proof only if a fresh official lane/router is published;
5. a fresh official-directory and onchain check proving the currently published bidirectional
   Arbitrum One↔Celo Mainnet route remains operational before value authority;
6. paused mainnet candidates, message-only ping/ack, external audit, timelock, peer/code-hash
   checks, and Safe/Zodiac review;
7. a human-authorized minimum-value canary and recorded observation period before cap increases.

## Exact Bun commands

All commands are repository Bun wrappers. The planning and verification commands below do not
broadcast. The operator-session commands are templates only: each use still requires an explicit
authorization naming the pinned commit, chain, stage, signer/owner, artifact diff, rollback
checkpoint, and window.

### Phase A and immediate pre-stage planning (no password)

```bash
bun run contracts:release:manifest
bun run contracts:release:core:plan:arbitrum
bun run contracts:pooling:schemas:preview:arbitrum
bun run contracts:assessment:upgrade:dry:arbitrum
bun run contracts:pooling:deploy:dry:arbitrum --expected-nonce <fresh-pending-nonce>
bun run contracts:pooling:finalize:dry:arbitrum
bun run contracts:pooling:upgrade:dry:arbitrum
bun run contracts:settlement:module:plan:arbitrum --expected-nonce <fresh-pending-nonce>
bun run contracts:settlement:module:dry:arbitrum --expected-nonce <same-reviewed-pending-nonce>
bun run contracts:credit:registry:plan:arbitrum --expected-nonce <fresh-pending-nonce>
bun run contracts:credit:registry:dry:arbitrum --expected-nonce <same-reviewed-pending-nonce>
bun run contracts:settlement:executor:plan:celo --expected-nonce <fresh-pending-nonce>
bun run contracts:settlement:executor:dry:celo --expected-nonce <same-reviewed-pending-nonce>
bun run contracts:release:verify:plan:arbitrum
bun run contracts:release:verify:plan:celo
bun run contracts:release:indexer:handoff
```

Rebuild every nonce-bound plan immediately before its authorized stage:

```bash
bun run contracts:assessment:upgrade:plan:arbitrum --expected-nonce <fresh-pending-nonce>
bun run contracts:pooling:schemas:plan:arbitrum --expected-nonce <fresh-pending-nonce>
bun run contracts:pooling:finalize:plan:arbitrum --expected-nonce <fresh-pending-nonce>
bun run contracts:pooling:upgrade:plan:arbitrum --expected-nonce <fresh-pending-nonce>
```

### Current deployer session: one Garden Safe boundary

The core deployment, pool registration, and Pooling unpause broadcasts are complete and their
orchestrators are retired. The remaining operator accepts only one explicitly selected Garden Safe
bootstrap or owner-swap boundary, then destroys its temporary credential lease:

```bash
bun run contracts:release:operator -- --commit <pinned-40-character-candidate>
```

```text
run settlement:garden-safes:deploy:celo --plan <reviewed-bootstrap-plan.json> --step <next-boundary>
run settlement:garden-safes:swap:celo --plan <reviewed-swap-plan.json> --replacements <reviewed-replacements.json> --step <next-boundary>
```

If the selected transaction mined but checkpoint persistence failed, repeat that same step in a new
credential session with `--receipt <mined-transaction-hash>`. The wrapper verifies the complete
checkpoint prefix, sender, target, zero value, calldata, nonce, exact receipt block, live Safe state,
and the independently read module-free 2-of-3 recovery Safe before accepting the boundary. A second
boundary always requires a new explicit session and password unlock.

No ownership-transfer, peer-wiring, Safe/Zodiac grant, message-only ping, canary, cap-increase, core
deployment, backfill, or unpause command is allowlisted. Do not substitute an ad hoc command.

### Recovery, verification, courier, and indexer handoff

```bash
bun run contracts:settlement:dual-chain:up
bun run contracts:settlement:courier
bun run contracts:settlement:dual-chain:down
bun run contracts:release:recover:plan:arbitrum
bun run contracts:release:recover:plan:celo
bun run contracts:release:verify:arbitrum
bun run contracts:release:verify:celo
bun run contracts:release:indexer:handoff
bun run contracts:settlement:verify-lane
```

`contracts:release:indexer:handoff` emits only the verified SettlementModule and
CeloSettlementExecutor address/start-block diff. The hosted production indexer is intentionally
unchanged. Live PRD-722 is the active indexer lane and owns codegen, configuration, reindex,
deployment, cutover/rollback, and read-back; this handoff contains no hosted deployment command.

For this ceremony, both post-deploy verifiers use the default `deployment` owner phase. Do not run
the `release:verify:safe:*` variants; those belong to the later ownership-transfer issue.

## Current deployment gates and deferred activation facts

- The protocol Safe at `0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19` was re-read as the exact
  approved **2-of-6** owner set. Repository policy now requires threshold >= 2 and owner count >= 3,
  so this exact set satisfies the guide. It is future-transfer evidence only and is not an owner
  precondition for this paused deployment.
- The approved GardenToken release inventory is all **18** finalized accounts (IDs 0–17), with
  protocol root token 0. The root-first Protocol plus seventeen-Garden backfill is complete and the
  separate boundary 19 has unpaused Commitment Pooling.
- The AssessmentResolver v3 upgrade, canonical v2 pin, schema finalization, Pooling,
  SettlementModule, CreditRegistry, integration upgrade, and Celo executor deployment receipts are
  complete. Their broadcast orchestrators are retired; current-state verification remains read-only.
- A local hard-max 24-member executor run measured **1,383,897 gas**, including the acknowledgment
  attempt. The manifest remains `"0"` until the final Safe/Zodiac configuration exists and the same
  atomic path is measured through that live-authority policy.
- Garden Safe/owner/recovery and Zodiac Roles/cap/fee/reserve facts are incomplete; value authority
  is disabled. They do not block a paused candidate with no peer/value authority.
- The hosted production indexer is the older deployment and is deliberately outside this contracts
  ceremony. PRD-722 remains responsible for its later deployment/reindex/cutover/read-back.

The next mutable boundary is one selected Garden Safe bootstrap. It still requires a pinned
candidate, fresh gates, exact-range review, the reviewed deterministic plan, exact live 2-of-3
recovery Safe proof, and explicit human authorization for that one step. Deferred activation facts
continue to block ownership transfer, peer/value authority, message-only ping, and value movement.

## Core-tier unblock evidence

- The internal committed-range review has no unresolved Critical/High finding.
- Every touched protocol UUPS/admin owner is verified as the frozen deployment sender before and
  after its boundary. The default `deployment` owner-phase verifier must pass; Safe ownership is
  not expected in this ceremony.
- The current local/fork/optional Ethereum Sepolia endpoint/Arbitrum One/Celo ladder is satisfied
  for the authorized stage, and rollback procedures are documented and tested.
- Full relevant tests; resolver/schema, module/register/finalization, integration-upgrade/wiring,
  paused post-wiring verification, post-action verifiers, storage/upgrade/rollback proof, and the
  deployment-sender rollback owner pass for all three ordered stages. Backfill and unpause are not
  current gate commands.
- The stage record contains the exact implementation/proxy/admin addresses, schema UIDs,
  dependency wiring, transaction receipts, persisted artifact changes, and post-action
  verification needed to begin the next separately authorized deployment stage.
- Reviewed artifacts remain non-custodial and non-transferable.
- Afolabi Aiyeloja records explicit artifact/window authorization.

## Value-tier unblock evidence

- The internal committed-range review has no unresolved Critical/High finding.
- Protocol ownership and Safe approval evidence are current; the timelock waiver is recorded.
- Both CCIP peers are paused, exact-versioned, mutually authenticated, and code-hash verified. The evidence record includes official Chainlink directory URLs, observation time, source/destination blocks, both router/selector pairs, lane status, and code hashes; cached plan values never substitute.
- Every selector is persisted as a base-10 string and round-trips to the exact official `uint64`/`bigint`; release verification rejects any JavaScript `number`, unsafe integer, rounded value, or numeric deployment artifact.
- Every dispatched command snapshots destination selector/executor/gas/version/payload hash. A same-key retry is demonstrated to stay on that peer, and a bounded previous peer is demonstrated unable to acknowledge a new-peer command.
- Before peer rotation, the operator pauses new dispatch, inventories every command/execution/ack state for the retiring peer, and sets grace longer than the current finality, service, manual-execution, and acknowledgment windows. The retiring peer must reach zero unresolved commands before grace expiry or any later rotation. If it does not, the value tier remains paused: the operator may extend the timelocked bounded grace after re-verifying the peer, or escalate an explicit quarantine/upgrade disposition; timeout alone never authorizes requeue, cancellation, peer overwrite, or a replacement payment. A Celo result stores the exact originating Arbitrum acknowledgment receiver and protocol version.
- Native ETH/CELO reserves and alert thresholds are funded and monitored.
- Delivery-delay and acknowledgment-delay windows are recorded from current official finality guidance plus measured canary evidence. CCIP Explorer/manual-execution guidance is documented; neither eligibility nor manual execution mutates Green Goods state or confirms arrival.
- Destination gas is measured at the worst accepted atomic batch; the record does not assume unused destination gas is refunded.
- Local two-router and separate-fork evidence covers duplicate/out-of-order command delivery, disbursement/batch key separation, homogeneous batches, same-key peer binding, acknowledgment retry to the stored receiver/version, bounded deferral codes, atomic queued-batch cancellation, failure/new-attempt, pause, and rotation.
- Source and executor batch limits match; zero disables batches without disabling one-recipient
  commands. Every Safe proves exact recovery owners, executor-not-owner, audited Zodiac Roles v2
  `bytes32` key/conditions, non-zero transfer/aggregate/period caps, and separately approved
  non-zero `maxFeeBps`/`maxFeeAmount` compatible with the observed G$ fee mode.
- Message-only ping/ack succeeds before any Safe authority.
- Pimlico's current matrix supports Kernel `0.3.1` on Arbitrum One and Celo Mainnet, but not on
  Celo Sepolia; Celo Sepolia supports Kernel `0.2.4`. Record the explicit Kernel `0.2.4`
  same-address profile and one included sponsored surrogate transfer on both Arbitrum Sepolia and
  Celo Sepolia as non-production mechanics evidence only. That evidence never enables member
  delivery. Production enablement requires exact Kernel `0.3.1` same-address Arbitrum One/Celo
  Mainnet derivation, the pinned v0.7 EntryPoint and verified account factory/implementation code
  hashes, passkey validation, an active `42220` policy bounded to the canonical-G$ call, and one
  separately human-authorized included sponsored first-use Celo Mainnet canonical-G$ transfer.
  The evidence contains UserOperation and transaction receipts, EntryPoint event, deployed-account
  code, exact token balance deltas, and observation block/time, but no API key or passkey material.
  AA/paymaster gate failure keeps contributor-payout preparation and member sends disabled without
  blocking discretionary non-commitment `ProtocolToGarden` seeding. The funding route is treasury
  support and does not count as a Garden-claim consideration payout.
- Afolabi Aiyeloja separately authorizes Safe authority, the minimum-value canary, and any later cap increase.

## Acceptance

- No broadcast or Safe grant occurs without an artifact-specific authorization record.
- The PRD-722 handoff includes only Green Goods Arbitrum/Celo settlement events and excludes raw G$
  transfers; hosted configuration and deployment remain PRD-722 work.
- Same-key transport retries do not duplicate value and acknowledgment retry does not touch value.
- One capped real flow reaches Arbitrum `Confirmed` only after the authenticated success acknowledgment, and the UI renders “support arrived” only then.
- Any unavailable evidence leaves the value leg blocked.

## Out of scope

- Product implementation, autonomous broadcasts, force operations, bridged G$, CCIP token
  transfer, arbitrary Safe execution, manual settlement confirmation, transferable-voucher
  activation, or G$ repayment enablement without an approved authenticated receipt policy.

## 2026-07-28 release-evidence addition

- Before any value canary, reconcile one parent payout plan against its complete recognition vector/hash, amount-derived payment vector/hash, declared amount, explicit garden-retained amount, no-child finalization, idempotently prepared immutable contributor children, stable commitment pointer, and payer garden Safe. Prove an all-retained zero-child plan completes without CCIP or a self-transfer.
- The canary must prove a child failure/retry does not duplicate value or alter sibling receipts, commitment fulfillment, or Hypercert recognition.
- This amendment does not authorize deployment, broadcast, Safe role changes, or value movement.
