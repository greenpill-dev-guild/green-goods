# Commitment Pooling — Human Release Operations Handoff

## Status

- Execution sub-lane: `release_ops`
- Machine lane: none; human authorization surface
- Accountable owner: Afolabi Aiyeloja (Commitment Pooling project lead and PRD-686 assignee)
- Current state: blocked until implementation GREEN and external gates are evidenced
- Linear context: PRD-731 (release ops; no parent, sits on the Release milestone). Settlement implementation stays PRD-686.

## Inputs

- GREEN handoffs for the exact artifact tier being considered.
- A named human release window, signer set, rollback owner, and explicit artifact-by-artifact authorization.
- Garden-ID replay snapshot, switch criterion, and tested rollback package before any indexer cutover.

> **Tiered Release evidence (register #41, 2026-07-20).** The audit, 48-hour timelock and two-week testnet gates apply to the **value tier only** — `SettlementModule` and per-garden Celo Safes. The pooling module, `CommitmentRegister`, and two EAS schemas use the narrower non-value-tier checklist below because the module is non-custodial and the register is non-transferable. Build closes July 31 with readiness evidence and no broadcast; either tier requires separate human authorization during the Release phase on or after August 12. This grants no agent broadcast authority and lapses immediately if custody or transferability is introduced.

## Outputs

- A signed non-value-tier readiness checklist for the pooling module, `CommitmentRegister`, and the two schemas.
- A separate signed value-tier checklist for `SettlementModule` and per-garden Celo Safes.
- For every authorized broadcast: signer set, transaction hash, block, persisted artifact diff, bytecode/proxy/admin verification, indexer/schema update proof, and rollback owner.
- For the value tier only: Functions health plus one live, bounded, Oracle-verified Celo G$ exit proof.

## Proof Limit

- Passing the non-value-tier checklist proves only that the non-custodial/non-transferable artifacts are ready for a separately authorized Release-phase broadcast. It does not prove settlement safety, live value delivery, or authorization.
- A dry run, transaction submission, or Reported settlement is never evidence that funds arrived.
- Only the current Chainlink Functions callback can move a settlement claim to Oracle-verified.
- Missing external evidence leaves the corresponding tier blocked. No agent may infer authorization from tests, lane GREEN, a due date, or this handoff.

## Ownership matrix

| Evidence | Accountable owner | Producing party |
|---|---|---|
| Release authorization and broadcast window | Afolabi Aiyeloja | protocol release operator |
| External audit disposition | Afolabi Aiyeloja | commissioned auditor + contracts implementer |
| GoodDollar operating/token confirmation | Afolabi Aiyeloja | GoodDollar/Good Labs contact |
| Functions subscription/router/DON/source health | Afolabi Aiyeloja | settlement implementer |
| Protocol multisig/timelock | Afolabi Aiyeloja | protocol signers |
| Garden Safe recovery/Roles/Allowance | Afolabi Aiyeloja | settlement operator + named garden delegate |
| Two-week testnet operation record | Afolabi Aiyeloja | QA/release operator |
| Garden-ID replay/cutover/rollback | Afolabi Aiyeloja | indexer implementer |
| Live Celo G$ exit proof | Afolabi Aiyeloja | settlement operator + QA witness |

No evidence row may be silently delegated. A replacement owner must be named in PRD-686 and this handoff before execution.

## Phases

1. **Build readiness through July 31**: review the appropriate unblock-evidence section, rollback rehearsal, persisted artifacts, and dry-run output. No artifact broadcasts during Build.
2. **Separately authorized Release on or after August 12**: schema registrations and module/register deployment may use the narrower non-value-tier evidence gate; settlement deployment requires the value-tier gate. No agent self-authorizes a broadcast.
3. **Post-broadcast checks**: non-zero artifacts, bytecode/proxy/admin checks, exact indexer config, schema UIDs, Functions health request, replay/cutover, and rollback readiness.
4. **Exit proof**: one Fulfilled commitment produces a reward-bound queue entry; registered garden Safe executes canonical G$ on Celo; report remains Reported until the current Functions callback verifies the finalized receipt; UI shows “support arrived.”

## Exact Bun Commands

These are the commands that resolve in the repository now. They prove package quality and release-tooling health only; they do not deploy Commitment Pooling and they do not substitute for the lane-produced targets below.

- `bun run --filter @green-goods/contracts lint:check`
- `bun run --filter @green-goods/contracts test`
- `bun run --filter @green-goods/contracts test:script`
- `bun run --filter @green-goods/contracts build:full`
- `bun run --filter @green-goods/indexer check:indexing-boundary`
- `bun run --filter @green-goods/indexer build`
- `bun run --filter @green-goods/contracts verify:post-deploy:sepolia`
- `bun run --filter @green-goods/contracts verify:post-deploy:indexer:sepolia`

The two post-deploy commands are current repository entrypoints but are run only after an authorized testnet broadcast has produced the expected artifacts. No command in this section authorizes a broadcast.

## Required Lane-Produced Release Targets

The current deploy and upgrade CLIs do **not** yet expose Commitment Pooling targets. The Contracts, Settlement, and Indexer lanes must add and test all of the following before this handoff can advance:

- a pure-simulation schema registration target for the two Commitment Pooling schemas;
- a pure-simulation pooling module/register deployment target;
- a pure-simulation pooling upgrade target with rollback proof;
- a SettlementModule testnet dry-run target;
- a per-garden Celo Safe pure-simulation target with explicit garden input;
- a Garden-ID migration/replay dry-run target with snapshot, switch criterion, and rollback output.

When those targets exist, this section must be amended with their exact checked-in Bun commands and the commands must pass a command-resolution check. Until then, release operations remains blocked; operators must not substitute the generic `core` or `all` targets.

## Non-value-tier Release Unblock Evidence

- Contracts, schema-resolver, storage-layout, deployment-script, and full package tests pass against the frozen handoff.
- The schema, pooling deploy, and pooling upgrade dry-runs succeed and persist reviewable simulated artifact diffs.
- Post-deploy verification covers bytecode, proxy implementation/admin, schema UIDs, deployment artifacts, and the exact indexer update path.
- Upgrade and rollback are rehearsed with a named human rollback owner.
- The authorized artifacts remain non-custodial and non-transferable at the reviewed commit.
- Afolabi Aiyeloja records explicit authorization for these artifacts and this release window. Without that record, no broadcast occurs.

## Value-tier Unblock Evidence

- External audit has no unresolved critical/high findings.
- Protocol UUPS/admin ownership is a 3-of-5-or-stronger multisig and the 48-hour mainnet timelock is evidenced.
- The settlement candidate has a minimum two-week testnet operation record.
- GoodDollar token/operating confirmation and current primary-source token/market facts are recorded.
- Functions router, subscription, DON, source, secrets, callback, and health evidence are current.
- Each garden Safe proves the scoped 2-of-3 recovery exception, Roles/Allowance selectors and caps, and strict owner/executor separation.
- AA/paymaster proof supports member delivery; failure keeps member delivery disabled without blocking the base ProtocolToGarden route.
- Afolabi Aiyeloja records a separate value-tier authorization. Non-value-tier readiness or authorization cannot substitute for it.

## Acceptance

- Broadcast authorization, signer set, transaction hashes, blocks, and artifact diffs are recorded.
- Mainnet protocol ownership satisfies the 3-of-5 minimum and timelock; per-garden Celo settlement Safes satisfy the documented 2-of-3 scoped exception.
- Garden-ID cutover has a pre-replay snapshot, zero raw-address relationship lookups, shared-query switch proof, and tested rollback.
- Live Functions health and the single exit proof are recorded; infrastructure failure is a blocker/proof limit, never a pass.
- Any unavailable external evidence leaves the corresponding release leg blocked without weakening base funding/member-delivery separation.

## Out of scope

- Product implementation, autonomous broadcasts, force operations, bridged G$, manual receipt verification, or activating CreditRegister/transferable vouchers.
