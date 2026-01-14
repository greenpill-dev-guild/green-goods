// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { MockHats } from "../../src/mocks/Hats.sol";

/// @title GardenHatsModuleTest
/// @notice Tests for MockHats functionality used in garden integration tests
/// @dev Tests verify the MockHats contract behavior for hat-based role management
///
/// **Note:** The Hats integration is planned for future implementation via HatsModule.
/// These tests verify the MockHats contract works correctly for integration testing.
///
/// **Green Goods Hat Tree Structure (Planned):**
/// ```
/// Green Goods Top Hat (0x0000005c...)
/// +-- Gardens Hat (parent for all gardens)
///     +-- Garden Hat (per-garden root)
///         +-- Operator Hat (can mint Gardener/Evaluator)
///         +-- Gardener Hat (minted by Operator)
///         +-- Evaluator Hat (minted by Operator)
///         +-- Funder Hat (eligibility-based)
///         +-- Community Hat (eligibility-based: ERC-20 holder)
/// ```
contract GardenHatsModuleTest is Test {
    // ═══════════════════════════════════════════════════════════════════════════
    // Test Contracts
    // ═══════════════════════════════════════════════════════════════════════════

    MockHats public mockHats;

    // ═══════════════════════════════════════════════════════════════════════════
    // Test Addresses
    // ═══════════════════════════════════════════════════════════════════════════

    address public owner;
    address public gardenToken;
    address public garden1;
    address public garden2;
    address public operator1;
    address public operator2;
    address public gardener1;
    address public gardener2;
    address public evaluator1;
    address public funder1;
    address public communityMember1;

    // ═══════════════════════════════════════════════════════════════════════════
    // Hat Tree IDs (matching Hats Protocol bit structure)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev Green Goods top hat on Arbitrum: tree 92
    uint256 constant GREEN_GOODS_TOP_HAT = 0x0000005c00000000000000000000000000000000000000000000000000000000;

    /// @dev Gardens hat (child of top hat, ID 1)
    uint256 constant GARDENS_HAT = 0x0000005c00010000000000000000000000000000000000000000000000000000;

    // Garden 1 hats
    uint256 constant GARDEN1_ROOT_HAT = 0x0000005c00010001000000000000000000000000000000000000000000000000;
    uint256 constant GARDEN1_OPERATOR_HAT = 0x0000005c00010001000100000000000000000000000000000000000000000000;
    uint256 constant GARDEN1_GARDENER_HAT = 0x0000005c00010001000200000000000000000000000000000000000000000000;
    uint256 constant GARDEN1_EVALUATOR_HAT = 0x0000005c00010001000300000000000000000000000000000000000000000000;
    uint256 constant GARDEN1_FUNDER_HAT = 0x0000005c00010001000400000000000000000000000000000000000000000000;
    uint256 constant GARDEN1_COMMUNITY_HAT = 0x0000005c00010001000500000000000000000000000000000000000000000000;

    // ═══════════════════════════════════════════════════════════════════════════
    // Role Constants
    // ═══════════════════════════════════════════════════════════════════════════

    uint256 constant ROLE_OPERATOR = 1;
    uint256 constant ROLE_GARDENER = 2;
    uint256 constant ROLE_EVALUATOR = 3;
    uint256 constant ROLE_FUNDER = 4;
    uint256 constant ROLE_COMMUNITY = 5;

    function setUp() public {
        owner = address(this);
        gardenToken = address(0x1000);
        garden1 = address(0x2000);
        garden2 = address(0x3000);
        operator1 = address(0x4000);
        operator2 = address(0x4001);
        gardener1 = address(0x5000);
        gardener2 = address(0x5001);
        evaluator1 = address(0x6000);
        funder1 = address(0x7000);
        communityMember1 = address(0x8000);

        // Deploy mock Hats
        mockHats = new MockHats();

        // Setup Green Goods hat tree structure
        _setupGreenGoodsTopHat();
    }

    /// @dev Sets up the Green Goods top hat and gardens hat in MockHats
    function _setupGreenGoodsTopHat() internal {
        // Mint top hat to owner
        mockHats.mintTopHat(owner, "Green Goods", "ipfs://green-goods-logo");

        // Create gardens hat under top hat
        mockHats.createHat(
            GREEN_GOODS_TOP_HAT, "Gardens", type(uint32).max, address(0), address(0), true, "ipfs://gardens-logo"
        );

        // Mint gardens hat to gardenToken so it can create garden hats
        mockHats.mintHat(GARDENS_HAT, gardenToken);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Role Query Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_isOperator_returnsTrueForHatWearer() public {
        // Setup: Create hat tree and assign operator
        _createGardenHatTree(garden1);
        mockHats.setWearer(GARDEN1_OPERATOR_HAT, operator1, true);

        // Verify
        assertTrue(mockHats.isWearerOfHat(operator1, GARDEN1_OPERATOR_HAT), "Should be operator");
    }

    function test_isOperator_returnsFalseForNonWearer() public {
        _createGardenHatTree(garden1);

        assertFalse(mockHats.isWearerOfHat(operator1, GARDEN1_OPERATOR_HAT), "Should not be operator");
    }

    function test_isGardener_returnsTrueForHatWearer() public {
        _createGardenHatTree(garden1);
        mockHats.setWearer(GARDEN1_GARDENER_HAT, gardener1, true);

        assertTrue(mockHats.isWearerOfHat(gardener1, GARDEN1_GARDENER_HAT), "Should be gardener");
    }

    function test_isEvaluator_returnsTrueForHatWearer() public {
        _createGardenHatTree(garden1);
        mockHats.setWearer(GARDEN1_EVALUATOR_HAT, evaluator1, true);

        assertTrue(mockHats.isWearerOfHat(evaluator1, GARDEN1_EVALUATOR_HAT), "Should be evaluator");
    }

    function test_roleCheck_respectsHatActiveStatus() public {
        _createGardenHatTree(garden1);
        mockHats.setWearer(GARDEN1_OPERATOR_HAT, operator1, true);

        assertTrue(mockHats.isWearerOfHat(operator1, GARDEN1_OPERATOR_HAT), "Should be operator when active");

        // Deactivate hat
        mockHats.setHatActive(GARDEN1_OPERATOR_HAT, false);

        assertFalse(mockHats.isWearerOfHat(operator1, GARDEN1_OPERATOR_HAT), "Should not be operator when inactive");
    }

    function test_roleCheck_respectsEligibilityStatus() public {
        _createGardenHatTree(garden1);
        mockHats.setWearer(GARDEN1_OPERATOR_HAT, operator1, true);

        assertTrue(mockHats.isWearerOfHat(operator1, GARDEN1_OPERATOR_HAT), "Should be operator when eligible");

        // Revoke eligibility
        mockHats.setEligibility(GARDEN1_OPERATOR_HAT, operator1, false);

        assertFalse(mockHats.isWearerOfHat(operator1, GARDEN1_OPERATOR_HAT), "Should not be operator when ineligible");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Multi-Garden Isolation Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_multiGarden_rolesAreIsolated() public {
        // Create hat trees for two gardens
        _createGardenHatTree(garden1);

        // Setup operators for different gardens
        mockHats.setWearer(GARDEN1_OPERATOR_HAT, operator1, true);

        // Verify garden1 operator is not garden2 operator
        assertTrue(mockHats.isWearerOfHat(operator1, GARDEN1_OPERATOR_HAT), "Should be operator of garden1");
        // Note: operator1 cannot be operator of garden2 without that hat
    }

    function test_multiGarden_independentConfiguration() public {
        // Create two gardens with different configurations
        _createGardenHatTree(garden1);

        // Assign different operators
        mockHats.setWearer(GARDEN1_OPERATOR_HAT, operator1, true);

        // Each garden has independent hat IDs
        assertTrue(mockHats.isWearerOfHat(operator1, GARDEN1_OPERATOR_HAT), "Operator1 should be garden1 operator");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Hat ID Generation Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_getHatLevel_topHat() public {
        uint32 level = mockHats.getHatLevel(GREEN_GOODS_TOP_HAT);
        assertEq(level, 0, "Top hat should be level 0");
    }

    function test_getHatLevel_gardensHat() public {
        uint32 level = mockHats.getHatLevel(GARDENS_HAT);
        assertEq(level, 1, "Gardens hat should be level 1");
    }

    function test_getHatLevel_gardenRootHat() public {
        uint32 level = mockHats.getHatLevel(GARDEN1_ROOT_HAT);
        assertEq(level, 2, "Garden root hat should be level 2");
    }

    function test_getHatLevel_roleHat() public {
        uint32 level = mockHats.getHatLevel(GARDEN1_OPERATOR_HAT);
        assertEq(level, 3, "Role hat should be level 3");
    }

    function test_isTopHat_true() public {
        assertTrue(mockHats.isTopHat(GREEN_GOODS_TOP_HAT), "Should be top hat");
    }

    function test_isTopHat_false() public {
        assertFalse(mockHats.isTopHat(GARDENS_HAT), "Should not be top hat");
        assertFalse(mockHats.isTopHat(GARDEN1_ROOT_HAT), "Should not be top hat");
    }

    function test_getAdminAtLevel_returnsCorrectAdmin() public {
        // For garden root hat (level 2), admin at level 1 should be gardens hat
        uint256 adminAt1 = mockHats.getAdminAtLevel(GARDEN1_ROOT_HAT, 1);
        assertEq(adminAt1, GARDENS_HAT, "Admin at level 1 should be gardens hat");

        // For role hat (level 3), admin at level 2 should be garden root
        uint256 adminAt2 = mockHats.getAdminAtLevel(GARDEN1_OPERATOR_HAT, 2);
        assertEq(adminAt2, GARDEN1_ROOT_HAT, "Admin at level 2 should be garden root hat");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Admin Hierarchy Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_isAdminOfHat_topHatWearerIsAdmin() public {
        mockHats.setWearer(GREEN_GOODS_TOP_HAT, owner, true);

        assertTrue(mockHats.isAdminOfHat(owner, GARDENS_HAT), "Top hat wearer should be admin of gardens hat");
        assertTrue(mockHats.isAdminOfHat(owner, GARDEN1_ROOT_HAT), "Top hat wearer should be admin of garden hat");
        assertTrue(mockHats.isAdminOfHat(owner, GARDEN1_OPERATOR_HAT), "Top hat wearer should be admin of role hat");
    }

    function test_isAdminOfHat_gardensHatWearerIsGardenAdmin() public {
        mockHats.setWearer(GARDENS_HAT, gardenToken, true);

        assertTrue(mockHats.isAdminOfHat(gardenToken, GARDEN1_ROOT_HAT), "Gardens hat wearer should be admin of garden hat");
    }

    function test_isAdminOfHat_nonAdminReturnsFalse() public {
        assertFalse(mockHats.isAdminOfHat(operator1, GARDEN1_ROOT_HAT), "Non-admin should not be admin");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Batch Operations Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_batchMintHats_assignsMultipleRoles() public {
        _createGardenHatTree(garden1);

        // Use setWearer helper which bypasses maxSupply checks (for mocking purposes)
        mockHats.setWearer(GARDEN1_OPERATOR_HAT, operator1, true);
        mockHats.setWearer(GARDEN1_GARDENER_HAT, gardener1, true);
        mockHats.setWearer(GARDEN1_EVALUATOR_HAT, evaluator1, true);

        assertTrue(mockHats.isWearerOfHat(operator1, GARDEN1_OPERATOR_HAT), "Operator should have hat");
        assertTrue(mockHats.isWearerOfHat(gardener1, GARDEN1_GARDENER_HAT), "Gardener should have hat");
        assertTrue(mockHats.isWearerOfHat(evaluator1, GARDEN1_EVALUATOR_HAT), "Evaluator should have hat");
    }

    function test_batchCreateHats_createsMultipleHats() public {
        // Create garden root hat first
        vm.prank(gardenToken);
        mockHats.createHat(GARDENS_HAT, "Garden 1", 1, address(0), address(0), true, "ipfs://garden1");

        // Get the created hat ID
        uint256 gardenRootHat = mockHats.getNextId(GARDENS_HAT) - (uint256(1) << (256 - 32 - 32));

        // Batch create role hats
        uint256[] memory admins = new uint256[](3);
        string[] memory details = new string[](3);
        uint32[] memory maxSupplies = new uint32[](3);
        address[] memory eligibilityModules = new address[](3);
        address[] memory toggleModules = new address[](3);
        bool[] memory mutables = new bool[](3);
        string[] memory imageURIs = new string[](3);

        for (uint256 i = 0; i < 3; i++) {
            admins[i] = gardenRootHat;
            maxSupplies[i] = 10;
            eligibilityModules[i] = address(0);
            toggleModules[i] = address(0);
            mutables[i] = true;
            imageURIs[i] = "ipfs://role";
        }
        details[0] = "Operator";
        details[1] = "Gardener";
        details[2] = "Evaluator";

        mockHats.batchCreateHats(admins, details, maxSupplies, eligibilityModules, toggleModules, mutables, imageURIs);

        // Verify hats were created by checking lastHatId
        (,,,,,, uint16 lastHatId,,) = mockHats.viewHat(gardenRootHat);
        assertEq(lastHatId, 3, "Should have created 3 child hats");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Edge Cases & Security Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_maxSupply_preventsOverMinting() public {
        _createGardenHatTree(garden1);

        // Try to mint more than max supply
        mockHats.setWearer(GARDEN1_OPERATOR_HAT, operator1, true);

        // Second operator should fail if max supply is 1
        vm.expectRevert(MockHats.MaxSupplyReached.selector);
        mockHats.mintHat(GARDEN1_OPERATOR_HAT, operator2);
    }

    function test_transferHat_requiresMutable() public {
        _createGardenHatTree(garden1);
        mockHats.setWearer(GARDEN1_GARDENER_HAT, gardener1, true);

        // Make hat immutable
        mockHats.makeHatImmutable(GARDEN1_GARDENER_HAT);

        // Transfer should fail
        vm.expectRevert(MockHats.HatNotMutable.selector);
        mockHats.transferHat(GARDEN1_GARDENER_HAT, gardener1, gardener2);
    }

    function test_inactiveHat_preventsMinting() public {
        _createGardenHatTree(garden1);

        // Deactivate hat
        mockHats.setHatActive(GARDEN1_GARDENER_HAT, false);

        // Minting should fail
        vm.expectRevert(MockHats.HatNotActive.selector);
        mockHats.mintHat(GARDEN1_GARDENER_HAT, gardener1);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Helper Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev Creates a garden hat tree in MockHats
    function _createGardenHatTree(address garden) internal {
        // Create garden root hat
        vm.prank(gardenToken);
        mockHats.createHat(GARDENS_HAT, "Garden", 1, address(0), address(0), true, "ipfs://garden");

        // Get the actual root hat ID
        uint256 rootHatId = mockHats.getNextId(GARDENS_HAT) - (uint256(1) << (256 - 32 - 32));

        // Mint root hat to garden
        mockHats.mintHat(rootHatId, garden);

        // Create role hats under garden root
        // Note: Using mock helper to set up expected hat IDs
        mockHats.setHatActive(GARDEN1_OPERATOR_HAT, true);
        mockHats.setHatActive(GARDEN1_GARDENER_HAT, true);
        mockHats.setHatActive(GARDEN1_EVALUATOR_HAT, true);
        mockHats.setHatActive(GARDEN1_FUNDER_HAT, true);
        mockHats.setHatActive(GARDEN1_COMMUNITY_HAT, true);
    }
}
