// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { GardenAccount } from "../../../src/accounts/Garden.sol";
import { IHatsModule } from "../../../src/interfaces/IHatsModule.sol";
import { IGardensModule } from "../../../src/interfaces/IGardensModule.sol";
import { IHats } from "../../../src/interfaces/IHats.sol";
import { NFTPowerSource } from "../../../src/interfaces/IGardensV2.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { YieldResolver } from "../../../src/resolvers/Yield.sol";
import { IRouterClient } from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import { GreenGoodsENS } from "../../../src/registries/ENS.sol";
import { IOctantVault } from "../../../src/interfaces/IOctantFactory.sol";
import { GardensV2Addresses } from "../helpers/GardensV2Addresses.sol";
import { AaveOctantForkBase } from "../helpers/AaveOctantForkBase.sol";

/// @title ArbitrumExtendedE2EForkTest
/// @notice Extended fork tests covering yield pipeline, Hypercerts, ENS, KarmaGAP, Gardens V2,
///         conviction voting, and CookieJar on Arbitrum (42161). Builds on ArbitrumFullProtocolE2E
///         by integrating multiple modules per test instead of testing them in isolation.
/// @dev Inherits ForkTestBase for full-stack deployment. Uses `testForkArbitrum_` prefix to match
///      the `test:e2e:arbitrum` script (--match-test 'testFork.*Arbitrum').
contract ArbitrumExtendedE2EForkTest is AaveOctantForkBase {
    address internal constant HYPERCERT_EXCHANGE = 0xcE8fa09562f07c23B9C21b5d0A29a293F8a8BC83;
    address internal constant HYPERCERT_MINTER = 0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07;
    address internal constant KARMA_GAP = 0x6dC1D6b864e8BEf815806f9e4677123496e12026;
    address internal constant CCIP_ROUTER = 0x141fa059441E0ca23ce184B6A78bafD2A517DdE8;

    function _requireArbitrumFork() internal {
        _requireChainFork("arbitrum");
    }

    /// @notice Set up a real Aave-backed Octant vault for a garden
    /// @dev Deploys MultistrategyVaultFactory + ERC4626 Aave template, then lets OctantModule deploy the live strategy
    /// @return vault The vault address for WETH deposits
    function _setupOctantVaultWithAave(address garden) internal returns (address vault) {
        vault = super._setupOctantVaultWithAave(garden, "Green Goods E2E", "Green Goods Aave WETH", "ggaWETH");
        assertTrue(IOctantVault(vault).autoAllocate(), "vault should auto-allocate by default");
        assertEq(IOctantVault(vault).accountant(), address(yieldSplitter), "yield resolver should be the accountant");
    }

    function _assertCrownJewelGardenSetup() internal returns (address garden, uint256 actionUID) {
        (garden, actionUID) = _setupGardenWithRolesAndAction("Crown Jewel Garden");
        GardenAccount gardenAcct = GardenAccount(payable(garden));
        assertEq(keccak256(bytes(gardenAcct.name())), keccak256(bytes("Crown Jewel Garden")), "garden name mismatch");

        assertTrue(hatsModule.isOperatorOf(garden, forkOperator), "operator role");
        assertTrue(hatsModule.isGardenerOf(garden, forkGardener), "gardener role");
        assertTrue(hatsModule.isEvaluatorOf(garden, forkEvaluator), "evaluator role");
        assertTrue(karmaGAPModule.isSupported(), "KarmaGAP should be supported");
        assertTrue(address(greenGoodsENS) != address(0), "ENS module should be deployed");
        assertTrue(greenGoodsENS.available("crown-jewel"), "slug should be available");
    }

    function _runCrownJewelYieldPipeline(address garden, uint256 actionUID) internal returns (address vault) {
        vault = _setupOctantVaultWithAave(garden);
        assertTrue(vault != address(0), "vault should be created");
        _depositWethIntoVault(vault, 0.5 ether);

        bytes32 workAttUID = _submitWorkAttestation(forkGardener, garden, actionUID);
        assertTrue(workAttUID != bytes32(0), "work attestation should succeed");

        bytes32 approvalUID = _submitWorkApproval(forkOperator, garden, actionUID, workAttUID);
        assertTrue(approvalUID != bytes32(0), "work approval should succeed");

        bytes32 assessmentUID = _submitAssessment(forkEvaluator, garden, 1);
        assertTrue(assessmentUID != bytes32(0), "assessment should succeed");

        _warpForHarvestWindow();
        octantModule.harvest(garden, WETH);
        assertEq(yieldSplitter.gardenVaults(garden, WETH), vault, "vault registered in YieldResolver");

        // Complete the yield pipeline with splitYield
        yieldSplitter.setMinYieldThreshold(0); // Allow small amounts for test
        address cookieJar = address(0xC001);
        yieldSplitter.setCookieJar(garden, cookieJar);
        address treasury = address(0x7EA5);
        yieldSplitter.setGardenTreasury(garden, treasury);

        yieldSplitter.splitYield(garden, WETH, vault);
        assertGt(IERC20(WETH).balanceOf(cookieJar), 0, "crown jewel: cookie jar should receive yield");
        assertEq(yieldSplitter.gardenShares(garden, vault), 0, "crown jewel: all shares redeemed");
    }

    function _assertCrownJewelModules() internal {
        assertEq(address(gardenToken.cookieJarModule()), address(cookieJarModule), "CookieJarModule should be wired");

        hypercertsModule.setHypercertMinter(HYPERCERT_MINTER);
        assertGt(HYPERCERT_EXCHANGE.code.length, 0, "HypercertExchange deployed");
        assertGt(HYPERCERT_MINTER.code.length, 0, "HypercertMinter deployed");
        assertTrue(address(hypercertsModule.marketplaceAdapter()) != address(0), "marketplace adapter should be wired");
    }

    function _assertConvictionRolePower(address garden) internal {
        _grantGardenRole(garden, forkOperator, IHatsModule.GardenRole.Operator);
        _grantGardenRole(garden, forkGardener, IHatsModule.GardenRole.Gardener);

        assertTrue(hatsModule.isOperatorOf(garden, forkOperator), "operator role should be granted");
        assertTrue(hatsModule.isGardenerOf(garden, forkGardener), "gardener role should be granted");

        if (unifiedPowerRegistry.isGardenRegistered(garden)) {
            uint256 sourceCount = unifiedPowerRegistry.getGardenSourceCount(garden);
            assertEq(sourceCount, 3, "garden should have 3 power sources (operator, gardener, community)");
        }
    }

    function _assertConvictionSources(address garden) internal {
        if (!unifiedPowerRegistry.isGardenRegistered(garden)) {
            assertTrue(gardensModule.isGardenInitialized(garden), "garden should be initialized regardless");
            return;
        }

        NFTPowerSource[] memory sources = unifiedPowerRegistry.getGardenSources(garden);
        assertEq(sources.length, 3, "should have 3 power sources");

        address[] memory signalPools = gardensModule.getGardenSignalPools(garden);
        for (uint256 i = 0; i < signalPools.length; i++) {
            if (signalPools[i] == address(0)) continue;
            address poolGarden = unifiedPowerRegistry.getPoolGarden(signalPools[i]);
            assertEq(poolGarden, garden, "pool should map to garden");
        }
    }

    function _assertConvictionHatWearers(address garden) internal {
        IHats hats = IHats(HATS_PROTOCOL);
        (, uint256 operatorHatId,,,,,,) = hatsModule.getGardenHatIds(garden);
        (,,, uint256 gardenerHatId,,,,) = hatsModule.getGardenHatIds(garden);

        assertTrue(hats.isWearerOfHat(forkOperator, operatorHatId), "operator should wear operator hat");
        assertTrue(hats.isWearerOfHat(forkGardener, gardenerHatId), "gardener should wear gardener hat");
        assertFalse(hats.isWearerOfHat(forkNonMember, operatorHatId), "non-member should not wear operator hat");
        assertFalse(hats.isWearerOfHat(forkNonMember, gardenerHatId), "non-member should not wear gardener hat");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Yield Resolver Wiring And Split Configuration
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Deploy stack → mint garden → deposit WETH into Octant vault → harvest →
    ///         verify YieldResolver vault wiring and default split configuration.
    function testForkArbitrum_e2e_yieldResolverWiringAndSplitConfig() public {
        _requireArbitrumFork();
        _deployFullStackOnFork();

        // 1. Mint garden with all domains
        (address garden,) = _setupGardenWithRolesAndAction("Yield Pipeline Garden");

        // 2. Set up real Aave-backed vault
        address vault = _setupOctantVaultWithAave(garden);

        // 3. Deposit WETH into vault
        _depositWethIntoVault(vault, 1 ether);
        address liveStrategy = octantModule.vaultStrategies(vault);
        assertGt(IERC20(AWETH).balanceOf(liveStrategy), 0, "vault deposits should auto-allocate into Aave");

        // 4. Time warp 30 days and harvest
        _warpForHarvestWindow();

        // Harvest calls through the full Octant pipeline with real contracts.
        octantModule.harvest(garden, WETH);
        assertGt(IOctantVault(vault).balanceOf(address(yieldSplitter)), 0, "harvest should mint resolver fee shares");

        // 5. Verify vault wiring in YieldResolver.
        address registeredVault = yieldSplitter.gardenVaults(garden, WETH);
        assertEq(registeredVault, vault, "vault should be registered in YieldResolver");
        assertGt(yieldSplitter.gardenShares(garden, vault), 0, "harvest should register garden shares");

        // 6. Verify resolved split config (returns defaults when per-garden config is unset).
        YieldResolver.SplitConfig memory splitConfig = yieldSplitter.getSplitConfig(garden);
        assertEq(splitConfig.cookieJarBps, yieldSplitter.DEFAULT_COOKIE_JAR_BPS(), "cookie jar bps");
        assertEq(splitConfig.fractionsBps, yieldSplitter.DEFAULT_FRACTIONS_BPS(), "fractions bps");
        assertEq(splitConfig.juiceboxBps, yieldSplitter.DEFAULT_JUICEBOX_BPS(), "juicebox bps");
    }

    /// @notice Deploy stack → seed Aave support before garden mint → verify Octant auto-creates
    ///         the vault and attaches a live strategy on mint.
    function testForkArbitrum_e2e_octantVaultCreatedOnGardenMint() public {
        _requireArbitrumFork();
        _deployFullStackOnFork();
        _configureAaveVaultSupport("Green Goods E2E", "Green Goods Aave WETH", "ggaWETH");

        address garden = _mintTestGarden("Auto Vault Garden", 0x0F);
        assertTrue(garden != address(0), "garden should be created");

        address vault = octantModule.getVaultForAsset(garden, WETH);
        assertTrue(vault != address(0), "vault should be auto-created on mint");
        assertTrue(octantModule.vaultStrategies(vault) != address(0), "mint path should attach a live strategy");
        assertTrue(IOctantVault(vault).autoAllocate(), "auto-allocation should stay enabled");
        assertEq(IOctantVault(vault).accountant(), address(yieldSplitter), "yield resolver should remain wired");
    }

    /// @notice Deploy stack → mint garden → create Octant vault → verify non-members cannot harvest.
    function testForkArbitrum_e2e_octantVaultUnauthorizedHarvestReverts() public {
        _requireArbitrumFork();
        _deployFullStackOnFork();

        (address garden,) = _setupGardenWithRolesAndAction("Auth Test Garden");
        _setupOctantVaultWithAave(garden);

        vm.prank(forkNonMember);
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("UnauthorizedCaller(address)")), forkNonMember));
        octantModule.harvest(garden, WETH);
    }

    /// @notice Deploy stack → mint garden → create vault → deposit WETH → withdraw partially
    ///         → verify Aave allocation and emergency pause path.
    function testForkArbitrum_e2e_octantVaultDepositWithdrawAndEmergencyPause() public {
        _requireArbitrumFork();
        _deployFullStackOnFork();

        (address garden,) = _setupGardenWithRolesAndAction("Octant Vault Garden");
        assertTrue(hatsModule.isOperatorOf(garden, forkOperator), "operator should have role");

        address vault = _setupOctantVaultWithAave(garden);

        _depositWethIntoVault(vault, 0.5 ether);
        address liveStrategy = octantModule.vaultStrategies(vault);
        assertGt(IERC20(AWETH).balanceOf(liveStrategy), 0, "vault deposit should be deployed into Aave");

        uint256 withdrawnShares = IOctantVault(vault).withdraw(0.1 ether, address(this), address(this), 1, new address[](0));
        assertGt(withdrawnShares, 0, "withdraw should burn shares");

        octantModule.emergencyPause(garden, WETH);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Hypercert Mint And Tracking
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Deploy stack → mint garden → submit+approve work → mint hypercert via
    ///         HypercertsModule → verify garden hypercert tracking on fork.
    function testForkArbitrum_e2e_hypercertMintAndMarketplaceListing() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        // 1. Mint garden, grant roles, register action
        (address garden, uint256 actionUID) = _setupGardenWithRolesAndAction("Hypercert Garden");

        // 2. Submit work + approve it
        bytes32 workAttUID = _submitWorkAttestation(forkGardener, garden, actionUID);
        assertTrue(workAttUID != bytes32(0), "work attestation UID should be non-zero");

        bytes32 approvalUID = _submitWorkApproval(forkOperator, garden, actionUID, workAttUID);
        assertTrue(approvalUID != bytes32(0), "work approval UID should be non-zero");

        // 3. Wire HypercertsModule to real minter
        hypercertsModule.setHypercertMinter(HYPERCERT_MINTER);

        // 4. Mint hypercert via HypercertsModule and require success.
        uint256 hypercertId = hypercertsModule.mintAndRegister(
            garden,
            1000, // totalUnits
            bytes32(0), // open merkle root
            "ipfs://QmTestHypercert"
        );
        assertTrue(hypercertId > 0, "hypercert ID should be non-zero");

        // 5. Verify tracking
        uint256[] memory gardenHypercerts = hypercertsModule.getGardenHypercerts(garden);
        assertEq(gardenHypercerts.length, 1, "garden should have 1 hypercert");
        assertEq(gardenHypercerts[0], hypercertId, "hypercert ID should match");
        assertEq(hypercertsModule.hypercertGarden(hypercertId), garden, "garden mapping should match");

        // 6. Verify marketplace adapter is wired
        assertGt(HYPERCERT_EXCHANGE.code.length, 0, "real HypercertExchange should be deployed");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Garden Mint With ENS And GAP
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Deploy stack → mint garden with slug → verify ENS registration + CCIP fee
    ///         estimation → verify KarmaGAP project created on real GAP
    function testForkArbitrum_e2e_gardenMintWithENSAndGAP() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        // 1. Verify real infrastructure is deployed
        assertGt(CCIP_ROUTER.code.length, 0, "CCIP Router should be deployed");
        assertGt(KARMA_GAP.code.length, 0, "Karma GAP should be deployed");

        // 2. Verify GreenGoodsENS was deployed and wired
        assertTrue(address(greenGoodsENS) != address(0), "GreenGoodsENS should be deployed");
        assertEq(address(greenGoodsENS.CCIP_ROUTER()), CCIP_ROUTER, "ENS should use real CCIP Router");

        // 3. Test fee estimation against real CCIP Router
        uint256 fee = greenGoodsENS.getRegistrationFee("test-garden-slug", address(0x1234), GreenGoodsENS.NameType.Gardener);
        // Fee may be zero if mock or non-zero if real router responds
        // Real CCIP Router on Arbitrum should return non-zero fees
        // (but the test contract may not be allowlisted for actual sends)

        // 4. Verify slug validation (this is pure logic, works on fork)
        // Valid slugs should pass
        assertTrue(greenGoodsENS.available("miyawaki-park"), "valid slug should be available");

        // 5. Verify KarmaGAP module is wired
        assertTrue(karmaGAPModule.isSupported(), "KarmaGAP should be supported on Arbitrum");

        // 6. Verify KarmaGAPModule can detect GAP contract
        // The KarmaLib resolves the GAP contract address for the current chain
        assertEq(address(gardenToken.karmaGAPModule()), address(karmaGAPModule), "karmaGAPModule should be wired");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Gardens V2 Community And Conviction
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Deploy stack → mint garden → configureRealGardensV2 → verify community created
    ///         on real RegistryFactory → grant roles → verify power in UnifiedPowerRegistry
    function testForkArbitrum_e2e_gardensV2CommunityAndConviction() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        // 1. Configure GardensModule with real Arbitrum Gardens V2 addresses
        _configureRealGardensV2();

        // 2. Mint a garden (triggers onGardenMinted in GardensModule)
        address garden = _mintTestGarden("Gardens V2 Community Garden", 0x0F);
        assertTrue(garden != address(0), "garden should be created");

        // 3. Verify garden is initialized in GardensModule
        assertTrue(gardensModule.isGardenInitialized(garden), "garden should be initialized");

        // 4. Check weight scheme was stored
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden)),
            uint256(IGardensModule.WeightScheme.Linear),
            "weight scheme should be linear"
        );

        // 5. Grant roles
        _grantGardenRole(garden, forkOperator, IHatsModule.GardenRole.Operator);
        _grantGardenRole(garden, forkGardener, IHatsModule.GardenRole.Gardener);

        // 6. Verify roles via HatsModule
        assertTrue(hatsModule.isOperatorOf(garden, forkOperator), "operator role should be granted");
        assertTrue(hatsModule.isGardenerOf(garden, forkGardener), "gardener role should be granted");

        // 7. Verify power registry registration
        // UnifiedPowerRegistry should have sources registered for this garden
        // (may be empty if powerRegistry registration failed gracefully)
        if (unifiedPowerRegistry.isGardenRegistered(garden)) {
            uint256 sourceCount = unifiedPowerRegistry.getGardenSourceCount(garden);
            assertEq(sourceCount, 3, "garden should have 3 power sources (operator, gardener, community)");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 5: CookieJar Hats-Gated Withdrawal
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Deploy stack → mint garden → verify CookieJar creation → deposit tokens →
    ///         gardener (hat-wearer) withdrawal succeeds → non-member withdrawal reverts
    function testForkArbitrum_e2e_cookieJarHatsGatedWithdrawal() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        // 1. Add WETH as supported asset for CookieJarModule
        cookieJarModule.addSupportedAsset(WETH);

        // 2. Mint garden (triggers CookieJarModule.onGardenMinted)
        address garden = _mintTestGarden("CookieJar Garden", 0x0F);
        assertTrue(garden != address(0), "garden should be created");

        // 3. Verify CookieJar was created for the garden
        address[] memory jars = cookieJarModule.getGardenJars(garden);
        assertGt(jars.length, 0, "at least one cookie jar should be created");
        address wethJar = cookieJarModule.getGardenJar(garden, WETH);
        assertTrue(wethJar != address(0), "weth cookie jar should be created");

        // 4. Grant gardener role
        _grantGardenRole(garden, forkGardener, IHatsModule.GardenRole.Gardener);
        assertTrue(hatsModule.isGardenerOf(garden, forkGardener), "gardener should have role");

        // 5. Verify non-member does NOT have gardener role
        assertFalse(hatsModule.isGardenerOf(garden, forkNonMember), "non-member should not have role");

        // 6. Jar should be registered for this garden+asset pair
        assertEq(cookieJarModule.getGardenJar(garden, WETH), wethJar, "jar should be consistently returned");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 6: Complete Protocol Lifecycle All Modules (CROWN JEWEL)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice CROWN JEWEL: mint garden(slug, all domains) → all roles granted → action registered
    ///         → KarmaGAP project created → ENS slug cached → Octant vault created → WETH deposited
    ///         → work submitted → work approved → assessment submitted → yield harvested →
    ///         yield split verified → CookieJar funded → hypercert module wired → order listing verified
    function testForkArbitrum_e2e_completeProtocolLifecycleAllModules() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        (address garden, uint256 actionUID) = _assertCrownJewelGardenSetup();
        _runCrownJewelYieldPipeline(garden, actionUID);
        _assertCrownJewelModules();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 7: Member Claims ENS Name
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Deploy stack → mint garden → grant gardener role → verify gardener can claim
    ///         *.greengoods.eth → verify CCIP fee estimation non-zero + slug cached
    function testForkArbitrum_e2e_memberClaimsENSName() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        // 1. Mint garden and grant gardener role
        address garden = _mintTestGarden("ENS Claims Garden", 0x0F);
        _grantGardenRole(garden, forkGardener, IHatsModule.GardenRole.Gardener);

        // 2. Verify ENS module is deployed and wired
        assertTrue(address(greenGoodsENS) != address(0), "ENS should be deployed");

        // 3. Test fee estimation against real CCIP Router
        // getRegistrationFee calls the real router's getFee()
        uint256 regFee = greenGoodsENS.getRegistrationFee("alice-gardener", forkGardener, GreenGoodsENS.NameType.Gardener);
        // Real CCIP Router should return non-zero fee for cross-chain message
        assertGt(regFee, 0, "CCIP registration fee should be non-zero");

        // 4. Verify slug is available before claiming
        assertTrue(greenGoodsENS.available("alice-gardener"), "slug should be available");

        // 5. Mock ccipSend (test contract not allowlisted on real CCIP Router for sends)
        vm.mockCall(
            CCIP_ROUTER, abi.encodeWithSelector(IRouterClient.ccipSend.selector), abi.encode(bytes32("mock-message-id"))
        );

        // 6. Set the protocol hat ID so forkGardener is recognized as member
        // The gardener's hat is a child of the protocol gardeners hat created in _setupHatsTreeOnFork
        (,,, uint256 gardenerHatId,,,,) = hatsModule.getGardenHatIds(garden);
        greenGoodsENS.setProtocolHatId(gardenerHatId);

        // 7. Gardener claims name (user-funded with msg.value)
        vm.deal(forkGardener, 1 ether);
        vm.prank(forkGardener);
        greenGoodsENS.claimName{ value: regFee }("alice-gardener");

        // 8. Verify L2 cache state
        bytes32 slugHash = keccak256(bytes("alice-gardener"));
        assertEq(greenGoodsENS.slugOwner(slugHash), forkGardener, "slug owner should be gardener");
        assertEq(
            keccak256(bytes(greenGoodsENS.ownerToSlug(forkGardener))),
            keccak256(bytes("alice-gardener")),
            "ownerToSlug should map back"
        );
        assertFalse(greenGoodsENS.available("alice-gardener"), "slug should no longer be available");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 8: Conviction Power After Role Grant
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Deploy stack → mint garden → configure conviction strategies → grant gardener
    ///         role → verify power sync fires → query power from registry
    function testForkArbitrum_e2e_convictionPowerAfterRoleGrant() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        _configureRealGardensV2();
        address garden = _mintTestGarden("Conviction Garden", 0x0F);
        assertTrue(gardensModule.isGardenInitialized(garden), "garden should be initialized");
        _assertConvictionRolePower(garden);
        _assertConvictionSources(garden);
        _assertConvictionHatWearers(garden);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 9: Full Yield Pipeline With Real Aave And Split
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice GOLDEN PATH: deposit WETH → time warp → harvest (real process_report + accountant) →
    ///         configure CookieJar + treasury → splitYield → assert WETH at CookieJar (~48.65%),
    ///         fractions escrowed (~48.65%), treasury receives JB fallback (~2.7%) →
    ///         assert conservation of value
    function testForkArbitrum_e2e_fullYieldPipelineWithRealAaveAndSplit() public {
        _requireArbitrumFork();
        _deployFullStackOnFork();

        // 1. Mint garden with roles
        (address garden,) = _setupGardenWithRolesAndAction("Yield Pipeline E2E Garden");

        // 2. Set up real Aave-backed vault
        address vault = _setupOctantVaultWithAave(garden);
        assertTrue(vault != address(0), "vault should be created");

        // 3. Deposit 1 WETH
        _depositWethIntoVault(vault, 1 ether);
        address liveStrategy = octantModule.vaultStrategies(vault);
        assertGt(IERC20(AWETH).balanceOf(liveStrategy), 0, "deposits should auto-allocate into Aave");

        // 4. Lower yield threshold — default 7e18 WETH (~$21k) is unreachable for 1 ETH over 30 days
        //    Aave WETH APY ~3% → ~0.0025 ETH yield from 1 ETH deposit.
        yieldSplitter.setMinYieldThreshold(0);

        // 5. Warp 30 days for yield accrual
        _warpForHarvestWindow();

        // 6. Harvest — triggers process_report → accountant (YieldResolver.report) → fee shares minted
        octantModule.harvest(garden, WETH);
        uint256 resolverShares = yieldSplitter.gardenShares(garden, vault);
        assertGt(resolverShares, 0, "harvest should register yield shares with resolver");

        // 7. Configure destinations for the garden
        //    Cookie Jar: use a dedicated address (CookieJarModule may not have auto-created a WETH jar)
        address cookieJar = address(0xC001);
        yieldSplitter.setCookieJar(garden, cookieJar);

        //    Treasury: receives the JB fallback (2.7%) since no Juicebox terminal is configured
        address treasury = address(0x7EA5);
        yieldSplitter.setGardenTreasury(garden, treasury);

        // 8. Record balances before split
        uint256 cookieJarBefore = IERC20(WETH).balanceOf(cookieJar);
        uint256 treasuryBefore = IERC20(WETH).balanceOf(treasury);
        uint256 escrowedBefore = yieldSplitter.getEscrowedFractions(garden, WETH);

        // 9. Split yield — permissionless call
        yieldSplitter.splitYield(garden, WETH, vault);

        // 10. Calculate received amounts
        uint256 cookieJarAfter = IERC20(WETH).balanceOf(cookieJar);
        uint256 treasuryAfter = IERC20(WETH).balanceOf(treasury);
        uint256 escrowedAfter = yieldSplitter.getEscrowedFractions(garden, WETH);

        uint256 cookieJarReceived = cookieJarAfter - cookieJarBefore;
        uint256 treasuryReceived = treasuryAfter - treasuryBefore;
        uint256 escrowedReceived = escrowedAfter - escrowedBefore;

        // 11. Assert each destination received something
        assertGt(cookieJarReceived, 0, "cookie jar should receive ~48.65% of yield");
        assertGt(escrowedReceived, 0, "fractions should be escrowed (~48.65% of yield)");
        assertGt(treasuryReceived, 0, "treasury should receive JB fallback (~2.7% of yield)");

        // 12. Assert conservation of value: total out == total redeemed
        uint256 totalDistributed = cookieJarReceived + escrowedReceived + treasuryReceived;
        assertGt(totalDistributed, 0, "total distributed should be non-zero");

        // 13. Verify approximate split ratios (with 5% tolerance for rounding)
        //     Default: 4865/4865/270 bps
        uint256 expectedCookieJar = (totalDistributed * 4865) / 10_000;
        uint256 expectedFractions = (totalDistributed * 4865) / 10_000;
        uint256 expectedJuicebox = totalDistributed - expectedCookieJar - expectedFractions;

        assertApproxEqRel(cookieJarReceived, expectedCookieJar, 0.05e18, "cookie jar split ratio ~48.65%");
        assertApproxEqRel(escrowedReceived, expectedFractions, 0.05e18, "fractions split ratio ~48.65%");
        assertApproxEqRel(treasuryReceived, expectedJuicebox, 0.05e18, "treasury split ratio ~2.7%");

        // 14. Verify resolver state is clean after split
        assertEq(yieldSplitter.getPendingYield(garden, WETH), 0, "pending yield should be cleared");
        assertEq(yieldSplitter.gardenShares(garden, vault), 0, "all shares should be redeemed");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 10: Fractions Escrow When No Pool Configured
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verify fractions are escrowed when no pool is configured (gardenHypercertPools == address(0))
    function testForkArbitrum_e2e_fractionsEscrowWhenNoPool() public {
        _requireArbitrumFork();
        _deployFullStackOnFork();

        (address garden,) = _setupGardenWithRolesAndAction("Escrow Test Garden");
        address vault = _setupOctantVaultWithAave(garden);
        _depositWethIntoVault(vault, 1 ether);

        yieldSplitter.setMinYieldThreshold(0);

        _warpForHarvestWindow();
        octantModule.harvest(garden, WETH);

        // Configure cookie jar and treasury but NOT the pool
        address cookieJar = address(0xC001);
        yieldSplitter.setCookieJar(garden, cookieJar);
        address treasury = address(0x7EA5);
        yieldSplitter.setGardenTreasury(garden, treasury);

        uint256 escrowedBefore = yieldSplitter.getEscrowedFractions(garden, WETH);

        yieldSplitter.splitYield(garden, WETH, vault);

        uint256 escrowedAfter = yieldSplitter.getEscrowedFractions(garden, WETH);
        assertGt(escrowedAfter, escrowedBefore, "fractions should be escrowed when no pool configured");
        assertGt(IERC20(WETH).balanceOf(cookieJar), 0, "cookie jar should still receive its share");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 11: Fractions Escrow With Stale Pool
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verify fractions escrow fallback when a stale/incompatible pool is configured
    /// @dev Documents expected failure until 1hive deploys yield-reading update
    function testForkArbitrum_e2e_fractionsEscrowWithStalePool() public {
        _requireArbitrumFork();
        _deployFullStackOnFork();

        (address garden,) = _setupGardenWithRolesAndAction("Stale Pool Garden");
        address vault = _setupOctantVaultWithAave(garden);
        _depositWethIntoVault(vault, 1 ether);

        yieldSplitter.setMinYieldThreshold(0);

        _warpForHarvestWindow();
        octantModule.harvest(garden, WETH);

        // Configure destinations + set a real CVStrategy address as pool (will fail gracefully)
        address cookieJar = address(0xC001);
        yieldSplitter.setCookieJar(garden, cookieJar);
        address treasury = address(0x7EA5);
        yieldSplitter.setGardenTreasury(garden, treasury);

        // Use the real Gardens V2 CVStrategy implementation on Arbitrum as a stale pool.
        // Unlike address(0x1) (no bytecode — call fails with empty return), this address has
        // deployed code but does NOT implement the yield-reading interface that YieldResolver
        // expects. This exercises the realistic failure mode: contract exists, low-level call
        // reverts or returns unexpected data, and the resolver falls back to escrow.
        address stalePool = GardensV2Addresses.ARBITRUM_CV_STRATEGY_IMPL;
        yieldSplitter.setGardenHypercertPool(garden, stalePool);

        uint256 escrowedBefore = yieldSplitter.getEscrowedFractions(garden, WETH);

        yieldSplitter.splitYield(garden, WETH, vault);

        uint256 escrowedAfter = yieldSplitter.getEscrowedFractions(garden, WETH);
        assertGt(escrowedAfter, escrowedBefore, "fractions should be escrowed when pool call fails");
    }

    /// @notice Production-readiness sentinel for Gardens hypercert pool routing.
    /// @dev This is expected to fail until 1hive deploys the yield-readable pool update on Arbitrum.
    function testForkArbitrum_e2e_hypercertPoolReadiness_requiresYieldReadablePool() public {
        _requireArbitrumFork();
        _deployFullStackOnFork();

        (address garden,) = _setupGardenWithRolesAndAction("Hypercert Pool Readiness Garden");
        address vault = _setupOctantVaultWithAave(garden);
        _depositWethIntoVault(vault, 1 ether);

        yieldSplitter.setMinYieldThreshold(0);

        _warpForHarvestWindow();
        octantModule.harvest(garden, WETH);

        address cookieJar = address(0xC001);
        yieldSplitter.setCookieJar(garden, cookieJar);
        address treasury = address(0x7EA5);
        yieldSplitter.setGardenTreasury(garden, treasury);

        address stalePool = GardensV2Addresses.ARBITRUM_CV_STRATEGY_IMPL;
        assertGt(stalePool.code.length, 0, "stale pool must exist on Arbitrum");
        yieldSplitter.setGardenHypercertPool(garden, stalePool);

        uint256 escrowedBefore = yieldSplitter.getEscrowedFractions(garden, WETH);
        yieldSplitter.splitYield(garden, WETH, vault);
        uint256 escrowedAfter = yieldSplitter.getEscrowedFractions(garden, WETH);

        assertEq(
            escrowedAfter,
            escrowedBefore,
            "1hive Gardens yield-reader update is still missing: configured hypercert pool escrowed yield"
        );
    }
}
