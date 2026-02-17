# Full Protocol E2E Fork Coverage Plan

**Date:** 2026-02-17
**Branch:** `feature/ens-integration`
**Complements:** `fork-test-coverage-gaps.md`, `mock-removal-and-e2e-coverage.md`
**Scope:** Sepolia + Arbitrum only (Celo excluded)
**Status:** Ready for implementation

---

## Context

The current E2E fork tests (`FullProtocolE2E.t.sol`, `ArbitrumFullProtocolE2E.t.sol`) cover only the attestation golden path: mint → roles → action → work → approval → assessment. The full protocol flow — yield pipeline, CookieJar, Hypercerts marketplace, ENS name claims, Gardens V2 communities, conviction voting — is tested in isolated module fork tests but **never exercised end-to-end on a single fork**.

This plan adds comprehensive E2E fork tests that exercise the complete protocol lifecycle with real on-chain contracts, plus supporting fork and integration tests to close remaining gaps.

**Excludes:** UnlockModule (not yet implemented for production).

---

## Phase 1: Arbitrum Full Protocol E2E (Crown Jewel)

### New file: `test/fork/e2e/ArbitrumExtendedE2E.t.sol`

Inherits `ForkTestBase`. Exercises the **complete protocol lifecycle** including all modules against real Arbitrum contracts.

**Real external contracts used:**
- Aave V3 Pool: `0x794a61358D6845594F94dc1DB02A252b5b4814aD`
- WETH: `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1`
- Juicebox Terminal: `0x14785612bd5C27D8CbAd1d9A9E33BEBfF5F4C3b6`
- HypercertExchange: `0xcE8fa09562f07c23B9C21b5d0A29a293F8a8BC83`
- HypercertMinter: `0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07`
- Karma GAP: `0x6dC1D6b864e8BEf815806f9e4677123496e12026`
- CCIP Router: `0x141fa059441E0ca23ce184B6A78bafD2A517DdE8`
- Hats Protocol: `0x3bc1A0Ad72417f2d411118085256fC53CBdDd137`
- EAS: `0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458`
- Gardens V2 RegistryFactory: `0xc1c2E092b7DbC8413E1aC02e92C161b0BDA783f6`

| # | Test | Flow | Modules Exercised |
|---|------|------|-------------------|
| 1 | `testForkArbitrum_e2e_fullYieldPipeline` | Deploy stack → mint garden → deposit WETH into Octant vault → time warp 30d → harvest → YieldResolver.registerShares → splitYield → verify CookieJar receives 48.65% + Juicebox receives via real JB Terminal + fractions escrowed | OctantModule, AaveV3Strategy, YieldResolver, CookieJarModule, Juicebox |
| 2 | `testForkArbitrum_e2e_hypercertMintAndMarketplaceListing` | Deploy stack → mint garden → submit+approve work → mint hypercert via HypercertsModule → register order on real HypercertExchange → verify order stored | HypercertsModule, HypercertMarketplaceAdapter, real HypercertExchange |
| 3 | `testForkArbitrum_e2e_gardenMintWithENSAndGAP` | Deploy stack → mint garden with slug → verify ENS registration + CCIP fee estimation → verify KarmaGAP project created on real GAP | GreenGoodsENS, KarmaGAPModule, real CCIP Router, real Karma GAP |
| 4 | `testForkArbitrum_e2e_gardensV2CommunityAndConviction` | Deploy stack → mint garden → configureRealGardensV2 → verify community created on real RegistryFactory → grant roles → verify power in UnifiedPowerRegistry | GardensModule, UnifiedPowerRegistry, real Gardens V2 RegistryFactory |
| 5 | `testForkArbitrum_e2e_cookieJarHatsGatedWithdrawal` | Deploy stack → mint garden → create CookieJar → deposit tokens → gardener (hat-wearer) withdraws → non-member withdrawal reverts | CookieJarModule, HatsModule, real Hats Protocol |
| 6 | `testForkArbitrum_e2e_completeProtocolLifecycleAllModules` | **The integration test:** mint garden(slug, all domains) → all roles granted → action registered → KarmaGAP project created → ENS slug cached → Octant vault created → WETH deposited → work submitted → work approved → assessment submitted → yield harvested → yield split → CookieJar funded → hypercert minted → order listed | ALL modules in sequence |
| 7 | `testForkArbitrum_e2e_memberClaimsENSName` | Deploy stack → mint garden → grant gardener role → gardener claims `*.greengoods.eth` → verify CCIP fee estimation non-zero + slug cached | GreenGoodsENS, HatsModule, real CCIP Router |
| 8 | `testForkArbitrum_e2e_convictionPowerAfterRoleGrant` | Deploy stack → mint garden → configure conviction strategies → grant gardener role → verify power sync fires → query power from registry | HatsModule, UnifiedPowerRegistry, ConvictionSync |

**8 tests — highest-value addition in the plan**

---

## Phase 2: Sepolia Extended E2E + Error Parity

### 2A. New file: `test/fork/e2e/SepoliaExtendedE2E.t.sol`

Inherits `ForkTestBase`. Extends Sepolia E2E with ENS and CookieJar (only external protocols available on Sepolia beyond EAS/Hats).

| # | Test | Flow |
|---|------|------|
| 1 | `test_fork_e2e_gardenMintWithENSSlug` | Mint with slug → ENS registration + CCIP fee estimation on real Sepolia CCIP router |
| 2 | `test_fork_e2e_memberClaimsENSName` | Grant gardener role → claim `*.greengoods.eth` name |
| 3 | `test_fork_e2e_cookieJarCreatedOnMint` | Garden mint triggers CookieJarModule callback → jar created |
| 4 | `test_fork_e2e_karmaGAPProjectOnMint` | Garden mint → KarmaGAP module creates project on real Sepolia GAP at `0x9E5560f5b084c227Dc40672f48F59DA617eeFA28` |

**4 tests**

### 2B. Modified file: `test/fork/e2e/FullProtocolE2E.t.sol`

Add 3 error-path tests to match Arbitrum E2E tests 6-8 (Sepolia currently has 0 error tests):

| # | Test | What It Validates |
|---|------|-------------------|
| 6 | `test_fork_e2e_unauthorizedWorkSubmission` | Non-member work attest reverts on real Sepolia EAS |
| 7 | `test_fork_e2e_crossGardenRoleIsolation` | Garden A operator can't approve Garden B work |
| 8 | `test_fork_e2e_doubleRoleGrantReverts` | Hats Protocol rejects duplicate hat mint |

**3 tests**

---

## Phase 3: Missing Module Fork Tests

### 3A. New file: `test/fork/ArbitrumKarmaGAP.t.sol`

Standalone pattern (inherits `Test`, not `ForkTestBase`). Mirrors `SepoliaKarmaGAP.t.sol`. Uses real Arbitrum GAP at `0x6dC1D6b864e8BEf815806f9e4677123496e12026`.

| # | Test | What It Validates |
|---|------|-------------------|
| 1 | `testForkArbitrum_createProjectImpactMilestone` | Full project→impact→milestone on real Arbitrum GAP |
| 2 | `testForkArbitrum_schemaUIDs_matchKnownArbitrumValues` | KarmaLib addresses match real Arbitrum deployment |
| 3 | `testForkArbitrum_createProject_persistsUID` | `gardenProjects` mapping updated on real chain |
| 4 | `testForkArbitrum_createImpact_withoutProject_reverts` | Error path: impact without prior project |

**4 tests**

### 3B. New file: `test/fork/SepoliaGardensModule.t.sol`

Arbitrum has `ArbitrumGardensModule.t.sol` but Sepolia doesn't. Gardens V2 RegistryFactory at `0x4177f64568e90fd58884579864923aa0345248F0` exists on Sepolia.

| # | Test | What It Validates |
|---|------|-------------------|
| 1 | `test_fork_gardens_communityCreatedOnMint` | Real RegistryFactory creates community |
| 2 | `test_fork_gardens_weightSchemeStored` | Linear/Exponential/Power scheme persisted |
| 3 | `test_fork_gardens_goodsTokenSeeded` | GOODS token configured in community |
| 4 | `test_fork_gardens_powerRegistryDeployed` | UnifiedPowerRegistry initialized per garden |

**4 tests**

### 3C. New file: `test/fork/SepoliaConvictionVoting.t.sol`

Mirrors `ArbitrumConvictionVoting.t.sol` for Sepolia.

| # | Test | What It Validates |
|---|------|-------------------|
| 1 | `test_fork_conviction_strategyRegisteredOnGardenMint` | Strategy wired after garden creation |
| 2 | `test_fork_conviction_powerSyncOnRoleGrant` | Role grant triggers power sync |
| 3 | `test_fork_conviction_powerSyncOnRoleRevoke` | Role revoke zeroes power |

**3 tests**

---

## Phase 4: Negative Path Fork Tests

### 4A. New file: `test/fork/ArbitrumNegativePaths.t.sol`

Aggregates error-path fork tests for modules that currently only test happy paths.

| # | Test | Module | What It Validates |
|---|------|--------|-------------------|
| 1 | `testForkArbitrum_yieldSplitter_splitWithZeroShares_reverts` | YieldResolver | No shares → split reverts |
| 2 | `testForkArbitrum_yieldSplitter_unauthorizedRegisterShares_reverts` | YieldResolver | Non-octant caller rejected |
| 3 | `testForkArbitrum_octantVault_depositZero_reverts` | OctantModule | Zero deposit rejected |
| 4 | `testForkArbitrum_octantVault_withdrawMoreThanBalance_reverts` | OctantModule | Over-withdraw rejected |
| 5 | `testForkArbitrum_hypercerts_buyFractionExpiredOrder_reverts` | HypercertMarketplaceAdapter | Expired order rejected |
| 6 | `testForkArbitrum_hypercerts_deactivateByNonOwner_reverts` | HypercertMarketplaceAdapter | Non-seller rejected |
| 7 | `testForkArbitrum_ens_ccipFeeWithZeroValue_reverts` | GreenGoodsENS | Insufficient CCIP fee |
| 8 | `testForkArbitrum_karmaGAP_impactWithoutProject_reverts` | KarmaGAPModule | Impact without project |

**8 tests**

### 4B. New file: `test/fork/SepoliaNegativePaths.t.sol`

| # | Test | Module | What It Validates |
|---|------|--------|-------------------|
| 1 | `test_fork_eas_workWithDisabledAction_reverts` | WorkResolver | Disabled action rejected |
| 2 | `test_fork_eas_approvalWithoutPriorWork_reverts` | WorkApprovalResolver | No matching work UID |
| 3 | `test_fork_eas_assessmentWithInvalidDomain_reverts` | AssessmentResolver | Domain > 3 rejected |
| 4 | `test_fork_eas_assessmentByGardener_reverts` | AssessmentResolver | Wrong role rejected |
| 5 | `test_fork_ens_duplicateGardenSlug_reverts` | GreenGoodsENS | `NameTaken` revert |
| 6 | `test_fork_ens_nonMemberClaimName_reverts` | GreenGoodsENS | `NotProtocolMember` revert |

**6 tests**

---

## Phase 5: Missing Integration Tests

### 5A. New file: `test/integration/CookieJarYieldIntegration.t.sol`

Pattern: follows `test/integration/YieldFlowE2E.t.sol`.

| # | Test | What It Validates |
|---|------|-------------------|
| 1 | `test_mintCreatesJarAndWiresVault` | Garden mint → CookieJarModule creates jar → YieldResolver knows jar |
| 2 | `test_splitRoutesToGardenJar` | Yield split sends correct % to CookieJar |
| 3 | `test_multiAssetJarsReceiveCorrectSplit` | WETH + DAI jars both receive correct split |
| 4 | `test_noJarForAssetFallsToTreasury` | Missing jar → treasury fallback |
| 5 | `test_jarBalanceAccumulatesAcrossMultipleSplits` | 3 consecutive splits accumulate |

**5 tests**

### 5B. New file: `test/integration/HypercertsIntegration.t.sol`

| # | Test | What It Validates |
|---|------|-------------------|
| 1 | `test_mintAndRegisterCallsAdapter` | HypercertsModule → adapter.registerOrder |
| 2 | `test_listForYieldRegistersOrder` | Yield-linked listing stores params |
| 3 | `test_delistCancelsOrder` | Delist → adapter.deactivateOrder |
| 4 | `test_batchMintAndRegister` | Multiple hypercerts in one tx |
| 5 | `test_pausedModuleBlocksMint` | Paused state reverts |
| 6 | `test_gardenTrackingAcrossGardens` | Per-garden tracking isolation |

**6 tests**

### 5C. New file: `test/integration/PowerRegistryConvictionIntegration.t.sol`

Pattern: follows `test/integration/ConvictionSync.t.sol` (complements it with power calculation focus).

| # | Test | What It Validates |
|---|------|-------------------|
| 1 | `test_strategyQueriesPowerFromRegistry` | Strategy→registry power query flow |
| 2 | `test_roleGrantUpdatesPowerWeight` | Hat grant → power increases |
| 3 | `test_roleRevokeRemovesPower` | Hat revoke → power zeroed |
| 4 | `test_multiGardenPowerIsolation` | Garden A power doesn't affect B |
| 5 | `test_weightSchemeAffectsPowerCalculation` | Linear vs Exponential vs Power |

**5 tests**

### 5D. New file: `test/integration/ENSIntegration.t.sol`

| # | Test | What It Validates |
|---|------|-------------------|
| 1 | `test_gardenMintWithSlugCallsENS` | Mint with slug → ENS.registerGarden |
| 2 | `test_gardenMintEmptySlugSkipsENS` | No slug → no ENS call |
| 3 | `test_claimNameRequiresHatMembership` | Non-member → NotProtocolMember |
| 4 | `test_releaseNameCooldownEnforced` | Immediate re-release blocked |
| 5 | `test_twoGardensDifferentSlugs` | Slug uniqueness across gardens |

**5 tests**

---

## Summary

| Phase | Focus | New Files | Modified | Tests |
|-------|-------|-----------|----------|-------|
| **1** | Arbitrum Full Protocol E2E | 1 | — | 8 |
| **2** | Sepolia Extended E2E + Error Parity | 1 | 1 | 7 |
| **3** | Missing Module Fork Tests | 3 | — | 11 |
| **4** | Negative Path Fork Tests | 2 | — | 14 |
| **5** | Missing Integration Tests | 4 | — | 21 |
| **Total** | | **11 new** | **1 modified** | **~61 tests** |

Combined with existing ~160 tests → **~221 total integration/fork/E2E tests**.

---

## Implementation Order & Dependencies

1. **Phase 1** (Arbitrum Extended E2E) — highest value, no dependencies, start here
2. **Phase 2A** (Sepolia Extended E2E) — independent, can parallel with Phase 1
3. **Phase 2B** (Sepolia error parity) — independent, can parallel
4. **Phase 3A-C** (module fork tests) — independent of each other, can parallel
5. **Phase 4A-B** (negative paths) — independent, can parallel with Phase 3
6. **Phase 5A-D** (integration tests) — independent, can parallel with all fork work

Phases 1-4 are fork tests (require RPC URLs). Phase 5 is mock-based integration (runs in CI without RPC).

---

## Verification

```bash
# Integration tests (Phase 5)
cd packages/contracts && bun run test

# Fork tests (Phases 1-4, requires RPC URLs in .env)
cd packages/contracts && bun run test:fork

# Chain-specific E2E
cd packages/contracts && bun run test:e2e:arbitrum
cd packages/contracts && bun run test:e2e:sepolia

# Full verification
bun run verify:contracts
```

All fork tests must gracefully skip when RPC URLs are not configured.

---

## Key Pattern References

| Pattern | File |
|---------|------|
| ForkTestBase E2E | `test/fork/e2e/ArbitrumFullProtocolE2E.t.sol` |
| Standalone fork test | `test/fork/SepoliaKarmaGAP.t.sol` |
| Cross-module integration | `test/integration/HatsGAPIntegration.t.sol` |
| Yield pipeline integration | `test/integration/YieldFlowE2E.t.sol` |
| Conviction sync integration | `test/integration/ConvictionSync.t.sol` |
| Graceful skip pattern | `_tryChainFork("arbitrum")` / `_getRpc("ARBITRUM_RPC_URL")` |
| Error path pattern | `ArbitrumFullProtocolE2E.t.sol` tests 6-8 |
