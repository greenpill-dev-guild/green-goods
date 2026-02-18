# Fork Test Gap Remediation Plan

**Date:** 2026-02-17
**Branch:** `feature/ens-integration`
**Complements:** `full-protocol-e2e-fork-coverage.md`
**Scope:** Sepolia + Arbitrum + Ethereum L1 (Celo and Unlock excluded)
**Status:** Ready for implementation

---

## Context

A comprehensive fork test coverage review identified 12 gaps across the protocol. This plan addresses the 9 selected gaps (items 1, 2, 3, 5, 6, 7, 8, 10, 11 from the review). The existing ~176 fork tests cover most modules well but leave core contracts (GardenToken, GardenAccount, ActionRegistry), the GoodsToken, chain parity (ConvictionVoting on Sepolia, Gardens V2 on Arbitrum), and cross-cutting scenarios (multi-garden isolation, cross-chain ENS) without dedicated coverage.

**What this plan does NOT cover (excluded by choice):**
- Gap 4: Yield pipeline on Sepolia (Arbitrum-only is acceptable since Aave/Octant/JB are mainnet-only)
- Gap 9: UUPS upgrade path tests
- Gap 12: DeploymentRegistry standalone tests

---

## Gap 1: Guardian Contract

**Finding:** Guardian is referenced in project documentation but **does not exist as a contract** in `packages/contracts/src/`. No `Guardian.sol` file found.

**Action:** Skip — no test can be written for a non-existent contract. If Guardian is implemented in future, fork tests should be added as part of that feature work. Track this as a future implementation item, not a test gap.

---

## Gap 2: GardenToken Dedicated Fork Test

**Problem:** GardenToken is the protocol's central orchestrator (`mintGarden` calls 6+ module callbacks) but has no standalone fork test. It's only exercised transitively through E2E tests.

**Missing coverage:**
- UUPS upgrade path on fork (deploy V1 → upgrade V2 → verify state preservation)
- Module callback isolation (what happens when callback 3 of 5 reverts mid-mint?)
- Transfer restriction modes (`Unrestricted`, `OwnerOnly`, `Locked`)
- `failedENSRefunds` and `totalPendingENSRefunds` accounting
- ERC-721 enumeration with real chain state

### New file: `test/fork/ArbitrumGardenToken.t.sol`

Inherits `ForkTestBase`. Deploys full stack on Arbitrum fork.

| # | Test | What It Validates |
|---|------|-------------------|
| 1 | `testForkArbitrum_mintGarden_callbackOrdering` | All 6 module callbacks fire in correct order: Hats tree → GardenAccount init → GardensModule community → KarmaGAP project → CookieJar → ENS. Verify via event emission ordering. |
| 2 | `testForkArbitrum_mintGarden_singleCallbackReverts_gracefulDegradation` | Set one module (e.g. KarmaGAP) to a reverting mock. Mint should still succeed with other modules wired. Verify the reverting module's state is zero/empty. |
| 3 | `testForkArbitrum_transferRestriction_locked` | Set `transferRestriction = Locked`. Transfer between non-owner accounts reverts. Owner transfer still works. |
| 4 | `testForkArbitrum_transferRestriction_ownerOnly` | Set `transferRestriction = OwnerOnly`. Only token owner can transfer. Approved operator transfer reverts. |
| 5 | `testForkArbitrum_failedENSRefund_accounting` | Simulate failed ENS registration (insufficient CCIP fee). Verify `failedENSRefunds[minter]` increments. Claim refund, verify balance decrements. |
| 6 | `testForkArbitrum_mintGarden_incrementsTokenId` | Mint 3 gardens sequentially. Token IDs increment correctly. Each TBA address is unique. |
| 7 | `testForkArbitrum_setModuleAddress_onlyOwner` | Non-owner calling `setHatsModule`, `setGardensModule`, etc. reverts. Owner succeeds. |

**7 tests**

### New file: `test/fork/SepoliaGardenToken.t.sol`

Mirror of ArbitrumGardenToken with Sepolia fork. Subset of tests (skip transfer restriction since that's chain-independent logic):

| # | Test | What It Validates |
|---|------|-------------------|
| 1 | `test_fork_mintGarden_callbackOrdering` | Same as Arbitrum test 1 |
| 2 | `test_fork_mintGarden_singleCallbackReverts_gracefulDegradation` | Same as Arbitrum test 2 |
| 3 | `test_fork_mintGarden_incrementsTokenId` | Same as Arbitrum test 6 |
| 4 | `test_fork_failedENSRefund_accounting` | Same as Arbitrum test 5 |

**4 tests**

---

## Gap 3: GardenAccount Dedicated Fork Test

**Problem:** GardenAccount (`AccountV3Upgradable` + `Initializable`) is the ERC-6551 token-bound account that every garden operates through. Only tested transitively (TBAs created during mint, used as `councilSafe`).

**Missing coverage:**
- `execute()` / `executeBatch()` against real contract targets
- Access control: owner vs operator vs gardener permissions
- Metadata setters (name, description, location, bannerImage, communityToken)
- Role delegation via `IGardenAccessControl`
- Garden capacity (`GardenFull` error)
- Invite system (`InvalidInvite`, `AlreadyGardener` errors)

### New file: `test/fork/ArbitrumGardenAccount.t.sol`

Inherits `ForkTestBase`. Deploys full stack, mints a garden, then tests the TBA directly.

| # | Test | What It Validates |
|---|------|-------------------|
| 1 | `testForkArbitrum_execute_ownerCanCallExternalContract` | Garden owner calls `execute()` targeting a real ERC20 `transfer`. Verify tokens moved. |
| 2 | `testForkArbitrum_execute_nonOwnerReverts` | `forkGardener` (not owner) calling `execute()` reverts with `NotGardenOwner`. |
| 3 | `testForkArbitrum_execute_operatorCanCallAllowed` | Operator executes permitted call through account. |
| 4 | `testForkArbitrum_metadataSetters_ownerUpdates` | Owner calls `setName`, `setDescription`, `setLocation`, `setBannerImage`. Events emitted, state updated. |
| 5 | `testForkArbitrum_metadataSetters_nonOwnerReverts` | Non-owner calling metadata setters reverts. |
| 6 | `testForkArbitrum_communityTokenUpdate` | Owner calls `setCommunityToken`. Event emitted, getter returns new address. |
| 7 | `testForkArbitrum_gardenFull_reverts` | Set garden capacity, fill it, then attempt one more join → `GardenFull`. |
| 8 | `testForkArbitrum_invalidInvite_reverts` | Attempt to join with invalid/expired invite code → `InvalidInvite`. |
| 9 | `testForkArbitrum_alreadyGardener_reverts` | Gardener attempts to join same garden twice → `AlreadyGardener`. |
| 10 | `testForkArbitrum_roleCheck_delegatesToHatsModule` | `isOperator()`, `isGardener()`, `isEvaluator()` all delegate to real Hats Protocol on fork. Verify correct responses for each role. |

**10 tests**

---

## Gap 5: ActionRegistry Dedicated Fork Test

**Problem:** ActionRegistry (UUPS proxy) is only exercised via `_registerTestAction()` helper. No dedicated fork test for the full lifecycle.

**Missing coverage:**
- Full CRUD lifecycle (create → read → update → disable → re-enable)
- Domain mask validation
- Capital type enforcement
- Authorization (only GardenToken owner can register)
- Disabled action prevents EAS work attestation (cross-module)

### New file: `test/fork/ArbitrumActionRegistry.t.sol`

Inherits `ForkTestBase`.

| # | Test | What It Validates |
|---|------|-------------------|
| 1 | `testForkArbitrum_registerAction_fullLifecycle` | Register action with all domain flags → read back → update metadata → disable → verify disabled → re-enable → verify enabled. |
| 2 | `testForkArbitrum_registerAction_domainMaskValidation` | Register action with domain=0 (invalid) → reverts. Register with max domain bitmask → succeeds. |
| 3 | `testForkArbitrum_registerAction_capitalTypes` | Register actions with each `Capital` variant. Verify stored correctly. |
| 4 | `testForkArbitrum_registerAction_unauthorizedReverts` | Non-owner calling `registerAction` → reverts. |
| 5 | `testForkArbitrum_disabledAction_blocksWorkAttestation` | Register action → disable it → attempt work attestation via real EAS → WorkResolver rejects with disabled action error. |
| 6 | `testForkArbitrum_multipleActions_sameGarden` | Register 3 actions for same garden. Each has unique UID. All queryable. |
| 7 | `testForkArbitrum_actionRegistry_uupsUpgrade` | Deploy V1 → register action → upgrade to V2 → verify action still queryable → verify new V2 function available. |

**7 tests**

### New file: `test/fork/SepoliaActionRegistry.t.sol`

Subset for Sepolia:

| # | Test | What It Validates |
|---|------|-------------------|
| 1 | `test_fork_registerAction_fullLifecycle` | Same as Arbitrum test 1 |
| 2 | `test_fork_disabledAction_blocksWorkAttestation` | Same as Arbitrum test 5 (cross-module with real Sepolia EAS) |
| 3 | `test_fork_registerAction_unauthorizedReverts` | Same as Arbitrum test 4 |

**3 tests**

---

## Gap 6: ConvictionVoting Sepolia Parity

**Problem:** Sepolia has 3 conviction tests vs Arbitrum's 9. The full conviction flow, multiple voters, deregister, and deallocate are Arbitrum-only.

### Modified file: `test/fork/SepoliaConvictionVoting.t.sol`

Add 6 tests to match Arbitrum parity:

| # | Test | What It Validates | Status |
|---|------|-------------------|--------|
| 1 | `test_fork_conviction_strategyRegisteredOnGardenMint` | Strategy wired after garden creation | **Exists** |
| 2 | `test_fork_conviction_powerSyncOnRoleGrant` | Role grant triggers power sync | **Exists** |
| 3 | `test_fork_conviction_powerSyncOnRoleRevoke` | Role revoke zeroes power | **Exists** |
| 4 | `test_fork_conviction_fullConvictionFlow` | Register → allocate → time warp → calculate conviction | **New** |
| 5 | `test_fork_conviction_multipleVoters` | 3 voters with different Hats-derived power, verify weighted conviction | **New** |
| 6 | `test_fork_conviction_deregisterClearsState` | Deregister voter → conviction zeroed | **New** |
| 7 | `test_fork_conviction_deallocateReducesConviction` | Partial deallocate → conviction decreases proportionally | **New** |
| 8 | `test_fork_conviction_nonEligibleVoterReverts` | Non-member attempts allocate → reverts | **New** |
| 9 | `test_fork_conviction_convictionWeightsAcrossHypercerts` | Conviction weights tied to hypercert fractions | **New** |

**6 new tests (9 total)**

---

## Gap 7: Gardens V2 Community on Arbitrum

**Problem:** 12 tests on Sepolia but only 1 on Arbitrum. Pool creation, staking, retry, and wiring diagnostics are Sepolia-only.

### Modified file: `test/fork/gardens/GardensCommunityGovernance.t.sol`

Add Arbitrum-specific tests (the file already supports multi-chain via `_tryChainFork`):

| # | Test | What It Validates | Status |
|---|------|-------------------|--------|
| 1 | `testForkArbitrum_communityCreation` | Community created on real Arbitrum RegistryFactory | **Exists** |
| 2 | `testForkArbitrum_poolCreation_unlimited` | Create pool with Unlimited point system on Arbitrum | **New** |
| 3 | `testForkArbitrum_memberStaking` | Member stakes GOODS in community on Arbitrum | **New** |
| 4 | `testForkArbitrum_multiMemberStaking` | 3 members stake, verify total staked | **New** |
| 5 | `testForkArbitrum_weightSchemePerGarden` | Different weight schemes stored per garden | **New** |

**4 new tests (5 total for Arbitrum)**

### New or modified: `test/fork/gardens/GardensV2Community.t.sol`

Add Arbitrum variants if this file is Sepolia-only:

| # | Test | What It Validates |
|---|------|-------------------|
| 1 | `testForkArbitrum_communityWithRealFactory` | Community with real Arbitrum RegistryFactory |
| 2 | `testForkArbitrum_retryAfterFactoryUpdate` | Factory address updated → retry community creation succeeds |
| 3 | `testForkArbitrum_isWiringCompleteDiagnostics` | `isWiringComplete()` returns correct diagnostics for partially-wired garden |

**3 new tests**

---

## Gap 8: GoodsToken Fork Test

**Problem:** GoodsToken is deployed as a mock ERC20 in tests. No fork test validates its actual contract logic (hard cap, owner-only mint, burn).

### New file: `test/fork/ArbitrumGoodsToken.t.sol`

Inherits `ForkTestBase`. Deploys GoodsToken as part of full stack, then tests standalone.

| # | Test | What It Validates |
|---|------|-------------------|
| 1 | `testForkArbitrum_goodsToken_initialSupplyMintedToOwner` | Constructor mints `_initialSupply` to owner. `totalSupply() == _initialSupply`. |
| 2 | `testForkArbitrum_goodsToken_maxSupplyEnforced` | Mint up to `maxSupply` succeeds. Mint beyond → `ExceedsMaxSupply` revert. |
| 3 | `testForkArbitrum_goodsToken_onlyOwnerCanMint` | Non-owner calling `mint()` reverts with `OwnableUnauthorizedAccount`. |
| 4 | `testForkArbitrum_goodsToken_burnReducesSupply` | Burn tokens → `totalSupply` decreases. Subsequent mint up to cap succeeds. |
| 5 | `testForkArbitrum_goodsToken_stakingIntegration` | Deploy GoodsToken → configure as community token in GardensModule → member stakes → verify `balanceOf` changes and community state updates. |
| 6 | `testForkArbitrum_goodsToken_maxSupplyZeroReverts` | Deploy with `_maxSupply = 0` → `MaxSupplyZero` revert in constructor. |

**6 tests**

---

## Gap 10: Cross-Chain ENS End-to-End

**Problem:** L2 ENS sender (Sepolia/Arbitrum) and L1 ENS receiver (Ethereum) are tested in isolation. The full CCIP message flow from slug registration to L1 subdomain resolution is never exercised end-to-end.

**Approach:** Use dual-fork simulation. Foundry doesn't natively support cross-chain message passing, so the test will:
1. Fork Arbitrum → call `GreenGoodsENS.registerGarden()` → capture the CCIP message payload
2. Fork Ethereum L1 → call `GreenGoodsENSReceiver.ccipReceive()` directly with the captured payload → verify ENS `addr()` resolution

### New file: `test/fork/CrossChainENS.t.sol`

| # | Test | What It Validates |
|---|------|-------------------|
| 1 | `testForkCrossChain_gardenSlugRegistration_L2toL1` | Arbitrum fork: register garden slug → extract CCIP payload. Ethereum fork: deliver payload to receiver → verify `greengoods.eth` subdomain resolves to garden TBA on real ENS Registry. |
| 2 | `testForkCrossChain_memberNameClaim_L2toL1` | Arbitrum fork: member claims `alice.greengoods.eth` → extract CCIP payload. Ethereum fork: deliver → verify `alice.greengoods.eth` resolves to member address. |
| 3 | `testForkCrossChain_duplicateSlug_L1skips` | Arbitrum fork: register slug. Ethereum fork: deliver same payload twice → second delivery emits `NameRegistrationSkipped`, first resolution unchanged. |
| 4 | `testForkCrossChain_invalidSender_L1reverts` | Fabricate CCIP payload with wrong sender address → receiver reverts with sender validation error. |

**4 tests**

**Implementation note:** Each test creates two forks via `vm.createFork()` and switches between them with `vm.selectFork()`. The CCIP payload is ABI-encoded manually between fork switches since there's no live CCIP relay in test.

---

## Gap 11: Multi-Garden Isolation Test

**Problem:** No test creates multiple gardens on a single fork to verify isolation between shared infrastructure (ActionRegistry) and per-garden state (Hats trees, yield pipelines, CookieJars, ENS slugs).

### New file: `test/fork/ArbitrumMultiGardenIsolation.t.sol`

Inherits `ForkTestBase`. Deploys full stack, mints 3 gardens, tests isolation.

| # | Test | What It Validates |
|---|------|-------------------|
| 1 | `testForkArbitrum_sharedActionRegistry_isolatedActions` | Register action in Garden A. Garden B cannot use Garden A's action UID for work attestation. ActionRegistry is shared but actions are garden-scoped. |
| 2 | `testForkArbitrum_independentHatsTrees` | Garden A and Garden B have separate Hats top-hat IDs. Granting operator in A does not affect B roles. |
| 3 | `testForkArbitrum_independentYieldPipelines` | Garden A deposits WETH → harvest → split. Garden B's CookieJar balance unchanged. |
| 4 | `testForkArbitrum_independentCookieJars` | Garden A's CookieJar withdrawal doesn't affect Garden B's jar balance. |
| 5 | `testForkArbitrum_uniqueENSSlugs` | Garden A registers `alpha.greengoods.eth`. Garden B registers `beta.greengoods.eth`. Both cached. Garden C trying `alpha` → `NameTaken`. |
| 6 | `testForkArbitrum_independentGardensCommunities` | Garden A and B create separate Gardens V2 communities. Each has its own community token and staking pool. |
| 7 | `testForkArbitrum_crossGardenRoleIsolation` | Operator in Garden A attempts to approve work in Garden B → reverts. Gardener in B attempts work in A → reverts. |
| 8 | `testForkArbitrum_independentConvictionPools` | Conviction allocated in Garden A's pool has no effect on Garden B's conviction calculations. |

**8 tests**

---

## Summary

| Gap | New Files | Modified Files | New Tests | Priority |
|-----|-----------|----------------|-----------|----------|
| **1. Guardian** | 0 | 0 | 0 | Skipped (contract doesn't exist) |
| **2. GardenToken** | 2 | 0 | 11 | High |
| **3. GardenAccount** | 1 | 0 | 10 | High |
| **5. ActionRegistry** | 2 | 0 | 10 | Medium |
| **6. ConvictionVoting parity** | 0 | 1 | 6 | Medium |
| **7. Gardens V2 on Arbitrum** | 0 | 2 | 7 | Medium |
| **8. GoodsToken** | 1 | 0 | 6 | Medium |
| **10. Cross-chain ENS** | 1 | 0 | 4 | Low |
| **11. Multi-garden isolation** | 1 | 0 | 8 | Low |
| **Total** | **8 new** | **3 modified** | **62 tests** |  |

Combined with existing ~176 fork tests → **~238 total fork/E2E tests**.

---

## Implementation Order

```
Phase A (High Priority — core contract coverage):
  ├── Gap 2: ArbitrumGardenToken.t.sol + SepoliaGardenToken.t.sol  (11 tests)
  └── Gap 3: ArbitrumGardenAccount.t.sol                           (10 tests)

Phase B (Medium Priority — dedicated module + chain parity):
  ├── Gap 5: ArbitrumActionRegistry.t.sol + SepoliaActionRegistry.t.sol  (10 tests)
  ├── Gap 6: SepoliaConvictionVoting.t.sol (extend)                      (6 tests)
  ├── Gap 7: GardensCommunityGovernance.t.sol + GardensV2Community.t.sol (7 tests)
  └── Gap 8: ArbitrumGoodsToken.t.sol                                    (6 tests)

Phase C (Low Priority — cross-cutting scenarios):
  ├── Gap 10: CrossChainENS.t.sol                                  (4 tests)
  └── Gap 11: ArbitrumMultiGardenIsolation.t.sol                   (8 tests)
```

All phases are independent — Phase B and C can be parallelized. Within each phase, all files are independent and can be written concurrently.

---

## Key Patterns to Follow

| Pattern | Reference File |
|---------|---------------|
| ForkTestBase inheritance + `_tryChainFork` | `test/fork/ArbitrumHats.t.sol` |
| Full stack deploy on fork | `test/fork/e2e/ArbitrumExtendedE2E.t.sol` |
| Graceful skip (no RPC = skip, not fail) | Any fork test — check env var, `emit log("SKIPPED: ...")` |
| Garden lifecycle helpers | `ForkTestBase._mintTestGarden()`, `_grantGardenRole()` |
| Cross-module error path | `test/fork/ArbitrumNegativePaths.t.sol` |
| Dual-fork switching | Foundry `vm.createFork()` + `vm.selectFork()` |
| CookieJar base pattern | `test/fork/helpers/CookieJarForkTestBase.sol` |

---

## Verification

```bash
# All fork tests (requires SEPOLIA_RPC_URL, ARBITRUM_RPC_URL, ETHEREUM_RPC_URL in .env)
cd packages/contracts && bun run test:fork

# Specific new test files
cd packages/contracts && forge test --match-path "test/fork/ArbitrumGardenToken.t.sol" --fork-url $ARBITRUM_RPC_URL -vvv
cd packages/contracts && forge test --match-path "test/fork/CrossChainENS.t.sol" -vvv
cd packages/contracts && forge test --match-path "test/fork/ArbitrumMultiGardenIsolation.t.sol" --fork-url $ARBITRUM_RPC_URL -vvv

# Full contract verification
bun run verify:contracts
```

All new fork tests MUST gracefully skip when RPC URLs are not configured — no CI failures from missing env vars.
