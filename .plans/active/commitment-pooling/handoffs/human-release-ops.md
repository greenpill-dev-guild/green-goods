# Commitment Pooling — Human Release Operations

## Status

- Execution sub-lane: `release_ops`
- Machine lane: none; human-owned authorization surface
- Accountable owner: Afolabi Aiyeloja
- Current state: blocked
- Linear context: PRD-731

This handoff never authorizes an agent broadcast. The core-upgrade/deployment tier and
value-bearing CCIP settlement tier have separate operational evidence and authorization, but both
share the repository's blocking internal committed-range review, protocol Safe ownership,
tested-rollback, post-action verification, and per-stage human authorization requirements.

**Owner decision 2026-08-10.** For this release wave, internal review replaces a commissioned
external audit, the 48-hour timelock is waived in favor of Safe multisig approval, and the former
two-week testnet soak is withdrawn. The evidence ladder is local/fork confidence, Ethereum Sepolia
endpoint rehearsal where useful, Arbitrum One, then Celo. These waivers do not authorize a
broadcast or collapse the separate core-unpause, message-only ping, Safe/Zodiac value-authority,
minimum-value canary, and cap/unpause decisions.

The approved product sequence treats the verified non-value broadcast plus indexer
deployment/reindex/live read-back as the handoff into scoped existing-admin fixes and polish.
Commitment Pooling runtime UI implementation follows that foundation work. This sequencing does
not weaken either broadcast gate or make the value tier a prerequisite for the non-settlement UI.

## Outputs

- A signed core-tier readiness checklist covering the shared blocking security requirements and the ordered
  `AssessmentResolver` upgrade/schema preparation, pooling module/register/schema finalization,
  and `GardenToken`/`WorkApprovalResolver` upgrades, reverse wiring, pooling unpause, and pool
  backfill.
- A separate signed value-tier checklist for Arbitrum `SettlementModule`, Celo `CeloSettlementExecutor`, and every enabled Safe/Zodiac configuration.
- For every authorized broadcast: signer set, transaction hash, block, artifact diff, bytecode/proxy/admin/peer verification, exact indexer update, pause state, and rollback owner.
- For the non-value tier: verified Envio deployment configuration, completed reindex/cutover, and
  live entity/query read-back suitable for the downstream admin-foundation and UI lanes.
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
| Pre-transfer rollback owner `green-goods-deployer` | Afolabi Aiyeloja | deployment operator |
| Post-transfer rollback execution | Afolabi Aiyeloja | protocol Safe; deployment EOA proposes/co-ordinates |
| Garden Safe recovery owner `0x49fa954B6C2Cd14B4b3604EF1Cc17cED20a9E42C` | Afolabi Aiyeloja | network council signers; verify live on Celo |
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
      preserve and verify its v2 schema UID; deploy only the net-new
      `TestimonyResolver`; register AssessmentV3 against the upgraded existing
      Assessment resolver; set the v3 and Community Testimony UIDs while Community Testimony's
      module remains zero; and prove v2/v3 compatibility.
   2. **Module/register/schema finalization**: deploy the non-transferable
      `CommitmentRegistry` and `CommitmentPoolingModule` proxies paused; wire and verify their
      dependencies; reconcile the exact Community Testimony registry record; activate its
      verified module only after its UID and record are exact; set the final non-zero,
      pairwise-distinct schema UIDs; verify dependency/schema/proxy state; transfer and verify every
      touched UUPS/admin owner on the approved protocol Safe target; and keep the pooling module paused
      through the integration upgrades.
   3. **Integration upgrades and backfill**: upgrade the existing `GardenToken` and
      `WorkApprovalResolver` proxies in place; wire `setCommitmentPoolingModule` and
      `setCommitmentModule`; prove updater preservation plus post-upgrade storage, ownership,
      both-direction wiring, and rollback state while pooling remains paused; register and
      backfill the verified live pool inventory; and only then pass the separately authorized core
      unpause gate.

   **Blocked release-order seam (observed 2026-08-11).** The frozen merged ABI gates
   `registerPool` behind `whenOperational`, so it cannot register or backfill while the module is
   paused. Unpausing first would violate the authoritative order above and consume the separately
   gated unpause decision. The Bun backfill target therefore refuses to emit an executable plan.
   This requires an explicit architecture/release-order resolution; operators must not improvise
   a temporary unpause or silently change the ABI.
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

All commands below are wrappers implemented and `--help`-checked in Phase A. Plan, dry-run,
recovery, and verification forms do not broadcast. Commands whose name contains `deploy`, or an
unqualified Phase B action, still require the exact per-stage authorization record described in
this handoff.

Manifest and dependency plan:

- `bun run contracts:release:manifest`
- `bun run contracts:release:core:plan:arbitrum`

Resolver, pooling, and upgrade preparation:

- `bun run contracts:pooling:schemas:preview:arbitrum`
- `bun run contracts:pooling:schemas:plan:arbitrum --expected-nonce <fresh-pending-nonce>`
- `bun run contracts:assessment:upgrade:dry:arbitrum`
- `bun run contracts:assessment:upgrade:plan:arbitrum --expected-nonce <fresh-pending-nonce>`
- `bun run contracts:pooling:deploy:dry:arbitrum`
- `bun run contracts:pooling:finalize:plan:arbitrum --expected-nonce <fresh-pending-nonce>`
- `bun run contracts:pooling:upgrade:dry:arbitrum`
- `bun run contracts:pooling:upgrade:plan:arbitrum --expected-nonce <fresh-pending-nonce>`
- `bun run contracts:pooling:backfill:dry:arbitrum`

Settlement and credit preparation:

- `bun run contracts:settlement:module:plan:arbitrum`
- `bun run contracts:settlement:module:dry:arbitrum`
- `bun run contracts:credit:registry:plan:arbitrum`
- `bun run contracts:credit:registry:dry:arbitrum`
- `bun run contracts:settlement:executor:plan:celo`
- `bun run contracts:settlement:executor:dry:celo`
- `bun run contracts:settlement:safe:plan:celo`
- `bun run contracts:settlement:safe:dry:celo`
- `bun run contracts:settlement:peer:plan:arbitrum`
- `bun run contracts:settlement:peer:plan:celo`

Courier, recovery, verification, and indexer handoff:

- `bun run contracts:settlement:dual-chain:up`
- `bun run contracts:settlement:courier`
- `bun run contracts:settlement:dual-chain:down`
- `bun run contracts:release:recover:plan:arbitrum`
- `bun run contracts:release:recover:plan:celo`
- `bun run contracts:release:verify:plan:arbitrum`
- `bun run contracts:release:verify:plan:celo`
- `bun run contracts:release:verify:arbitrum`
- `bun run contracts:release:verify:celo`
- `bun run contracts:release:indexer:handoff`

Validation:

- `bun run --filter @green-goods/contracts lint:check`
- `bun run --filter @green-goods/contracts test`
- `bun run --filter @green-goods/contracts test:script`
- `bun run --filter @green-goods/contracts build:full`
- `bun run --filter @green-goods/indexer check:indexing-boundary`
- `bun run --filter @green-goods/indexer build`
- `bun run contracts:settlement:verify-lane` — read-only Arbitrum One↔Celo Mainnet CCIP lane
  verification against both real routers. No broadcast, no deployment, no funds. Re-run this
  immediately before any value authority is granted; a lane that was live in August is not
  evidence that it is live today.

The current installed Envio CLI has no hosted `deploy` command. The indexer handoff is therefore
inert and blocked on a verified operator entrypoint for activation/reindex/cutover/read-back. Do
not substitute an invented command. No command in this handoff authorizes a broadcast.

## Current live-state blockers

- The protocol Safe at `0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19` was read as **2-of-6**
  on Arbitrum. The approved **3-of-5** configuration is a target, not current live fact.
- A finalized Arbitrum inventory read found **18** GardenToken accounts (IDs 0–17), not 13. The
  root derives as token 0 while the frozen artifact identifies token 1. No backfill plan is valid
  until the inventory and root decision are reconciled.
- The live `AssessmentResolver` is not v3-capable. Downstream schema, pooling, SettlementModule,
  and CreditRegistry dry-runs correctly stop at this prerequisite.
- Settlement peer wiring is blocked because measured destination gas is not frozen. The manifest
  value remains `"0"` and cannot be overridden by an environment variable.
- Garden Safe/owner/recovery and Zodiac Roles/cap/fee/reserve facts are incomplete; value authority
  is disabled.
- The hosted Envio activation command is unavailable from the installed CLI.

These are blockers, not Phase B instructions. No operator should use this handoff until a pinned
candidate report shows their resolution and a new exact stage authorization names the commit,
chain, signer/owner, artifact diff, rollback checkpoint, and window.

## Core-tier unblock evidence

- The internal committed-range review has no unresolved Critical/High finding.
- Every touched protocol UUPS/admin owner and the exact protocol Safe are verified; Safe multisig
  approval is required. The 48-hour timelock is waived for this wave by the August 10 owner
  decision.
- The current local/fork/optional Ethereum Sepolia endpoint/Arbitrum One/Celo ladder is satisfied
  for the authorized stage, and rollback procedures are documented and tested.
- Full relevant tests; resolver/schema, module/register/finalization, integration-upgrade/wiring,
  post-wiring unpause, and pool-backfill dry runs; post-action verifiers;
  storage/upgrade/rollback proof; and named rollback owners pass for all three ordered stages.
- An isolated, human-authorized ownership-transfer plan may start from the observed live EOA, but
  every later tx-plan sender equals the verified protocol Safe and grouped upgrades prove their
  Safe-ownership preconditions before plan persistence. The stage record contains the exact
  implementation/proxy/admin addresses, schema UIDs, dependency wiring, transaction receipts,
  persisted artifact changes, and post-action verification needed to begin the next stage.
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
- Indexer config includes only Green Goods Arbitrum/Celo settlement events; raw G$ transfers remain excluded.
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
