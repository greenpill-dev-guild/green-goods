// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase } from "./helpers/ForkTestBase.sol";
import { ActionRegistry } from "../../src/registries/Action.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { IGardensModule } from "../../src/interfaces/IGardensModule.sol";
import { GreenGoodsENS, NameTaken } from "../../src/registries/ENS.sol";
import { IRouterClient } from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";

/// @title ArbitrumMultiGardenIsolationForkTest
/// @notice Fork tests verifying isolation between 3 gardens deployed on a single Arbitrum fork.
/// @dev Deploys full protocol stack via ForkTestBase, mints 3 gardens (Alpha, Beta, Gamma),
///      and verifies that roles, actions, ENS slugs, communities, and attestations remain isolated.
///      Gracefully skips when ARBITRUM_RPC_URL is not set.
contract ArbitrumMultiGardenIsolationForkTest is ForkTestBase {
    // Garden accounts
    address internal gardenAlpha;
    address internal gardenBeta;
    address internal gardenGamma;

    // Action UIDs (garden-agnostic, registered in shared ActionRegistry)
    uint256 internal actionAlpha;
    uint256 internal actionBeta;

    // Per-garden actors
    address internal alphaOperator;
    address internal betaOperator;
    address internal gammaOperator;

    // ═══════════════════════════════════════════════════════════════════════════
    // Setup
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Full setup: fork Arbitrum → deploy stack → mint 3 gardens with separate roles
    function _setupThreeGardens() internal returns (bool) {
        if (!_tryChainFork("arbitrum")) return false;
        _deployFullStackOnFork();

        // Create per-garden actors (distinct from ForkTestBase actors)
        alphaOperator = makeAddr("alphaOperator");
        betaOperator = makeAddr("betaOperator");
        gammaOperator = makeAddr("gammaOperator");

        // Mint 3 gardens with different domain masks
        gardenAlpha = _mintTestGarden("Alpha Garden", 0x01); // Solar only
        gardenBeta = _mintTestGarden("Beta Garden", 0x02); // Agro only
        gardenGamma = _mintTestGarden("Gamma Garden", 0x04); // Edu only

        // Grant operator roles to garden-specific actors
        _grantGardenRole(gardenAlpha, alphaOperator, IHatsModule.GardenRole.Operator);
        _grantGardenRole(gardenBeta, betaOperator, IHatsModule.GardenRole.Operator);
        _grantGardenRole(gardenGamma, gammaOperator, IHatsModule.GardenRole.Operator);

        // Register 2 actions (global, not per-garden)
        actionAlpha = _registerTestAction();
        actionBeta = _registerTestAction();

        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Shared ActionRegistry, Isolated Actions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Actions are globally registered but work attestations target specific gardens.
    ///         Both action UIDs are valid, but attestations to gardenAlpha vs gardenBeta remain distinct.
    function test_fork_arbitrum_sharedActionRegistry_isolatedActions() public {
        if (!_setupThreeGardens()) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        // Both actions exist in the shared registry
        ActionRegistry.Action memory a1 = actionRegistry.getAction(actionAlpha);
        ActionRegistry.Action memory a2 = actionRegistry.getAction(actionBeta);
        assertTrue(bytes(a1.title).length > 0, "actionAlpha should exist");
        assertTrue(bytes(a2.title).length > 0, "actionBeta should exist");

        // Grant gardener roles for attestation
        _grantGardenRole(gardenAlpha, forkGardener, IHatsModule.GardenRole.Gardener);
        _grantGardenRole(gardenBeta, forkGardener, IHatsModule.GardenRole.Gardener);

        // Submit work to gardenAlpha using actionAlpha
        bytes32 workAlpha = _submitWorkAttestation(forkGardener, gardenAlpha, actionAlpha);
        assertTrue(workAlpha != bytes32(0), "work attestation to gardenAlpha should succeed");

        // Submit work to gardenBeta using actionBeta
        bytes32 workBeta = _submitWorkAttestation(forkGardener, gardenBeta, actionBeta);
        assertTrue(workBeta != bytes32(0), "work attestation to gardenBeta should succeed");

        // Both attestation UIDs should be unique
        assertTrue(workAlpha != workBeta, "attestation UIDs for different gardens should differ");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Independent Hats Trees
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Each garden gets its own hat tree — operator in Alpha has no role in Beta
    function test_fork_arbitrum_independentHatsTrees() public {
        if (!_setupThreeGardens()) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        // Verify hat tree isolation: each garden has different hat IDs
        (,,,,,, uint256 alphaAdminHat, bool alphaConfigured) = hatsModule.getGardenHatIds(gardenAlpha);
        (,,,,,, uint256 betaAdminHat, bool betaConfigured) = hatsModule.getGardenHatIds(gardenBeta);
        (,,,,,, uint256 gammaAdminHat, bool gammaConfigured) = hatsModule.getGardenHatIds(gardenGamma);

        assertTrue(alphaConfigured, "Alpha should be configured");
        assertTrue(betaConfigured, "Beta should be configured");
        assertTrue(gammaConfigured, "Gamma should be configured");

        // Admin hats should be unique per garden
        assertTrue(alphaAdminHat != betaAdminHat, "Alpha and Beta should have different admin hats");
        assertTrue(betaAdminHat != gammaAdminHat, "Beta and Gamma should have different admin hats");
        assertTrue(alphaAdminHat != gammaAdminHat, "Alpha and Gamma should have different admin hats");

        // Role isolation: alphaOperator is operator of Alpha but NOT Beta or Gamma
        assertTrue(hatsModule.isOperatorOf(gardenAlpha, alphaOperator), "alphaOperator should be operator of Alpha");
        assertFalse(hatsModule.isOperatorOf(gardenBeta, alphaOperator), "alphaOperator should NOT be operator of Beta");
        assertFalse(hatsModule.isOperatorOf(gardenGamma, alphaOperator), "alphaOperator should NOT be operator of Gamma");

        // betaOperator is operator of Beta but NOT Alpha or Gamma
        assertFalse(hatsModule.isOperatorOf(gardenAlpha, betaOperator), "betaOperator should NOT be operator of Alpha");
        assertTrue(hatsModule.isOperatorOf(gardenBeta, betaOperator), "betaOperator should be operator of Beta");
        assertFalse(hatsModule.isOperatorOf(gardenGamma, betaOperator), "betaOperator should NOT be operator of Gamma");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Independent Yield Pipelines
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Each garden's yield vaults are mapped separately in OctantModule.
    /// Garden A having a vault for an asset does not create one for garden B.
    function testForkArbitrum_independentYieldPipelines() public {
        if (!_setupThreeGardens()) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        // OctantModule maps vaults per-garden per-asset via gardenAssetVaults
        address weth = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1; // Arbitrum WETH

        // Neither garden should have a vault yet (no createVaults has been called)
        address vaultAlpha = octantModule.gardenAssetVaults(gardenAlpha, weth);
        address vaultBeta = octantModule.gardenAssetVaults(gardenBeta, weth);
        address vaultGamma = octantModule.gardenAssetVaults(gardenGamma, weth);

        assertEq(vaultAlpha, address(0), "Alpha should not have WETH vault yet");
        assertEq(vaultBeta, address(0), "Beta should not have WETH vault yet");
        assertEq(vaultGamma, address(0), "Gamma should not have WETH vault yet");

        // Donation addresses are set per-garden during mint by OctantModule callback.
        // Each garden TBA is unique, so donation addresses should be distinct.
        address donationAlpha = octantModule.gardenDonationAddresses(gardenAlpha);
        address donationBeta = octantModule.gardenDonationAddresses(gardenBeta);
        address donationGamma = octantModule.gardenDonationAddresses(gardenGamma);

        // If donation addresses were set (OctantModule callback succeeded), verify isolation
        if (donationAlpha != address(0) && donationBeta != address(0)) {
            assertTrue(donationAlpha != donationBeta, "Alpha and Beta donation addresses should differ");
        }
        if (donationBeta != address(0) && donationGamma != address(0)) {
            assertTrue(donationBeta != donationGamma, "Beta and Gamma donation addresses should differ");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Independent Cookie Jars
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Each garden's cookie jars are mapped separately in CookieJarModule.
    /// Jars for garden A are not accessible via garden B's mapping.
    function testForkArbitrum_independentCookieJars() public {
        if (!_setupThreeGardens()) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        // CookieJarModule maps jars per-garden per-asset
        address weth = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;

        // Check jar mappings per garden — each garden gets its own jars
        address jarAlpha = cookieJarModule.gardenJars(gardenAlpha, weth);
        address jarBeta = cookieJarModule.gardenJars(gardenBeta, weth);
        address jarGamma = cookieJarModule.gardenJars(gardenGamma, weth);

        // If jars were created (CookieJarFactory available), they should be different addresses
        if (jarAlpha != address(0) && jarBeta != address(0)) {
            assertTrue(jarAlpha != jarBeta, "Alpha and Beta cookie jars should differ");
        }
        if (jarBeta != address(0) && jarGamma != address(0)) {
            assertTrue(jarBeta != jarGamma, "Beta and Gamma cookie jars should differ");
        }

        // Jar lists are independent per-garden
        address[] memory jarListAlpha = cookieJarModule.getGardenJars(gardenAlpha);
        address[] memory jarListBeta = cookieJarModule.getGardenJars(gardenBeta);

        // If both have jars, verify the jar addresses are different
        if (jarListAlpha.length > 0 && jarListBeta.length > 0) {
            for (uint256 i = 0; i < jarListAlpha.length && i < jarListBeta.length; i++) {
                assertTrue(jarListAlpha[i] != jarListBeta[i], "jar addresses should differ between gardens");
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 5: Unique ENS Slugs Per Garden
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Each garden gets a unique slug — duplicate slug for second garden reverts
    function test_fork_arbitrum_uniqueENSSlugs() public {
        if (!_setupThreeGardens()) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        // Skip if ENS module not deployed
        if (address(greenGoodsENS) == address(0)) {
            emit log("SKIPPED: GreenGoodsENS not deployed on this fork");
            return;
        }

        // Mock ccipSend (test contract not allowlisted on real router)
        address ccipRouter = address(greenGoodsENS.CCIP_ROUTER());
        vm.mockCall(ccipRouter, abi.encodeWithSelector(IRouterClient.ccipSend.selector), abi.encode(bytes32("mock-msg")));

        // Register slug for Alpha
        string memory alphaSlug = "alpha-garden";
        uint256 fee = greenGoodsENS.getRegistrationFee(alphaSlug, gardenAlpha, GreenGoodsENS.NameType.Garden);
        vm.deal(address(gardenToken), fee * 3);

        vm.prank(address(gardenToken));
        greenGoodsENS.registerGarden{ value: fee }(alphaSlug, gardenAlpha);

        // Register different slug for Beta — should succeed
        string memory betaSlug = "beta-garden";
        vm.prank(address(gardenToken));
        greenGoodsENS.registerGarden{ value: fee }(betaSlug, gardenBeta);

        // Verify both registered
        assertFalse(greenGoodsENS.available(alphaSlug), "alphaSlug should be taken");
        assertFalse(greenGoodsENS.available(betaSlug), "betaSlug should be taken");

        bytes32 alphaHash = keccak256(bytes(alphaSlug));
        bytes32 betaHash = keccak256(bytes(betaSlug));
        assertEq(greenGoodsENS.slugOwner(alphaHash), gardenAlpha, "alphaSlug owner should be gardenAlpha");
        assertEq(greenGoodsENS.slugOwner(betaHash), gardenBeta, "betaSlug owner should be gardenBeta");

        // Attempt duplicate slug for Gamma — should revert with NameTaken
        vm.prank(address(gardenToken));
        vm.expectRevert(NameTaken.selector);
        greenGoodsENS.registerGarden{ value: fee }(alphaSlug, gardenGamma);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 6: Independent Gardens Communities
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Each garden should be independently initialized in GardensModule
    function test_fork_arbitrum_independentGardensCommunities() public {
        if (!_setupThreeGardens()) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        // All gardens should be independently initialized
        assertTrue(gardensModule.isGardenInitialized(gardenAlpha), "Alpha should be initialized");
        assertTrue(gardensModule.isGardenInitialized(gardenBeta), "Beta should be initialized");
        assertTrue(gardensModule.isGardenInitialized(gardenGamma), "Gamma should be initialized");

        // Weight schemes should be independent (all default to Linear via _mintTestGarden)
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(gardenAlpha)),
            uint256(IGardensModule.WeightScheme.Linear),
            "Alpha should have Linear scheme"
        );
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(gardenBeta)),
            uint256(IGardensModule.WeightScheme.Linear),
            "Beta should have Linear scheme"
        );
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(gardenGamma)),
            uint256(IGardensModule.WeightScheme.Linear),
            "Gamma should have Linear scheme"
        );

        // Garden addresses should all be different (TBAs from different token IDs)
        assertTrue(gardenAlpha != gardenBeta, "Alpha and Beta should have different addresses");
        assertTrue(gardenBeta != gardenGamma, "Beta and Gamma should have different addresses");
        assertTrue(gardenAlpha != gardenGamma, "Alpha and Gamma should have different addresses");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 7: Cross-Garden Role Isolation
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Operator in garden A can approve work in A but not in garden B
    function test_fork_arbitrum_crossGardenRoleIsolation() public {
        if (!_setupThreeGardens()) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        // Grant gardener to forkGardener in both gardens
        _grantGardenRole(gardenAlpha, forkGardener, IHatsModule.GardenRole.Gardener);
        _grantGardenRole(gardenBeta, forkGardener, IHatsModule.GardenRole.Gardener);

        // Grant evaluator to alphaOperator only in Alpha
        _grantGardenRole(gardenAlpha, alphaOperator, IHatsModule.GardenRole.Evaluator);

        // Submit work to both gardens
        bytes32 workAlpha = _submitWorkAttestation(forkGardener, gardenAlpha, actionAlpha);
        bytes32 workBeta = _submitWorkAttestation(forkGardener, gardenBeta, actionBeta);

        assertTrue(workAlpha != bytes32(0), "Alpha work should succeed");
        assertTrue(workBeta != bytes32(0), "Beta work should succeed");

        // alphaOperator can approve work in Alpha
        bytes32 approvalAlpha = _submitWorkApproval(alphaOperator, gardenAlpha, actionAlpha, workAlpha);
        assertTrue(approvalAlpha != bytes32(0), "Alpha approval should succeed");

        // Verify role isolation via hatsModule
        assertTrue(hatsModule.isEvaluatorOf(gardenAlpha, alphaOperator), "alphaOperator should be evaluator of Alpha");
        assertFalse(hatsModule.isEvaluatorOf(gardenBeta, alphaOperator), "alphaOperator should NOT be evaluator of Beta");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 8: Independent Conviction Pools
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Conviction voting pools (signal pools) created for garden A are independent
    /// from garden B. Each garden gets its own community and pool set.
    function testForkArbitrum_independentConvictionPools() public {
        if (!_tryChainFork("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        _deployFullStackOnFork();
        _configureRealGardensV2();

        // Create per-garden actors
        address cvAlphaOp = makeAddr("cvAlphaOp");
        address cvBetaOp = makeAddr("cvBetaOp");

        // Mint two gardens
        address cvAlpha = _mintTestGarden("CV Alpha", 0x0F);
        address cvBeta = _mintTestGarden("CV Beta", 0x0F);

        _grantGardenRole(cvAlpha, cvAlphaOp, IHatsModule.GardenRole.Operator);
        _grantGardenRole(cvBeta, cvBetaOp, IHatsModule.GardenRole.Operator);

        // Signal pools are per-garden
        address[] memory poolsAlpha = gardensModule.getGardenSignalPools(cvAlpha);
        address[] memory poolsBeta = gardensModule.getGardenSignalPools(cvBeta);

        // If pools were created (requires real factory + successful community creation),
        // verify pool addresses are distinct per garden
        if (poolsAlpha.length > 0 && poolsBeta.length > 0) {
            for (uint256 i = 0; i < poolsAlpha.length && i < poolsBeta.length; i++) {
                assertTrue(poolsAlpha[i] != poolsBeta[i], "conviction pool addresses should differ");
            }
        }

        // Weight schemes should be stored independently per garden
        IGardensModule.WeightScheme schemeAlpha = gardensModule.getGardenWeightScheme(cvAlpha);
        IGardensModule.WeightScheme schemeBeta = gardensModule.getGardenWeightScheme(cvBeta);

        assertEq(uint256(schemeAlpha), uint256(IGardensModule.WeightScheme.Linear), "Alpha should have Linear");
        assertEq(uint256(schemeBeta), uint256(IGardensModule.WeightScheme.Linear), "Beta should have Linear");

        // Communities should be independent (if created)
        address commAlpha = gardensModule.getGardenCommunity(cvAlpha);
        address commBeta = gardensModule.getGardenCommunity(cvBeta);

        if (commAlpha != address(0) && commBeta != address(0)) {
            assertTrue(commAlpha != commBeta, "communities backing conviction pools should differ");
        }

        // Power registry should be shared singleton (if configured)
        address registryAlpha = gardensModule.getGardenPowerRegistry(cvAlpha);
        address registryBeta = gardensModule.getGardenPowerRegistry(cvBeta);

        if (registryAlpha != address(0)) {
            assertEq(registryAlpha, registryBeta, "power registry should be shared singleton");
        }
    }
}
