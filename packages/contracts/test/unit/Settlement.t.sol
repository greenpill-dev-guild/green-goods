// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ISettlementModule } from "../../src/interfaces/ISettlementModule.sol";
import { SettlementMessageCodec } from "../../src/libraries/SettlementMessageCodec.sol";
import { SettlementPayerTest } from "./SettlementPayer.t.sol";

contract SettlementLifecycleTest is SettlementPayerTest {
    address internal constant CONTRIBUTOR = address(0x9000);
    address internal constant ACTIVE_EXECUTOR = address(0x8000);
    address internal constant REPLACEMENT_EXECUTOR = address(0x8001);

    /// @dev Dispatch a beneficiary child and hand back what a later acknowledgment needs.
    function _dispatchedSubject() private returns (uint256 childId, bytes32 executionKey, bytes32 commandMessageId) {
        pooling.setCommitment(1, _gardenRequest(PROTOCOL_GARDEN, PROVIDER_GARDEN));
        vm.startPrank(OWNER);
        uint256 planId = settlement.createCommitmentPayoutPlan(1, new ISettlementModule.RecognitionEntry[](0), bytes32(0));
        settlement.finalizeCommitmentPayoutPlan(planId);
        childId = settlement.prepareGardenBeneficiaryPayout(planId);
        commandMessageId = settlement.dispatchDisbursement(childId);
        vm.stopPrank();
        executionKey = settlement.getDisbursement(childId).executionKey;
    }

    /// @dev Replacing an executor on the same lane requires a grace window — configuration refuses
    ///      a zero-grace swap — so a retirement always looks like this: swap, then wait it out.
    function _retireActiveExecutor(uint64 graceSeconds) private {
        vm.startPrank(OWNER);
        settlement.setPaused(true);
        settlement.setCcipRoute(1, REPLACEMENT_EXECUTOR, 500_000, 1, graceSeconds);
        settlement.setPaused(false);
        vm.stopPrank();
    }

    /// @notice A replaced executor loses acknowledgment authority when its grace window expires.
    /// @dev Authentication ran only against the snapshot taken when the command was dispatched, and
    ///      that snapshot never expires — so the grace window the configuration layer carefully
    ///      negotiates was never actually enforced against an acknowledgment. A retired executor
    ///      kept authority over everything in flight to it forever, and could report success with
    ///      nothing having left the Safe.
    function testSettlementModule_retiredExecutorCannotAcknowledgeOnceItsGraceExpires() public {
        (, bytes32 executionKey, bytes32 commandMessageId) = _dispatchedSubject();

        _retireActiveExecutor(7 days);
        vm.warp(block.timestamp + 8 days);

        vm.expectRevert(abi.encodeWithSelector(ISettlementModule.RetiredPeerAcknowledgment.selector, ACTIVE_EXECUTOR));
        router.deliver(
            address(settlement),
            keccak256("retired-ack"),
            1,
            ACTIVE_EXECUTOR,
            SettlementMessageCodec.encodeAcknowledgment(1, executionKey, commandMessageId, true, 0)
        );
    }

    /// @notice The previous peer keeps acknowledging while its grace window is open.
    /// @dev The point of a grace window is to drain in-flight commands, so a cutover that grants
    ///      one must not break the acknowledgments it exists to allow.
    function testSettlementModule_previousPeerCanAcknowledgeInsideItsGraceWindow() public {
        (uint256 childId, bytes32 executionKey, bytes32 commandMessageId) = _dispatchedSubject();

        _retireActiveExecutor(7 days);

        router.deliver(
            address(settlement),
            keccak256("grace-ack"),
            1,
            ACTIVE_EXECUTOR,
            SettlementMessageCodec.encodeAcknowledgment(1, executionKey, commandMessageId, true, 0)
        );
        assertEq(uint8(settlement.getDisbursement(childId).state), uint8(ISettlementModule.DisbursementState.Confirmed));
    }

    function testSettlementModule_previousPeerCanAcknowledgeAtGraceExpiry() public {
        (uint256 childId, bytes32 executionKey, bytes32 commandMessageId) = _dispatchedSubject();

        _retireActiveExecutor(7 days);
        vm.warp(settlement.ccipRoute().previousPeerExpiresAt);

        router.deliver(
            address(settlement),
            keccak256("grace-boundary-ack"),
            1,
            ACTIVE_EXECUTOR,
            SettlementMessageCodec.encodeAcknowledgment(1, executionKey, commandMessageId, true, 0)
        );
        assertEq(uint8(settlement.getDisbursement(childId).state), uint8(ISettlementModule.DisbursementState.Confirmed));
    }

    /// @notice A second rotation cannot erase the grace promised to the first retired executor.
    function testSettlementModule_secondRotationCannotDiscardLivePreviousPeer() public {
        (uint256 childId, bytes32 executionKey, bytes32 commandMessageId) = _dispatchedSubject();

        _retireActiveExecutor(7 days);
        ISettlementModule.CcipRoute memory rotated = settlement.ccipRoute();

        vm.startPrank(OWNER);
        settlement.setPaused(true);
        vm.expectRevert(
            abi.encodeWithSelector(
                ISettlementModule.PreviousPeerGraceActive.selector, ACTIVE_EXECUTOR, rotated.previousPeerExpiresAt
            )
        );
        settlement.setCcipRoute(1, address(0x8002), 500_000, 1, 7 days);
        settlement.setPaused(false);
        vm.stopPrank();

        router.deliver(
            address(settlement),
            keccak256("first-peer-still-graced"),
            1,
            ACTIVE_EXECUTOR,
            SettlementMessageCodec.encodeAcknowledgment(1, executionKey, commandMessageId, true, 0)
        );
        assertEq(uint8(settlement.getDisbursement(childId).state), uint8(ISettlementModule.DisbursementState.Confirmed));

        vm.warp(rotated.previousPeerExpiresAt + 1);
        vm.startPrank(OWNER);
        settlement.setPaused(true);
        settlement.setCcipRoute(1, address(0x8002), 500_000, 1, 7 days);
        vm.stopPrank();
        ISettlementModule.CcipRoute memory secondRotation = settlement.ccipRoute();
        assertEq(secondRotation.previousDestinationExecutor, REPLACEMENT_EXECUTOR);
    }

    /// @notice Reusing an executor address on another selector does not keep the old lane trusted.
    /// @dev Deterministic deployments can have the same address on two chains. The live route is
    ///      therefore the selector/address pair, not the address alone.
    function testSettlementModule_sameExecutorAddressOnANewSelectorCannotAcknowledgeTheOldLane() public {
        (uint256 childId, bytes32 executionKey, bytes32 commandMessageId) = _dispatchedSubject();

        vm.startPrank(OWNER);
        settlement.setPaused(true);
        settlement.setCcipRoute(2, ACTIVE_EXECUTOR, 500_000, 1, 0);
        settlement.setPaused(false);
        vm.stopPrank();

        vm.expectRevert(abi.encodeWithSelector(ISettlementModule.RetiredPeerAcknowledgment.selector, ACTIVE_EXECUTOR));
        router.deliver(
            address(settlement),
            keccak256("old-lane-same-address"),
            1,
            ACTIVE_EXECUTOR,
            SettlementMessageCodec.encodeAcknowledgment(1, executionKey, commandMessageId, true, 0)
        );

        vm.prank(OWNER);
        settlement.failStrandedSubject(false, childId);
        assertEq(uint8(settlement.getDisbursement(childId).state), uint8(ISettlementModule.DisbursementState.Failed));
    }

    /// @notice A subject whose executor has retired can be closed out, and only once it truly has.
    /// @dev Without this the tightened acknowledgment check would trade a security hole for a
    ///      liveness one: requeue needs Failed and cancel accepts only Queued or Failed, so a
    ///      Dispatched subject nobody can acknowledge would sit there forever, and the payout plan
    ///      counting it would never resolve.
    function testSettlementModule_strandedSubjectCanBeFailedOnlyOnceItIsGenuinelyStranded() public {
        (uint256 childId,,) = _dispatchedSubject();

        // Still the active peer, so an acknowledgment could yet arrive — refuse to pre-empt it.
        vm.expectRevert(abi.encodeWithSelector(ISettlementModule.SubjectNotStranded.selector, false, childId));
        vm.prank(OWNER);
        settlement.failStrandedSubject(false, childId);

        // Retired but still inside its grace window: the acknowledgment is still legitimate, so
        // closing the subject out here would pre-empt a payment that may well have happened.
        _retireActiveExecutor(7 days);
        vm.expectRevert(abi.encodeWithSelector(ISettlementModule.SubjectNotStranded.selector, false, childId));
        vm.prank(OWNER);
        settlement.failStrandedSubject(false, childId);

        vm.warp(block.timestamp + 8 days);
        vm.prank(OWNER);
        settlement.failStrandedSubject(false, childId);

        ISettlementModule.Disbursement memory stranded = settlement.getDisbursement(childId);
        assertEq(uint8(stranded.state), uint8(ISettlementModule.DisbursementState.Failed));
        assertEq(stranded.failureCode, uint8(ISettlementModule.FailureCode.SourceStranded));

        // Failed is the state the ordinary recovery paths accept, which is the whole point.
        vm.prank(OWNER);
        settlement.requeue(childId);
        assertEq(uint8(settlement.getDisbursement(childId).state), uint8(ISettlementModule.DisbursementState.Queued));
    }

    /// @notice Closing out a stranded subject is the owner's call, not a steward's.
    function testSettlementModule_strandedSubjectCloseOutIsOwnerOnly() public {
        (uint256 childId,,) = _dispatchedSubject();

        _retireActiveExecutor(7 days);
        vm.warp(block.timestamp + 8 days);

        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        vm.prank(CONTRIBUTOR);
        settlement.failStrandedSubject(false, childId);
    }

    function testBeneficiaryFailureRequeueAndCancelMovesParentCounters() public {
        pooling.setCommitment(1, _gardenRequest(PROTOCOL_GARDEN, PROVIDER_GARDEN));
        vm.startPrank(OWNER);
        uint256 planId = settlement.createCommitmentPayoutPlan(1, new ISettlementModule.RecognitionEntry[](0), bytes32(0));
        settlement.finalizeCommitmentPayoutPlan(planId);
        uint256 childId = settlement.prepareGardenBeneficiaryPayout(planId);
        bytes32 commandMessageId = settlement.dispatchDisbursement(childId);
        vm.stopPrank();

        ISettlementModule.Disbursement memory dispatched = settlement.getDisbursement(childId);
        router.deliver(
            address(settlement),
            keccak256("failure-ack"),
            1,
            address(0x8000),
            SettlementMessageCodec.encodeAcknowledgment(
                1, dispatched.executionKey, commandMessageId, false, uint8(ISettlementModule.FailureCode.RouteRejected)
            )
        );

        ISettlementModule.CommitmentPayoutPlan memory failedPlan = settlement.getPayoutPlan(planId);
        assertEq(failedPlan.failedPayoutCount, 1);
        assertEq(uint8(settlement.payoutPlanStatus(planId)), uint8(ISettlementModule.PayoutPlanStatus.Failed));

        vm.startPrank(OWNER);
        settlement.requeue(childId);
        ISettlementModule.Disbursement memory requeued = settlement.getDisbursement(childId);
        assertEq(requeued.attempt, 1);
        assertEq(uint8(requeued.state), uint8(ISettlementModule.DisbursementState.Queued));
        assertEq(settlement.getPayoutPlan(planId).failedPayoutCount, 0);
        settlement.cancelDisbursement(childId, "ipfs://closed");
        vm.stopPrank();

        ISettlementModule.CommitmentPayoutPlan memory cancelledPlan = settlement.getPayoutPlan(planId);
        assertEq(cancelledPlan.cancelledPayoutCount, 1);
        assertEq(uint8(settlement.payoutPlanStatus(planId)), uint8(ISettlementModule.PayoutPlanStatus.Failed));
    }

    function testBeneficiarySuccessAcknowledgmentCompletesExactlyOnce() public {
        pooling.setCommitment(1, _gardenRequest(PROTOCOL_GARDEN, PROVIDER_GARDEN));
        vm.startPrank(OWNER);
        uint256 planId = settlement.createCommitmentPayoutPlan(1, new ISettlementModule.RecognitionEntry[](0), bytes32(0));
        settlement.finalizeCommitmentPayoutPlan(planId);
        uint256 childId = settlement.prepareGardenBeneficiaryPayout(planId);
        bytes32 commandMessageId = settlement.dispatchDisbursement(childId);
        vm.stopPrank();

        ISettlementModule.Disbursement memory dispatched = settlement.getDisbursement(childId);
        bytes memory acknowledgment = SettlementMessageCodec.encodeAcknowledgment(
            1, dispatched.executionKey, commandMessageId, true, uint8(ISettlementModule.FailureCode.None)
        );
        router.deliver(address(settlement), keccak256("success-ack"), 1, address(0x8000), acknowledgment);
        router.deliver(address(settlement), keccak256("duplicate-ack"), 1, address(0x8000), acknowledgment);

        ISettlementModule.CommitmentPayoutPlan memory completed = settlement.getPayoutPlan(planId);
        assertEq(completed.confirmedPayoutCount, 1);
        assertEq(uint8(settlement.payoutPlanStatus(planId)), uint8(ISettlementModule.PayoutPlanStatus.Complete));
    }

    function testBatchExecutionKeySeparatesBatchFromSameNumberedChild() public {
        vm.startPrank(OWNER);
        settlement.setPaused(true);
        settlement.setBatchSizeLimit(1);
        settlement.setPaused(false);
        uint256 childId = settlement.queueFunding(PROVIDER_GARDEN, 10 ether);
        uint256[] memory ids = new uint256[](1);
        ids[0] = childId;
        uint256 batchId = settlement.createBatch(ids);
        settlement.dispatchBatch(batchId);
        vm.stopPrank();

        assertEq(childId, batchId);
        ISettlementModule.Batch memory batch = settlement.getBatch(batchId);
        bytes32 unbatchedKey = keccak256(abi.encode(ARBITRUM_SELECTOR, address(settlement), false, childId, uint32(0)));
        bytes32 expectedBatchKey = keccak256(abi.encode(ARBITRUM_SELECTOR, address(settlement), true, batchId, uint32(0)));
        assertEq(batch.executionKey, expectedBatchKey);
        assertTrue(batch.executionKey != unbatchedKey);
    }

    /// @notice A batch command cannot be consumed through one of the children that shares its key.
    /// @dev Both id counters start at one, so this also covers a same-numbered batch and child. The
    ///      rejected call must leave the command usable for the correct batch close-out and keep
    ///      payout-plan counters balanced through the later child requeue.
    function testSettlementModule_strandedBatchRejectsAChildDomainCloseOut() public {
        pooling.setCommitment(1, _gardenRequest(PROTOCOL_GARDEN, PROVIDER_GARDEN));
        vm.startPrank(OWNER);
        settlement.setPaused(true);
        settlement.setBatchSizeLimit(1);
        settlement.setPaused(false);
        uint256 planId = settlement.createCommitmentPayoutPlan(1, new ISettlementModule.RecognitionEntry[](0), bytes32(0));
        settlement.finalizeCommitmentPayoutPlan(planId);
        uint256 childId = settlement.prepareGardenBeneficiaryPayout(planId);
        uint256[] memory ids = new uint256[](1);
        ids[0] = childId;
        uint256 batchId = settlement.createBatch(ids);
        settlement.dispatchBatch(batchId);
        vm.stopPrank();

        assertEq(childId, batchId, "the regression needs the colliding-id shape");
        _retireActiveExecutor(7 days);
        vm.warp(block.timestamp + 8 days);

        vm.expectRevert(ISettlementModule.InvalidExecutionKey.selector);
        vm.prank(OWNER);
        settlement.failStrandedSubject(false, childId);
        assertEq(uint8(settlement.getBatch(batchId).state), uint8(ISettlementModule.DisbursementState.Dispatched));
        assertEq(uint8(settlement.getDisbursement(childId).state), uint8(ISettlementModule.DisbursementState.Dispatched));
        assertEq(settlement.getPayoutPlan(planId).failedPayoutCount, 0);

        vm.prank(OWNER);
        settlement.failStrandedSubject(true, batchId);
        assertEq(uint8(settlement.getBatch(batchId).state), uint8(ISettlementModule.DisbursementState.Failed));
        assertEq(uint8(settlement.getDisbursement(childId).state), uint8(ISettlementModule.DisbursementState.Failed));
        assertEq(settlement.getPayoutPlan(planId).failedPayoutCount, 1);

        vm.prank(OWNER);
        settlement.requeue(childId);
        assertEq(uint8(settlement.getDisbursement(childId).state), uint8(ISettlementModule.DisbursementState.Queued));
        assertEq(settlement.getPayoutPlan(planId).failedPayoutCount, 0);
    }

    function testCrossGardenContributorPlanRejectsRetention() public {
        pooling.setCommitment(2, _individualRequest(PROTOCOL_GARDEN, PROVIDER_GARDEN));
        bytes32 recognitionHash = keccak256("recognition");
        pooling.setCanonicalRecognitionHash(recognitionHash);
        ISettlementModule.RecognitionEntry[] memory recognition = _recognition();

        vm.startPrank(OWNER);
        uint256 planId = settlement.createCommitmentPayoutPlan(2, recognition, recognitionHash);
        ISettlementModule.ContributorPayoutInput[] memory payouts = new ISettlementModule.ContributorPayoutInput[](1);
        payouts[0] = ISettlementModule.ContributorPayoutInput({ contributor: CONTRIBUTOR, amount: 90 ether });
        vm.expectRevert();
        settlement.setContributorPayouts(planId, 10 ether, payouts, "ipfs://retention");
        vm.stopPrank();
    }

    function testGardenInternalContributorPlanMayRetainAndConserves() public {
        pooling.setCommitment(3, _individualRequest(PROVIDER_GARDEN, PROVIDER_GARDEN));
        bytes32 recognitionHash = keccak256("recognition-internal");
        pooling.setCanonicalRecognitionHash(recognitionHash);
        ISettlementModule.RecognitionEntry[] memory recognition = _recognition();

        vm.startPrank(OWNER);
        uint256 planId = settlement.createCommitmentPayoutPlan(3, recognition, recognitionHash);
        ISettlementModule.ContributorPayoutInput[] memory payouts = new ISettlementModule.ContributorPayoutInput[](1);
        payouts[0] = ISettlementModule.ContributorPayoutInput({ contributor: CONTRIBUTOR, amount: 90 ether });
        settlement.setContributorPayouts(planId, 10 ether, payouts, "ipfs://retention");
        settlement.finalizeCommitmentPayoutPlan(planId);
        vm.stopPrank();

        ISettlementModule.CommitmentPayoutPlan memory plan = settlement.getPayoutPlan(planId);
        assertEq(plan.gardenRetainedAmount, 10 ether);
        assertEq(plan.contributorPayoutTotal, 90 ether);
        assertEq(plan.declaredAmount, plan.gardenRetainedAmount + plan.contributorPayoutTotal);
    }

    function testProtocolOfferGardenClaimPaysContributorsFromClaimingGarden() public {
        pooling.setCommitment(4, _gardenOffer(PROVIDER_GARDEN, PROTOCOL_GARDEN));
        bytes32 recognitionHash = keccak256("offer-recognition");
        pooling.setCanonicalRecognitionHash(recognitionHash);

        vm.prank(OWNER);
        uint256 planId = settlement.createCommitmentPayoutPlan(4, _recognition(), recognitionHash);
        ISettlementModule.CommitmentPayoutPlan memory plan = settlement.getPayoutPlan(planId);
        ISettlementModule.ContributorPayout memory payout = settlement.contributorPayoutOf(planId, CONTRIBUTOR);
        assertEq(uint8(plan.payoutKind), uint8(ISettlementModule.DisbursementKind.ContributorConsideration));
        assertEq(plan.payerGarden, PROVIDER_GARDEN);
        assertEq(plan.providerGarden, PROTOCOL_GARDEN);
        assertEq(plan.source, BENEFICIARY_SAFE);
        assertEq(payout.recipient, CONTRIBUTOR);
        assertEq(plan.beneficiaryRecipient, address(0));
    }

    function _individualRequest(
        address payer,
        address provider
    )
        internal
        pure
        returns (ICommitmentPoolingModule.Commitment memory commitment)
    {
        commitment = _gardenRequest(payer, provider);
        commitment.claimType = ICommitmentPoolingModule.ClaimType.Individual;
        commitment.counterpartyKind = ICommitmentPoolingModule.ClaimType.Individual;
    }

    function _gardenOffer(
        address payer,
        address provider
    )
        internal
        pure
        returns (ICommitmentPoolingModule.Commitment memory commitment)
    {
        commitment = _gardenRequest(payer, provider);
        commitment.direction = ICommitmentPoolingModule.CommitmentDirection.Offer;
        commitment.claimType = ICommitmentPoolingModule.ClaimType.Garden;
        commitment.counterpartyKind = ICommitmentPoolingModule.ClaimType.Garden;
    }

    function _recognition() internal pure returns (ISettlementModule.RecognitionEntry[] memory entries) {
        entries = new ISettlementModule.RecognitionEntry[](1);
        entries[0] = ISettlementModule.RecognitionEntry({ contributor: CONTRIBUTOR, recognitionWeightBps: 10_000 });
    }
}
