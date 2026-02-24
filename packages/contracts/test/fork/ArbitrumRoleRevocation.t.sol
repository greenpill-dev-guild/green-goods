// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase } from "./helpers/ForkTestBase.sol";
import { IHats } from "../../src/interfaces/IHats.sol";
import { IHatsModule } from "../../src/interfaces/IHatsModule.sol";
import { HatsModule } from "../../src/modules/Hats.sol";

/// @title ArbitrumRoleRevocationForkTest
/// @notice Fork tests for HatsModule.revokeRole() and revokeRoles() against real Hats Protocol
///         on Arbitrum. Covers the burn-address revocation mechanism, nonce isolation, authorization,
///         batch revocation, and event emission.
/// @dev Uses setUp pattern for efficient fork reuse. Each test guards with `if (!forkActive) return;`.
///      The _revokeNonce resets per test (Forge snapshot/revert), so burn address generation is isolated.
contract ArbitrumRoleRevocationForkTest is ForkTestBase {
    // ═══════════════════════════════════════════════════════════════════════════
    // Test State
    // ═══════════════════════════════════════════════════════════════════════════

    address internal testGarden;

    // ═══════════════════════════════════════════════════════════════════════════
    // setUp — fork once, deploy once, mint garden with roles
    // ═══════════════════════════════════════════════════════════════════════════

    function setUp() public {
        if (!_tryChainFork("arbitrum")) return;

        _deployFullStackOnFork();

        // Mint a garden — address(this) is the garden NFT owner and wears the Owner hat
        testGarden = _mintTestGarden("Revocation Test Garden", 0x0F);

        // Grant roles to test actors
        _grantGardenRole(testGarden, forkOperator, IHatsModule.GardenRole.Operator);
        _grantGardenRole(testGarden, forkGardener, IHatsModule.GardenRole.Gardener);
        _grantGardenRole(testGarden, forkEvaluator, IHatsModule.GardenRole.Evaluator);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Retrieve the gardener hat ID for double-verification against real Hats Protocol
    function _getGardenerHatId() internal view returns (uint256) {
        (,,, uint256 gardenerHatId,,,,) = hatsModule.getGardenHatIds(testGarden);
        return gardenerHatId;
    }

    /// @notice Retrieve the operator hat ID for double-verification against real Hats Protocol
    function _getOperatorHatId() internal view returns (uint256) {
        (, uint256 operatorHatId,,,,,,) = hatsModule.getGardenHatIds(testGarden);
        return operatorHatId;
    }

    /// @notice Retrieve the evaluator hat ID for double-verification against real Hats Protocol
    function _getEvaluatorHatId() internal view returns (uint256) {
        (,, uint256 evaluatorHatId,,,,,) = hatsModule.getGardenHatIds(testGarden);
        return evaluatorHatId;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Basic gardener revocation
    // ═══════════════════════════════════════════════════════════════════════════

    function test_fork_revokeRole_basicGardenerRevocation() public {
        if (!forkActive) return;

        // Pre-condition: forkGardener has the gardener hat
        assertTrue(hatsModule.isGardenerOf(testGarden, forkGardener), "should be gardener before revoke");

        // Double-verify with real Hats Protocol
        uint256 gardenerHatId = _getGardenerHatId();
        assertTrue(IHats(HATS_PROTOCOL).isWearerOfHat(forkGardener, gardenerHatId), "real Hats should confirm gardener hat");

        // Revoke
        _revokeGardenRole(testGarden, forkGardener, IHatsModule.GardenRole.Gardener);

        // Post-condition: hat removed via both HatsModule view AND direct Hats check
        assertFalse(hatsModule.isGardenerOf(testGarden, forkGardener), "should not be gardener after revoke");
        assertFalse(IHats(HATS_PROTOCOL).isWearerOfHat(forkGardener, gardenerHatId), "real Hats should confirm hat removed");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Revoke → re-grant → revoke cycle (burn address nonce)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_fork_revokeRole_revokeRegrantRevoke() public {
        if (!forkActive) return;

        uint256 gardenerHatId = _getGardenerHatId();

        // First revoke
        _revokeGardenRole(testGarden, forkGardener, IHatsModule.GardenRole.Gardener);
        assertFalse(
            IHats(HATS_PROTOCOL).isWearerOfHat(forkGardener, gardenerHatId), "should not wear hat after first revoke"
        );

        // Re-grant
        _grantGardenRole(testGarden, forkGardener, IHatsModule.GardenRole.Gardener);
        assertTrue(IHats(HATS_PROTOCOL).isWearerOfHat(forkGardener, gardenerHatId), "should wear hat after re-grant");

        // Second revoke — unique burn address nonce prevents AlreadyWearingHat revert
        _revokeGardenRole(testGarden, forkGardener, IHatsModule.GardenRole.Gardener);
        assertFalse(
            IHats(HATS_PROTOCOL).isWearerOfHat(forkGardener, gardenerHatId), "should not wear hat after second revoke"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Two users with same hat type revoked sequentially
    // ═══════════════════════════════════════════════════════════════════════════

    function test_fork_revokeRole_twoUsersSameHatType() public {
        if (!forkActive) return;

        // Grant gardener to a second user
        address secondGardener = makeAddr("secondGardener");
        _grantGardenRole(testGarden, secondGardener, IHatsModule.GardenRole.Gardener);

        uint256 gardenerHatId = _getGardenerHatId();

        // Both should wear the hat
        assertTrue(IHats(HATS_PROTOCOL).isWearerOfHat(forkGardener, gardenerHatId), "gardener1 should wear hat");
        assertTrue(IHats(HATS_PROTOCOL).isWearerOfHat(secondGardener, gardenerHatId), "gardener2 should wear hat");

        // Revoke first
        _revokeGardenRole(testGarden, forkGardener, IHatsModule.GardenRole.Gardener);
        assertFalse(IHats(HATS_PROTOCOL).isWearerOfHat(forkGardener, gardenerHatId), "gardener1 hat removed");

        // Revoke second — sequential same-hat burn addresses must not collide
        _revokeGardenRole(testGarden, secondGardener, IHatsModule.GardenRole.Gardener);
        assertFalse(IHats(HATS_PROTOCOL).isWearerOfHat(secondGardener, gardenerHatId), "gardener2 hat removed");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Three sequential grant-revoke cycles (stress test)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_fork_revokeRole_threeSequentialCycles() public {
        if (!forkActive) return;

        uint256 gardenerHatId = _getGardenerHatId();

        for (uint256 i = 0; i < 3; i++) {
            // Revoke
            _revokeGardenRole(testGarden, forkGardener, IHatsModule.GardenRole.Gardener);
            assertFalse(IHats(HATS_PROTOCOL).isWearerOfHat(forkGardener, gardenerHatId), "should not wear hat after revoke");

            // Re-grant
            _grantGardenRole(testGarden, forkGardener, IHatsModule.GardenRole.Gardener);
            assertTrue(IHats(HATS_PROTOCOL).isWearerOfHat(forkGardener, gardenerHatId), "should wear hat after re-grant");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 5: Idempotent revocation of non-wearer (no-op)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_fork_revokeRole_idempotentNonWearer() public {
        if (!forkActive) return;

        uint256 gardenerHatId = _getGardenerHatId();

        // forkNonMember never had the gardener role
        assertFalse(
            IHats(HATS_PROTOCOL).isWearerOfHat(forkNonMember, gardenerHatId), "non-member should not wear gardener hat"
        );

        // Revoke from non-wearer — should be a no-op (isWearerOfHat guard skips transferHat)
        // The garden admin (address(this)) calls this, so authorization passes.
        hatsModule.revokeRole(testGarden, forkNonMember, IHatsModule.GardenRole.Gardener);

        // Still not wearing the hat — state unchanged
        assertFalse(
            IHats(HATS_PROTOCOL).isWearerOfHat(forkNonMember, gardenerHatId),
            "non-member should still not wear gardener hat"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 6: Operator revocation preserves other roles (no cascade)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_fork_revokeRole_operatorRevocation() public {
        if (!forkActive) return;

        uint256 operatorHatId = _getOperatorHatId();
        uint256 evaluatorHatId = _getEvaluatorHatId();
        uint256 gardenerHatId = _getGardenerHatId();

        // forkOperator was granted Operator in setUp, which auto-grants Evaluator + Gardener
        assertTrue(IHats(HATS_PROTOCOL).isWearerOfHat(forkOperator, operatorHatId), "should wear operator hat");
        assertTrue(IHats(HATS_PROTOCOL).isWearerOfHat(forkOperator, evaluatorHatId), "should wear evaluator hat");
        assertTrue(IHats(HATS_PROTOCOL).isWearerOfHat(forkOperator, gardenerHatId), "should wear gardener hat");

        // Revoke ONLY the operator hat
        _revokeGardenRole(testGarden, forkOperator, IHatsModule.GardenRole.Operator);

        // Operator hat removed, but Evaluator and Gardener survive (no cascade on revoke)
        assertFalse(IHats(HATS_PROTOCOL).isWearerOfHat(forkOperator, operatorHatId), "operator hat should be removed");
        assertTrue(IHats(HATS_PROTOCOL).isWearerOfHat(forkOperator, evaluatorHatId), "evaluator hat should survive");
        assertTrue(IHats(HATS_PROTOCOL).isWearerOfHat(forkOperator, gardenerHatId), "gardener hat should survive");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 7: Unauthorized caller reverts
    // ═══════════════════════════════════════════════════════════════════════════

    function test_fork_revokeRole_unauthorizedReverts() public {
        if (!forkActive) return;

        // forkNonMember is not owner or operator — should revert
        vm.prank(forkNonMember);
        vm.expectRevert(abi.encodeWithSelector(HatsModule.NotGardenAdmin.selector, forkNonMember, testGarden));
        hatsModule.revokeRole(testGarden, forkGardener, IHatsModule.GardenRole.Gardener);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 8: Operator can revoke a gardener
    // ═══════════════════════════════════════════════════════════════════════════

    function test_fork_revokeRole_operatorCanRevoke() public {
        if (!forkActive) return;

        uint256 gardenerHatId = _getGardenerHatId();

        // Pre-condition: forkGardener has the hat
        assertTrue(IHats(HATS_PROTOCOL).isWearerOfHat(forkGardener, gardenerHatId), "gardener should wear hat");

        // forkOperator (wearing operator hat) revokes the gardener
        vm.prank(forkOperator);
        hatsModule.revokeRole(testGarden, forkGardener, IHatsModule.GardenRole.Gardener);

        // Post-condition: gardener hat removed
        assertFalse(IHats(HATS_PROTOCOL).isWearerOfHat(forkGardener, gardenerHatId), "gardener hat should be removed");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 9: Batch revocation via revokeRoles()
    // ═══════════════════════════════════════════════════════════════════════════

    function test_fork_revokeRoles_batchRevocation() public {
        if (!forkActive) return;

        // Grant gardener to two more users
        address gardener2 = makeAddr("batchGardener2");
        address gardener3 = makeAddr("batchGardener3");
        _grantGardenRole(testGarden, gardener2, IHatsModule.GardenRole.Gardener);
        _grantGardenRole(testGarden, gardener3, IHatsModule.GardenRole.Gardener);

        uint256 gardenerHatId = _getGardenerHatId();

        // Verify all three wear the hat
        assertTrue(IHats(HATS_PROTOCOL).isWearerOfHat(forkGardener, gardenerHatId), "gardener1 pre-check");
        assertTrue(IHats(HATS_PROTOCOL).isWearerOfHat(gardener2, gardenerHatId), "gardener2 pre-check");
        assertTrue(IHats(HATS_PROTOCOL).isWearerOfHat(gardener3, gardenerHatId), "gardener3 pre-check");

        // Batch revoke all three
        address[] memory accounts = new address[](3);
        accounts[0] = forkGardener;
        accounts[1] = gardener2;
        accounts[2] = gardener3;

        IHatsModule.GardenRole[] memory roles = new IHatsModule.GardenRole[](3);
        roles[0] = IHatsModule.GardenRole.Gardener;
        roles[1] = IHatsModule.GardenRole.Gardener;
        roles[2] = IHatsModule.GardenRole.Gardener;

        hatsModule.revokeRoles(testGarden, accounts, roles);

        // All three should have hats removed
        assertFalse(IHats(HATS_PROTOCOL).isWearerOfHat(forkGardener, gardenerHatId), "gardener1 hat removed");
        assertFalse(IHats(HATS_PROTOCOL).isWearerOfHat(gardener2, gardenerHatId), "gardener2 hat removed");
        assertFalse(IHats(HATS_PROTOCOL).isWearerOfHat(gardener3, gardenerHatId), "gardener3 hat removed");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 10: RoleRevoked event emission
    // ═══════════════════════════════════════════════════════════════════════════

    function test_fork_revokeRole_emitsEvent() public {
        if (!forkActive) return;

        vm.expectEmit(true, true, false, true, address(hatsModule));
        emit IHatsModule.RoleRevoked(testGarden, forkGardener, IHatsModule.GardenRole.Gardener);

        _revokeGardenRole(testGarden, forkGardener, IHatsModule.GardenRole.Gardener);
    }
}
