# Commitment Pooling — Human Release Operations

## Status

- Execution sub-lane: `release_ops`
- Machine lane: none; human-owned authorization surface
- Accountable owner: Afolabi Aiyeloja
- Current state: blocked
- Linear context: PRD-731

This handoff never authorizes an agent broadcast. The non-value pooling/register/schema tier and value-bearing CCIP settlement tier have separate evidence and authorization.

## Outputs

- A signed non-value-tier readiness checklist for the pooling module, `CommitmentRegister`, and two schemas.
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
| No-active-Celo-testnet alternative gate | Afolabi Aiyeloja | QA/release operator + auditor |
| Garden-ID replay/cutover/rollback | Afolabi Aiyeloja | indexer implementer |
| Message-only ping/ack and capped G$ canary | Afolabi Aiyeloja | settlement operator + QA witness |

A replacement owner must be named in PRD-686/PRD-731 and this handoff before execution.

## Phases

1. **Non-value tier**: after its narrower evidence and explicit authorization, broadcast only the pooling module, non-transferable register, and two schemas.
2. **Value candidate preparation**: deploy both CCIP peers paused and with no Safe role/value authority; verify bytecode, proxy/admin, live official-directory router/selector/lane, peer, version, measured gas, code hashes, source/executor pause state, zero-or-matching batch limits, and fee monitoring.
3. **Message-only canary**: authorize ping/ack only after audit/timelock review. No G$ authority exists yet.
4. **Safe authority**: verify exact 2-of-3 owners; `CeloSettlementExecutor` is not an owner; install only the audited Zodiac Roles v2 `bytes32 roleKey`, canonical-G$ `transfer` condition tree, and transfer/batch/period caps. Probe one allowed call plus denied target, selector, recipient-policy, and over-cap calls.
5. **Minimum-value canary**: separately authorize one capped Fulfilled-commitment command. Observe Arbitrum dispatch, Celo execution, Celo acknowledgment, Arbitrum Confirmed, indexer convergence, and UI “support arrived.”
6. **Observation/cap decision**: keep caps unchanged until the recorded observation window passes and the accountable owner explicitly authorizes any increase.

## No-active-Celo-testnet alternative gate

The prior two-week Celo-testnet requirement is not satisfiable while no active Celo CCIP testnet exists. It is replaced, not waived, by:

1. deterministic two-router local command/ack tests;
2. separate Arbitrum/Celo fork processes;
3. paused mainnet candidate deployment with no Safe authority;
4. message-only ping/ack;
5. external audit, timelock, peer/code-hash checks, and Safe/Zodiac review;
6. a human-authorized minimum-value canary;
7. a recorded observation period before cap increases.

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

- Full relevant tests, schema/module/register dry runs, post-deploy verifier, storage/upgrade/rollback proof, and named rollback owner pass.
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
- Source and executor batch limits match; zero disables batches without disabling one-recipient commands. Every Safe proves exact recovery owners, executor-not-owner, audited Zodiac Roles v2 `bytes32` key/conditions, and non-zero transfer/aggregate/period caps.
- Message-only ping/ack succeeds before any Safe authority.
- AA/paymaster proof supports member delivery; failure keeps member delivery disabled without blocking ProtocolToGarden.
- Afolabi Aiyeloja separately authorizes Safe authority, the minimum-value canary, and any later cap increase.

## Acceptance

- No broadcast or Safe grant occurs without an artifact-specific authorization record.
- Indexer config includes only Green Goods Arbitrum/Celo settlement events; raw G$ transfers remain excluded.
- Same-key transport retries do not duplicate value and acknowledgment retry does not touch value.
- One capped real flow reaches Arbitrum `Confirmed` only after the authenticated success acknowledgment, and the UI renders “support arrived” only then.
- Any unavailable evidence leaves the value leg blocked.

## Out of scope

- Product implementation, autonomous broadcasts, force operations, bridged G$, CCIP token transfer, arbitrary Safe execution, manual settlement confirmation, or CreditRegister/transferable-voucher activation.
