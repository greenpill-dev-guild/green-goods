// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ISettlementModule } from "../../src/interfaces/ISettlementModule.sol";
import { SettlementMessageCodec } from "../../src/libraries/SettlementMessageCodec.sol";
import { SettlementPayerTest } from "./SettlementPayer.t.sol";

contract SettlementLifecycleTest is SettlementPayerTest {
    address internal constant CONTRIBUTOR = address(0x9000);

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
