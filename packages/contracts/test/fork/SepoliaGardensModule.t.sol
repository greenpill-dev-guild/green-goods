// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase } from "./helpers/ForkTestBase.sol";
import { GardenAccount } from "../../src/accounts/Garden.sol";
import { GardenToken } from "../../src/tokens/Garden.sol";
import { IGardensModule } from "../../src/interfaces/IGardensModule.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { IHats } from "../../src/interfaces/IHats.sol";
import { NFTPowerSource } from "../../src/interfaces/IGardensV2.sol";

/// @title SepoliaGardensModuleForkTest
/// @notice Fork tests for GardensModule against Sepolia testnet using real
///         HatsModule, Hats Protocol, and full protocol stack via ForkTestBase.
/// @dev Mirrors ArbitrumGardensModuleForkTest for Sepolia chain. Uses
///      _deployFullStackOnFork() for production-equivalent wiring and
///      _configureRealGardensV2() for Gardens V2 addresses.
contract SepoliaGardensModuleForkTest is ForkTestBase {
    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Deploy and verify initialization with real Hats Protocol
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_initializesWithRealHatsProtocol() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        // Verify Hats Protocol is deployed at the expected address
        assertGt(HATS_PROTOCOL.code.length, 0, "Hats Protocol should be deployed on Sepolia");

        _deployFullStackOnFork();

        // GardensModule should be wired to real Hats Protocol
        assertEq(gardensModule.hatsProtocol(), HATS_PROTOCOL, "hats protocol should point to real address");
        assertEq(address(gardensModule.gardenToken()), address(gardenToken), "garden token should be authorized");
        assertTrue(address(hatsModule) != address(0), "hats module should be deployed");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Real Hats Protocol responds to queries
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_hatsProtocolIsQueryable() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        IHats hats = IHats(HATS_PROTOCOL);

        // Top hat for domain 1 should be level 0
        uint256 topHatDomain1 = 1 << 224;
        uint32 level = hats.getHatLevel(topHatDomain1);
        assertEq(level, 0, "top hat should be level 0");

        // An invalid hat should return false for isActive
        bool active = hats.isActive(0);
        assertFalse(active, "hat 0 should not be active");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Weight schemes stored correctly via real mint pipeline
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_weightSchemesResolveCorrectly() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Mint garden with Linear scheme (default in _mintTestGarden)
        address linearGarden = _mintTestGarden("Linear Garden", 0x0F);
        assertTrue(gardensModule.isGardenInitialized(linearGarden), "linear garden should be initialized");
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(linearGarden)),
            uint256(IGardensModule.WeightScheme.Linear),
            "Linear weight scheme should be stored"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: onGardenMinted stores state correctly via real pipeline
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_onGardenMintedStoresState() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Mint garden — goes through real GardenToken.mintGarden() → onGardenMinted() callback
        address garden = _mintTestGarden("State Test Garden", 0x0F);

        // Garden should be initialized
        assertTrue(gardensModule.isGardenInitialized(garden), "garden should be initialized after mint");
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden)),
            uint256(IGardensModule.WeightScheme.Linear),
            "weight scheme should be Linear"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Unauthorized caller reverts
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_onGardenMintedRevertsForUnauthorized() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Direct call from non-gardenToken should revert
        vm.prank(forkNonMember);
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("NotGardenToken(address)")), forkNonMember));
        gardensModule.onGardenMinted(address(0xDEAD), IGardensModule.WeightScheme.Linear);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Real role grants via HatsModule on fork
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_realRoleGrantsViaHatsModule() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Mint garden and grant roles through real HatsModule → real Hats Protocol
        address garden = _mintTestGarden("Role Test Garden", 0x0F);
        _grantGardenRole(garden, forkOperator, IHatsModule.GardenRole.Operator);
        _grantGardenRole(garden, forkGardener, IHatsModule.GardenRole.Gardener);

        // Verify roles via real HatsModule (which queries real Hats Protocol)
        assertTrue(hatsModule.isOperatorOf(garden, forkOperator), "operator role should be granted");
        assertTrue(hatsModule.isGardenerOf(garden, forkGardener), "gardener role should be granted");
        assertFalse(hatsModule.isOperatorOf(garden, forkNonMember), "non-member should not have operator role");

        // Verify via real Hats Protocol directly
        IHats hats = IHats(HATS_PROTOCOL);
        (, uint256 operatorHatId,, uint256 gardenerHatId,,,,) = hatsModule.getGardenHatIds(garden);
        assertTrue(hats.isWearerOfHat(forkOperator, operatorHatId), "operator should wear operator hat");
        assertTrue(hats.isWearerOfHat(forkGardener, gardenerHatId), "gardener should wear gardener hat");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Gardens V2 community creation with real factory
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_gardensV2CommunityCreation() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();
        _configureRealGardensV2();

        // Mint garden (triggers onGardenMinted → community creation if factory available)
        address garden = _mintTestGarden("Gardens V2 Garden", 0x0F);
        assertTrue(gardensModule.isGardenInitialized(garden), "garden should be initialized");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Constants are correct
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_constantsAreCorrect() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        assertEq(gardensModule.DEFAULT_DECAY(), 9_999_799, "default decay should be 9999799");
        assertEq(gardensModule.DEFAULT_MAX_RATIO(), 2_000_000, "default max ratio should be 2000000");
        assertEq(gardensModule.DEFAULT_WEIGHT(), 10_000, "default weight should be 10000");
        assertEq(gardensModule.DEFAULT_MIN_THRESHOLD_POINTS(), 2_500_000, "default min threshold should be 2500000");
        assertEq(gardensModule.stakeAmountPerMember(), 1e18, "stake per member should be 1 GOODS");
        assertEq(gardensModule.D(), 10_000_000, "scaling factor D should be 10000000");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: GOODS token configured via real deployment
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_goodsTokenConfigured() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();
        _configureRealGardensV2();

        // Verify GOODS token is set (goodsToken deployed by _configureRealGardensV2)
        assertEq(address(gardensModule.goodsToken()), address(goodsToken), "GOODS token should be configured");

        // Verify stake amount per member (default 1 GOODS = 1e18)
        assertEq(gardensModule.stakeAmountPerMember(), 1e18, "stake per member should be 1 GOODS");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Power registry wired and populated on garden mint
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_powerRegistryWiringVerified() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Verify power registry is deployed and configured
        assertEq(unifiedPowerRegistry.owner(), address(this), "registry owner should be deployer");
        assertEq(unifiedPowerRegistry.hatsProtocol(), HATS_PROTOCOL, "hats protocol should point to real address");
        assertEq(unifiedPowerRegistry.gardensModule(), address(gardensModule), "gardens module should be authorized");

        // Mint garden — power sources should be registered via real onGardenMinted pipeline
        address garden = _mintTestGarden("Power Test Garden", 0x0F);

        // Verify garden is registered in power registry with 3 sources (operator, gardener, community)
        assertTrue(unifiedPowerRegistry.isGardenRegistered(garden), "garden should be registered in power registry");
        assertEq(unifiedPowerRegistry.getGardenSourceCount(garden), 3, "garden should have 3 power sources");

        // Verify source weights match Linear scheme (operator=30k, gardener=20k, community=10k)
        NFTPowerSource[] memory sources = unifiedPowerRegistry.getGardenSources(garden);
        assertEq(sources[0].weight, 30_000, "operator source should have 30000 weight");
        assertEq(sources[1].weight, 20_000, "gardener source should have 20000 weight");
        assertEq(sources[2].weight, 10_000, "community source should have 10000 weight");
    }
}
