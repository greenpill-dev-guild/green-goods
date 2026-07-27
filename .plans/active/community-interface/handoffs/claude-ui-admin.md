# Admin Community workspace handoff

**Status:** BLOCKED — waits for state/API; membership queue remains separately blocked on RESR-64.

## Inputs

- `spec.md` §9/§11, admin route/shell contract, final state/export APIs, admin wireframes.

## Outputs

- `/community` triage, moderation/reopen, pools, evaluator lineage/export, gathering, and seed-from-Need surfaces using canonical admin primitives.

## Acceptance

- No `/pools` root; online status writes expose signature/pending/failed/retry; declined/hidden access is enforced; partial lineage cannot export; membership queue is not implemented before its gate.

## RED / GREEN

- RED: route, moderation transition/access, export completeness, and recovery tests fail first.
- GREEN: targeted admin tests/build, stories where applicable, and authenticated Brave proof pass.

## Exact commands

```sh
bun run --filter @green-goods/admin test
bun run --filter @green-goods/admin test -- src/__tests__/views/CommunityEvaluatorExport.test.tsx
bun run --filter @green-goods/admin build
bun run lint:vocab
bun run agentic:check
```

The named `CommunityEvaluatorExport.test.tsx` is the RED target for the export-completeness bullet (partial lineage cannot export; CSV/JSON gated on EAS/Envio/funding-proof completeness). It is cited by the RESR-58 acceptance mapping for scenarios S10/S11; keep the filename stable or update the mapping when it changes.

## Out of scope

Top-level `/pools`, join transport, EAS/indexer implementation, public funding UI, or decorative dashboard redesign.

## Unblock evidence

State/API GREEN, admin route map approved, operator test account available, and exact authenticated Brave scenarios named.
