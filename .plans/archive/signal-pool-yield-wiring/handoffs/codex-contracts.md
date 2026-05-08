# Signal Pool Yield Wiring - Contracts Handoff

**Feature**: `signal-pool-yield-wiring`
**Lane**: `contracts`
**Owner**: `codex`
**Status**: `implemented`

## What Changed

- Added bidirectional GardensModule/YieldResolver wiring:
  - `GardensModule.yieldResolver`
  - `YieldResolver.gardensModule`
  - upgrade cross-wire step and deployment fixture wiring
- Added typed HypercertSignal pool state in GardensModule:
  - `gardenHypercertSignalPools[garden]`
  - owner backfill/clear helper with stored-pool validation
  - mint-path and `createGardenPools()` recovery-path auto-wiring into YieldResolver
  - reset/reinit cleanup for stale typed pool and resolver wiring
- Hardened YieldResolver repair paths:
  - trusted GardensModule may wire directly
  - owner/operators may repair manually
  - manual repair validates the pool behaves like a CVStrategy and matches typed GardensModule state when present
- Added garden TBA treasury fallback for Cookie Jar and Juicebox fallback routes so yield is not stranded when a treasury is unset.
- Updated deployment and verification paths:
  - `Upgrade.s.sol` and `script/upgrade.ts` include `yield-gardens-wiring`
  - `migrate-vaults.ts` backfills typed pools from `SignalPoolCreated(..., PoolType.HypercertSignal, ...)`, treats array-index inference as manual-review only, and defaults missing garden treasuries to the garden TBA
  - `post-deploy-verify.ts` checks both resolver/module directions, typed pool consistency, resolver pool consistency, and treasury defaults
- Updated storage-layout tests for the new slots and gap sizes.

## What Remains

- No shared/state/API/admin UI work was started.
- No deployment broadcast was run.
- Existing deployed gardens still need the dry-run/backfill operator path before live use.
- Gardens without event-sourced HypercertSignal pool evidence are intentionally left for manual review/operator action.

## TDD Proof

### RED Command/Result

Command:

```bash
cd packages/contracts && bun run test -- --match-test 'test_signalPoolYieldWiring|test_yieldResolverWiring' --offline
```

Result before implementation:

- Exit: failed as expected.
- 12 focused boundary tests failed:
  - 4 GardensModule signal pool wiring tests
  - 6 YieldResolver trusted-module/manual-repair tests
  - 2 fallback routing tests
- Failure cause: the new typed pool state, resolver/module setters, trusted GardensModule path, manual repair validation, reset cleanup, and garden TBA fallback behavior did not exist yet.

### GREEN Command/Result

Command:

```bash
cd packages/contracts && bun run test -- --match-test 'test_signalPoolYieldWiring|test_yieldResolverWiring' --offline
```

Result after implementation:

- Exit: passed.
- 18 tests passed, 0 failed, 0 skipped.
- The count is 18 because `YieldSplitterTest` now aliases the YieldResolver test suite so the plan validation command has a concrete suite name.

## Validation Run

- `node scripts/harness/plan-hub.mjs validate`
  - Passed: `Validated 19 feature hubs.`
- `cd packages/contracts && bun run test -- --match-contract FullModuleWiringTest --match-test test_fullWiring_gardensModuleIsWiringComplete --offline -vvv`
  - Passed: 1 test passed, 0 failed, 0 skipped.
- `cd packages/contracts && bun run test -- --match-contract YieldResolverConvictionTest --match-test 'test_setGardenHypercertPool' --offline -vvv`
  - Passed: 2 tests passed, 0 failed, 0 skipped.
- `cd packages/contracts && bun run test -- --match-test 'test_signalPoolYieldWiring|test_yieldResolverWiring' --offline`
  - Passed: 18 tests passed, 0 failed, 0 skipped.
- `cd packages/contracts && bun run test -- --match-contract FullModuleWiringTest --offline`
  - Passed: 8 tests passed, 0 failed, 0 skipped.
- `cd packages/contracts && bun run test -- --match-contract YieldResolverConvictionTest --offline`
  - Passed: 14 tests passed, 0 failed, 0 skipped.
- `cd packages/contracts && bun run test -- --offline`
  - Passed: 62 test suites; 1528 tests passed, 0 failed, 0 skipped.
- `cd packages/contracts && ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc bun run test:fork:protocol -- --match-contract ArbitrumLiveGardenSignalPoolRepairForkTest`
  - Passed with network access: 5 Arbitrum live-garden signal-pool repair fork tests passed, 0 failed, 0 skipped.
- `cd packages/contracts && bun run test:match test/integration/YieldFlowE2E.t.sol --offline`
  - Passed: 5 local yield-flow integration tests passed, 0 failed, 0 skipped.
- `cd packages/contracts && ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc SEPOLIA_RPC_URL=https://ethereum-sepolia.publicnode.com bun run test:e2e`
  - Partially passed before provider rate limit: E2EWorkflow 8/8, ArbitrumKarmaGAP 4/4, SepoliaKarmaGAP 2/2, and FullProtocolE2E 8/8 passed. The run stopped at SepoliaExtendedE2E because the resolved Sepolia fork provider returned HTTP 429.
- `cd packages/contracts && SEPOLIA_FORK_RPC_URL=https://ethereum-sepolia.publicnode.com SEPOLIA_RPC_URL=https://ethereum-sepolia.publicnode.com bun run test:e2e:sepolia`
  - Passed: FullProtocolE2E 8/8 and SepoliaExtendedE2E 4/4 passed, 0 failed, 0 skipped.
- `cd packages/contracts && ARBITRUM_FORK_RPC_URL=https://arbitrum-one.publicnode.com ARBITRUM_RPC_URL=https://arbitrum-one.publicnode.com bun run test:e2e:arbitrum -- --match-test 'testForkArbitrum_e2e_(openJoiningFlow|unauthorizedWorkSubmission|gardenMintWithENSAndGAP|hypercertMintAndMarketplaceListing|yieldResolverWiringAndSplitConfig)'`
  - Passed: the 5 Arbitrum E2E tests that previously hit provider HTTP 429 all passed, 0 failed, 0 skipped.
- `cd packages/contracts && bun run test -- --match-contract GardensModule`
  - Blocked before test execution by Foundry macOS signature lookup panic: `Attempted to create a NULL object` in `system_configuration::dynamic_store`.
- `cd packages/contracts && bun run test -- --match-contract GardensModule --offline`
  - Passed: 106 tests passed, 0 failed, 0 skipped.
- `cd packages/contracts && bun run test -- --match-contract YieldSplitter --offline`
  - Passed: 77 tests passed, 0 failed, 0 skipped.
- `cd packages/contracts && bun run test -- --match-contract StorageLayout --match-test 'testGardensModule|testYieldResolver' --offline`
  - Passed: 6 tests passed, 0 failed, 0 skipped.
- `cd packages/contracts && bun run build:target -- script/Upgrade.s.sol src/modules/Gardens.sol src/resolvers/Yield.sol`
  - Passed.
- `cd packages/contracts && bun run build`
  - Passed.
- `bun run format:check`
  - Passed: 1603 files checked, no fixes applied.
- `bun lint`
  - Passed with existing warnings: oxlint reported warnings only; solhint reported 165 warnings, 0 errors.
- `git diff --check -- <contracts lane files>`
  - Passed.

## Known Risks/Blockers

- Local Foundry crashes without `--offline` before running tests because signature lookup attempts to create a macOS `SCDynamicStore` client. The same test suites pass with `--offline`, which disables that lookup.
- Foundry still warns that it cannot write `/Users/afo/.foundry/cache/signatures` from this sandbox. This warning did not fail tests or builds.
- `bun lint` passes but the repo still has pre-existing lint warnings in scripts/Solidity sources; this lane did not attempt a broad lint cleanup.
- Backfill only auto-writes event-sourced HypercertSignal pools. Array-index fallback is logged as manual-review evidence by design.
- Fork/E2E tests require explicit RPC values at runtime. Some fork tests gracefully return early when RPC env is missing, so passing fork commands without RPC values is not proof. The proof above used explicit public RPC values and network access.
- Public RPC providers can rate-limit long E2E runs. The full E2E run hit HTTP 429 after earlier suites passed; the affected Sepolia and Arbitrum suites were rerun with explicit alternate fork RPC values and passed.
