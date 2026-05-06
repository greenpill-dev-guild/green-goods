// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase } from "../helpers/ForkTestBase.sol";
import { GardenToken } from "../../../src/tokens/Garden.sol";
import { IGardensModule } from "../../../src/interfaces/IGardensModule.sol";

/// @title GardensV2CommunityForkTest
/// @notice Fork tests for Gardens V2 community creation via GardensModule.
/// @dev Tests cover community lifecycle, retry logic, weight scheme storage, and
/// wiring diagnostics against real fork contracts. No fork-local registry factory
/// fabricated factories are used for Arbitrum confidence paths.
contract GardensV2CommunityForkTest is ForkTestBase {
    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Create Community With Real Factory
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Sepolia RegistryFactory is deployed but currently lacks configured community facets.
    function test_fork_gardens_sepoliaFactoryWithoutFacetsIsDiagnostic() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();
        _configureRealGardensV2();

        address factoryAddr = address(gardensModule.registryFactory());
        assertTrue(factoryAddr != address(0), "Sepolia factory should be configured");
        assertGt(factoryAddr.code.length, 0, "Sepolia factory should have deployed code");

        address garden = _mintTestGarden("Sepolia Factory Diagnostic Garden", 0x0F);

        assertTrue(gardensModule.isGardenInitialized(garden), "garden should be initialized");
        assertEq(gardensModule.getGardenCommunity(garden), address(0), "Sepolia factory has no community facets");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Community Without Pools (Factory Available, Pool Creation Fails)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Sepolia remains initialized even though the live factory cannot create a community.
    function test_fork_gardens_sepoliaPartialInitializationWithoutPools() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();
        _configureRealGardensV2();

        address garden = _mintTestGarden("Sepolia Partial Pool Garden", 0x0F);

        assertTrue(gardensModule.isGardenInitialized(garden), "garden should be initialized");
        assertEq(gardensModule.getGardenCommunity(garden), address(0), "community should be absent on current Sepolia");
        assertEq(gardensModule.getGardenSignalPools(garden).length, 0, "pools require a community");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Retry Community After Factory Update
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Retry against Sepolia's live factory fails closed without inventing a local factory.
    function test_fork_gardens_sepoliaRetryUsesLiveFactoryState() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();

        address garden = _mintTestGarden("Sepolia Retry Garden", 0x0F);
        assertTrue(gardensModule.isGardenInitialized(garden), "garden should be initialized");
        assertEq(gardensModule.getGardenCommunity(garden), address(0), "community should be zero without factory");

        _configureRealGardensV2();
        assertGt(address(gardensModule.registryFactory()).code.length, 0, "retry should target live Sepolia factory");

        address retryResult = gardensModule.retryCreateCommunity(garden);
        assertEq(retryResult, address(0), "retry should reflect live Sepolia factory facet state");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Weight Scheme Stored Per Garden
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Tests that different weight schemes are correctly stored per garden.
    /// This test works WITHOUT a real factory -- weight scheme storage is independent.
    function test_fork_gardens_weightSchemeStoredWithRealFactory() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();

        // Mint 3 gardens with different weight schemes
        // _mintTestGarden defaults to Linear, so we call mintGarden directly for the others.

        // Garden 1: Linear
        address garden1 = _mintTestGarden("Linear Garden", 0x01);

        // Garden 2: Exponential
        GardenToken.GardenConfig memory config2 = GardenToken.GardenConfig({
            name: "Exponential Garden",
            slug: "",
            description: "Uses exponential weighting",
            location: "Test Location",
            bannerImage: "ipfs://QmTest",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Exponential,
            domainMask: 0x02,
            gardeners: new address[](0),
            operators: new address[](0)
        });
        address garden2 = gardenToken.mintGarden(config2);

        // Garden 3: Power
        GardenToken.GardenConfig memory config3 = GardenToken.GardenConfig({
            name: "Power Garden",
            slug: "",
            description: "Uses power weighting",
            location: "Test Location",
            bannerImage: "ipfs://QmTest",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Power,
            domainMask: 0x04,
            gardeners: new address[](0),
            operators: new address[](0)
        });
        address garden3 = gardenToken.mintGarden(config3);

        // Verify weight schemes are stored correctly per garden
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden1)),
            uint256(IGardensModule.WeightScheme.Linear),
            "garden1 should have Linear weight scheme"
        );
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden2)),
            uint256(IGardensModule.WeightScheme.Exponential),
            "garden2 should have Exponential weight scheme"
        );
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden3)),
            uint256(IGardensModule.WeightScheme.Power),
            "garden3 should have Power weight scheme"
        );

        // Verify all 3 are initialized
        assertTrue(gardensModule.isGardenInitialized(garden1), "garden1 should be initialized");
        assertTrue(gardensModule.isGardenInitialized(garden2), "garden2 should be initialized");
        assertTrue(gardensModule.isGardenInitialized(garden3), "garden3 should be initialized");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 5: isWiringComplete Reflects State
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Tests that isWiringComplete() accurately reports missing dependencies.
    /// This test works WITHOUT a real factory -- it's testing the diagnostic function.
    function test_fork_gardens_isWiringCompleteReflectsState() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();

        // Default deployment has factories = address(0), so wiring should be incomplete
        (bool wired, string memory missing) = gardensModule.isWiringComplete();

        // gardenToken is set (we called setGardenToken during _deployCoreContracts wiring)
        // registryFactory is address(0) -- should report missing
        assertFalse(wired, "wiring should be incomplete with zero factories");
        assertTrue(bytes(missing).length > 0, "missing message should be non-empty");

        _configureRealGardensV2();

        // Now check again
        (bool wired2, string memory missing2) = gardensModule.isWiringComplete();
        assertTrue(wired2, "wiring should be complete after setting all dependencies");
        assertEq(bytes(missing2).length, 0, "missing message should be empty when fully wired");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Arbitrum Fork Tests
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Community creation on Arbitrum with real RegistryFactory
    function test_fork_arbitrum_communityWithRealFactory() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();
        _configureRealGardensV2();

        // Check if registryFactory is set on the deployed gardensModule
        address factoryAddr = address(gardensModule.registryFactory());
        assertTrue(factoryAddr != address(0), "Arbitrum factory should be configured");
        assertGt(factoryAddr.code.length, 0, "Arbitrum factory should have deployed code");

        // If we have a real factory, mint a garden and verify community creation
        address garden = _mintTestGarden("Arb Factory Garden", 0x0F);

        // Community should have been created during mint (via onGardenMinted)
        address community = gardensModule.getGardenCommunity(garden);
        assertTrue(community != address(0), "community should be created with real factory");
        assertTrue(gardensModule.isGardenInitialized(garden), "garden should be initialized");
    }

    /// @notice Retry community creation on Arbitrum after factory update
    function test_fork_arbitrum_retryAfterFactoryUpdate() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        // Mint a garden — community should be zero due to missing factory in default deployment
        address garden = _mintTestGarden("Arb Retry Garden", 0x0F);
        assertTrue(gardensModule.isGardenInitialized(garden), "garden should be initialized");
        assertEq(gardensModule.getGardenCommunity(garden), address(0), "community should be zero without factory");

        _configureRealGardensV2();
        assertGt(address(gardensModule.registryFactory()).code.length, 0, "retry should target live Arbitrum factory");

        address retryResult = gardensModule.retryCreateCommunity(garden);

        assertTrue(retryResult != address(0), "retry with live Arbitrum factory should create community");
        assertEq(gardensModule.getGardenCommunity(garden), retryResult, "community should be persisted");
    }

    /// @notice Tests isWiringComplete diagnostics on Arbitrum fork
    function test_fork_arbitrum_isWiringCompleteDiagnostics() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        // Default deployment has factories = address(0), so wiring should be incomplete
        (bool wired, string memory missing) = gardensModule.isWiringComplete();

        assertFalse(wired, "wiring should be incomplete with zero factories");
        assertTrue(bytes(missing).length > 0, "missing message should be non-empty");

        _configureRealGardensV2();

        // Now check again
        (bool wired2, string memory missing2) = gardensModule.isWiringComplete();
        assertTrue(wired2, "wiring should be complete after setting all dependencies");
        assertEq(bytes(missing2).length, 0, "missing message should be empty when fully wired");
    }
}
