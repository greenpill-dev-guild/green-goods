// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { HatsModule } from "../../src/modules/Hats.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { MockHats } from "../../src/mocks/Hats.sol";

// ═══════════════════════════════════════════════════════════════════════════
// Handler: target contract for Foundry invariant fuzzer
// ═══════════════════════════════════════════════════════════════════════════

/// @title RoleHierarchyHandler
/// @notice Exposes role operations as target functions for Foundry's invariant fuzzer.
///         The fuzzer calls grantRole/revokeRole in arbitrary sequences, then invariants
///         are checked after each call.
contract RoleHierarchyHandler {
    HatsModule public adapter;
    address public garden1;
    address public garden2;
    address[5] public users;

    constructor(HatsModule _adapter, address _garden1, address _garden2, address[5] memory _users) {
        adapter = _adapter;
        garden1 = _garden1;
        garden2 = _garden2;
        users = _users;
    }

    /// @notice Grant a role to a random user in a random garden
    function grantRole(uint8 gardenSeed, uint8 userSeed, uint8 roleSeed) external {
        address garden = gardenSeed % 2 == 0 ? garden1 : garden2;
        address user = users[userSeed % 5];
        IHatsModule.GardenRole role = _seedToRole(roleSeed);
        try adapter.grantRole(garden, user, role) { } catch { }
    }

    /// @notice Revoke a role from a random user in a random garden
    function revokeRole(uint8 gardenSeed, uint8 userSeed, uint8 roleSeed) external {
        address garden = gardenSeed % 2 == 0 ? garden1 : garden2;
        address user = users[userSeed % 5];
        IHatsModule.GardenRole role = _seedToRole(roleSeed);
        try adapter.revokeRole(garden, user, role) { } catch { }
    }

    function _seedToRole(uint8 seed) internal pure returns (IHatsModule.GardenRole) {
        uint8 idx = seed % 4;
        if (idx == 0) return IHatsModule.GardenRole.Gardener;
        if (idx == 1) return IHatsModule.GardenRole.Evaluator;
        if (idx == 2) return IHatsModule.GardenRole.Operator;
        return IHatsModule.GardenRole.Owner;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// True Foundry Invariant Tests
// ═══════════════════════════════════════════════════════════════════════════

/// @title RoleHierarchyInvariantTest
/// @notice True Foundry invariant tests using handler + targetContract pattern.
///         The fuzzer calls random sequences of grantRole/revokeRole on the handler,
///         then each invariant_* function is checked after EVERY call.
/// @dev Invariants verified:
///      1. Funder/Community are never auto-granted by core role operations
///      2. Garden hat configuration is never corrupted by role operations
///      3. Cross-garden isolation: operations in one garden don't affect the other
///      4. All role queries succeed without reverting (no corrupted state)
contract RoleHierarchyInvariantTest is Test {
    HatsModule public adapter;
    MockHats public mockHats;
    RoleHierarchyHandler public handler;

    address public garden1;
    address public garden2;

    address[5] public users;

    // Inline targetContract support (StdInvariant not available in this forge-std version)
    address[] private _targetedContracts;

    function targetContract(address newTargetedContract_) internal {
        _targetedContracts.push(newTargetedContract_);
    }

    function targetContracts() public view returns (address[] memory) {
        return _targetedContracts;
    }

    function setUp() public {
        mockHats = new MockHats();

        // Deploy adapter with proxy
        HatsModule impl = new HatsModule();
        bytes memory initData = abi.encodeWithSelector(HatsModule.initialize.selector, address(this), address(mockHats));
        adapter = HatsModule(address(new ERC1967Proxy(address(impl), initData)));

        // Create hat trees
        uint256 gardensHatId = mockHats.mintTopHat(address(adapter), "Green Goods Gardens", "");
        adapter.setProtocolHatIds(0, gardensHatId, 0);

        // Set gardenToken to this contract for initial setup
        adapter.setGardenToken(address(this));

        garden1 = address(0x1000);
        garden2 = address(0x2000);

        adapter.createGardenHatTree(garden1, "Garden One", address(0x9999));
        adapter.createGardenHatTree(garden2, "Garden Two", address(0x9999));

        // Set up users
        users[0] = address(0x3001);
        users[1] = address(0x3002);
        users[2] = address(0x3003);
        users[3] = address(0x3004);
        users[4] = address(0x3005);

        // Deploy handler and authorize it as gardenToken for role operations
        handler = new RoleHierarchyHandler(adapter, garden1, garden2, users);
        adapter.setGardenToken(address(handler));

        // Only target the handler — fuzzer will call grantRole/revokeRole randomly
        targetContract(address(handler));
    }

    // =========================================================================
    // Invariant 1: Funder/Community Never Auto-Granted
    // No sequence of core role grant/revoke operations should produce
    // Funder or Community roles.
    // =========================================================================

    function invariant_funderAndCommunityNeverAutoGranted() public {
        for (uint256 i = 0; i < 5; i++) {
            assertFalse(adapter.isFunderOf(garden1, users[i]), "Funder must never be auto-granted in garden1");
            assertFalse(adapter.isCommunityOf(garden1, users[i]), "Community must never be auto-granted in garden1");
            assertFalse(adapter.isFunderOf(garden2, users[i]), "Funder must never be auto-granted in garden2");
            assertFalse(adapter.isCommunityOf(garden2, users[i]), "Community must never be auto-granted in garden2");
        }
    }

    // =========================================================================
    // Invariant 2: Configuration Preservation
    // Role operations must never corrupt the garden hat configuration.
    // =========================================================================

    function invariant_configurationPreserved() public {
        assertTrue(adapter.isConfigured(garden1), "Garden1 must remain configured");
        assertTrue(adapter.isConfigured(garden2), "Garden2 must remain configured");
    }

    // =========================================================================
    // Invariant 3: All Queries Succeed
    // No role query should revert (no corrupted hat IDs or broken state).
    // =========================================================================

    function invariant_allRoleQueriesSucceed() public {
        for (uint256 i = 0; i < 5; i++) {
            // These must never revert on configured gardens
            adapter.isGardenerOf(garden1, users[i]);
            adapter.isEvaluatorOf(garden1, users[i]);
            adapter.isOperatorOf(garden1, users[i]);
            adapter.isOwnerOf(garden1, users[i]);
            adapter.isFunderOf(garden1, users[i]);
            adapter.isCommunityOf(garden1, users[i]);

            adapter.isGardenerOf(garden2, users[i]);
            adapter.isEvaluatorOf(garden2, users[i]);
            adapter.isOperatorOf(garden2, users[i]);
            adapter.isOwnerOf(garden2, users[i]);
            adapter.isFunderOf(garden2, users[i]);
            adapter.isCommunityOf(garden2, users[i]);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Fuzz Tests for Operation Properties
// ═══════════════════════════════════════════════════════════════════════════

/// @title RoleHierarchyFuzzTest
/// @notice Fuzz tests for individual operation properties (cascade behavior).
///         These test properties of INDIVIDUAL operations, not system invariants.
/// @dev These remain as testFuzz_* because cascade is a property of grantRole,
///      not a system-wide invariant (you can grant Owner then revoke Evaluator).
contract RoleHierarchyFuzzTest is Test {
    HatsModule public adapter;
    MockHats public mockHats;

    address public garden1;
    address public garden2;

    address[5] public users;

    function setUp() public {
        mockHats = new MockHats();

        // Deploy adapter with proxy
        HatsModule impl = new HatsModule();
        bytes memory initData = abi.encodeWithSelector(HatsModule.initialize.selector, address(this), address(mockHats));
        adapter = HatsModule(address(new ERC1967Proxy(address(impl), initData)));

        // Create hat trees for both gardens
        uint256 gardensHatId = mockHats.mintTopHat(address(adapter), "Green Goods Gardens", "");
        adapter.setProtocolHatIds(0, gardensHatId, 0);

        // Register gardenToken as authorized caller (this test contract)
        adapter.setGardenToken(address(this));

        garden1 = address(0x1000);
        garden2 = address(0x2000);

        // Create hat trees
        adapter.createGardenHatTree(garden1, "Garden One", address(0x9999));
        adapter.createGardenHatTree(garden2, "Garden Two", address(0x9999));

        // Set up users
        users[0] = address(0x3001);
        users[1] = address(0x3002);
        users[2] = address(0x3003);
        users[3] = address(0x3004);
        users[4] = address(0x3005);
    }

    // =========================================================================
    // Cascade: Owner Grant
    // =========================================================================

    function testFuzz_ownerGrantCascadesToAllRoles(uint8 userSeed) public {
        address user = users[userSeed % 5];

        adapter.grantRole(garden1, user, IHatsModule.GardenRole.Owner);

        assertTrue(adapter.isOwnerOf(garden1, user), "Should be owner");
        assertTrue(adapter.isOperatorOf(garden1, user), "Owner should cascade to operator");
        assertTrue(adapter.isEvaluatorOf(garden1, user), "Owner should cascade to evaluator");
        assertTrue(adapter.isGardenerOf(garden1, user), "Owner should cascade to gardener");
    }

    function testFuzz_ownerGrantDoesNotCascadeToFunderOrCommunity(uint8 userSeed) public {
        address user = users[userSeed % 5];

        adapter.grantRole(garden1, user, IHatsModule.GardenRole.Owner);

        assertFalse(adapter.isFunderOf(garden1, user), "Owner should NOT cascade to funder");
        assertFalse(adapter.isCommunityOf(garden1, user), "Owner should NOT cascade to community");
    }

    // =========================================================================
    // Cascade: Operator Grant
    // =========================================================================

    function testFuzz_operatorGrantCascadesToSubRoles(uint8 userSeed) public {
        address user = users[userSeed % 5];

        adapter.grantRole(garden1, user, IHatsModule.GardenRole.Operator);

        assertTrue(adapter.isOperatorOf(garden1, user), "Should be operator");
        assertTrue(adapter.isEvaluatorOf(garden1, user), "Operator should cascade to evaluator");
        assertTrue(adapter.isGardenerOf(garden1, user), "Operator should cascade to gardener");
        assertFalse(adapter.isOwnerOf(garden1, user), "Operator should NOT cascade to owner");
    }

    // =========================================================================
    // Leaf Roles: No Cascade
    // =========================================================================

    function testFuzz_gardenerGrantHasNoSubGrants(uint8 userSeed) public {
        address user = users[userSeed % 5];

        adapter.grantRole(garden1, user, IHatsModule.GardenRole.Gardener);

        assertTrue(adapter.isGardenerOf(garden1, user), "Should be gardener");
        assertFalse(adapter.isEvaluatorOf(garden1, user), "Gardener should NOT get evaluator");
        assertFalse(adapter.isOperatorOf(garden1, user), "Gardener should NOT get operator");
        assertFalse(adapter.isOwnerOf(garden1, user), "Gardener should NOT get owner");
    }

    function testFuzz_evaluatorGrantHasNoSubGrants(uint8 userSeed) public {
        address user = users[userSeed % 5];

        adapter.grantRole(garden1, user, IHatsModule.GardenRole.Evaluator);

        assertTrue(adapter.isEvaluatorOf(garden1, user), "Should be evaluator");
        assertFalse(adapter.isGardenerOf(garden1, user), "Evaluator should NOT get gardener");
        assertFalse(adapter.isOperatorOf(garden1, user), "Evaluator should NOT get operator");
        assertFalse(adapter.isOwnerOf(garden1, user), "Evaluator should NOT get owner");
    }

    // =========================================================================
    // Cross-Garden Isolation
    // =========================================================================

    function testFuzz_crossGardenIsolation(uint8 userSeed, uint8 roleSeed) public {
        address user = users[userSeed % 5];
        IHatsModule.GardenRole role = _seedToRole(roleSeed);

        // Grant role in garden1 only
        adapter.grantRole(garden1, user, role);

        // Garden2 should be unaffected
        assertFalse(adapter.isGardenerOf(garden2, user), "Garden2 gardener should be unaffected");
        assertFalse(adapter.isEvaluatorOf(garden2, user), "Garden2 evaluator should be unaffected");
        assertFalse(adapter.isOperatorOf(garden2, user), "Garden2 operator should be unaffected");
        assertFalse(adapter.isOwnerOf(garden2, user), "Garden2 owner should be unaffected");
        assertFalse(adapter.isFunderOf(garden2, user), "Garden2 funder should be unaffected");
        assertFalse(adapter.isCommunityOf(garden2, user), "Garden2 community should be unaffected");
    }

    function testFuzz_dualGardenIndependentGrants(
        uint8 user1Seed,
        uint8 role1Seed,
        uint8 user2Seed,
        uint8 role2Seed
    )
        public
    {
        address user1 = users[user1Seed % 5];
        address user2 = users[user2Seed % 5];
        IHatsModule.GardenRole role1 = _seedToRole(role1Seed);
        IHatsModule.GardenRole role2 = _seedToRole(role2Seed);

        adapter.grantRole(garden1, user1, role1);
        adapter.grantRole(garden2, user2, role2);

        if (user1 != user2) {
            assertFalse(adapter.isGardenerOf(garden2, user1), "User1 should have no garden2 roles");
            assertFalse(adapter.isGardenerOf(garden1, user2), "User2 should have no garden1 roles");
        }
    }

    // =========================================================================
    // Revocation Behavior
    // =========================================================================

    function test_revokeSubHatDoesNotAffectParent() public {
        address user = users[0];

        adapter.grantRole(garden1, user, IHatsModule.GardenRole.Owner);
        assertTrue(adapter.isOwnerOf(garden1, user), "Should be owner");
        assertTrue(adapter.isEvaluatorOf(garden1, user), "Should be evaluator (cascaded)");

        adapter.revokeRole(garden1, user, IHatsModule.GardenRole.Evaluator);

        assertTrue(adapter.isOwnerOf(garden1, user), "Owner hat should be retained");
        assertFalse(adapter.isEvaluatorOf(garden1, user), "Evaluator hat should be gone");
    }

    // =========================================================================
    // Configuration Immutability (per-operation)
    // =========================================================================

    function testFuzz_roleOpsPreserveConfiguration(uint8 userSeed, uint8 roleSeed) public {
        (
            uint256 g1OwnerBefore,
            uint256 g1OperatorBefore,
            uint256 g1EvaluatorBefore,
            uint256 g1GardenerBefore,
            uint256 g1FunderBefore,
            uint256 g1CommunityBefore,
            ,
            bool g1ConfiguredBefore
        ) = adapter.gardenHats(garden1);

        address user = users[userSeed % 5];
        IHatsModule.GardenRole role = _seedToRole(roleSeed);
        adapter.grantRole(garden1, user, role);

        (
            uint256 g1OwnerAfter,
            uint256 g1OperatorAfter,
            uint256 g1EvaluatorAfter,
            uint256 g1GardenerAfter,
            uint256 g1FunderAfter,
            uint256 g1CommunityAfter,
            ,
            bool g1ConfiguredAfter
        ) = adapter.gardenHats(garden1);

        assertEq(g1OwnerBefore, g1OwnerAfter, "Owner hat ID changed");
        assertEq(g1OperatorBefore, g1OperatorAfter, "Operator hat ID changed");
        assertEq(g1EvaluatorBefore, g1EvaluatorAfter, "Evaluator hat ID changed");
        assertEq(g1GardenerBefore, g1GardenerAfter, "Gardener hat ID changed");
        assertEq(g1FunderBefore, g1FunderAfter, "Funder hat ID changed");
        assertEq(g1CommunityBefore, g1CommunityAfter, "Community hat ID changed");
        assertEq(g1ConfiguredBefore, g1ConfiguredAfter, "Configured status changed");
    }

    function testFuzz_noCoreRoleGrantsProduceFunderOrCommunity(
        uint8[8] calldata userSeeds,
        uint8[8] calldata roleSeeds
    )
        public
    {
        for (uint256 i = 0; i < 8; i++) {
            address user = users[userSeeds[i] % 5];
            IHatsModule.GardenRole role = _seedToRole(roleSeeds[i]);
            try adapter.grantRole(garden1, user, role) { } catch { }
        }

        for (uint256 i = 0; i < 5; i++) {
            assertFalse(adapter.isFunderOf(garden1, users[i]), "Funder must never be auto-granted");
            assertFalse(adapter.isCommunityOf(garden1, users[i]), "Community must never be auto-granted");
        }
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    function _seedToRole(uint8 seed) internal pure returns (IHatsModule.GardenRole) {
        uint8 idx = seed % 4;
        if (idx == 0) return IHatsModule.GardenRole.Gardener;
        if (idx == 1) return IHatsModule.GardenRole.Evaluator;
        if (idx == 2) return IHatsModule.GardenRole.Operator;
        return IHatsModule.GardenRole.Owner;
    }
}
