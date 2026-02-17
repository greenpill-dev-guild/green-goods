# Fork Test Coverage Gaps — Implementation Plan

> **Scope**: Sepolia + Arbitrum only (Celo excluded from production release)
> **Current state**: ~93 fork tests across 16 files, 2 chains
> **Branch**: `feature/ens-integration`

## Priority 1: OctantModule Real Vault Integration Fork Test

**Risk**: Medium-High — Octant is part of the yield pipeline (vault → strategy → split). Only tested via graceful degradation (`address(0)`) in E2E. If `onGardenMinted` callback or vault wiring has integration bugs against real Octant contracts, they won't surface until deployment.

**File**: `packages/contracts/test/fork/ArbitrumOctantModule.t.sol`

**Tests to write**:
1. `test_forkDeploy_octantModuleInitializesWithRealInfra` — Deploy OctantModule on Arbitrum fork, verify initialization with real vault factory addresses
2. `test_forkDeploy_onGardenMintedCreatesVault` — Call `onGardenMinted` and verify vault is created/registered for the garden
3. `test_forkDeploy_vaultAcceptsDeposits` — Deposit real WETH into the created vault and verify share accounting
4. `test_forkDeploy_strategyDeploysFundsToAave` — Verify the vault's strategy deploys funds to the real Aave pool on Arbitrum
5. `test_forkDeploy_yieldAccruesOverTime` — Time warp and verify `totalAssets > deposit` (similar pattern to `ArbitrumAaveStrategy.t.sol`)
6. `test_forkDeploy_adminSettersWorkOnFork` — Verify owner-only setters (setVaultFactory, etc.)

**Pattern**: Follow `ArbitrumYieldSplitter.t.sol` standalone style (own `_tryFork()` + `_deployModule()`, not ForkTestBase).

**Key addresses** (Arbitrum):
- WETH: `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1`
- Aave V3 Pool: `0x794a61358D6845594F94dc1DB02A252b5b4814aD`
- Real Octant MultistrategyVaultFactory (check `deployments/42161-latest.json`)

---

## Priority 2: UnifiedPowerRegistry Fork Test

**Risk**: Medium — New contract with no on-chain integration validation. Unit tests + fault injection cover reverting paths, but `registerGarden`/`registerPool` never tested against real chain state.

**File**: `packages/contracts/test/fork/ArbitrumPowerRegistry.t.sol`

**Tests to write**:
1. `test_forkDeploy_powerRegistryInitializes` — Deploy via UUPS proxy on Arbitrum fork
2. `test_forkDeploy_registerGardenStoresState` — Register a garden with NFTPowerSources and verify storage
3. `test_forkDeploy_registerPoolLinksToGarden` — Register pool and verify bidirectional mapping
4. `test_forkDeploy_deregisterGardenClearsState` — Deregister and verify cleanup
5. `test_forkDeploy_getGardenSourcesReturnsCorrectly` — Query registered sources after registration
6. `test_forkDeploy_unauthorizedCallerReverts` — Non-owner/non-gardenToken caller reverts

**Pattern**: Standalone (own `_tryFork()`), deploy PowerRegistry wired to real Hats Protocol.

---

## Priority 3: HypercertsModule Full Flow Fork Test

**Risk**: Medium — Adapter has 12 fork tests (strong), but the module layer (`mintFraction`, `batchListForYield`) isn't fork-tested. Module-to-adapter wiring bugs only caught by unit tests.

**File**: Extend existing `packages/contracts/test/fork/ArbitrumHypercerts.t.sol`

**Tests to add**:
1. `test_forkModule_mintFractionWithRealMinter` — Call `mintFraction` through the module and verify real HypercertMinter is invoked
2. `test_forkModule_batchListForYieldRegistersOrders` — Batch list fractions and verify orders are registered in the adapter
3. `test_forkModule_moduleToAdapterWiring` — Full flow: module → adapter → real exchange (verify correct call chain)
4. `test_forkModule_unauthorizedMintReverts` — Non-authorized caller attempting mint through module reverts

**Note**: These tests may require minting a real hypercert on the fork first. Use `vm.prank` + real HypercertMinter to create test fractions.

---

## Priority 4: KarmaGAPModule Fork Test

**Risk**: Low-Medium — Only validated by graceful degradation. If real Karma GAP on Arbitrum has different interface than expected, `onGardenMinted` callback could fail silently.

**File**: `packages/contracts/test/fork/ArbitrumKarmaGAP.t.sol`

**Tests to write**:
1. `test_forkDeploy_karmaGAPModuleInitializes` — Deploy on Arbitrum fork with real GAP address
2. `test_forkDeploy_onGardenMintedCallbackSucceeds` — Verify `onGardenMinted` doesn't revert against real GAP
3. `test_forkDeploy_realGAPContractIsDeployed` — Verify GAP contract exists at expected address
4. `test_forkDeploy_projectRegistrationFlow` — If GAP supports project registration, test the full flow

**Key addresses**: Check Karma GAP deployment on Arbitrum (likely in `deployments/42161-latest.json` or hardcoded in `KarmaGAPModule`).

---

## Priority 5: CookieJar Fork Test

**Risk**: Low — Receives yield in the three-way split. The transfer is just an ERC20 transfer to an address, so integration risk is minimal.

**File**: `packages/contracts/test/fork/ArbitrumCookieJar.t.sol` (if CookieJar has on-chain logic beyond receiving tokens)

**Tests to write** (only if CookieJar has its own contract logic):
1. `test_forkDeploy_cookieJarReceivesYield` — End-to-end: deposit → vault → split → verify CookieJar balance
2. `test_forkDeploy_cookieJarDistribution` — If CookieJar has distribution logic, test it on fork

**Note**: If CookieJar is just an address that receives ERC20 transfers, this can be deprioritized below other items. The `ArbitrumYieldSplitter` tests already verify WETH arrives at the cookieJar address.

---

## Priority 6: Unlock Module Fork Test

**Risk**: Low — Appears early-stage. Not part of core release flow.

**File**: `packages/contracts/test/fork/ArbitrumUnlock.t.sol`

**Defer** unless Unlock is needed for the production release.

---

## Execution Notes

- **All fork tests must gracefully skip** when RPC URL is not set (use `_tryFork()` pattern)
- **Use `bun run test:fork`** to run, never raw `forge test`
- **Standalone tests** (Priorities 1, 2, 4, 5, 6) should use their own `_tryFork()` + deploy helpers
- **Extended tests** (Priority 3) add to existing `ArbitrumHypercerts.t.sol`
- **Estimated effort**: ~2-3 hours for Priority 1, ~1-2 hours each for Priorities 2-4, <1 hour for 5-6

## Current Coverage Summary

| Category | Sepolia | Arbitrum | Total |
|----------|---------|----------|-------|
| E2E Protocol | 5 | 8 | 13 |
| EAS Attestation | 8 | 10 | 18 |
| Hats Protocol | 1 | 4 | 5 |
| Module-Specific | — | 45 | 45 |
| Gardens V2 | 11 | 1 | 12 |
| **Total** | **25** | **68** | **93** |
