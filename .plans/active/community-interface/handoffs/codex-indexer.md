# Community indexer handoff

**Status:** BLOCKED — waits for final Commitment Pooling events/entities and the Community contracts UIDs.

## Inputs

- `spec.md` §4/§11, final Commitment events, current schema/config/handler conventions.

## Outputs

- The exact protocol-event-only `NeedCommitmentIndex` owned by Commitment Pooling §8.2 (`chainId-lowercaseNeedUID`) with composite commitment, fulfilled-commitment, cycle, and Hypercert relationship arrays; create-if-absent/idempotent handlers, query fixtures, and Envio preservation/boundary proof.

## Acceptance

- `CommitmentCreated`, Fulfilled, and commitment-bundled Hypercert handling are the only writers; stable-order arrays append once, `needUID == 0` creates no row, replay is deterministic, and no EAS or raw funding transfer events enter Envio.
- Hypercert persists ascending unique non-zero `needUIDs` plus composite `commitmentEntityIds`; the reverse index persists its composite Hypercert ID.
- Placeholder defaults and later creation merges match the Commitment Pooling handler contract; every cross-entity pointer is composite.

## RED / GREEN

- RED: event-sequence fixtures expose duplicate/out-of-order creation, zero UID, cross-chain collision, Hypercert reverse-link, and replay failures.
- GREEN: codegen, handler tests, build, and indexing-boundary checks pass twice from a clean replay.

## Exact commands

```sh
bun run --filter @green-goods/indexer codegen
bun run --filter @green-goods/indexer test
bun run --filter @green-goods/indexer build
bun run --filter @green-goods/indexer check:indexing-boundary
```

## Out of scope

EAS indexing, Easscan queries, funding receipt interpretation, and UI hooks.

## Unblock evidence

Frozen ABI/signatures for Arbitrum and Sepolia, non-zero deployment keys, complete handler acceptance fixture, and contracts lane GREEN evidence.
