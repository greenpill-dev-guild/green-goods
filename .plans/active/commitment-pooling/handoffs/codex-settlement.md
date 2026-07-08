# Commitment Pooling - Codex Settlement Handoff

## Status

- Execution sub-lane: `settlement`
- Machine lane: `contracts`
- Owner: Codex
- Branch: `codex/settlement/commitment-pooling`
- Current state: waits for PRD-672 interface freeze; can run parallel with PRD-673/674 after that gate
- Tracker context: PRD-686

## Scope

- Implement the Arbitrum `SettlementModule` control plane from `settlement-spec.md`.
- Support one active Celo settlement account per garden, disbursement queue state, executor controls, failure/retry/cancel states, and Celo execution references.
- Provide the deterministic Celo Safe deploy/register path and admin trigger contract touchpoints without making Safe rollout launch-blocking.

## Acceptance

- Written GoodDollar confirmations and the Celo AA verification spike are recorded before the member-receipt leg is treated as GREEN.
- First base exit proof: G$ disbursement queued on Arbitrum, executed from a garden Celo Safe, `recordSettled` stores the Celo tx hash, and status is visible through the shared/app path.
- Bridge-executor automation is stretch only and cannot block the operator-executed August base proof.

## Proof Expectations

- RED/GREEN contract tests for settlement account registration, queue transitions, failure/requeue/cancel, executor gates, and reward-status precedence.
- Validation from `packages/contracts`: `bun run test`; add package build/lint when deploy or type surfaces move.

## Out Of Scope

- Bridged G$, any bridge with custody or unbounded value authority, Sarafu integration, transferable voucher activation, indexing raw Celo/G$ transfers, and `CreditRegister` repayment semantics.
