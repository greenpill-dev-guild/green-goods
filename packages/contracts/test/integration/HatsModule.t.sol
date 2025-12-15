// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {HatsModule} from "../../src/modules/Hats.sol";
import {IGardenAccessControl} from "../../src/interfaces/IGardenAccessControl.sol";
import {MockHats} from "../../src/mocks/Hats.sol";

/// @title HatsModuleTest
/// @notice Tests for the HatsModule contract
contract HatsModuleTest is Test {
    HatsModule public adapter;
    MockHats public mockHats;

    address public owner;
    address public garden1;
    address public garden2;
    address public user1;
    address public user2;
    address public user3;
    address public configAuthority;

    // Hat IDs for garden1
    uint256 constant GARDEN1_GARDENER_HAT = 1;
    uint256 constant GARDEN1_OPERATOR_HAT = 2;
    uint256 constant GARDEN1_OWNER_HAT = 3;

    // Hat IDs for garden2
    uint256 constant GARDEN2_GARDENER_HAT = 10;
    uint256 constant GARDEN2_OPERATOR_HAT = 20;
    uint256 constant GARDEN2_OWNER_HAT = 30;

    // Events
    event GardenConfigured(address indexed garden, uint256 gardenerHatId, uint256 operatorHatId, uint256 ownerHatId);
    event GardenDeconfigured(address indexed garden);
    event HatsContractUpdated(address indexed oldHats, address indexed newHats);

    function setUp() public {
        owner = address(this);
        garden1 = address(0x1000);
        garden2 = address(0x2000);
        user1 = address(0x3000);
        user2 = address(0x4000);
        user3 = address(0x5000);
        configAuthority = address(0x6000);

        // Deploy mock Hats
        mockHats = new MockHats();

        // Deploy adapter with proxy
        HatsModule impl = new HatsModule();
        bytes memory initData = abi.encodeWithSelector(HatsModule.initialize.selector, owner, address(mockHats));
        address proxyAddr = address(new ERC1967Proxy(address(impl), initData));
        adapter = HatsModule(proxyAddr);

        // Activate all hats
        mockHats.setHatActive(GARDEN1_GARDENER_HAT, true);
        mockHats.setHatActive(GARDEN1_OPERATOR_HAT, true);
        mockHats.setHatActive(GARDEN1_OWNER_HAT, true);
        mockHats.setHatActive(GARDEN2_GARDENER_HAT, true);
        mockHats.setHatActive(GARDEN2_OPERATOR_HAT, true);
        mockHats.setHatActive(GARDEN2_OWNER_HAT, true);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Initialization Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_initialize_setsOwner() public {
        assertEq(adapter.owner(), owner, "Owner should be set correctly");
    }

    function test_initialize_setsHatsContract() public {
        assertEq(address(adapter.hats()), address(mockHats), "Hats contract should be set");
    }

    function test_initialize_revertsOnZeroOwner() public {
        HatsModule impl = new HatsModule();
        bytes memory initData = abi.encodeWithSelector(HatsModule.initialize.selector, address(0), address(mockHats));

        vm.expectRevert(HatsModule.ZeroAddress.selector);
        new ERC1967Proxy(address(impl), initData);
    }

    function test_initialize_revertsOnZeroHats() public {
        HatsModule impl = new HatsModule();
        bytes memory initData = abi.encodeWithSelector(HatsModule.initialize.selector, owner, address(0));

        vm.expectRevert(HatsModule.ZeroAddress.selector);
        new ERC1967Proxy(address(impl), initData);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Garden Configuration Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_configureGarden_byOwner() public {
        vm.expectEmit(true, false, false, true);
        emit GardenConfigured(garden1, GARDEN1_GARDENER_HAT, GARDEN1_OPERATOR_HAT, GARDEN1_OWNER_HAT);

        adapter.configureGarden(garden1, GARDEN1_GARDENER_HAT, GARDEN1_OPERATOR_HAT, GARDEN1_OWNER_HAT);

        assertTrue(adapter.isConfigured(garden1), "Garden should be configured");

        (uint256 gardenerHat, uint256 operatorHat, uint256 ownerHat, bool configured) = adapter.gardenHats(garden1);
        assertEq(gardenerHat, GARDEN1_GARDENER_HAT, "Gardener hat should match");
        assertEq(operatorHat, GARDEN1_OPERATOR_HAT, "Operator hat should match");
        assertEq(ownerHat, GARDEN1_OWNER_HAT, "Owner hat should match");
        assertTrue(configured, "Should be configured");
    }

    function test_configureGarden_byGardenItself() public {
        vm.prank(garden1);
        adapter.configureGarden(garden1, GARDEN1_GARDENER_HAT, GARDEN1_OPERATOR_HAT, GARDEN1_OWNER_HAT);

        assertTrue(adapter.isConfigured(garden1), "Garden should be configured");
    }

    function test_configureGarden_byConfigAuthority() public {
        adapter.setConfigAuthority(configAuthority, true);

        vm.prank(configAuthority);
        adapter.configureGarden(garden1, GARDEN1_GARDENER_HAT, GARDEN1_OPERATOR_HAT, GARDEN1_OWNER_HAT);

        assertTrue(adapter.isConfigured(garden1), "Garden should be configured");
    }

    function test_configureGarden_revertsForUnauthorized() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(HatsModule.NotGardenAdmin.selector, user1, garden1));
        adapter.configureGarden(garden1, GARDEN1_GARDENER_HAT, GARDEN1_OPERATOR_HAT, GARDEN1_OWNER_HAT);
    }

    function test_configureGarden_revertsOnZeroGarden() public {
        vm.expectRevert(HatsModule.ZeroAddress.selector);
        adapter.configureGarden(address(0), GARDEN1_GARDENER_HAT, GARDEN1_OPERATOR_HAT, GARDEN1_OWNER_HAT);
    }

    function test_configureGarden_revertsOnZeroHatId() public {
        vm.expectRevert(HatsModule.InvalidHatId.selector);
        adapter.configureGarden(garden1, 0, GARDEN1_OPERATOR_HAT, GARDEN1_OWNER_HAT);

        vm.expectRevert(HatsModule.InvalidHatId.selector);
        adapter.configureGarden(garden1, GARDEN1_GARDENER_HAT, 0, GARDEN1_OWNER_HAT);

        vm.expectRevert(HatsModule.InvalidHatId.selector);
        adapter.configureGarden(garden1, GARDEN1_GARDENER_HAT, GARDEN1_OPERATOR_HAT, 0);
    }

    function test_deconfigureGarden() public {
        adapter.configureGarden(garden1, GARDEN1_GARDENER_HAT, GARDEN1_OPERATOR_HAT, GARDEN1_OWNER_HAT);
        assertTrue(adapter.isConfigured(garden1), "Garden should be configured");

        vm.expectEmit(true, false, false, false);
        emit GardenDeconfigured(garden1);

        adapter.deconfigureGarden(garden1);
        assertFalse(adapter.isConfigured(garden1), "Garden should not be configured");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Role Check Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_isGardenerOf_returnsTrueForHatWearer() public {
        adapter.configureGarden(garden1, GARDEN1_GARDENER_HAT, GARDEN1_OPERATOR_HAT, GARDEN1_OWNER_HAT);
        mockHats.setWearer(GARDEN1_GARDENER_HAT, user1, true);

        assertTrue(adapter.isGardenerOf(garden1, user1), "User should be gardener");
    }

    function test_isGardenerOf_returnsFalseForNonWearer() public {
        adapter.configureGarden(garden1, GARDEN1_GARDENER_HAT, GARDEN1_OPERATOR_HAT, GARDEN1_OWNER_HAT);

        assertFalse(adapter.isGardenerOf(garden1, user1), "User should not be gardener");
    }

    function test_isOperatorOf_returnsTrueForHatWearer() public {
        adapter.configureGarden(garden1, GARDEN1_GARDENER_HAT, GARDEN1_OPERATOR_HAT, GARDEN1_OWNER_HAT);
        mockHats.setWearer(GARDEN1_OPERATOR_HAT, user1, true);

        assertTrue(adapter.isOperatorOf(garden1, user1), "User should be operator");
    }

    function test_isOwnerOf_returnsTrueForHatWearer() public {
        adapter.configureGarden(garden1, GARDEN1_GARDENER_HAT, GARDEN1_OPERATOR_HAT, GARDEN1_OWNER_HAT);
        mockHats.setWearer(GARDEN1_OWNER_HAT, user1, true);

        assertTrue(adapter.isOwnerOf(garden1, user1), "User should be owner");
    }

    function test_roleCheck_respectsHatActiveStatus() public {
        adapter.configureGarden(garden1, GARDEN1_GARDENER_HAT, GARDEN1_OPERATOR_HAT, GARDEN1_OWNER_HAT);
        mockHats.setWearer(GARDEN1_GARDENER_HAT, user1, true);

        assertTrue(adapter.isGardenerOf(garden1, user1), "User should be gardener when hat active");

        // Deactivate the hat
        mockHats.setHatActive(GARDEN1_GARDENER_HAT, false);

        assertFalse(adapter.isGardenerOf(garden1, user1), "User should not be gardener when hat inactive");
    }

    function test_roleCheck_revertsForUnconfiguredGarden() public {
        vm.expectRevert(abi.encodeWithSelector(HatsModule.GardenNotConfigured.selector, garden1));
        adapter.isGardenerOf(garden1, user1);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Multi-Garden Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_multipleGardens_isolatedConfiguration() public {
        // Configure both gardens
        adapter.configureGarden(garden1, GARDEN1_GARDENER_HAT, GARDEN1_OPERATOR_HAT, GARDEN1_OWNER_HAT);
        adapter.configureGarden(garden2, GARDEN2_GARDENER_HAT, GARDEN2_OPERATOR_HAT, GARDEN2_OWNER_HAT);

        // User1 is gardener of garden1
        mockHats.setWearer(GARDEN1_GARDENER_HAT, user1, true);

        // User2 is gardener of garden2
        mockHats.setWearer(GARDEN2_GARDENER_HAT, user2, true);

        // Verify isolation
        assertTrue(adapter.isGardenerOf(garden1, user1), "User1 should be gardener of garden1");
        assertFalse(adapter.isGardenerOf(garden1, user2), "User2 should not be gardener of garden1");
        assertFalse(adapter.isGardenerOf(garden2, user1), "User1 should not be gardener of garden2");
        assertTrue(adapter.isGardenerOf(garden2, user2), "User2 should be gardener of garden2");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // IGardenAccessControl Interface Tests (called by garden)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_isGardener_calledByGarden() public {
        adapter.configureGarden(garden1, GARDEN1_GARDENER_HAT, GARDEN1_OPERATOR_HAT, GARDEN1_OWNER_HAT);
        mockHats.setWearer(GARDEN1_GARDENER_HAT, user1, true);

        // Call as if garden1 is calling
        vm.prank(garden1);
        assertTrue(adapter.isGardener(user1), "User should be gardener when called by garden");
    }

    function test_isOperator_calledByGarden() public {
        adapter.configureGarden(garden1, GARDEN1_GARDENER_HAT, GARDEN1_OPERATOR_HAT, GARDEN1_OWNER_HAT);
        mockHats.setWearer(GARDEN1_OPERATOR_HAT, user1, true);

        vm.prank(garden1);
        assertTrue(adapter.isOperator(user1), "User should be operator when called by garden");
    }

    function test_isOwner_calledByGarden() public {
        adapter.configureGarden(garden1, GARDEN1_GARDENER_HAT, GARDEN1_OPERATOR_HAT, GARDEN1_OWNER_HAT);
        mockHats.setWearer(GARDEN1_OWNER_HAT, user1, true);

        vm.prank(garden1);
        assertTrue(adapter.isOwner(user1), "User should be owner when called by garden");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Admin Functions Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setHatsContract() public {
        MockHats newHats = new MockHats();

        vm.expectEmit(true, true, false, false);
        emit HatsContractUpdated(address(mockHats), address(newHats));

        adapter.setHatsContract(address(newHats));

        assertEq(address(adapter.hats()), address(newHats), "Hats contract should be updated");
    }

    function test_setHatsContract_revertsForNonOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        adapter.setHatsContract(address(0x9999));
    }

    function test_setConfigAuthority() public {
        assertFalse(adapter.configAuthority(configAuthority), "Should not be authority initially");

        adapter.setConfigAuthority(configAuthority, true);
        assertTrue(adapter.configAuthority(configAuthority), "Should be authority after setting");

        adapter.setConfigAuthority(configAuthority, false);
        assertFalse(adapter.configAuthority(configAuthority), "Should not be authority after removal");
    }
}
