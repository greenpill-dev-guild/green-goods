# Fix Garden Domain UI - state_api Handoff

**Feature**: `fix-garden-domain-ui`
**Lane**: `state_api`
**Owner**: `codex`
**Status**: `completed`
**Dispatch Branch**: `develop`

## What Changed

- `getGardens()` now joins `GardenDomains` to `Garden` with lower-cased address keys on both sides.
- `useGardenDerivedState()` now treats `domainMask === 0` as a warning signal, rolls it into the overview badge and garden health label, and emits a `domain-empty` alert.
- The zero-domain alert action opens the existing `overview` / `health` section so it never targets a stale or missing admin section.
- Added regression coverage for case-insensitive `GardenDomains` lookup and zero-domain derived-state behavior.

## Validation

- `cd packages/shared && bun run test -- src/__tests__/modules/greengoods.module.test.ts` passed.
- `cd packages/shared && bun run test -- src/__tests__/hooks/garden/useGardenDerivedState.test.ts` passed.
- `bun run lint:vocab` passed.
- `node scripts/harness/plan-hub.mjs validate` passed before and after lane status updates.
- Targeted Bun/Vitest commands required network escalation after the sandboxed run attempted an npm registry lookup for `node`.

## Proof Limits

- No indexer IDs were normalized and no contract code was touched.
- This pass proves shared normalization and derived-state behavior with focused unit coverage; it does not prove live indexer data freshness.
