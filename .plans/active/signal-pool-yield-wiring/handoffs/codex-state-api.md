# Signal Pool Yield Wiring - state_api Handoff

**Feature**: `signal-pool-yield-wiring`
**Lane**: `state_api`
**Owner**: `codex`
**Status**: `implemented`
**Branch**: `codex/state-api/signal-pool-yield-wiring`
**Depends on**: `contracts`

## What Changed

- Added shared yield-wiring derivation in `packages/shared/src/utils/blockchain/garden-yield-wiring.ts`.
  - Exposes `connected`, `missing-pool`, `missing-resolver-wiring`, and `mismatch`.
  - Keeps unavailable contract reads separate via `readStatus: "unavailable"` instead of pretending a repair state is known.
  - Includes compact repair metadata (`canRepairFromCommunity`, `repairHref`) that routes available non-connected states to `/community/governance`.
- Added `useGardenYieldWiringState()` in shared.
  - Reads `GardensModule.gardenHypercertSignalPools(garden)`.
  - Reads `GardensModule.yieldResolver()`.
  - Reads `YieldResolver.gardenHypercertPools(garden)`.
  - Reads `YieldResolver.gardensModule()`.
  - Derives bidirectional module/resolver wiring state from those typed reads.
- Updated shared ABIs for the new contract surface:
  - `GARDENS_MODULE_ABI`: `gardenHypercertSignalPools`, `yieldResolver`.
  - `YIELD_RESOLVER_ABI`: `gardenHypercertPools`, `gardensModule`, `setGardenHypercertPool`.
- Updated pool list query helpers to stop using array position as Hypercert/Action truth.
  - `useGardenPools()` and `getGardenPoolsFromSubgraph()` now annotate the Hypercert pool by matching the typed `gardenHypercertSignalPools(garden)` value.
  - A trimmed Hypercert pool at returned array index 0 is now labeled `PoolType.Hypercert`.
  - Pool addresses/list display behavior is preserved; when typed pool truth is unavailable, non-matching pools remain display-safe as Action rather than becoming yield-wiring truth.
- Updated hypercert registration to read `gardenHypercertSignalPools(garden)` instead of selecting `getGardenSignalPools()[1]`.
- Added a `queryKeys.yield.wiring(garden, chainId)` cache key and invalidates it after `useCreateGardenPools()` succeeds.

## What Remains

- Admin UI was not implemented.
- Primary repair UX still belongs in `/community`.
- This pass exposes state and routing metadata but does not change pool-creation success toast semantics or add a manual resolver repair mutation; those need UI/product decisions about when to offer reconnect vs pool creation.
- Live contract reads were not run against a deployed upgraded resolver/module pair in this lane.

## TDD Proof

### RED Command/Result

Command:

```bash
cd packages/shared && bun run test -- src/__tests__/utils/garden-yield-wiring.test.ts
```

Result before implementation:

- Exit: failed as expected.
- Failure: Vite import analysis could not resolve the new `garden-yield-wiring` derivation surface.
- Test intent covered connected, no typed pool, missing resolver wiring, mismatched resolver pool, unavailable contract reads, and a trimmed-array Hypercert pool at position 0.
- Test hygiene note: the initial RED test import used the wrong relative depth and was corrected before the GREEN run.

### GREEN Command/Result

Command:

```bash
cd packages/shared && bun run test -- src/__tests__/utils/garden-yield-wiring.test.ts
```

Result after implementation:

- Exit: passed.
- 6 tests passed, 0 failed.

## Validation

- `cd packages/shared && bun run test -- src/__tests__/utils/garden-yield-wiring.test.ts src/__tests__/hooks/conviction/useGardenCommunityAndPools.test.ts src/__tests__/hooks/query-keys.test.ts src/__tests__/hooks/hypercerts/useMintHypercert.test.ts`
  - Passed: 4 test files, 69 tests.
- `cd packages/shared && bun run typecheck`
  - Passed.
- `bunx @biomejs/biome format packages/shared/src/__tests__/utils/garden-yield-wiring.test.ts packages/shared/src/__tests__/hooks/conviction/useGardenCommunityAndPools.test.ts packages/shared/src/__tests__/hooks/query-keys.test.ts packages/shared/src/config/query-keys/types.ts packages/shared/src/config/query-keys/vault.ts packages/shared/src/hooks/conviction/useCreateGardenPools.ts packages/shared/src/hooks/conviction/useGardenPools.ts packages/shared/src/hooks/hypercerts/services/register-in-signal-pool.ts packages/shared/src/hooks/index.ts packages/shared/src/hooks/yield/useGardenYieldWiringState.ts packages/shared/src/index.ts packages/shared/src/modules/data/gardens.ts packages/shared/src/utils/blockchain/abis.ts packages/shared/src/utils/blockchain/abis/conviction.ts packages/shared/src/utils/blockchain/abis/index.ts packages/shared/src/utils/blockchain/abis/yield.ts packages/shared/src/utils/blockchain/garden-yield-wiring.ts packages/shared/src/utils/index.ts`
  - Passed: checked 18 files, no fixes applied.
- `bun run format:check`
  - Blocked by unrelated dirty files already present in the worktree:
    - `.plans/active/agent-upload-signer/status.json`
    - `packages/client/src/components/Navigation/SiteHeader.tsx`
  - The only owned file reported by the first run was formatted and rechecked with the targeted command above.
- `bun lint`
  - Passed with existing warnings.

## Risks/Blockers

- If the deployed contract address still points at a pre-upgrade ABI, `useGardenYieldWiringState()` returns `readStatus: "unavailable"` rather than a false repair status.
- Subgraph-only pool type data is not treated as yield-wiring truth. Typed on-chain pool state is required for Hypercert identity.
- Existing unrelated worktree changes remain outside this lane and were not modified.
