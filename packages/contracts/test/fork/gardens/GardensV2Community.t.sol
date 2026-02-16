// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase } from "../helpers/ForkTestBase.sol";
import { GardensModule } from "../../../src/modules/Gardens.sol";
import { GardenToken } from "../../../src/tokens/Garden.sol";
import { IGardensModule } from "../../../src/interfaces/IGardensModule.sol";

/// @title GardensV2CommunityForkTest
/// @notice Fork tests for Gardens V2 community creation via GardensModule.
/// @dev Tests cover community lifecycle: creation with/without factories, retry logic,
/// weight scheme storage, and wiring diagnostics. Gracefully skips factory-dependent
/// tests when no RegistryFactory is deployed on the fork chain.
contract GardensV2CommunityForkTest is ForkTestBase {
    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Create Community With Real Factory
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Tests community creation when a real RegistryFactory is available.
    /// Gracefully skips if registryFactory is address(0) (expected on most chains).
    function test_fork_gardens_createCommunityWithRealFactory() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Check if registryFactory is set on the deployed gardensModule
        address factoryAddr = address(gardensModule.registryFactory());
        if (factoryAddr == address(0)) {
            emit log("SKIPPED: No RegistryFactory deployed on this chain");
            return;
        }

        // If we have a real factory, mint a garden and verify community creation
        address garden = _mintTestGarden("Factory Garden", 0x0F);

        // Community should have been created during mint (via onGardenMinted)
        address community = gardensModule.getGardenCommunity(garden);
        assertTrue(community != address(0), "community should be created with real factory");
        assertTrue(gardensModule.isGardenInitialized(garden), "garden should be initialized");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Community Without Pools (Factory Available, Pool Creation Fails)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Tests partial initialization when community is created but pools fail.
    /// Skips if no factory is available.
    function test_fork_gardens_communityWithoutPools() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        address factoryAddr = address(gardensModule.registryFactory());
        if (factoryAddr == address(0)) {
            emit log("SKIPPED: No RegistryFactory deployed on this chain");
            return;
        }

        // Mint garden -- if pool creation fails but community succeeds, that's partial init
        address garden = _mintTestGarden("Partial Pool Garden", 0x0F);

        // Garden should be initialized regardless of pool outcome
        assertTrue(gardensModule.isGardenInitialized(garden), "garden should be initialized");

        // Community may exist even if pools don't
        address community = gardensModule.getGardenCommunity(garden);
        address[] memory pools = gardensModule.getGardenSignalPools(garden);

        // Log state for debugging -- both outcomes are valid
        emit log_named_address("community", community);
        emit log_named_uint("pools count", pools.length);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Retry Community After Factory Update
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Tests retry flow: deploy without factory, set factory later, retry community creation.
    /// The retryCreateCommunity path works independent of external factory existence.
    function test_fork_gardens_retryAfterFactoryUpdate() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // gardensModule was deployed with factories = address(0) (standard testnet behavior)
        // Mint a garden -- community should be zero due to missing factory
        address garden = _mintTestGarden("Retry Garden", 0x0F);
        assertTrue(gardensModule.isGardenInitialized(garden), "garden should be initialized");
        assertEq(gardensModule.getGardenCommunity(garden), address(0), "community should be zero without factory");

        // Now simulate a factory becoming available by setting a test address.
        // retryCreateCommunity will call _createCommunity internally which calls registryFactory.
        // Since we don't have a real factory, the try/catch in _createCommunity will catch
        // and return address(0). But we verify the retry path doesn't revert.
        address mockFactory = address(0xFACE);

        // Setting factory requires owner privileges (address(this) is owner)
        gardensModule.setRegistryFactory(mockFactory);
        assertEq(address(gardensModule.registryFactory()), mockFactory, "factory should be updated");

        // retryCreateCommunity should not revert (graceful try/catch in _createCommunity)
        address retryResult = gardensModule.retryCreateCommunity(garden);

        // Result will be address(0) since mockFactory isn't a real contract with createRegistryCommunity
        // The important thing is the call didn't revert -- the retry path is functional
        assertEq(retryResult, address(0), "retry with mock factory should gracefully return zero");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Weight Scheme Stored Per Garden
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Tests that different weight schemes are correctly stored per garden.
    /// This test works WITHOUT a real factory -- weight scheme storage is independent.
    function test_fork_gardens_weightSchemeStoredWithRealFactory() public {
        if (!_tryChainFork("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Mint 3 gardens with different weight schemes
        // _mintTestGarden defaults to Linear, so we call mintGarden directly for the others.

        // Garden 1: Linear
        address garden1 = _mintTestGarden("Linear Garden", 0x01);

        // Garden 2: Exponential
        GardenToken.GardenConfig memory config2 = GardenToken.GardenConfig({
            communityToken: address(communityToken),
            name: "Exponential Garden",
            description: "Uses exponential weighting",
            location: "Test Location",
            bannerImage: "ipfs://QmTest",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Exponential,
            domainMask: 0x02
        });
        address garden2 = gardenToken.mintGarden(config2);

        // Garden 3: Power
        GardenToken.GardenConfig memory config3 = GardenToken.GardenConfig({
            communityToken: address(communityToken),
            name: "Power Garden",
            description: "Uses power weighting",
            location: "Test Location",
            bannerImage: "ipfs://QmTest",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Power,
            domainMask: 0x04
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
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _deployFullStackOnFork();

        // Default deployment has factories = address(0), so wiring should be incomplete
        (bool wired, string memory missing) = gardensModule.isWiringComplete();

        // gardenToken is set (we called setGardenToken during _deployCoreContracts wiring)
        // registryFactory is address(0) -- should report missing
        assertFalse(wired, "wiring should be incomplete with zero factories");
        assertTrue(bytes(missing).length > 0, "missing message should be non-empty");

        // Set all missing dependencies to make wiring complete
        gardensModule.setRegistryFactory(address(0xF1));
        gardensModule.setPowerRegistryFactory(address(0xF2));

        // goodsToken was set to address(0) during deploy -- need to set it
        if (address(gardensModule.goodsToken()) == address(0)) {
            gardensModule.setGoodsToken(address(communityToken));
        }

        // Now check again
        (bool wired2, string memory missing2) = gardensModule.isWiringComplete();
        assertTrue(wired2, "wiring should be complete after setting all dependencies");
        assertEq(bytes(missing2).length, 0, "missing message should be empty when fully wired");
    }
}
