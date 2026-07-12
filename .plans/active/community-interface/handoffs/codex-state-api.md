# Community shared state/API handoff

**Status:** BLOCKED — waits for contracts, indexer, and shared-foundation GREEN evidence.

## Inputs

- `spec.md` §§4–7/10–13, generated contract/indexer types, shared queue and EAS/data conventions.

## Outputs

- Need types/hooks, two-axis joined read, exact two-rail funding verifier/global receipt de-dup, `NeedCommitmentIndex` adapter, evaluator export, `need`/`needSignal`/`testimony` jobs, `waiting_for_hat` recovery, voice/transcription adapter, en/es/pt key substrate.

## Acceptance

- Partial sources never look empty; revoked Needs become tombstones in lineage; NeedStatus ordering matches the resolver's unsigned `(timeCreated, uid)` head; waiting consumes no retry and supports edit/retry/delete.
- Rail 0 accepts only a strict terminal public funding-intent tuple and recorded receiver identity; rail 1 accepts only finalized canonical GardenVault ERC-4626 Deposit evidence with owner identity. `transaction.from` is never identity.
- The lowest `(timeCreated, uid)` per global `(chainId, txHash, rail)` is the only attribution that contributes, including across different Need UIDs; retry never replays funding.
- Community member routes remain in the independent PWA; public adapters feed only existing client `/gardens`, `/gardens/:id`, `/impact`, and `/fund?garden=<slug>&need=<uid>` surfaces.

## RED / GREEN

- RED: tests cover offline restart, membership wait/reject, same-timestamp status UID ordering, same-receipt cross-Need duplication, both exact funding rails, AA identity not transaction.from, revoked Need, failed source/receipt/transcription, and incomplete export.
- GREEN: focused tests and typecheck pass with no client/admin-local hooks.

## Exact commands

```sh
bun run --filter @green-goods/shared test -- src/__tests__/modules/job-queue.core.test.ts src/__tests__/modules/job-queue.db.test.ts src/__tests__/providers/JobQueueProvider.test.tsx
bun run --filter @green-goods/shared typecheck
bun run --filter @green-goods/shared check:stories
bun run --filter @green-goods/shared check:story-quality
```

## Out of scope

Routes/components, join-request transport, NeedStatus offline writes, Envio EAS indexing, or funding transaction replay.

## Unblock evidence

Dependency handoffs marked GREEN, generated types committed by their lanes, and test matrix mapped to every state/recovery rule.
