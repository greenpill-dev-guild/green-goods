# Admin Community workspace handoff

**Status:** BLOCKED — waits for state/API; membership queue remains separately blocked on RESR-64.

## Inputs

- `spec.md` §9/§11, admin route/shell contract, final state/export APIs, admin wireframes.

## Outputs

- `/community/needs` as the fifth route-level `AdminTabRail` mode with focused triage, moderation/reopen, selected-Need inspector, gathering, seed-from-Need, and Need-filtered evaluator lineage/export surfaces using canonical admin primitives. Existing `/community/coordination` retains pool/cycle operations, and `/community/members` retains Manage Members. Do not expand the existing catch-all `CommunityTab` branch.

## Acceptance

- No `/pools` or top-level `/needs` root and no duplicate pool/cycle controls in `/community/needs`; triage rows show support and non-support separately; default ordering is support count, then recency, then alphabetical tie-break; non-support never subtracts into a net score.
- Online status writes expose signature/pending/failed/retry; declined/hidden access is enforced; partial lineage cannot export; membership queue is not implemented before its gate.

## RED / GREEN

- RED: route, separate-count/no-net-score ordering, moderation transition/access, export completeness, and recovery tests fail first.
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
