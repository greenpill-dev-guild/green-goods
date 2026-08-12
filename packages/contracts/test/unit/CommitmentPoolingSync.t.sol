// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { CommitmentPoolingFixture } from "../helpers/CommitmentPoolingFixture.sol";

/// @title CommitmentPoolingSyncTest
/// @notice Work unlinking and the steward decision catch-up for PRD-721.
contract CommitmentPoolingSyncTest is CommitmentPoolingFixture {
    address private constant POOL_STEWARD = address(0xA001);

    bytes32 private constant WORK_A = keccak256("sync-work-a");
    bytes32 private constant WORK_B = keccak256("sync-work-b");
    bytes32 private constant WORK_C = keccak256("sync-work-c");
    bytes32 private constant WORK_D = keccak256("sync-work-d");

    function setUp() public {
        _setUpProductionFixture();
        _registerActions(2);
        hats.setOperator(POOL_GARDEN, POOL_STEWARD, true);
    }

    // ───────────────────────────── unlinkWork
    // ─────────────────────────────

    function testUnlinkWorkIsStewardOnly() public {
        uint256 commitmentId = _acceptedDomainImpact(keccak256("unlink-gating"));
        _link(commitmentId, WORK_A, 0);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.NotPoolSteward.selector, CREATOR, poolId));
        vm.prank(CREATOR);
        module.unlinkWork(WORK_A);
    }

    function testUnlinkWorkRemovesTheLinkAndReleasesTheContributor() public {
        uint256 commitmentId = _acceptedDomainImpact(keccak256("unlink-release"));
        _link(commitmentId, WORK_A, 0);
        assertEq(module.getLinkedWorkUIDs(commitmentId).length, 1);
        assertEq(module.getContributor(commitmentId, CREATOR).uncountedLinkedWorkCount, 1);

        vm.expectEmit(true, true, false, true);
        emit ICommitmentPoolingModule.WorkUnlinked(commitmentId, WORK_A, POOL_STEWARD);
        vm.prank(POOL_STEWARD);
        module.unlinkWork(WORK_A);

        assertEq(module.workCommitmentOf(WORK_A), 0);
        assertEq(module.getLinkedWorkUIDs(commitmentId).length, 0);
        assertEq(module.getContributor(commitmentId, CREATOR).uncountedLinkedWorkCount, 0);
    }

    function testUnlinkKeepsTheRemainingLinksEnumerable() public {
        uint256 commitmentId = _acceptedDomainImpact(keccak256("unlink-enumerable"));
        _link(commitmentId, WORK_A, 0);
        _link(commitmentId, WORK_B, 1);

        vm.prank(POOL_STEWARD);
        module.unlinkWork(WORK_A);

        bytes32[] memory remaining = module.getLinkedWorkUIDs(commitmentId);
        assertEq(remaining.length, 1);
        assertEq(remaining[0], WORK_B);
    }

    function testUnlinkRejectedWhileWorkCreditIsActive() public {
        uint256 commitmentId = _acceptedDomainImpact(keccak256("unlink-active-credit"));
        _link(commitmentId, WORK_A, 0);
        bytes32 approvalUID = _decision(WORK_A, 0, true, 1);
        vm.prank(address(decisionResolver));
        module.onWorkDecision(WORK_A, approvalUID, 1, POOL_GARDEN, true);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.ApprovalAlreadyCounted.selector, approvalUID));
        vm.prank(POOL_STEWARD);
        module.unlinkWork(WORK_A);
    }

    function testHistoricalApprovalDoesNotBlockUnlinkAfterANewerRejection() public {
        uint256 commitmentId = _acceptedDomainImpact(keccak256("unlink-after-rejection"));
        _link(commitmentId, WORK_A, 0);
        bytes32 approvalUID = _decision(WORK_A, 0, true, 1);
        vm.prank(address(decisionResolver));
        module.onWorkDecision(WORK_A, approvalUID, 1, POOL_GARDEN, true);
        bytes32 rejectionUID = _decision(WORK_A, 0, false, 2);
        vm.prank(address(decisionResolver));
        module.onWorkDecision(WORK_A, rejectionUID, 2, POOL_GARDEN, false);

        vm.prank(POOL_STEWARD);
        module.unlinkWork(WORK_A);

        assertEq(module.workCommitmentOf(WORK_A), 0);
        assertEq(module.getContributor(commitmentId, CREATOR).uncountedLinkedWorkCount, 0);
        // The historical approval stays delivered so redelivery is still idempotent.
        assertTrue(module.isApprovalCounted(approvalUID));
    }

    function testUnlinkRejectsAWorkThatIsNotLinked() public {
        _acceptedDomainImpact(keccak256("unlink-unknown"));

        vm.expectRevert(
            abi.encodeWithSelector(ICommitmentPoolingModule.WorkNotLinkedToCommitment.selector, WORK_A, uint256(0))
        );
        vm.prank(POOL_STEWARD);
        module.unlinkWork(WORK_A);
    }

    // ────────────────────────── syncWorkDecisions
    // ──────────────────────────

    function testSyncIsStewardOnly() public {
        uint256 commitmentId = _acceptedDomainImpact(keccak256("sync-gating"));
        _link(commitmentId, WORK_A, 0);
        bytes32 approvalUID = _decision(WORK_A, 0, true, 1);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.NotPoolSteward.selector, CREATOR, poolId));
        vm.prank(CREATOR);
        module.syncWorkDecisions(commitmentId, _uids(approvalUID));
    }

    function testSyncAppliesTheCurrentDecisionAndCountsTheRequirement() public {
        uint256 commitmentId = _acceptedDomainImpact(keccak256("sync-applies"));
        _link(commitmentId, WORK_A, 0);
        bytes32 approvalUID = _decision(WORK_A, 0, true, 1);

        vm.prank(POOL_STEWARD);
        module.syncWorkDecisions(commitmentId, _uids(approvalUID));

        assertEq(module.getRequirement(commitmentId, 0).approvedCount, 1);
        assertEq(module.getContributor(commitmentId, CREATOR).approvedWorkCredits, 1);
        assertEq(module.getContributor(commitmentId, CREATOR).uncountedLinkedWorkCount, 0);
        assertTrue(module.isApprovalCounted(approvalUID));
    }

    function testSyncRejectsAStaleGreatestSuppliedSequence() public {
        uint256 commitmentId = _acceptedDomainImpact(keccak256("sync-stale"));
        _link(commitmentId, WORK_A, 0);
        bytes32 approvalUID = _decision(WORK_A, 0, true, 3);
        // A newer decision exists on the resolver that the caller did not supply.
        decisionResolver.setLatestDecisionSequence(WORK_A, 5);

        vm.expectRevert(
            abi.encodeWithSelector(
                ICommitmentPoolingModule.IncompleteDecisionHistory.selector, WORK_A, uint64(5), uint64(3)
            )
        );
        vm.prank(POOL_STEWARD);
        module.syncWorkDecisions(commitmentId, _uids(approvalUID));
    }

    function testSyncRejectsAPreUpgradeDecisionWithNoSequence() public {
        uint256 commitmentId = _acceptedDomainImpact(keccak256("sync-unsequenced"));
        _link(commitmentId, WORK_A, 0);
        bytes32 approvalUID = keccak256("sync-unsequenced-approval");
        _setApprovalAttestation(approvalUID, WORK_A, 0, true);
        decisionResolver.setLatestDecisionSequence(WORK_A, 4);

        vm.expectRevert(
            abi.encodeWithSelector(
                ICommitmentPoolingModule.IncompleteDecisionHistory.selector, WORK_A, uint64(4), uint64(0)
            )
        );
        vm.prank(POOL_STEWARD);
        module.syncWorkDecisions(commitmentId, _uids(approvalUID));
    }

    function testSyncRejectsADecisionForAWorkLinkedElsewhere() public {
        uint256 commitmentId = _acceptedDomainImpact(keccak256("sync-foreign-a"));
        uint256 otherId = _acceptedDomainImpact(keccak256("sync-foreign-b"));
        _link(commitmentId, WORK_A, 0);
        bytes32 approvalUID = _decision(WORK_A, 0, true, 1);

        vm.expectRevert(
            abi.encodeWithSelector(ICommitmentPoolingModule.WorkNotLinkedToCommitment.selector, WORK_A, otherId)
        );
        vm.prank(POOL_STEWARD);
        module.syncWorkDecisions(otherId, _uids(approvalUID));
    }

    function testOmittingAStaleLinkedWorkRevertsTheWholeCatchUp() public {
        uint256 commitmentId = _acceptedDomainImpact(keccak256("sync-omission"));
        _link(commitmentId, WORK_A, 0);
        _link(commitmentId, WORK_B, 1);
        _decision(WORK_A, 0, true, 1);
        bytes32 approvalB = _decision(WORK_B, 1, true, 1);

        // Work A is equally stale, so syncing only B cannot freeze A's missing decision.
        vm.expectRevert(
            abi.encodeWithSelector(
                ICommitmentPoolingModule.IncompleteDecisionHistory.selector, WORK_A, uint64(1), uint64(0)
            )
        );
        vm.prank(POOL_STEWARD);
        module.syncWorkDecisions(commitmentId, _uids(approvalB));
    }

    function testSyncAppliesOnlyTheCurrentDecisionWhenHistoryIsSupplied() public {
        uint256 commitmentId = _acceptedDomainImpact(keccak256("sync-history"));
        _link(commitmentId, WORK_A, 0);
        bytes32 approvalUID = _decision(WORK_A, 0, true, 1);
        bytes32 rejectionUID = _decision(WORK_A, 0, false, 2);

        bytes32[] memory supplied = new bytes32[](2);
        supplied[0] = approvalUID;
        supplied[1] = rejectionUID;
        vm.prank(POOL_STEWARD);
        module.syncWorkDecisions(commitmentId, supplied);

        // Only the current rejection is effective; the superseded approval never credits.
        assertEq(module.getRequirement(commitmentId, 0).approvedCount, 0);
        assertEq(module.getContributor(commitmentId, CREATOR).approvedWorkCredits, 0);
        assertTrue(module.isApprovalCounted(rejectionUID));
        assertFalse(module.isApprovalCounted(approvalUID));
    }

    function testSyncCompletesTheRequirementSetAndFreezesForConfirmation() public {
        uint256 commitmentId = _acceptedDomainImpact(keccak256("sync-ready"));
        _link(commitmentId, WORK_A, 0);
        _link(commitmentId, WORK_B, 1);
        bytes32 approvalA = _decision(WORK_A, 0, true, 1);
        bytes32 approvalB = _decision(WORK_B, 1, true, 1);

        bytes32[] memory supplied = new bytes32[](2);
        supplied[0] = approvalA;
        supplied[1] = approvalB;
        vm.prank(POOL_STEWARD);
        module.syncWorkDecisions(commitmentId, supplied);

        ICommitmentPoolingModule.Commitment memory commitment = module.getCommitment(commitmentId);
        assertEq(uint256(commitment.state), uint256(ICommitmentPoolingModule.CommitmentState.ReadyForConfirmation));
        assertTrue(commitment.contributorsFrozen);
    }

    function testSyncRejectsAnInvalidDecisionAttestation() public {
        uint256 commitmentId = _acceptedDomainImpact(keccak256("sync-invalid"));
        _link(commitmentId, WORK_A, 0);
        bytes32 approvalUID = keccak256("sync-invalid-approval");
        decisionResolver.setDecisionSequence(approvalUID, 1);
        decisionResolver.setLatestDecisionSequence(WORK_A, 1);

        vm.expectRevert(abi.encodeWithSelector(ICommitmentPoolingModule.InvalidApprovalAttestation.selector, approvalUID));
        vm.prank(POOL_STEWARD);
        module.syncWorkDecisions(commitmentId, _uids(approvalUID));
    }

    /// @dev A frozen ledger has already left Accepted, so the state gate is what closes catch-up.
    function testSyncRejectsACommitmentWhoseLedgerHasFrozen() public {
        uint256 commitmentId = _acceptedDomainImpact(keccak256("sync-frozen"));
        _link(commitmentId, WORK_A, 0);
        bytes32 approvalUID = _decision(WORK_A, 0, true, 1);
        vm.prank(POOL_STEWARD);
        module.syncWorkDecisions(commitmentId, _uids(approvalUID));
        module.markReadyForConfirmation(commitmentId, "frozen before catch-up");
        assertTrue(module.getCommitment(commitmentId).contributorsFrozen);

        vm.expectRevert(
            abi.encodeWithSelector(
                ICommitmentPoolingModule.CommitmentNotInState.selector,
                commitmentId,
                ICommitmentPoolingModule.CommitmentState.ReadyForConfirmation
            )
        );
        vm.prank(POOL_STEWARD);
        module.syncWorkDecisions(commitmentId, _uids(approvalUID));
    }

    function testCommitmentPooling_poolPauseKeepsWorkLinkUnlinkSyncAndDecisionHookAvailable() public {
        uint256 linkId = _acceptedDomainImpact(keccak256("paused-link"));
        uint256 unlinkId = _acceptedDomainImpact(keccak256("paused-unlink"));
        uint256 syncId = _acceptedDomainImpact(keccak256("paused-sync"));
        uint256 hookId = _acceptedDomainImpact(keccak256("paused-hook"));
        _setWorkAttestation(WORK_A, CREATOR, 0);
        _link(unlinkId, WORK_B, 0);
        _link(syncId, WORK_C, 0);
        _link(hookId, WORK_D, 0);
        bytes32 syncDecision = _decision(WORK_C, 0, true, 1);
        bytes32 hookDecision = _decision(WORK_D, 0, true, 1);
        vm.prank(POOL_STEWARD);
        module.pausePool(poolId, "bafy-pause-work");

        vm.prank(CREATOR);
        module.linkWork(linkId, WORK_A, 0, keccak256("paused-link-operation"));
        vm.prank(POOL_STEWARD);
        module.unlinkWork(WORK_B);
        vm.prank(POOL_STEWARD);
        module.syncWorkDecisions(syncId, _uids(syncDecision));
        vm.prank(address(decisionResolver));
        module.onWorkDecision(WORK_D, hookDecision, 1, POOL_GARDEN, true);

        assertEq(module.workCommitmentOf(WORK_A), linkId);
        assertEq(module.workCommitmentOf(WORK_B), 0);
        assertEq(module.getRequirement(syncId, 0).approvedCount, 1);
        assertEq(module.getRequirement(hookId, 0).approvedCount, 1);
    }

    // ───────────────────────────── Helpers
    // ─────────────────────────────

    /// @dev An accepted DomainImpact Offer with two single-count requirements.
    function _acceptedDomainImpact(bytes32 creationKey) private returns (uint256 commitmentId) {
        ICommitmentPoolingModule.CreateCommitmentParams memory params = _baseParams(creationKey);
        params.commitmentType = ICommitmentPoolingModule.CommitmentType.DomainImpact;
        params.requirements = new ICommitmentPoolingModule.CommitmentRequirementInput[](2);
        params.requirements[0] = ICommitmentPoolingModule.CommitmentRequirementInput({ actionUID: 0, requiredCount: 1 });
        params.requirements[1] = ICommitmentPoolingModule.CommitmentRequirementInput({ actionUID: 1, requiredCount: 1 });
        vm.prank(CREATOR);
        commitmentId = module.createCommitment(params);
        _acceptOffer(commitmentId);
    }

    function _link(uint256 commitmentId, bytes32 workUID, uint16 requirementIndex) private {
        _setWorkAttestation(workUID, CREATOR, requirementIndex);
        vm.prank(CREATOR);
        module.linkWork(commitmentId, workUID, requirementIndex, keccak256(abi.encode(commitmentId, workUID)));
    }

    /// @dev Publishes a decision attestation and makes it the resolver's current sequence.
    function _decision(
        bytes32 workUID,
        uint256 actionUID,
        bool approved,
        uint64 sequence
    )
        private
        returns (bytes32 decisionUID)
    {
        decisionUID = keccak256(abi.encode(workUID, sequence, approved));
        _setApprovalAttestation(decisionUID, workUID, actionUID, approved);
        decisionResolver.setDecisionSequence(decisionUID, sequence);
        decisionResolver.setLatestDecisionSequence(workUID, sequence);
    }

    function _uids(bytes32 uid) private pure returns (bytes32[] memory uids) {
        uids = new bytes32[](1);
        uids[0] = uid;
    }
}
