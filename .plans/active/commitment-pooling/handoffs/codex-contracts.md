# Commitment Pooling - Codex Contracts Handoff

## Status

- Machine lane: `contracts`
- Owner: Codex
- Branch: `codex/contracts/commitment-pooling`
- Current state: ready for scoped implementation after Afo dispatches the contracts lane or this handoff
- Tracker context: PRD-650 parent; PRD-671/672 are historical workstream labels

## Scope

- Implement Assessment v3 and community testimony schemas/resolvers from `contract-spec.md` PR chain 1.
- Implement `CommitmentPoolingModule`, `CommitmentRegister`, GardenToken wiring, deploy helpers, storage layout baselines, and tests from PR chain 2.
- Keep `SettlementModule` proof in `codex-settlement.md` unless Afo dispatches it in the same Codex lane.

## Acceptance

- Schema registration path is wired and artifacts preserve existing v2 schema keys byte-identical.
- Core module/register acceptance in `contract-spec.md` sections 6.1 and 6.2 passes.
- Storage/upgrade safety is proven before any broadcast path is used.
- Sepolia smoke covers offer/request -> accept/claim -> evidence/work approval -> fulfillment.
- Arbitrum broadcast remains gated on chain-3 readiness and post-broadcast artifact/indexer updates.

## Proof Expectations

- RED: failing unit/fork/storage test selected before implementation.
- GREEN: same proof passing with the minimal implementation.
- Validation from `packages/contracts`: `bun run test`; add `bun run build`, `bun run lint`, or `bun run test:audit:full` when touched scope requires it.

## Out Of Scope

- Bridged G$, bridge custody, Sarafu integration, transferable settlement voucher activation, `settlementEnabled`/`settlementAdapter` activation, Celo/G$ transfer indexing, leaderboards, credit scores, and `CreditRegister`.
