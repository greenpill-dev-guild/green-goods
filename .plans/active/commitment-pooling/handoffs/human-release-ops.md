# Commitment Pooling — Human Release Operations

## Status

- Execution sub-lane: `release_ops`
- Machine lane: none; human-owned authorization surface
- Accountable owner: Afolabi Aiyeloja
- Current state: blocked
- Linear context: PRD-731

This handoff never authorizes an agent broadcast. The non-value core-upgrade/deployment tier and
value-bearing CCIP settlement tier have separate evidence and authorization.

## Outputs

- A signed non-value-tier readiness checklist covering the ordered
  `AssessmentResolver` upgrade/schema preparation, pooling module/register/schema finalization,
  and `GardenToken`/`WorkApprovalResolver` upgrades, reverse wiring, pooling unpause, and pool
  backfill.
- A separate signed value-tier checklist for Arbitrum `SettlementModule`, Celo `CeloSettlementExecutor`, and every enabled Safe/Zodiac configuration.
- For every authorized broadcast: signer set, transaction hash, block, artifact diff, bytecode/proxy/admin/peer verification, exact indexer update, pause state, and rollback owner.
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
| External audit disposition | Afolabi Aiyeloja | commissioned auditor + contracts implementer |
| GoodDollar operating/token confirmation | Afolabi Aiyeloja | GoodDollar/Good Labs contact |
| CCIP router/peer/gas/fee-reserve health | Afolabi Aiyeloja | settlement implementer |
| Protocol multisig/timelock | Afolabi Aiyeloja | protocol signers |
| Garden Safe recovery/Zodiac Roles/caps | Afolabi Aiyeloja | settlement operator + named garden delegate |
| Direct CCIP lane + dual-chain testnet evidence gate | Afolabi Aiyeloja | QA/release operator + auditor |
| Garden-ID replay/cutover/rollback | Afolabi Aiyeloja | indexer implementer |
| Message-only ping/ack and capped G$ canary | Afolabi Aiyeloja | settlement operator + QA witness |
| EntryPoint v0.7; Kernel `0.2.4` dual-testnet mechanics; Kernel `0.3.1` Arbitrum One/Celo Mainnet production derivation; bounded `42220` policy; passkey account; and included sponsored Celo Mainnet user-op evidence | Afolabi Aiyeloja | shared/wallet implementer + QA witness |

A replacement owner must be named in PRD-686/PRD-731 and this handoff before execution.

## Phases

1. **Non-value tier**: execute the following dependency-ordered stages only after the full
   non-value evidence gate passes. Each stage needs its own explicit human authorization,
   signer/owner verification, transaction receipt, persisted artifact, post-action verifier, and
   rollback checkpoint before the next stage:
   1. **Resolver/schema preparation**: upgrade the existing `AssessmentResolver` proxy in place;
      preserve and verify its v2 schema UID; deploy only the net-new
      `CommunityTestimonyResolver`; register AssessmentV3 against the upgraded existing
      Assessment resolver; set the v3 and Community Testimony UIDs while Community Testimony's
      module remains zero; and prove v2/v3 compatibility.
   2. **Module/register/schema finalization**: deploy the non-transferable
      `CommitmentRegister` and `CommitmentPoolingModule` proxies paused; wire and verify their
      dependencies; reconcile the exact Community Testimony registry record; activate its
      verified module only after its UID and record are exact; set the final non-zero,
      pairwise-distinct schema UIDs; verify dependency/schema/ownership/proxy state; and keep the
      pooling module paused through the integration upgrades.
   3. **Integration upgrades and backfill**: upgrade the existing `GardenToken` and
      `WorkApprovalResolver` proxies in place; wire `setCommitmentPoolingModule` and
      `setCommitmentModule`; prove updater preservation plus post-upgrade storage, ownership,
      both-direction wiring, and rollback state while pooling remains paused; unpause only after
      every stage-2 and stage-3 readiness fact passes; then register the protocol pool on the root
      garden and backfill `registerPool` for the verified live-garden set.
   Rehearse the exact sequence on local and Arbitrum Sepolia before separately authorizing
   Arbitrum One. Ethereum Sepolia remains a legacy regression lane and is not target-chain proof.
2. **Value candidate preparation**: deploy both CCIP peers paused and with no Safe role/value authority; verify bytecode, proxy/admin, live official-directory router/selector/lane, peer, version, measured gas, code hashes, source/executor pause state, zero-or-matching batch limits, and fee monitoring.
3. **Message-only canary**: authorize ping/ack only after audit/timelock review. No G$ authority exists yet.
4. **Safe authority**: verify the deterministic Safe factory/singleton/initializer/salt
   evidence and exact 2-of-3 owners; `CeloSettlementExecutor` is not an owner; install one
   audited Zodiac Roles v2 modifier with the exact `bytes32 roleKey`, native
   `WithinAllowance(allowanceKey)`, canonical-G$ `transfer` condition tree, and
   transfer/batch/period gross-debit caps plus absolute/BPS fee limits. Probe zero-fee and
   sender-pays exact-net paths plus denied receiver-pays, source-as-recipient, target, selector,
   recipient-policy, fee-policy, and over-cap calls.
5. **Minimum-value canary**: separately authorize one capped Fulfilled-commitment command. Observe Arbitrum dispatch, Celo execution, Celo acknowledgment, Arbitrum Confirmed, indexer convergence, and UI “support arrived.”
6. **Observation/cap decision**: keep caps unchanged until the recorded observation window passes and the accountable owner explicitly authorizes any increase.

## Direct-lane and dual-chain testnet evidence gate

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

Current package checks:

- `bun run --filter @green-goods/contracts lint:check`
- `bun run --filter @green-goods/contracts test`
- `bun run --filter @green-goods/contracts test:script`
- `bun run --filter @green-goods/contracts build:full`
- `bun run --filter @green-goods/indexer check:indexing-boundary`
- `bun run --filter @green-goods/indexer build`

Lane-produced settlement deploy/dry-run targets must be added through the existing Bun deploy wrapper, documented by `--help`, and copied here before use. No command in this handoff authorizes a broadcast.

## Non-value-tier unblock evidence

- Full relevant tests; resolver/schema, module/register/finalization, integration-upgrade/wiring,
  post-wiring unpause, and pool-backfill dry runs; post-action verifiers;
  storage/upgrade/rollback proof; and named rollback owners pass for all three ordered stages.
- Every tx-plan sender equals the relevant live proxy `owner()`; grouped upgrades prove their
  ownership preconditions before plan persistence. The stage record contains the exact
  implementation/proxy/admin addresses, schema UIDs, dependency wiring, transaction receipts,
  persisted artifact changes, and post-action verification needed to begin the next stage.
- Reviewed artifacts remain non-custodial and non-transferable.
- Afolabi Aiyeloja records explicit artifact/window authorization.

## Value-tier unblock evidence

- External audit has no unresolved critical/high findings.
- Protocol ownership/timelock evidence is current.
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
  Failure keeps member delivery disabled without blocking `ProtocolToGarden`.
- Afolabi Aiyeloja separately authorizes Safe authority, the minimum-value canary, and any later cap increase.

## Acceptance

- No broadcast or Safe grant occurs without an artifact-specific authorization record.
- Indexer config includes only Green Goods Arbitrum/Celo settlement events; raw G$ transfers remain excluded.
- Same-key transport retries do not duplicate value and acknowledgment retry does not touch value.
- One capped real flow reaches Arbitrum `Confirmed` only after the authenticated success acknowledgment, and the UI renders “support arrived” only then.
- Any unavailable evidence leaves the value leg blocked.

## Out of scope

- Product implementation, autonomous broadcasts, force operations, bridged G$, CCIP token transfer, arbitrary Safe execution, manual settlement confirmation, or CreditRegister/transferable-voucher activation.
