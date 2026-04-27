# Signal Pool Yield Wiring - state_api Handoff

**Feature**: `signal-pool-yield-wiring`
**Lane**: `state_api`
**Owner**: `codex`
**Status**: `blocked`
**Branch**: `codex/state-api/signal-pool-yield-wiring`
**Depends on**: `contracts`

## Current Context

- Starts after contract ABIs expose `gardensModule.gardenHypercertSignalPools(garden)` and `yieldResolver.gardenHypercertPools(garden)`.
- Shared hooks must not infer Hypercert vs Action pool identity from `getGardenSignalPools()` array index.

## Required Scope

- `packages/shared/src/types/gardens-community.ts`
  - Align pool type representation with Solidity or split contract enum values from UI labels.
- `packages/shared/src/hooks/conviction/useGardenPools.ts`
  - Stop classifying pools by trimmed array index.
  - Return untyped pools plus typed HypercertSignal pool state when type data is unavailable.
- `packages/shared/src/modules/data/gardens.ts`
  - Use event/subgraph type data when available; do not treat `orderBy: poolId` as type proof.
- New hooks:
  - `useGardenHypercertPool.ts`
  - `useSetGardenHypercertPool.ts`
  - `useGardenSignalPoolWiring.ts`
- `useCreateGardenPools.ts`
  - After tx confirmation, verify resolver wiring against typed expected HypercertSignal pool.
  - Show success only when expected pool and resolver pool match.
  - Surface retry only when expected pool is known and resolver wiring is zero or mismatched.

## Tests

- Hook tests for `connected`, `missing-pool`, `missing-resolver-wiring`, `mismatch`, and `unknown`.
- Regression test proving a single trimmed Hypercert pool at array index 0 is not labeled Action.
- Mutation tests for retry hook success/error/invalidation if local patterns support it.

## Validation

- `cd packages/shared && bun run test`
- `cd packages/shared && bun run typecheck`
- `node scripts/dev/ci-local.js --quick`
