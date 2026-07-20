# Commitment Pooling — Human Release Operations Handoff

## Status

- Execution sub-lane: `release_ops`
- Machine lane: none; human authorization surface
- Accountable owner: Afolabi Aiyeloja (Commitment Pooling project lead and PRD-686 assignee)
- Current state: blocked until implementation GREEN and external gates are evidenced
- Linear context: PRD-731 (release ops; no parent, sits on the Release milestone). Settlement implementation stays PRD-686.

## Inputs

- GREEN contracts, settlement, indexer, state/API, and required August UI handoffs.
- External audit with no unresolved critical/high findings.
- Protocol UUPS/admin ownership on a 3-of-5-or-stronger multisig; 48-hour mainnet timelock.
- Minimum two-week testnet operation record for mainnet deployment candidates.
- GoodDollar token/operating confirmation; Functions router/subscription/DON/source/secrets evidence.
- Per-garden Celo Safe artifact proving the scoped 2-of-3 operational-recovery exception, Roles/Allowance selectors/caps, and owner/executor separation.
- Garden-ID replay snapshot, switch criterion, and tested rollback package.

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

1. **Pre-broadcast readiness**: review GREEN handoffs, audit, multisig/timelock, two-week testnet record, rollback rehearsal, artifacts, and dry-run output.
2. **Separately authorized broadcast**: schema registrations; module/register deployment and upgrades; settlement deployment only when its gates pass. No agent self-authorizes a broadcast.
3. **Post-broadcast checks**: non-zero artifacts, bytecode/proxy/admin checks, exact indexer config, schema UIDs, Functions health request, replay/cutover, and rollback readiness.
4. **Exit proof**: one Fulfilled commitment produces a reward-bound queue entry; registered garden Safe executes canonical G$ on Celo; report remains Reported until the current Functions callback verifies the finalized receipt; UI shows “support arrived.”

## Exact commands

Run only after explicit authorization and use the implementation handoffs' exact deployment targets. Required read-only/dry-run evidence before authorization:

- `bun script/deploy.ts commitment-schemas --network sepolia --dry-run --pure-simulation`
- `bun script/deploy.ts commitment-pooling --network sepolia --dry-run --pure-simulation`
- `bun script/deploy.ts settlement --network sepolia --dry-run`
- `bun script/deploy.ts settlement-safe --network celo --garden <arbitrumGardenAccount> --dry-run --pure-simulation`
- `bun run --filter @green-goods/contracts verify:post-deploy:sepolia`
- `bun run --filter @green-goods/contracts verify:post-deploy:indexer:sepolia`
- `bun run --filter @green-goods/indexer migrate:garden-ids -- --dry-run`

The indexer migration target is an explicit deliverable of the indexer lane and must exist before this handoff can advance.

## Acceptance

- Broadcast authorization, signer set, transaction hashes, blocks, and artifact diffs are recorded.
- Mainnet protocol ownership satisfies the 3-of-5 minimum and timelock; per-garden Celo settlement Safes satisfy the documented 2-of-3 scoped exception.
- Garden-ID cutover has a pre-replay snapshot, zero raw-address relationship lookups, shared-query switch proof, and tested rollback.
- Live Functions health and the single exit proof are recorded; infrastructure failure is a blocker/proof limit, never a pass.
- Any unavailable external evidence leaves the corresponding release leg blocked without weakening base funding/member-delivery separation.

## Out of scope

- Product implementation, autonomous broadcasts, force operations, bridged G$, manual receipt verification, or activating CreditRegister/transferable vouchers.
