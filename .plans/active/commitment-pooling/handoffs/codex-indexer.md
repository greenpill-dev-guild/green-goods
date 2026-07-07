# Commitment Pooling - Codex Indexer Handoff

## Status

- Execution sub-lane: `indexer`
- Machine lane: `state_api`
- Owner: Codex
- Branch: `codex/indexer/commitment-pooling`
- Current state: blocked until PRD-672 event signatures are frozen
- Tracker context: PRD-650 parent; PRD-673 is the historical workstream label

## Scope

- Add Envio config, schema entities/enums, handlers, imports, helper IDs, handler tests, and generated artifacts for commitment pools and settlement/disbursement status.
- Extend hypercert handling for `bundleKind` / commitment bundle reads.
- Freeze the entity/query contract early enough for the shared substrate lane.

## Acceptance

- Every persisted entity includes `chainId`.
- IDs are composite and chain-aware (`chainId-*`) to prevent cross-chain collisions.
- Relationship changes update both sides.
- Handlers derive from Green Goods core events only; no EAS reads in indexer handlers and no raw Celo/G$ transfer indexing.
- Four locked stats and settlement status derive with integer math only.

## Proof Expectations

- RED: failing handler/schema proof for the first event/entity sequence.
- GREEN: local fixture replay produces expected pool/cycle/commitment/aggregate/disbursement records.
- Validation from `packages/indexer`: `bun run codegen && bun run setup-generated`, then `bun run check:indexing-boundary && bun run test && bun run build`.

## Out Of Scope

- EAS attestation indexing, Celo/G$ transfer indexing, Sarafu data ingestion, leaderboards, and credit-score surfaces.
