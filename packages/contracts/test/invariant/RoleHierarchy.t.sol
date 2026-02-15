// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { HatsModule } from "../../src/modules/Hats.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { MockHats } from "../../src/mocks/Hats.sol";

/// @title RoleHierarchyInvariantTest
/// @notice Fuzz-based invariant tests verifying role hierarchy properties under random sequences
/// @dev Verifies:
///      1. Owner grant cascades to Operator + Evaluator + Gardener
///      2. Operator grant cascades to Evaluator + Gardener
///      3. Cross-garden isolation is maintained
///      4. Funder/Community are never auto-granted
///      5. Configuration immutability during role operations
contract RoleHierarchyInvariantTest is Test {
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

        // Create hat trees for both gardens using createGardenHatTree
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
    // Invariant 1: Owner Grant Cascades
    // Granting Owner MUST also grant Operator, Evaluator, and Gardener hats.
    // =========================================================================

    /// @notice Fuzz: granting Owner to any user cascades all 4 roles
    function testFuzz_ownerGrantCascadesToAllRoles(uint8 userSeed) public {
        address user = users[userSeed % 5];

        adapter.grantRole(garden1, user, IHatsModule.GardenRole.Owner);

        assertTrue(adapter.isOwnerOf(garden1, user), "Should be owner");
        assertTrue(adapter.isOperatorOf(garden1, user), "Owner should cascade to operator");
        assertTrue(adapter.isEvaluatorOf(garden1, user), "Owner should cascade to evaluator");
        assertTrue(adapter.isGardenerOf(garden1, user), "Owner should cascade to gardener");
    }

    /// @notice Fuzz: granting Owner does NOT auto-grant Funder or Community
    function testFuzz_ownerGrantDoesNotCascadeToFunderOrCommunity(uint8 userSeed) public {
        address user = users[userSeed % 5];

        adapter.grantRole(garden1, user, IHatsModule.GardenRole.Owner);

        assertFalse(adapter.isFunderOf(garden1, user), "Owner should NOT cascade to funder");
        assertFalse(adapter.isCommunityOf(garden1, user), "Owner should NOT cascade to community");
    }

    // =========================================================================
    // Invariant 2: Operator Grant Cascades
    // Granting Operator MUST also grant Evaluator and Gardener hats.
    // =========================================================================

    /// @notice Fuzz: granting Operator cascades to Evaluator + Gardener
    function testFuzz_operatorGrantCascadesToSubRoles(uint8 userSeed) public {
        address user = users[userSeed % 5];

        adapter.grantRole(garden1, user, IHatsModule.GardenRole.Operator);

        assertTrue(adapter.isOperatorOf(garden1, user), "Should be operator");
        assertTrue(adapter.isEvaluatorOf(garden1, user), "Operator should cascade to evaluator");
        assertTrue(adapter.isGardenerOf(garden1, user), "Operator should cascade to gardener");
        assertFalse(adapter.isOwnerOf(garden1, user), "Operator should NOT cascade to owner");
    }

    // =========================================================================
    // Invariant 3: Leaf Roles Do NOT Cascade
    // Granting Gardener or Evaluator should NOT grant any other roles.
    // =========================================================================

    /// @notice Fuzz: granting Gardener gives no other roles
    function testFuzz_gardenerGrantHasNoSubGrants(uint8 userSeed) public {
        address user = users[userSeed % 5];

        adapter.grantRole(garden1, user, IHatsModule.GardenRole.Gardener);

        assertTrue(adapter.isGardenerOf(garden1, user), "Should be gardener");
        assertFalse(adapter.isEvaluatorOf(garden1, user), "Gardener should NOT get evaluator");
        assertFalse(adapter.isOperatorOf(garden1, user), "Gardener should NOT get operator");
        assertFalse(adapter.isOwnerOf(garden1, user), "Gardener should NOT get owner");
    }

    /// @notice Fuzz: granting Evaluator gives no other roles
    function testFuzz_evaluatorGrantHasNoSubGrants(uint8 userSeed) public {
        address user = users[userSeed % 5];

        adapter.grantRole(garden1, user, IHatsModule.GardenRole.Evaluator);

        assertTrue(adapter.isEvaluatorOf(garden1, user), "Should be evaluator");
        assertFalse(adapter.isGardenerOf(garden1, user), "Evaluator should NOT get gardener");
        assertFalse(adapter.isOperatorOf(garden1, user), "Evaluator should NOT get operator");
        assertFalse(adapter.isOwnerOf(garden1, user), "Evaluator should NOT get owner");
    }

    // =========================================================================
    // Invariant 4: Cross-Garden Isolation
    // Granting roles in garden1 MUST NOT affect garden2, and vice versa.
    // =========================================================================

    /// @notice Fuzz: roles in garden1 do not leak to garden2
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

    /// @notice Fuzz: independent grants in both gardens maintain isolation
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

        // Grant in garden1
        adapter.grantRole(garden1, user1, role1);

        // Grant in garden2
        adapter.grantRole(garden2, user2, role2);

        // Verify garden1 user's roles in garden2 are only from their garden2 grants
        if (user1 != user2) {
            // If different users, user1 should have NO roles in garden2
            assertFalse(adapter.isGardenerOf(garden2, user1), "User1 should have no garden2 roles");
        }

        // Verify garden2 user's roles in garden1 are only from their garden1 grants
        if (user1 != user2) {
            assertFalse(adapter.isGardenerOf(garden1, user2), "User2 should have no garden1 roles");
        }
    }

    // =========================================================================
    // Invariant 5: Revocation Does NOT Cascade (Design Property)
    // Revoking a sub-hat leaves the parent hat intact. This is BY DESIGN:
    // HatsModule does exact hat checks, while GardenAccount applies inclusive
    // hierarchy (Owner => isEvaluator() returns true via the OR check).
    // =========================================================================

    /// @notice Demonstrates: revoking a sub-hat does not revoke the parent hat
    function test_revokeSubHatDoesNotAffectParent() public {
        address user = users[0];

        // Grant Owner => cascades to Operator + Evaluator + Gardener
        adapter.grantRole(garden1, user, IHatsModule.GardenRole.Owner);
        assertTrue(adapter.isOwnerOf(garden1, user), "Should be owner");
        assertTrue(adapter.isEvaluatorOf(garden1, user), "Should be evaluator (cascaded)");

        // Revoke Evaluator only
        adapter.revokeRole(garden1, user, IHatsModule.GardenRole.Evaluator);

        // Owner hat is retained; evaluator hat is gone (at HatsModule level)
        assertTrue(adapter.isOwnerOf(garden1, user), "Owner hat should be retained");
        assertFalse(adapter.isEvaluatorOf(garden1, user), "Evaluator hat should be gone");

        // NOTE: At the GardenAccount level, _isEvaluator() checks:
        //   isEvaluatorOf || isOperatorOf || isOwnerOf
        // So the user would STILL pass evaluator checks via the owner path.
        // This test documents the HatsModule-level behavior.
    }

    // =========================================================================
    // Invariant 5b: Random Sequences Never Corrupt System State
    // After random grant/revoke sequences, the system remains consistent:
    // - No unexpected reverts
    // - Configuration unchanged
    // - Funder/Community never auto-granted
    // =========================================================================

    /// @notice Fuzz: random sequences produce consistent state
    function testFuzz_randomSequenceSystemConsistency(
        uint8[8] calldata userSeeds,
        uint8[8] calldata roleSeeds,
        bool[8] calldata isGrant
    )
        public
    {
        // Execute random sequence of 8 operations
        for (uint256 i = 0; i < 8; i++) {
            address user = users[userSeeds[i] % 5];
            IHatsModule.GardenRole role = _seedToRole(roleSeeds[i]);

            if (isGrant[i]) {
                try adapter.grantRole(garden1, user, role) { } catch { }
            } else {
                try adapter.revokeRole(garden1, user, role) { } catch { }
            }
        }

        // After all operations, verify system consistency:
        // 1. Configuration must be preserved
        assertTrue(adapter.isConfigured(garden1), "Garden1 must remain configured");
        assertTrue(adapter.isConfigured(garden2), "Garden2 must remain configured");

        // 2. Funder/Community must never appear
        for (uint256 i = 0; i < 5; i++) {
            assertFalse(adapter.isFunderOf(garden1, users[i]), "Funder must never auto-grant");
            assertFalse(adapter.isCommunityOf(garden1, users[i]), "Community must never auto-grant");
        }

        // 3. Garden2 must be completely unaffected
        for (uint256 i = 0; i < 5; i++) {
            assertFalse(adapter.isGardenerOf(garden2, users[i]), "Garden2 must be unaffected");
            assertFalse(adapter.isOwnerOf(garden2, users[i]), "Garden2 must be unaffected");
        }

        // 4. All role queries must succeed without reverting (no corrupted state)
        for (uint256 i = 0; i < 5; i++) {
            // These should never revert on a configured garden
            adapter.isGardenerOf(garden1, users[i]);
            adapter.isEvaluatorOf(garden1, users[i]);
            adapter.isOperatorOf(garden1, users[i]);
            adapter.isOwnerOf(garden1, users[i]);
            adapter.isFunderOf(garden1, users[i]);
            adapter.isCommunityOf(garden1, users[i]);
        }
    }

    // =========================================================================
    // Invariant 6: Configuration Immutability
    // Role operations MUST NOT change garden configuration.
    // =========================================================================

    /// @notice Fuzz: role operations don't affect configuration
    function testFuzz_roleOpsPreserveConfiguration(uint8 userSeed, uint8 roleSeed) public {
        // Capture initial state
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

        // Perform role operation
        address user = users[userSeed % 5];
        IHatsModule.GardenRole role = _seedToRole(roleSeed);
        adapter.grantRole(garden1, user, role);

        // Verify configuration unchanged
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

    // =========================================================================
    // Invariant 7: Funder/Community Independence
    // No combination of core role operations should grant Funder or Community.
    // =========================================================================

    /// @notice Fuzz: exhaustive grant sequence never produces Funder/Community
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

    /// @dev Map seed to one of the 4 core roles
    function _seedToRole(uint8 seed) internal pure returns (IHatsModule.GardenRole) {
        uint8 idx = seed % 4;
        if (idx == 0) return IHatsModule.GardenRole.Gardener;
        if (idx == 1) return IHatsModule.GardenRole.Evaluator;
        if (idx == 2) return IHatsModule.GardenRole.Operator;
        return IHatsModule.GardenRole.Owner;
    }
}
