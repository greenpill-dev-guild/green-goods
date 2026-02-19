# Fork & E2E Test Coverage Audit

**Date:** 2026-02-16
**Branch:** `feature/ens-integration`
**Test Results:** 1,317 unit/integration tests PASS | 3 E2E tests PASS
**Blocking Issue Found:** `MockUnifiedPowerRegistry` missing `deregisterGarden()` — FIXED

---

## Executive Summary

| Category | Count |
|----------|-------|
| Total try-catch blocks in production contracts | **60+** |
| Files with try-catch patterns | **12** |
| CRITICAL risk (silent swallow, potential fund impact) | **5** |
| HIGH risk (untested catch branches) | **8** |
| MEDIUM risk (events emitted, partially tested) | **38** |
| LOW risk (safe fallbacks, well-tested) | **14** |
| Untested catch branches | **~15** |

### Build Blocker (Fixed During Audit)

`MockUnifiedPowerRegistry` in `src/mocks/GardensV2.sol` did not implement `deregisterGarden()` added to `IUnifiedPowerRegistry`. This blocked **all 1,317 tests** from compiling. Added the missing stub implementation.

---

## Test Infrastructure Overview

### E2E Test (Mock-Based): `test/E2EWorkflow.t.sol`

Uses **MockEAS** and **MockHats** — verifies protocol flow logic but NOT real contract interactions:

| Test | Coverage |
|------|----------|
| `testCompleteProtocolWorkflow` | Mint -> Roles -> Action -> Work -> Approval (mock EAS) |
| `testAccessControlEnforcement` | Unauthorized access reverts, authorized succeeds |
| `testJoinGardenOpenJoining` | Open joining grants gardener hat |

**Limitation:** MockEAS doesn't enforce schema validation, resolver callbacks, or real attestation storage. These tests verify *protocol logic*, not *EAS integration correctness*.

### Fork E2E: `test/fork/e2e/FullProtocolE2E.t.sol`

Uses **real EAS** on Sepolia fork — exercises the golden path against production contracts:

| Test | Real Contracts Tested |
|------|----------------------|
| `test_fork_e2e_completeProtocolLifecycle` | EAS attest(), SchemaRegistry, Hats Protocol |
| `test_fork_e2e_gardenMintWithAllModules` | Full module wiring verification |
| `test_fork_e2e_gracefulDegradationMatrix` | Module-by-module removal |
| `test_fork_e2e_batchMintGardens` | Batch mint with distinct configs |
| `test_fork_e2e_openJoiningFlow` | Open join against real Hats |

**Requires:** `SEPOLIA_RPC_URL` in `.env`. Tests skip gracefully if not configured.

### Fork Tests (Chain-Specific)

| File | Chain | Real Contracts |
|------|-------|----------------|
| `ArbitrumHats.t.sol` | Arbitrum | Hats Protocol tree verification |
| `CeloHats.t.sol` | Celo | Hats Protocol tree verification |
| `ArbitrumYieldSplitter.t.sol` | Arbitrum | Juicebox v3 MultiTerminal, Aave V3 Pool |
| `ArbitrumGardensModule.t.sol` | Arbitrum | Gardens V2 RegistryFactory, RegistryCommunity |
| `ArbitrumAaveStrategy.t.sol` | Arbitrum | Aave V3 Pool, aWETH, aDAI |
| `GardensCommunityGovernance.t.sol` | Fork | Gardens V2 governance |
| `GardensV2Community.t.sol` | Fork | Gardens V2 community contract |
| `EASAttestationLifecycle.t.sol` | Fork | EAS contract lifecycle |

---

## Try-Catch Audit: Complete Production Catalog

### How to Read This Catalog

Each entry documents a try-catch in production code with:
- **Catch behavior:** What happens when the external call fails
- **Tested?** Whether any test explicitly triggers the catch branch
- **Risk:** Impact of silent failure on protocol correctness

---

### 1. GardenToken.sol — `_initializeGardenModules()` (7 blocks)

The core minting flow. Garden mint MUST NOT revert, so every module callback is wrapped in try-catch.

| Line | External Call | Catch Behavior | Tested Catch? | Risk |
|------|--------------|----------------|---------------|------|
| 213 | `Deployment.isInAllowlist()` | Reverts `UnauthorizedMinter` | YES GardenToken.t.sol | LOW |
| 324 | `karmaGAPModule.createProject()` | Silent swallow | YES FullModuleWiring (module absent) | MEDIUM |
| 335 | `octantModule.onGardenMinted()` | Silent swallow | YES FullProtocolE2E (degradation) | MEDIUM |
| 346 | `gardensModule.onGardenMinted()` | Silent swallow | YES FullProtocolE2E (degradation) | MEDIUM |
| 356 | `cookieJarModule.onGardenMinted()` | Silent swallow | YES FullModuleWiring (module absent) | MEDIUM |
| 366 | `actionRegistry.setGardenDomainsFromMint()` | Silent swallow | YES FullProtocolE2E (degradation) | MEDIUM |
| 376 | `ensModule.registerGarden{value}()` | Silent swallow | **NO** | **HIGH** |
| 415 | `IERC20.totalSupply()` | Reverts `InvalidERC20Token` | YES GardenToken.t.sol | LOW |

**Finding:** Lines 324-376 all silently swallow errors with no event emission. The degradation matrix tests module *absence* (address(0)), but does NOT test module *failure* (present but reverts).

**ENS catch (line 376):** Completely untested. If ENS registration fails during garden mint, no event is emitted, no error is logged. Garden still mints but slug is lost silently.

---

### 2. GardenAccount.sol — Auto-Registration (3 blocks)

| Line | External Call | Catch Behavior | Tested Catch? | Risk |
|------|--------------|----------------|---------------|------|
| 316 | `IGardenTokenModules.karmaGAPModule()` | Returns address(0) | YES GardenAccount.t.sol | LOW |
| 350 | `IGardenTokenModules.gardensModule()` | Returns address(0) | YES GardenAccount.t.sol | LOW |
| 382 | `this.executeAutoStake()` | Silent swallow, gardener still granted | **NO (catch not tested)** | **HIGH** |

**Finding:** Line 382 — `_autoRegisterInCommunity` always succeeds in tests because mocks never revert on staking. No test verifies gardener is still correctly granted when community staking fails.

---

### 3. Gardens.sol — Community + Pool Creation (8 blocks)

| Line | External Call | Catch Behavior | Tested Catch? | Risk |
|------|--------------|----------------|---------------|------|
| 197 | `IGoodsToken.mint()` | Silent swallow | YES ArbitrumGardensModule | MEDIUM |
| 209 | `this.attemptPoolCreation()` | Emit `GardenPartiallyInitialized` | YES GardensV2Community | MEDIUM |
| 398 | `powerRegistry.deregisterGarden()` | Silent swallow | **NO** | **HIGH** |
| 496 | `powerRegistry.registerGarden()` | Emit `CommunityCreationFailed` | YES ArbitrumGardensModule | MEDIUM |
| 529 | `registryFactory.createRegistryCommunity()` | Emit `CommunityCreationFailed` | YES GardensModule.t.sol | MEDIUM |
| 614 | `IRegistryCommunity.createPool()` | Emit `PoolCreationFailed` | YES GardensV2Community | MEDIUM |
| 632 | `powerRegistry.registerPool()` | Emit `PoolRegistrationFailed` | **NO** | **HIGH** |
| 666 | `hatsModule.setConvictionStrategies()` | Emit `PoolRegistrationFailed` | YES ConvictionSync | MEDIUM |

**Finding:** `resetGardenInitialization` (398) and pool-to-power-registry mapping (632) have zero catch-branch coverage.

---

### 4. Octant.sol — Vault & Strategy Operations (15 blocks)

The most try-catch-heavy contract. Octant integrations are inherently unreliable.

| Line | External Call | Catch Behavior | Tested Catch? | Risk |
|------|--------------|----------------|---------------|------|
| 122 | `IGardenAccessControl.isOperator()` | Silent, continue | YES OctantModule.t.sol | LOW |
| 126 | `IGardenAccessControl.isOwner()` | Silent, continue | YES OctantModule.t.sol | LOW |
| 143 | `IGardenAccessControl.isOwner()` | Silent, revert if false | YES OctantModule.t.sol | LOW |
| 232 | `IOctantVault.process_report()` | Fallback to strategy.report() | **NO** | **CRITICAL** |
| 235 | `IOctantStrategy.report()` | Emit `HarvestReportFailed` | **NO** | **CRITICAL** |
| 246 | `IYieldResolver.registerShares()` | Silent swallow | **NO** | **HIGH** |
| 261 | `IOctantStrategy.shutdown()` | Emit `StrategyShutdownFailed` | **NO** | MEDIUM |
| 295 | `IOctantVault.revoke_strategy()` | Silent swallow | **NO** | MEDIUM |
| 307 | `IOctantStrategy.setDonationAddress()` | Emit `DonationAddressUpdateFailed` | **NO** | MEDIUM |
| 339 | `IOctantStrategy.setDonationAddress()` | Emit `DonationAddressUpdateFailed` | **NO** | MEDIUM |
| 504 | `IOctantVault.add_strategy()` | Emit `StrategyAttachmentFailed` | YES OctantVaultIntegration | MEDIUM |
| 515 | `IOctantStrategy.setDonationAddress()` | Silent swallow | YES OctantVaultIntegration | MEDIUM |
| 524 | `IYieldResolver.setGardenVault()` | Silent swallow | YES OctantVaultIntegration | MEDIUM |
| 558 | `IERC20Metadata.symbol()` | Returns "ASSET" default | YES (implicit) | LOW |
| 567 | `IGardenMetadata.name()` | Returns "Garden" default | YES (implicit) | LOW |

**Finding:** Lines 232-246 form the **harvest fallback chain** — the most critical yield path. If all three fail, harvest silently does nothing. No test exercises this cascade. **Highest-risk gap in the entire test suite.**

---

### 5. Hats.sol — Role & Eligibility Operations (9 blocks)

| Line | External Call | Catch Behavior | Tested Catch? | Risk |
|------|--------------|----------------|---------------|------|
| 650 | `hats.mintHat(protocolGardenersHatId)` | Silent swallow | YES HatsModule.t.sol | LOW |
| 673 | `hats.mintHat()` | Emit `PartialGrantFailed` | YES HatsModule.t.sol | MEDIUM |
| 717 | `karmaGAPModule.addProjectAdmin()` | Silent swallow | YES HatsGAPIntegration | MEDIUM |
| 720 | `karmaGAPModule.removeProjectAdmin()` | Silent swallow | YES HatsGAPIntegration | MEDIUM |
| 741 | `ICVSyncPowerFacet.syncPower{gas}()` | Emit `ConvictionSyncFailed` | YES ConvictionSync | MEDIUM |
| 786 | `hatsModuleFactory.createHatsModule()` | Emit `EligibilityModuleCreationFailed` | YES HatsModule.t.sol | MEDIUM |
| 796 | `hats.changeHatEligibility()` | Silent swallow | YES HatsModule.t.sol | MEDIUM |
| 808 | `hatsModuleFactory.createHatsModule()` | Emit `EligibilityModuleCreationFailed` | YES HatsModule.t.sol | MEDIUM |
| 817 | `hats.changeHatEligibility()` | Silent swallow | YES HatsModule.t.sol | MEDIUM |

**Assessment:** Best-covered module. All catch branches have at least indirect test coverage.

---

### 6. Yield.sol — Routing & Fractionalization (6 blocks)

| Line | External Call | Catch Behavior | Tested Catch? | Risk |
|------|--------------|----------------|---------------|------|
| 492 | `cookieJarModule.getGardenJar()` | Fallback to mapping | YES YieldFlowE2E | MEDIUM |
| 544 | `ICVStrategy.proposalCounter()` | Escrow fractions | YES YieldToFractions | MEDIUM |
| 604 | `ICVStrategy.getProposal()` | Skip proposal | YES YieldToFractions | MEDIUM |
| 624 | `ICVStrategy.calculateProposalConviction()` | Conviction = 0 | YES YieldToFractions | MEDIUM |
| 683 | `hypercertMarketplace.buyFraction()` | Reset approval, escrow funds | **NO** | **CRITICAL** |
| 715 | `jbMultiTerminal.pay()` | Reset approval, fallback to treasury | **NO** | **CRITICAL** |

**Finding:** Lines 683 and 715 handle **real money flows**. Stranded funds require manual `withdrawEscrowedFractions()` intervention.

---

### 7. Karma.sol — GAP Attestations (7 blocks)

| Line | External Call | Catch Behavior | Tested Catch? | Risk |
|------|--------------|----------------|---------------|------|
| 188 | `gap.attest()` (project) | Emit `GAPOperationFailed`, return 0 | YES | MEDIUM |
| 211 | `gap.attest()` (MemberOf) | Emit `GAPOperationFailed` | YES | MEDIUM |
| 234 | `gap.attest()` (Details) | Emit `GAPOperationFailed` | YES | MEDIUM |
| 251 | `gap.addProjectAdmin()` | Emit `GAPOperationFailed` | **NO** | MEDIUM |
| 264 | `gap.removeProjectAdmin()` | Emit `GAPOperationFailed` | **NO** | MEDIUM |
| 325 | `gap.attest()` (impact) | Emit `GAPOperationFailed` | YES | MEDIUM |
| 374 | `gap.attest()` (milestone) | Emit `GAPOperationFailed` | YES | MEDIUM |

---

### 8. Other Files (4 blocks)

| File | Line | External Call | Catch | Tested? | Risk |
|------|------|--------------|-------|---------|------|
| WorkApproval.sol | 183 | `karmaGAPModule.createImpact()` | Silent swallow | YES | LOW |
| Assessment.sol | 137 | `karmaGAPModule.createMilestone()` | Silent swallow | YES | LOW |
| HypercertAdapter.sol | 316 | `exchange.executeTakerBid()` | Revert `ExchangeExecutionFailed` | YES | MEDIUM |
| Hypercerts.sol | 133 | `gardensModule.getGardenSignalPools()` | pool = 0 | YES | LOW |
| ENSReceiver.sol | 125 | `this._setENSRecordsExternal()` | Emit `ENSRegistrationFailed` | YES | MEDIUM |
| ENSReceiver.sol | 152 | `this._clearENSRecordsExternal()` | Emit `ENSReleaseFailed` | YES | MEDIUM |

---

## Top 5 Recommendations (Priority Order)

### 1. CRITICAL: Test Octant Harvest Failure Cascade

**Lines:** `Octant.sol:232-246`
**Risk:** Harvest silently does nothing if vault + strategy + yield resolver all fail.

```
What needs testing:
1. process_report() fails -> falls back to strategy.report()
2. strategy.report() fails -> emits HarvestReportFailed, continues
3. registerShares() fails -> shares lost, no revert
```

Add `test_harvest_vaultReportFails_fallsBackToStrategy()` and `test_harvest_allReportsFail_emitsEvent()` to OctantModule.t.sol using a mock vault that reverts on `process_report`.

### 2. CRITICAL: Test Yield Routing Fallback Paths

**Lines:** `Yield.sol:683, 715`
**Risk:** Real money stuck in escrow if fraction purchase or Juicebox payment fails.

Add tests for:
- `_purchaseFraction` when `buyFraction()` reverts -> verify funds escrowed + `YieldAccumulated` emitted
- `_routeToJuicebox` when `pay()` reverts -> verify fallback to treasury + `YieldStranded` emitted
- Verify `withdrawEscrowedFractions()` admin recovery works after escrow

### 3. HIGH: Test GardenAccount Auto-Stake Failure

**Line:** `GardenAccount.sol:382`
**Risk:** Gardener joins but community staking fails silently.

Add `test_joinGarden_stakeFails_gardenerStillGranted()` using a mock that reverts on `stakeAndRegisterMember()`.

### 4. HIGH: Test ENS Registration Failure During Mint

**Line:** `GardenToken.sol:376`
**Risk:** ENS slug silently lost during garden mint.

Add `test_mintGarden_ensRegistrationFails_gardenStillCreated()` and consider adding an `ENSRegistrationFailed` event in the catch block.

### 5. HIGH: Test Gardens Reset + Pool Registration Catch Paths

**Lines:** `Gardens.sol:398, 632`
**Risk:** Admin recovery paths have untested catch branches.

Add `test_resetGardenInitialization_powerRegistryFails()` and `test_registerPoolsInPowerRegistry_singlePoolFails()`.

---

## Mock vs. Real Contract Coverage Matrix

| Module | Unit (Mock) | Integration (Mixed) | Fork (Real) | Gap? |
|--------|------------|--------------------|----|------|
| GardenToken | YES | YES FullModuleWiring | YES FullProtocolE2E | No |
| GardenAccount | YES | YES GardenJoin | YES FullProtocolE2E | **Auto-stake catch** |
| HatsModule | YES | YES HatsModule integration | YES Hats fork (3 chains) | No |
| ActionRegistry | YES | YES FullModuleWiring | YES FullProtocolE2E | No |
| GardensModule | YES | YES GardensV2Community | YES ArbitrumGardensModule | **Reset + pool reg** |
| OctantModule | YES | YES OctantVaultIntegration | Partial (no harvest) | **Harvest cascade** |
| YieldResolver | YES | YES YieldFlowE2E | Partial (no JB/HC) | **Fraction + JB fallback** |
| KarmaGAPModule | YES | YES HatsGAPIntegration | No fork test | **Admin sync** |
| CookieJarModule | YES | YES FullModuleWiring | No fork test | MockFactory only |
| HypercertAdapter | YES | No integration | No fork test | **No real exchange** |
| GreenGoodsENS | YES | No integration | No fork test | **No real CCIP** |
| ENSReceiver | YES | No integration | No fork test | L1 only |
| WorkResolver | YES | YES FullProtocolE2E | YES FullProtocolE2E | No |
| WorkApprovalResolver | YES | YES FullProtocolE2E | YES FullProtocolE2E | No |
| AssessmentResolver | YES | YES FullProtocolE2E | YES FullProtocolE2E | No |

---

## Architectural Observations

### Graceful Degradation Design (Correct)

The protocol's try-catch architecture follows a deliberate pattern: **garden minting is the sacred operation that must never revert**. All module callbacks during `_initializeGardenModules()` are wrapped in try-catch so that a failure in any optional module (Karma, Octant, Gardens V2, CookieJar, ENS) doesn't prevent garden creation.

This is sound architecture — but it means **silent failures are by design**, and monitoring/alerting is the responsibility of the operator layer. The protocol currently emits events for some failures (`GardenPartiallyInitialized`, `PoolCreationFailed`, `GAPOperationFailed`) but NOT for:
- KarmaGAP project creation failure during mint
- Octant vault setup failure during mint
- CookieJar creation failure during mint
- ENS registration failure during mint
- ActionRegistry domain mask failure during mint

### Recovery Paths (Need Testing)

The protocol provides admin recovery for partial initialization:
- `GardensModule.resetGardenInitialization()` -> untested catch path
- `GardensModule.retryCreateCommunity()` -> tested
- `GardensModule.retryCreatePools()` -> tested
- `GardensModule.createGardenPools()` -> tested
- `YieldResolver.withdrawEscrowedFractions()` -> untested with escrowed funds

---

## Appendix: DeploymentBase Try-Catch (Test Infrastructure)

These are in the test helper, not production, but affect fork test behavior:

| Line | Expression | Catch | Purpose |
|------|-----------|-------|---------|
| 350 | `Deployment.addToAllowlist()` | Ignore failure | Deployer may not need allowlist |
| 1018 | `vm.envUint("ENS_SPONSOR_FUND")` | Default 0.01 ETH | Optional env var |
| 1027 | `vm.envAddress("ENS_L1_RECEIVER")` | Default address(0) | Cross-chain chicken-and-egg |

ForkTestBase additional:

| Line | Expression | Catch | Purpose |
|------|-----------|-------|---------|
| 91 | `vm.envString(primaryVar)` | Try fallback var | RPC URL resolution |
| 97 | `vm.envString(fallbackVar)` | Return "" | RPC URL fallback |

These are all acceptable — test infrastructure should gracefully handle missing env vars.
