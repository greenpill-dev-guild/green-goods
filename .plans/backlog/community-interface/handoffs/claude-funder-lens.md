# Public funder lens handoff

**Status:** BLOCKED — waits for joined reads/funding verifier and existing public funding contracts.

## Inputs

- `spec.md` §10–11, current public garden/impact/funding surfaces, final funding-proof adapter.

## Outputs

- Need discovery/context inside existing client public surfaces; direct/endowment handoff; verified/de-duplicated funded-toward detail; pending/failed/retry attribution states.

## Acceptance

- No funding ranking/steering/escrow; funding success is independent from attribution; only canonical verified proof counts; unsupported or duplicate proof contributes zero; public retraction is a tombstone.

## RED / GREEN

- RED: tests cover both rails, pending/failed/mismatched/duplicate proof, attribution retry, and fund-success/attribution-failure separation.
- GREEN: targeted client tests/build, vocabulary/accessibility checks, and public rendered proof pass.

## Exact commands

```sh
bun run --filter @green-goods/client test
bun run --filter @green-goods/client test -- src/__tests__/funding-attribution.test.tsx
bun run --filter @green-goods/client build
bun run lint:vocab
bun run agentic:check
```

The named `funding-attribution.test.tsx` is the RED target for the attribution bullets (pending/failed/mismatched/duplicate proof, retry, fund-success/attribution-failure separation). It is cited by the RESR-58 acceptance mapping for scenarios S10/S11; keep the filename stable or update the mapping when it changes.

## Out of scope

New public route by default, rankings, fund custody, per-Need escrow, or changing `/fund` transaction logic.

## Unblock evidence

Funding verifier GREEN, both canonical proof shapes frozen, exact existing-route placements approved, and public test fixtures available.
