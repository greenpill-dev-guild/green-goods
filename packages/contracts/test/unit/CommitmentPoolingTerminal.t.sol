// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingFixture } from "../helpers/CommitmentPoolingFixture.sol";

/// @title CommitmentPoolingTerminalTest
/// @notice Cancellation, expiry, dispute, and dispute-resolution paths for PRD-721.
contract CommitmentPoolingTerminalTest is CommitmentPoolingFixture {
    address private constant POOL_STEWARD = address(0xA001);

    function setUp() public {
        _setUpProductionFixture();
        hats.setOperator(POOL_GARDEN, POOL_STEWARD, true);
    }

    // ───────────────────────────── Cancellation
    // ─────────────────────────────

    function testCreatorCancelsOfferedCommitmentAndReleasesUnits() public {
        uint256 commitmentId = _createOffer(keccak256("cancel-offered"));
        assertEq(registry.committedOf(CREATOR, commitmentId), 1);
        uint32 liveBefore = module.getPool(poolId).liveCommitmentCount;

        vm.prank(CREATOR);
        module.cancelCommitment(commitmentId, "");

        assertEq(
            uint256(module.getCommitment(commitmentId).state), uint256(ICommitmentPoolingModule.CommitmentState.Cancelled)
        );
        assertEq(registry.committedOf(CREATOR, commitmentId), 0);
        assertEq(module.getPool(poolId).liveCommitmentCount, liveBefore - 1);
    }

    function testStewardCancellationOfAcceptedCommitmentRequiresReason() public {
        uint256 commitmentId = _createOffer(keccak256("cancel-accepted"));
        _acceptOffer(commitmentId);

        // The creator loses withdrawal authority once the commitment is claimed.
        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.NotPoolSteward.selector, CREATOR, poolId));
        vm.prank(CREATOR);
        module.cancelCommitment(commitmentId, "creator can no longer withdraw");

        vm.expectRevert(ICommitmentPoolingModule.ReasonRequired.selector);
        vm.prank(POOL_STEWARD);
        module.cancelCommitment(commitmentId, "");

        vm.prank(POOL_STEWARD);
        module.cancelCommitment(commitmentId, "bafy-cancel-reason");
        assertEq(
            uint256(module.getCommitment(commitmentId).state), uint256(ICommitmentPoolingModule.CommitmentState.Cancelled)
        );
        assertEq(registry.committedOf(CREATOR, commitmentId), 0);
    }

    function testCancelRejectedFromReadyForConfirmation() public {
        uint256 commitmentId = _readyCommitment(keccak256("cancel-ready"));

        vm.expectRevert(
            abi.encodeWithSelector(
                ICommitmentPoolingModule.CommitmentNotInState.selector,
                commitmentId,
                ICommitmentPoolingModule.CommitmentState.ReadyForConfirmation
            )
        );
        vm.prank(POOL_STEWARD);
        module.cancelCommitment(commitmentId, "not allowed except via dispute");
    }

    // ─────────────────────────────── Expiry
    // ───────────────────────────────

    function testExpireIsPermissionlessOnlyOncePastDue() public {
        uint256 commitmentId = _createOfferDueAt(keccak256("expire-due"), uint64(block.timestamp + 1 days));

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.NotDue.selector, commitmentId));
        module.expireCommitment(commitmentId);

        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(address(0xDEAD)); // permissionless
        module.expireCommitment(commitmentId);

        assertEq(
            uint256(module.getCommitment(commitmentId).state), uint256(ICommitmentPoolingModule.CommitmentState.Expired)
        );
        assertEq(registry.committedOf(CREATOR, commitmentId), 0);
    }

    function testCommitmentWithoutAnyDeadlineNeverExpires() public {
        uint256 commitmentId = _createOffer(keccak256("expire-no-deadline"));
        vm.warp(block.timestamp + 3650 days);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.NotDue.selector, commitmentId));
        module.expireCommitment(commitmentId);
    }

    // ─────────────────────────────── Dispute
    // ───────────────────────────────

    function testRaiseDisputeRequiresEligibleRaiserAndReason() public {
        uint256 commitmentId = _createOffer(keccak256("dispute-gating"));
        _acceptOffer(commitmentId);

        vm.expectRevert(ICommitmentPoolingModule.ReasonRequired.selector);
        vm.prank(CREATOR);
        module.raiseDispute(commitmentId, "");

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.UnauthorizedCaller.selector, address(0xBAD)));
        vm.prank(address(0xBAD));
        module.raiseDispute(commitmentId, "bafy-dispute");

        vm.prank(CREATOR);
        module.raiseDispute(commitmentId, "bafy-dispute");
        assertEq(
            uint256(module.getCommitment(commitmentId).state), uint256(ICommitmentPoolingModule.CommitmentState.Disputed)
        );
        assertEq(
            uint256(module.getCommitment(commitmentId).preDisputeState),
            uint256(ICommitmentPoolingModule.CommitmentState.Accepted)
        );
    }

    function testDisputeFromExpiredReIncrementsLiveCountAndResolutionDecrementsOnce() public {
        uint256 commitmentId = _createOfferDueAt(keccak256("dispute-expired"), uint64(block.timestamp + 1 days));
        vm.warp(block.timestamp + 1 days + 1);
        module.expireCommitment(commitmentId);
        uint32 liveAfterExpiry = module.getPool(poolId).liveCommitmentCount;

        vm.prank(POOL_STEWARD);
        module.raiseDispute(commitmentId, "bafy-reopen");
        assertEq(module.getPool(poolId).liveCommitmentCount, liveAfterExpiry + 1, "Disputed must hold the cycle open");

        vm.prank(POOL_STEWARD);
        module.resolveDispute(commitmentId, ICommitmentPoolingModule.DisputeResolution.Cancelled, "bafy-resolve");

        assertEq(module.getPool(poolId).liveCommitmentCount, liveAfterExpiry, "resolution decrements exactly once");
        assertEq(
            uint256(module.getCommitment(commitmentId).state), uint256(ICommitmentPoolingModule.CommitmentState.Cancelled)
        );
    }

    function testExpiredDisputeCanNeverResolveFulfilled() public {
        uint256 commitmentId = _createOfferDueAt(keccak256("expired-never-fulfilled"), uint64(block.timestamp + 1 days));
        vm.warp(block.timestamp + 1 days + 1);
        module.expireCommitment(commitmentId);
        vm.prank(POOL_STEWARD);
        module.raiseDispute(commitmentId, "bafy-reopen");

        vm.expectRevert(
            abi.encodeWithSelector(
                ICommitmentPoolingModule.InvalidDisputeResolution.selector,
                commitmentId,
                ICommitmentPoolingModule.DisputeResolution.Fulfilled
            )
        );
        vm.prank(POOL_STEWARD);
        module.resolveDispute(commitmentId, ICommitmentPoolingModule.DisputeResolution.Fulfilled, "bafy-resolve");
    }

    function testRestorePreviousReturnsTheExactPriorState() public {
        uint256 commitmentId = _readyCommitment(keccak256("restore-ready"));
        vm.prank(POOL_STEWARD);
        module.raiseDispute(commitmentId, "bafy-dispute");
        uint32 liveWhileDisputed = module.getPool(poolId).liveCommitmentCount;

        vm.prank(POOL_STEWARD);
        module.resolveDispute(commitmentId, ICommitmentPoolingModule.DisputeResolution.RestorePrevious, "bafy-restore");

        assertEq(
            uint256(module.getCommitment(commitmentId).state),
            uint256(ICommitmentPoolingModule.CommitmentState.ReadyForConfirmation)
        );
        assertEq(module.getPool(poolId).liveCommitmentCount, liveWhileDisputed, "restoring a live state changes no count");
    }

    function testDisputeResolvedFulfilledRejectsAContributorSteward() public {
        uint256 commitmentId = _readyCommitment(keccak256("dispute-self-confirm"));
        vm.prank(POOL_STEWARD);
        module.raiseDispute(commitmentId, "bafy-dispute");

        // CREATOR is the frozen lead provider; granting steward authority must not let them resolve.
        hats.setOperator(POOL_GARDEN, CREATOR, true);
        vm.expectRevert(ICommitmentPoolingModule.SelfConfirmation.selector);
        vm.prank(CREATOR);
        module.resolveDispute(commitmentId, ICommitmentPoolingModule.DisputeResolution.Fulfilled, "bafy-resolve");
    }

    function testDisputeResolutionFulfillsAndConvertsUnits() public {
        uint256 commitmentId = _readyCommitment(keccak256("dispute-fulfilled"));
        vm.prank(CREATOR);
        module.raiseDispute(commitmentId, "bafy-dispute");
        uint32 liveWhileDisputed = module.getPool(poolId).liveCommitmentCount;

        vm.prank(POOL_STEWARD);
        module.resolveDispute(commitmentId, ICommitmentPoolingModule.DisputeResolution.Fulfilled, "bafy-resolve");

        assertEq(
            uint256(module.getCommitment(commitmentId).state), uint256(ICommitmentPoolingModule.CommitmentState.Fulfilled)
        );
        assertEq(registry.fulfilledOf(CREATOR, commitmentId), 1);
        assertEq(module.getPool(poolId).liveCommitmentCount, liveWhileDisputed - 1);
    }

    function testCommitmentPoolingDispute_raiserCannotFulfillOwnDisputeButAnotherStewardCan() public {
        uint256 commitmentId = _readyCommitment(keccak256("raiser-cannot-fulfill"));
        vm.prank(POOL_STEWARD);
        module.raiseDispute(commitmentId, "bafy-dispute");
        uint32 liveBefore = module.getPool(poolId).liveCommitmentCount;

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.SelfDisputeResolution.selector, commitmentId));
        vm.prank(POOL_STEWARD);
        module.resolveDispute(commitmentId, ICommitmentPoolingModule.DisputeResolution.Fulfilled, "bafy-self");
        assertEq(module.getPool(poolId).liveCommitmentCount, liveBefore);
        assertEq(registry.fulfilledOf(CREATOR, commitmentId), 0);

        address secondSteward = address(0xA002);
        hats.setOperator(POOL_GARDEN, secondSteward, true);
        vm.prank(secondSteward);
        module.resolveDispute(commitmentId, ICommitmentPoolingModule.DisputeResolution.Fulfilled, "bafy-independent");
        assertEq(registry.fulfilledOf(CREATOR, commitmentId), 1);
    }

    function testCommitmentPoolingDispute_legacyRequiresRestoreAndFreshRaiserBeforeFulfillment() public {
        uint256 commitmentId = _readyCommitment(keccak256("legacy-dispute"));
        vm.prank(CREATOR);
        module.raiseDispute(commitmentId, "bafy-legacy");
        // Model the empty ERC-7201 namespace on an upgraded proxy with an open legacy dispute.
        bytes32 actorSlot = keccak256(
            abi.encode(commitmentId, bytes32(0x00db7e1233ad7c733085b036698b86167ca9dcdb9d823e12d31c5fe3ff1f6a00))
        );
        vm.store(address(module), actorSlot, bytes32(0));
        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.UnknownDisputeRaiser.selector, commitmentId));
        vm.prank(POOL_STEWARD);
        module.resolveDispute(commitmentId, ICommitmentPoolingModule.DisputeResolution.Fulfilled, "bafy-unknown");
        vm.prank(POOL_STEWARD);
        module.resolveDispute(commitmentId, ICommitmentPoolingModule.DisputeResolution.RestorePrevious, "bafy-restore");
        vm.prank(CREATOR);
        module.raiseDispute(commitmentId, "bafy-fresh");
        vm.prank(POOL_STEWARD);
        module.resolveDispute(commitmentId, ICommitmentPoolingModule.DisputeResolution.Fulfilled, "bafy-verified");
        assertEq(registry.fulfilledOf(CREATOR, commitmentId), 1);
        assertEq(vm.load(address(module), actorSlot), bytes32(0), "resolved actor is cleared");
    }

    function testCommitmentPoolingDispute_raiserCanCancelOrExpireOwnDispute() public {
        for (uint256 i = 0; i < 2; i++) {
            uint256 id = _readyCommitment(keccak256(abi.encode("raiser-wind-down", i)));
            vm.prank(POOL_STEWARD);
            module.raiseDispute(id, "bafy-dispute");
            ICommitmentPoolingModule.DisputeResolution resolution = i == 0
                ? ICommitmentPoolingModule.DisputeResolution.Cancelled
                : ICommitmentPoolingModule.DisputeResolution.Expired;
            vm.prank(POOL_STEWARD);
            module.resolveDispute(id, resolution, "bafy-wind-down");
            assertEq(registry.committedOf(CREATOR, id), 0);
        }
    }

    // ───────────────────────────── Helpers
    // ─────────────────────────────

    function _createOfferDueAt(bytes32 creationKey, uint64 dueDate) private returns (uint256 commitmentId) {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(creationKey);
        params.dueDate = dueDate;
        vm.prank(CREATOR);
        return module.createCommitment(params);
    }

    /// @dev An accepted, credited Offer frozen at ReadyForConfirmation.
    function _readyCommitment(bytes32 creationKey) private returns (uint256 commitmentId) {
        commitmentId = _createOffer(creationKey);
        _acceptOffer(commitmentId);
        address[] memory credited = new address[](1);
        credited[0] = CREATOR;
        vm.prank(CREATOR);
        module.attachEvidence(commitmentId, "bafy-terminal-credit", credited);
        module.markReadyForConfirmation(commitmentId, "ready for terminal coverage");
    }
}
