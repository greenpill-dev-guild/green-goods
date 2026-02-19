// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { Vm } from "forge-std/Vm.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { HatsModule } from "../../src/modules/Hats.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { IHatsModuleFactory } from "../../src/interfaces/IHatsModuleFactory.sol";
import { ICVSyncPowerFacet } from "../../src/interfaces/ICVSyncPowerFacet.sol";
import { MockHats } from "../../src/mocks/Hats.sol";

/// @notice Mock conviction strategy that records syncPower calls
contract MockConvictionStrategy is ICVSyncPowerFacet {
    address[] public syncedMembers;

    function syncPower(address member) external {
        syncedMembers.push(member);
    }

    function batchSyncPower(address[] calldata members) external {
        for (uint256 i = 0; i < members.length; i++) {
            syncedMembers.push(members[i]);
        }
    }

    function syncedMembersLength() external view returns (uint256) {
        return syncedMembers.length;
    }
}

contract RevertingHatsModuleFactory is IHatsModuleFactory {
    function createHatsModule(address, uint256, bytes calldata, bytes calldata, uint256) external pure returns (address) {
        revert("factory failed");
    }
}

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
    uint256 constant GARDEN1_OWNER_HAT = 1;
    uint256 constant GARDEN1_OPERATOR_HAT = 2;
    uint256 constant GARDEN1_EVALUATOR_HAT = 3;
    uint256 constant GARDEN1_GARDENER_HAT = 4;
    uint256 constant GARDEN1_FUNDER_HAT = 5;
    uint256 constant GARDEN1_COMMUNITY_HAT = 6;

    // Hat IDs for garden2
    uint256 constant GARDEN2_OWNER_HAT = 11;
    uint256 constant GARDEN2_OPERATOR_HAT = 12;
    uint256 constant GARDEN2_EVALUATOR_HAT = 13;
    uint256 constant GARDEN2_GARDENER_HAT = 14;
    uint256 constant GARDEN2_FUNDER_HAT = 15;
    uint256 constant GARDEN2_COMMUNITY_HAT = 16;

    // Events
    event GardenConfigured(
        address indexed garden,
        uint256 ownerHatId,
        uint256 operatorHatId,
        uint256 evaluatorHatId,
        uint256 gardenerHatId,
        uint256 funderHatId,
        uint256 communityHatId
    );
    event GardenDeconfigured(address indexed garden);
    event HatsContractUpdated(address indexed oldHats, address indexed newHats);
    event Upgraded(address indexed implementation);

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
        mockHats.setHatActive(GARDEN1_OWNER_HAT, true);
        mockHats.setHatActive(GARDEN1_OPERATOR_HAT, true);
        mockHats.setHatActive(GARDEN1_EVALUATOR_HAT, true);
        mockHats.setHatActive(GARDEN1_GARDENER_HAT, true);
        mockHats.setHatActive(GARDEN1_FUNDER_HAT, true);
        mockHats.setHatActive(GARDEN1_COMMUNITY_HAT, true);
        mockHats.setHatActive(GARDEN2_OWNER_HAT, true);
        mockHats.setHatActive(GARDEN2_OPERATOR_HAT, true);
        mockHats.setHatActive(GARDEN2_EVALUATOR_HAT, true);
        mockHats.setHatActive(GARDEN2_GARDENER_HAT, true);
        mockHats.setHatActive(GARDEN2_FUNDER_HAT, true);
        mockHats.setHatActive(GARDEN2_COMMUNITY_HAT, true);
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
        emit GardenConfigured(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );

        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );

        assertTrue(adapter.isConfigured(garden1), "Garden should be configured");

        (
            uint256 ownerHat,
            uint256 operatorHat,
            uint256 evaluatorHat,
            uint256 gardenerHat,
            uint256 funderHat,
            uint256 communityHat,
            ,
            bool configured
        ) = adapter.gardenHats(garden1);
        assertEq(ownerHat, GARDEN1_OWNER_HAT, "Owner hat should match");
        assertEq(operatorHat, GARDEN1_OPERATOR_HAT, "Operator hat should match");
        assertEq(evaluatorHat, GARDEN1_EVALUATOR_HAT, "Evaluator hat should match");
        assertEq(gardenerHat, GARDEN1_GARDENER_HAT, "Gardener hat should match");
        assertEq(funderHat, GARDEN1_FUNDER_HAT, "Funder hat should match");
        assertEq(communityHat, GARDEN1_COMMUNITY_HAT, "Community hat should match");
        assertTrue(configured, "Should be configured");
    }

    function test_configureGarden_byGardenItself() public {
        vm.prank(garden1);
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );

        assertTrue(adapter.isConfigured(garden1), "Garden should be configured");
    }

    function test_configureGarden_byConfigAuthority() public {
        adapter.setConfigAuthority(configAuthority, true);

        vm.prank(configAuthority);
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );

        assertTrue(adapter.isConfigured(garden1), "Garden should be configured");
    }

    function test_configureGarden_revertsForUnauthorized() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(HatsModule.NotGardenAdmin.selector, user1, garden1));
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
    }

    function test_configureGarden_revertsOnZeroGarden() public {
        vm.expectRevert(HatsModule.ZeroAddress.selector);
        adapter.configureGarden(
            address(0),
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
    }

    function test_configureGarden_revertsOnZeroHatId() public {
        vm.expectRevert(HatsModule.InvalidHatId.selector);
        adapter.configureGarden(
            garden1,
            0,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );

        vm.expectRevert(HatsModule.InvalidHatId.selector);
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            0,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );

        vm.expectRevert(HatsModule.InvalidHatId.selector);
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            0,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
    }

    function test_deconfigureGarden() public {
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        assertTrue(adapter.isConfigured(garden1), "Garden should be configured");

        vm.expectEmit(true, false, false, false);
        emit GardenDeconfigured(garden1);

        adapter.deconfigureGarden(garden1);
        assertFalse(adapter.isConfigured(garden1), "Garden should not be configured");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Garden Configuration Lifecycle Tests (L2)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_lifecycle_configureDeconfigureReconfigure() public {
        // Phase 1: Configure with original hats
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        assertTrue(adapter.isConfigured(garden1), "Should be configured after initial setup");

        // Grant a role in the configured state
        mockHats.setWearer(GARDEN1_OWNER_HAT, owner, true);
        mockHats.setWearer(GARDEN1_GARDENER_HAT, user1, true);
        assertTrue(adapter.isGardenerOf(garden1, user1), "User1 should be gardener");

        // Phase 2: Deconfigure
        adapter.deconfigureGarden(garden1);
        assertFalse(adapter.isConfigured(garden1), "Should not be configured after deconfigure");

        // Role checks should revert for unconfigured garden
        vm.expectRevert(abi.encodeWithSelector(HatsModule.GardenNotConfigured.selector, garden1));
        adapter.isGardenerOf(garden1, user1);

        // Phase 3: Reconfigure with DIFFERENT hat IDs (simulating a hat tree rebuild)
        adapter.configureGarden(
            garden1,
            GARDEN2_OWNER_HAT,
            GARDEN2_OPERATOR_HAT,
            GARDEN2_EVALUATOR_HAT,
            GARDEN2_GARDENER_HAT,
            GARDEN2_FUNDER_HAT,
            GARDEN2_COMMUNITY_HAT
        );
        assertTrue(adapter.isConfigured(garden1), "Should be configured after reconfigure");

        // Verify the new hat IDs are in effect
        (
            uint256 ownerHat,
            uint256 operatorHat,
            uint256 evaluatorHat,
            uint256 gardenerHat,
            uint256 funderHat,
            uint256 communityHat,
            ,
            bool configured
        ) = adapter.gardenHats(garden1);
        assertEq(ownerHat, GARDEN2_OWNER_HAT, "Owner hat should use new IDs");
        assertEq(operatorHat, GARDEN2_OPERATOR_HAT, "Operator hat should use new IDs");
        assertEq(evaluatorHat, GARDEN2_EVALUATOR_HAT, "Evaluator hat should use new IDs");
        assertEq(gardenerHat, GARDEN2_GARDENER_HAT, "Gardener hat should use new IDs");
        assertEq(funderHat, GARDEN2_FUNDER_HAT, "Funder hat should use new IDs");
        assertEq(communityHat, GARDEN2_COMMUNITY_HAT, "Community hat should use new IDs");
        assertTrue(configured, "Should show as configured");

        // Old hat wearer (user1 on GARDEN1_GARDENER_HAT) should NOT be a gardener
        // because garden1 now uses GARDEN2_GARDENER_HAT
        assertFalse(adapter.isGardenerOf(garden1, user1), "User1 should not be gardener with new hats");

        // Grant on new hat and verify
        mockHats.setWearer(GARDEN2_OWNER_HAT, owner, true);
        mockHats.setWearer(GARDEN2_GARDENER_HAT, user2, true);
        assertTrue(adapter.isGardenerOf(garden1, user2), "User2 should be gardener with new hats");
    }

    function test_lifecycle_deconfigureRevertsForUnauthorized() public {
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );

        vm.prank(user1);
        vm.expectRevert();
        adapter.deconfigureGarden(garden1);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Role Check Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_isGardenerOf_returnsTrueForHatWearer() public {
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        mockHats.setWearer(GARDEN1_GARDENER_HAT, user1, true);

        assertTrue(adapter.isGardenerOf(garden1, user1), "User should be gardener");
    }

    function test_isGardenerOf_returnsFalseForNonWearer() public {
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );

        assertFalse(adapter.isGardenerOf(garden1, user1), "User should not be gardener");
    }

    function test_isOperatorOf_returnsTrueForHatWearer() public {
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        mockHats.setWearer(GARDEN1_OPERATOR_HAT, user1, true);

        assertTrue(adapter.isOperatorOf(garden1, user1), "User should be operator");
    }

    function test_isOwnerOf_returnsTrueForHatWearer() public {
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        mockHats.setWearer(GARDEN1_OWNER_HAT, user1, true);

        assertTrue(adapter.isOwnerOf(garden1, user1), "User should be owner");
    }

    function test_isEvaluatorOf_returnsTrueForHatWearer() public {
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        mockHats.setWearer(GARDEN1_EVALUATOR_HAT, user1, true);

        assertTrue(adapter.isEvaluatorOf(garden1, user1), "User should be evaluator");
    }

    function test_isFunderOf_returnsTrueForHatWearer() public {
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        mockHats.setWearer(GARDEN1_FUNDER_HAT, user1, true);

        assertTrue(adapter.isFunderOf(garden1, user1), "User should be funder");
    }

    function test_isCommunityOf_returnsTrueForHatWearer() public {
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        mockHats.setWearer(GARDEN1_COMMUNITY_HAT, user1, true);

        assertTrue(adapter.isCommunityOf(garden1, user1), "User should be community");
    }

    function test_roleCheck_respectsHatActiveStatus() public {
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
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
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        adapter.configureGarden(
            garden2,
            GARDEN2_OWNER_HAT,
            GARDEN2_OPERATOR_HAT,
            GARDEN2_EVALUATOR_HAT,
            GARDEN2_GARDENER_HAT,
            GARDEN2_FUNDER_HAT,
            GARDEN2_COMMUNITY_HAT
        );

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
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        mockHats.setWearer(GARDEN1_GARDENER_HAT, user1, true);

        // Call as if garden1 is calling
        vm.prank(garden1);
        assertTrue(adapter.isGardener(user1), "User should be gardener when called by garden");
    }

    function test_isOperator_calledByGarden() public {
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        mockHats.setWearer(GARDEN1_OPERATOR_HAT, user1, true);

        vm.prank(garden1);
        assertTrue(adapter.isOperator(user1), "User should be operator when called by garden");
    }

    function test_isOwner_calledByGarden() public {
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
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

    // ═══════════════════════════════════════════════════════════════════════════
    // Batch Operations Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_grantRoles_batchGrantsMultipleRoles() public {
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        mockHats.setWearer(GARDEN1_OWNER_HAT, owner, true);

        address[] memory accounts = new address[](2);
        IHatsModule.GardenRole[] memory roles = new IHatsModule.GardenRole[](2);
        accounts[0] = user1;
        accounts[1] = user2;
        roles[0] = IHatsModule.GardenRole.Gardener;
        roles[1] = IHatsModule.GardenRole.Evaluator;

        adapter.grantRoles(garden1, accounts, roles);

        assertTrue(adapter.isGardenerOf(garden1, user1), "User1 should be gardener");
        assertTrue(adapter.isEvaluatorOf(garden1, user2), "User2 should be evaluator");
    }

    function test_grantRoles_revertsOnArrayMismatch() public {
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        mockHats.setWearer(GARDEN1_OWNER_HAT, owner, true);

        address[] memory accounts = new address[](2);
        IHatsModule.GardenRole[] memory roles = new IHatsModule.GardenRole[](1);

        vm.expectRevert(HatsModule.ArrayLengthMismatch.selector);
        adapter.grantRoles(garden1, accounts, roles);
    }

    function test_revokeRoles_batchRevokesMultipleRoles() public {
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        mockHats.setWearer(GARDEN1_OWNER_HAT, owner, true);
        mockHats.setWearer(GARDEN1_GARDENER_HAT, user1, true);
        mockHats.setWearer(GARDEN1_EVALUATOR_HAT, user2, true);

        address[] memory accounts = new address[](2);
        IHatsModule.GardenRole[] memory roles = new IHatsModule.GardenRole[](2);
        accounts[0] = user1;
        accounts[1] = user2;
        roles[0] = IHatsModule.GardenRole.Gardener;
        roles[1] = IHatsModule.GardenRole.Evaluator;

        adapter.revokeRoles(garden1, accounts, roles);

        assertFalse(adapter.isGardenerOf(garden1, user1), "User1 should not be gardener");
        assertFalse(adapter.isEvaluatorOf(garden1, user2), "User2 should not be evaluator");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Eligibility Module Recovery Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_createGardenHatTree_succeedsWhenEligibilityModuleFails() public {
        address gardenToken = address(0x7777);
        adapter.setGardenToken(gardenToken);

        uint256 gardensHatId = mockHats.mintTopHat(address(adapter), "Green Goods Gardens", "");
        adapter.setProtocolHatIds(0, gardensHatId, 0);

        adapter.setEligibilityModules(address(0x1111), address(0x2222));
        adapter.setEligibilityModuleFactory(address(new RevertingHatsModuleFactory()));

        vm.prank(gardenToken);
        adapter.createGardenHatTree(garden2, "Garden Two", address(0x9999));

        assertTrue(adapter.isConfigured(garden2), "Garden should be configured despite eligibility failure");
    }

    function test_createGardenHatTree_emitsEventOnEligibilityFailure() public {
        address gardenToken = address(0x7777);
        adapter.setGardenToken(gardenToken);

        uint256 gardensHatId = mockHats.mintTopHat(address(adapter), "Green Goods Gardens", "");
        adapter.setProtocolHatIds(0, gardensHatId, 0);

        adapter.setEligibilityModules(address(0x1111), address(0x2222));
        adapter.setEligibilityModuleFactory(address(new RevertingHatsModuleFactory()));

        vm.recordLogs();
        vm.prank(gardenToken);
        adapter.createGardenHatTree(garden2, "Garden Two", address(0x9999));

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 sig = keccak256("EligibilityModuleCreationFailed(uint256,string)");
        bool found;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics.length > 0 && logs[i].topics[0] == sig) {
                found = true;
                break;
            }
        }
        assertTrue(found, "Expected EligibilityModuleCreationFailed event");
    }

    function test_createGardenHatTree_revertsWhenHatsNotConfigured() public {
        address gardenToken = address(0x7777);
        adapter.setGardenToken(gardenToken);

        vm.prank(gardenToken);
        vm.expectRevert(HatsModule.HatsNotConfigured.selector);
        adapter.createGardenHatTree(garden2, "Garden Two", address(0x9999));
    }

    function test_createGardenHatTree_revertsWhenNotGardenToken() public {
        address gardenToken = address(0x7777);
        adapter.setGardenToken(gardenToken);

        uint256 gardensHatId = mockHats.mintTopHat(address(adapter), "Green Goods Gardens", "");
        adapter.setProtocolHatIds(0, gardensHatId, 0);

        vm.expectRevert(abi.encodeWithSelector(HatsModule.NotGardenToken.selector, owner));
        adapter.createGardenHatTree(garden2, "Garden Two", address(0x9999));
    }

    function test_createGardenHatTree_createsAllSixRoleHats() public {
        address gardenToken = address(0x7777);
        adapter.setGardenToken(gardenToken);

        uint256 gardensHatId = mockHats.mintTopHat(address(adapter), "Green Goods Gardens", "");
        adapter.setProtocolHatIds(0, gardensHatId, 0);

        vm.prank(gardenToken);
        adapter.createGardenHatTree(garden2, "Garden Two", address(0x9999));

        (
            uint256 ownerHatId,
            uint256 operatorHatId,
            uint256 evaluatorHatId,
            uint256 gardenerHatId,
            uint256 funderHatId,
            uint256 communityHatId,
            ,
            bool configured
        ) = adapter.gardenHats(garden2);

        assertTrue(configured, "Garden should be configured");
        assertGt(ownerHatId, 0, "Owner hat should be set");
        assertGt(operatorHatId, 0, "Operator hat should be set");
        assertGt(evaluatorHatId, 0, "Evaluator hat should be set");
        assertGt(gardenerHatId, 0, "Gardener hat should be set");
        assertGt(funderHatId, 0, "Funder hat should be set");
        assertGt(communityHatId, 0, "Community hat should be set");
    }

    function test_createGardenHatTree_mintsAdminHatToGardenAndModule() public {
        address gardenToken = address(0x7777);
        adapter.setGardenToken(gardenToken);

        uint256 gardensHatId = mockHats.mintTopHat(address(adapter), "Green Goods Gardens", "");
        adapter.setProtocolHatIds(0, gardensHatId, 0);

        vm.prank(gardenToken);
        uint256 adminHatId = adapter.createGardenHatTree(garden2, "Garden Two", address(0x9999));

        assertTrue(mockHats.isWearerOfHat(garden2, adminHatId), "Garden should wear admin hat");
        assertTrue(mockHats.isWearerOfHat(address(adapter), adminHatId), "Module should wear admin hat");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UUPS Upgrade Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_upgrade_preservesState() public {
        adapter.setGardenToken(address(0x8888));
        adapter.setEligibilityModules(address(0x1111), address(0x2222));
        adapter.setCommunityMinBalance(42);

        HatsModule newImpl = new HatsModule();
        adapter.upgradeTo(address(newImpl));

        assertEq(adapter.gardenToken(), address(0x8888), "Garden token should be preserved");
        assertEq(address(adapter.hats()), address(mockHats), "Hats address should be preserved");
        assertEq(adapter.communityMinBalance(), 42, "Min balance should be preserved");
    }

    function test_upgrade_revertsForNonOwner() public {
        HatsModule newImpl = new HatsModule();
        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        adapter.upgradeTo(address(newImpl));
    }

    function test_upgrade_emitsCorrectEvents() public {
        HatsModule newImpl = new HatsModule();
        vm.expectEmit(true, false, false, true);
        emit Upgraded(address(newImpl));
        adapter.upgradeTo(address(newImpl));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Revocation Tests (C1 fix verification)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_revokeRole_removesHatFromWearer() public {
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        mockHats.setWearer(GARDEN1_OWNER_HAT, owner, true);
        mockHats.setWearer(GARDEN1_GARDENER_HAT, user1, true);

        assertTrue(adapter.isGardenerOf(garden1, user1), "User1 should be gardener before revoke");

        adapter.revokeRole(garden1, user1, IHatsModule.GardenRole.Gardener);

        assertFalse(adapter.isGardenerOf(garden1, user1), "User1 should not be gardener after revoke");
    }

    function test_revokeRole_idempotentWhenNotWearer() public {
        // C1 fix: revoking a role the user doesn't wear should not revert
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        mockHats.setWearer(GARDEN1_OWNER_HAT, owner, true);

        // user1 does NOT wear the gardener hat
        assertFalse(adapter.isGardenerOf(garden1, user1), "User1 should not be gardener");

        // Should not revert — idempotent revocation
        adapter.revokeRole(garden1, user1, IHatsModule.GardenRole.Gardener);

        assertFalse(adapter.isGardenerOf(garden1, user1), "User1 should still not be gardener");
    }

    function test_revokeRole_canRevokeAndRegrantAndRevokeAgain() public {
        // C1 fix: the original bug was that a second revocation would fail
        // because the dead address already wore the hat from the first revocation
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        mockHats.setWearer(GARDEN1_OWNER_HAT, owner, true);
        mockHats.setWearer(GARDEN1_GARDENER_HAT, user1, true);

        // First revoke
        adapter.revokeRole(garden1, user1, IHatsModule.GardenRole.Gardener);
        assertFalse(adapter.isGardenerOf(garden1, user1), "Should not be gardener after first revoke");

        // Re-grant
        adapter.grantRole(garden1, user1, IHatsModule.GardenRole.Gardener);
        assertTrue(adapter.isGardenerOf(garden1, user1), "Should be gardener after re-grant");

        // Second revoke — this was the bug scenario
        adapter.revokeRole(garden1, user1, IHatsModule.GardenRole.Gardener);
        assertFalse(adapter.isGardenerOf(garden1, user1), "Should not be gardener after second revoke");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Role Hierarchy Sub-Grant Tests (C2 fix verification)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_grantOwner_autoGrantsOperatorAndGardener() public {
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        mockHats.setWearer(GARDEN1_OWNER_HAT, owner, true);

        // Grant Owner to user1 — cascades to Operator + Gardener (NOT Evaluator)
        // Evaluator is independent: only cascaded when Operator is directly granted
        adapter.grantRole(garden1, user1, IHatsModule.GardenRole.Owner);

        assertTrue(adapter.isOwnerOf(garden1, user1), "User1 should be owner");
        assertTrue(adapter.isOperatorOf(garden1, user1), "User1 should auto-get operator");
        assertTrue(adapter.isGardenerOf(garden1, user1), "User1 should auto-get gardener");
        // Evaluator, Funder, and Community are NOT auto-granted from Owner
        assertFalse(adapter.isEvaluatorOf(garden1, user1), "User1 should not auto-get evaluator");
        assertFalse(adapter.isFunderOf(garden1, user1), "User1 should not auto-get funder");
        assertFalse(adapter.isCommunityOf(garden1, user1), "User1 should not auto-get community");
    }

    function test_grantOperator_autoGrantsEvaluatorGardener() public {
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        mockHats.setWearer(GARDEN1_OWNER_HAT, owner, true);

        // Grant Operator to user1 — should cascade to Evaluator, Gardener
        adapter.grantRole(garden1, user1, IHatsModule.GardenRole.Operator);

        assertTrue(adapter.isOperatorOf(garden1, user1), "User1 should be operator");
        assertTrue(adapter.isEvaluatorOf(garden1, user1), "User1 should auto-get evaluator");
        assertTrue(adapter.isGardenerOf(garden1, user1), "User1 should auto-get gardener");
        // Owner is NOT auto-granted
        assertFalse(adapter.isOwnerOf(garden1, user1), "User1 should not auto-get owner");
    }

    function test_grantGardener_noSubGrants() public {
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        mockHats.setWearer(GARDEN1_OWNER_HAT, owner, true);

        // Grant Gardener to user1 — no sub-grants
        adapter.grantRole(garden1, user1, IHatsModule.GardenRole.Gardener);

        assertTrue(adapter.isGardenerOf(garden1, user1), "User1 should be gardener");
        assertFalse(adapter.isEvaluatorOf(garden1, user1), "User1 should not auto-get evaluator");
        assertFalse(adapter.isOperatorOf(garden1, user1), "User1 should not auto-get operator");
        assertFalse(adapter.isOwnerOf(garden1, user1), "User1 should not auto-get owner");
    }

    function test_revokeRole_twoUsersWithSameHatType() public {
        // L1: Validates H3 fix — revoking the same hat type from two different users
        // must succeed because each revocation uses a unique burn address.
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        mockHats.setWearer(GARDEN1_OWNER_HAT, owner, true);
        mockHats.setWearer(GARDEN1_GARDENER_HAT, user1, true);
        mockHats.setWearer(GARDEN1_GARDENER_HAT, user2, true);

        assertTrue(adapter.isGardenerOf(garden1, user1), "User1 should be gardener");
        assertTrue(adapter.isGardenerOf(garden1, user2), "User2 should be gardener");

        // First revocation
        adapter.revokeRole(garden1, user1, IHatsModule.GardenRole.Gardener);
        assertFalse(adapter.isGardenerOf(garden1, user1), "User1 should not be gardener after revoke");

        // Second revocation of same hat type — this was the H3 bug scenario
        adapter.revokeRole(garden1, user2, IHatsModule.GardenRole.Gardener);
        assertFalse(adapter.isGardenerOf(garden1, user2), "User2 should not be gardener after revoke");
    }

    function test_revokeRole_threeSequentialRevocationsOfSameHat() public {
        // Stress test: three revoke→re-grant→revoke cycles on the same hat type
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        mockHats.setWearer(GARDEN1_OWNER_HAT, owner, true);
        mockHats.setWearer(GARDEN1_GARDENER_HAT, user1, true);

        for (uint256 i = 0; i < 3; i++) {
            adapter.revokeRole(garden1, user1, IHatsModule.GardenRole.Gardener);
            assertFalse(adapter.isGardenerOf(garden1, user1), "Should not be gardener after revoke");
            adapter.grantRole(garden1, user1, IHatsModule.GardenRole.Gardener);
            assertTrue(adapter.isGardenerOf(garden1, user1), "Should be gardener after re-grant");
        }
    }

    function test_revokeRole_revertsForUnauthorized() public {
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        mockHats.setWearer(GARDEN1_GARDENER_HAT, user1, true);

        // user2 is not owner or operator — should revert
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSelector(HatsModule.NotGardenAdmin.selector, user2, garden1));
        adapter.revokeRole(garden1, user1, IHatsModule.GardenRole.Gardener);
    }

    function test_grantRole_allowsGardenSelfManagement() public {
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );

        vm.prank(garden1);
        adapter.grantRole(garden1, user1, IHatsModule.GardenRole.Gardener);

        assertTrue(adapter.isGardenerOf(garden1, user1), "Garden should be able to self-grant gardener");
    }

    function test_grantRole_revertsForZeroAddress() public {
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        mockHats.setWearer(GARDEN1_OWNER_HAT, owner, true);

        vm.expectRevert(HatsModule.ZeroAddress.selector);
        adapter.grantRole(garden1, address(0), IHatsModule.GardenRole.Gardener);
    }

    function test_revokeRole_revertsForZeroAddress() public {
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        mockHats.setWearer(GARDEN1_OWNER_HAT, owner, true);

        vm.expectRevert(HatsModule.ZeroAddress.selector);
        adapter.revokeRole(garden1, address(0), IHatsModule.GardenRole.Gardener);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Conviction Power Sync on Grant Tests (H-7 fix verification)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_grantRole_syncsConvictionPower() public {
        // Configure garden
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        mockHats.setWearer(GARDEN1_OWNER_HAT, owner, true);

        // Deploy and register a mock conviction strategy
        MockConvictionStrategy strategy = new MockConvictionStrategy();
        address[] memory strategies = new address[](1);
        strategies[0] = address(strategy);
        adapter.setConvictionStrategies(garden1, strategies);

        // Grant gardener role to user1
        adapter.grantRole(garden1, user1, IHatsModule.GardenRole.Gardener);

        // Verify syncPower was called for user1
        assertEq(strategy.syncedMembersLength(), 1, "syncPower should be called once on grant");
        assertEq(strategy.syncedMembers(0), user1, "syncPower should be called for the granted user");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Protocol Gardener Hat Auto-Mint Tests
    // ═══════════════════════════════════════════════════════════════════════════

    uint256 constant PROTOCOL_GARDENERS_HAT = 100;

    function _setupProtocolGardenersHat() internal {
        // Activate the protocol gardeners hat
        mockHats.setHatActive(PROTOCOL_GARDENERS_HAT, true);
        // Set the protocol gardeners hat ID on the adapter
        adapter.setProtocolHatIds(0, 0, PROTOCOL_GARDENERS_HAT);
    }

    function _configureGarden1WithOwner() internal {
        adapter.configureGarden(
            garden1,
            GARDEN1_OWNER_HAT,
            GARDEN1_OPERATOR_HAT,
            GARDEN1_EVALUATOR_HAT,
            GARDEN1_GARDENER_HAT,
            GARDEN1_FUNDER_HAT,
            GARDEN1_COMMUNITY_HAT
        );
        mockHats.setWearer(GARDEN1_OWNER_HAT, owner, true);
    }

    function test_grantRole_autoMintsProtocolGardenersHat() public {
        _setupProtocolGardenersHat();
        _configureGarden1WithOwner();

        // Before grant, user1 should NOT wear protocol gardeners hat
        assertFalse(
            mockHats.isWearerOfHat(user1, PROTOCOL_GARDENERS_HAT),
            "User should not wear protocol gardeners hat before grant"
        );

        // Grant gardener role to user1
        adapter.grantRole(garden1, user1, IHatsModule.GardenRole.Gardener);

        // After grant, user1 SHOULD wear both garden gardener hat AND protocol gardeners hat
        assertTrue(mockHats.isWearerOfHat(user1, GARDEN1_GARDENER_HAT), "User should wear garden gardener hat");
        assertTrue(
            mockHats.isWearerOfHat(user1, PROTOCOL_GARDENERS_HAT),
            "User should also wear protocol gardeners hat after any role grant"
        );
    }

    function test_grantRole_protocolHatIdempotentForExistingWearer() public {
        _setupProtocolGardenersHat();
        _configureGarden1WithOwner();

        // Pre-assign protocol gardeners hat to user1
        mockHats.mintHat(PROTOCOL_GARDENERS_HAT, user1);
        assertTrue(mockHats.isWearerOfHat(user1, PROTOCOL_GARDENERS_HAT), "Should already wear protocol hat");

        // Grant gardener role — should NOT revert even though user1 already has protocol hat
        adapter.grantRole(garden1, user1, IHatsModule.GardenRole.Gardener);

        // Still wearing both hats
        assertTrue(mockHats.isWearerOfHat(user1, GARDEN1_GARDENER_HAT), "Should wear garden hat");
        assertTrue(mockHats.isWearerOfHat(user1, PROTOCOL_GARDENERS_HAT), "Should still wear protocol hat");
    }

    function test_grantRole_skipsProtocolMintWhenHatIdZero() public {
        // Don't setup protocol hat — leave protocolGardenersHatId = 0
        _configureGarden1WithOwner();

        // Grant gardener role — should succeed without protocol hat mint
        adapter.grantRole(garden1, user1, IHatsModule.GardenRole.Gardener);

        assertTrue(mockHats.isWearerOfHat(user1, GARDEN1_GARDENER_HAT), "Should wear garden hat");
        // No protocol hat to check (ID is 0)
    }

    function test_grantRole_protocolMintGracefulOnInactiveHat() public {
        _setupProtocolGardenersHat();
        _configureGarden1WithOwner();

        // Deactivate the protocol gardeners hat — simulates hat being toggled off
        mockHats.setHatActive(PROTOCOL_GARDENERS_HAT, false);

        // Grant should still succeed (protocol mint is best-effort)
        adapter.grantRole(garden1, user1, IHatsModule.GardenRole.Gardener);

        // Garden hat should be granted
        assertTrue(mockHats.isWearerOfHat(user1, GARDEN1_GARDENER_HAT), "Should wear garden hat");
        // Protocol hat NOT worn because hat is inactive (mint failed silently)
        assertFalse(
            mockHats.isWearerOfHat(user1, PROTOCOL_GARDENERS_HAT), "Should NOT wear protocol hat when hat is inactive"
        );
    }
}
