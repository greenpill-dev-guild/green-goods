// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Vm } from "forge-std/Vm.sol";

import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ISettlementModule } from "../../src/interfaces/ISettlementModule.sol";
import { SettlementAcknowledgmentLib } from "../../src/lib/Settlement/AcknowledgmentLib.sol";
import { SettlementFundingLib } from "../../src/lib/Settlement/FundingLib.sol";
import { SettlementLifecycleLib } from "../../src/lib/Settlement/LifecycleLib.sol";
import { SettlementPlanLib } from "../../src/lib/Settlement/PlanLib.sol";
import { SettlementMessageCodec } from "../../src/libraries/SettlementMessageCodec.sol";
import { SettlementPayerTest } from "./SettlementPayer.t.sol";

interface VmAccessList {
    /// @notice Marks an account and all of its storage slots cold for gas measurement.
    function cool(address target) external;
}

/// @title SettlementFundingTest
/// @notice Member deposits, acceptance races, and the one-child refund obligation.
contract SettlementFundingTest is SettlementPayerTest {
    struct FundedBatchAttempt {
        bool success;
        uint256 gasUsed;
        uint256 batchId;
        bytes acknowledgment;
        bytes returnData;
    }

    uint256 private constant POOL_ID = 77;
    address private constant FUNDER_A = address(0xF00A);
    address private constant FUNDER_B = address(0xF00B);
    address private constant REFUND_A = address(0xA00A);
    address private constant REFUND_B = address(0xA00B);
    address private constant EXECUTOR = address(0x8000);
    uint256 private constant PRICE = 100 ether;
    uint256 private constant SOURCE_ACKNOWLEDGMENT_GAS_LIMIT = 300_000;
    uint16 private constant PROPOSED_BATCH_SIZE_LIMIT = 3;
    uint16 private constant HARD_MAX_BATCH_SIZE = 24;
    bytes32 private constant FUNDING_STATE_SLOT = 0x14790e171eb52cfebe9fb0c814ca455ea33a3bcc183d5784757d5df85dd1e400;

    function testFundingPledgeIsIdempotentAndFreezesThePendingClaim() public {
        _setPricedOffer(1, FUNDER_A);

        vm.expectEmit(true, true, true, true);
        emit ISettlementModule.FundingPledged(1, 1, FUNDER_A, PROVIDER_GARDEN, REFUND_A, PRICE, OWNER);
        vm.prank(OWNER);
        uint256 fundingId = settlement.recordFunding(1, FUNDER_A, REFUND_A);

        vm.recordLogs();
        vm.prank(OWNER);
        uint256 replayed = settlement.recordFunding(1, FUNDER_A, REFUND_A);

        ISettlementModule.CommitmentFunding memory funding = settlement.getCommitmentFunding(fundingId);
        assertEq(fundingId, 1);
        assertEq(replayed, fundingId);
        assertEq(vm.getRecordedLogs().length, 0);
        assertEq(funding.commitmentId, 1);
        assertEq(funding.funder, FUNDER_A);
        assertEq(funding.garden, PROVIDER_GARDEN);
        assertEq(funding.refundAccount, REFUND_A);
        assertEq(funding.expectedAmount, PRICE);
        assertEq(uint8(funding.state), uint8(ISettlementModule.FundingState.Pledged));
        assertEq(settlement.fundingOfCommitmentFunder(1, FUNDER_A), fundingId);
        assertEq(vm.load(address(settlement), FUNDING_STATE_SLOT), bytes32(uint256(2)));
        assertEq(vm.load(address(settlement), _mappingSlot(1, uint256(FUNDING_STATE_SLOT) + 1)), bytes32(uint256(1)));
        bytes32 commitmentFunderRoot = _mappingSlot(1, uint256(FUNDING_STATE_SLOT) + 2);
        assertEq(vm.load(address(settlement), _mappingSlot(FUNDER_A, uint256(commitmentFunderRoot))), bytes32(fundingId));
    }

    function testFundingPledgeConflictCannotChangeRefundOrFrozenPrice() public {
        _setPricedOffer(2, FUNDER_A);
        vm.prank(OWNER);
        uint256 fundingId = settlement.recordFunding(2, FUNDER_A, REFUND_A);

        vm.expectRevert(abi.encodeWithSelector(ISettlementModule.FundingRecordConflict.selector, 2, FUNDER_A, fundingId));
        vm.prank(OWNER);
        settlement.recordFunding(2, FUNDER_A, REFUND_B);

        ICommitmentPoolingModule.Commitment memory repriced = pooling.getCommitment(2);
        repriced.consideration.amount = PRICE + 1;
        pooling.setCommitment(2, repriced);
        vm.expectRevert(abi.encodeWithSelector(ISettlementModule.FundingRecordConflict.selector, 2, FUNDER_A, fundingId));
        vm.prank(OWNER);
        settlement.recordFunding(2, FUNDER_A, REFUND_A);
    }

    function testFundingPledgeRejectsTheGardenSourceSafeAsRefundAccount() public {
        _setPricedOffer(5, FUNDER_A);

        vm.expectRevert(ISettlementModule.InvalidPayoutVector.selector);
        vm.prank(OWNER);
        settlement.recordFunding(5, FUNDER_A, BENEFICIARY_SAFE);
    }

    function testDepositRequiresUniqueReferenceAndAtLeastTheFrozenPrice() public {
        _setPricedOffer(3, FUNDER_A);
        _setPricedOffer(4, FUNDER_B);
        uint256 first = _pledge(3, FUNDER_A, REFUND_A);
        uint256 second = _pledge(4, FUNDER_B, REFUND_B);

        vm.expectRevert(
            abi.encodeWithSelector(ISettlementModule.FundingDepositBelowPrice.selector, first, PRICE, PRICE - 1)
        );
        vm.prank(OWNER);
        settlement.recordFundingDeposit(first, PRICE - 1, keccak256("below"));

        bytes32 depositRef = keccak256("deposit-reference");
        vm.prank(OWNER);
        settlement.recordFundingDeposit(first, PRICE, depositRef);
        assertEq(
            vm.load(address(settlement), _mappingSlot(uint256(depositRef), uint256(FUNDING_STATE_SLOT) + 3)), bytes32(first)
        );
        vm.expectRevert(abi.encodeWithSelector(ISettlementModule.FundingDepositReferenceUsed.selector, depositRef, first));
        vm.prank(OWNER);
        settlement.recordFundingDeposit(second, PRICE, depositRef);
    }

    function testBothFundingRaceOrdersConsumeOnlyTheAcceptedMember() public {
        _assertFundingRace(10, FUNDER_A, REFUND_A, FUNDER_B, REFUND_B);
        _assertFundingRace(11, FUNDER_B, REFUND_B, FUNDER_A, REFUND_A);
    }

    function testDeclineAfterDepositRefundsExactAndExcessDepositsInFull() public {
        _setPricedOffer(20, FUNDER_A);
        _addPendingClaim(20, FUNDER_B);
        uint256 exact = _pledgeAndDeposit(20, FUNDER_A, REFUND_A, PRICE, keccak256("exact"));
        uint256 excess = _pledgeAndDeposit(20, FUNDER_B, REFUND_B, PRICE + 25 ether, keccak256("excess"));

        ICommitmentPoolingModule.PendingClaim memory exactClaim = pooling.getPendingClaim(20, FUNDER_A);
        exactClaim.active = false;
        pooling.setPendingClaim(20, FUNDER_A, exactClaim);
        ICommitmentPoolingModule.PendingClaim memory excessClaim = pooling.getPendingClaim(20, FUNDER_B);
        excessClaim.active = false;
        pooling.setPendingClaim(20, FUNDER_B, excessClaim);

        vm.startPrank(OWNER);
        uint256 exactRefund = settlement.queueFundingRefund(exact);
        uint256 excessRefund = settlement.queueFundingRefund(excess);
        vm.stopPrank();

        assertEq(settlement.getDisbursement(exactRefund).amount, PRICE);
        assertEq(settlement.getDisbursement(excessRefund).amount, PRICE + 25 ether);
        assertEq(settlement.getDisbursement(exactRefund).recipient, REFUND_A);
        assertEq(settlement.getDisbursement(excessRefund).recipient, REFUND_B);
    }

    function testRefundFailureRequeuesTheSameChildAndSuccessClosesTheObligation() public {
        _setPricedOffer(30, FUNDER_A);
        uint256 fundingId = _pledgeAndDeposit(30, FUNDER_A, REFUND_A, PRICE, keccak256("retry-deposit"));

        vm.startPrank(OWNER);
        uint256 childId = settlement.queueFundingRefund(fundingId);
        assertEq(vm.load(address(settlement), _mappingSlot(childId, uint256(FUNDING_STATE_SLOT) + 4)), bytes32(fundingId));
        assertEq(settlement.queueFundingRefund(fundingId), childId);
        bytes32 firstMessageId = settlement.dispatchDisbursement(childId);
        vm.stopPrank();
        _acknowledge(childId, firstMessageId, false, ISettlementModule.FailureCode.BalanceDeltaMismatch);

        assertEq(
            uint8(settlement.getCommitmentFunding(fundingId).state), uint8(ISettlementModule.FundingState.RefundQueued)
        );
        assertEq(uint8(settlement.getDisbursement(childId).state), uint8(ISettlementModule.DisbursementState.Failed));
        vm.startPrank(OWNER);
        assertEq(settlement.queueFundingRefund(fundingId), childId);
        settlement.requeue(childId);
        bytes32 secondMessageId = settlement.dispatchDisbursement(childId);
        vm.stopPrank();
        _acknowledge(childId, secondMessageId, true, ISettlementModule.FailureCode.None);

        ISettlementModule.CommitmentFunding memory refunded = settlement.getCommitmentFunding(fundingId);
        assertEq(uint8(refunded.state), uint8(ISettlementModule.FundingState.Refunded));
        assertEq(refunded.refundDisbursementId, childId);
        assertEq(settlement.fundingRefundDisbursementOf(fundingId), childId);
        vm.prank(OWNER);
        assertEq(settlement.queueFundingRefund(fundingId), childId);
    }

    function testConsumedFundingRefundsOnlyAfterTerminalNonFulfillment() public {
        _setPricedOffer(40, FUNDER_A);
        uint256 fundingId = _pledgeAndDeposit(40, FUNDER_A, REFUND_A, PRICE, keccak256("consumed"));
        _accept(40, FUNDER_A);
        vm.prank(OWNER);
        settlement.consumeFunding(fundingId);

        vm.expectRevert(abi.encodeWithSelector(ISettlementModule.FundingRefundNotEligible.selector, fundingId));
        vm.prank(OWNER);
        settlement.queueFundingRefund(fundingId);

        ICommitmentPoolingModule.Commitment memory cancelled = pooling.getCommitment(40);
        cancelled.state = ICommitmentPoolingModule.CommitmentState.Cancelled;
        pooling.setCommitment(40, cancelled);
        vm.prank(OWNER);
        uint256 childId = settlement.queueFundingRefund(fundingId);
        assertEq(uint8(settlement.getDisbursement(childId).kind), uint8(ISettlementModule.DisbursementKind.Refund));
    }

    function testPledgedWithdrawalCreatesNoRefundChild() public {
        _setPricedOffer(50, FUNDER_A);
        uint256 fundingId = _pledge(50, FUNDER_A, REFUND_A);

        vm.expectEmit(true, true, true, true);
        emit ISettlementModule.FundingWithdrawn(fundingId, 50, FUNDER_A, OWNER);
        vm.prank(OWNER);
        assertEq(settlement.queueFundingRefund(fundingId), 0);

        ISettlementModule.CommitmentFunding memory withdrawn = settlement.getCommitmentFunding(fundingId);
        assertEq(uint8(withdrawn.state), uint8(ISettlementModule.FundingState.Withdrawn));
        assertEq(withdrawn.refundDisbursementId, 0);

        vm.expectRevert(abi.encodeWithSelector(ISettlementModule.FundingRefundNotEligible.selector, fundingId));
        vm.prank(OWNER);
        settlement.queueFundingRefund(fundingId);
    }

    function testCompletedPayoutPlanClosesConsumedFundingWithoutAnotherPayment() public {
        _setPricedOffer(60, FUNDER_A);
        uint256 fundingId = _pledgeAndDeposit(60, FUNDER_A, REFUND_A, PRICE, keccak256("close"));
        _accept(60, FUNDER_A);
        vm.prank(OWNER);
        settlement.consumeFunding(fundingId);
        assertEq(vm.load(address(settlement), _mappingSlot(60, uint256(FUNDING_STATE_SLOT) + 5)), bytes32(fundingId));

        ICommitmentPoolingModule.Commitment memory fulfilled = pooling.getCommitment(60);
        fulfilled.state = ICommitmentPoolingModule.CommitmentState.Fulfilled;
        fulfilled.providerGarden = PROVIDER_GARDEN;
        pooling.setCommitment(60, fulfilled);
        bytes32 recognitionHash = keccak256("close-recognition");
        pooling.setCanonicalRecognitionHash(recognitionHash);
        ISettlementModule.RecognitionEntry[] memory recognition = new ISettlementModule.RecognitionEntry[](1);
        recognition[0] =
            ISettlementModule.RecognitionEntry({ contributor: fulfilled.creator, recognitionWeightBps: 10_000 });
        ISettlementModule.ContributorPayoutInput[] memory retained = new ISettlementModule.ContributorPayoutInput[](1);
        retained[0] = ISettlementModule.ContributorPayoutInput({ contributor: fulfilled.creator, amount: 0 });

        vm.startPrank(OWNER);
        uint256 planId = settlement.createCommitmentPayoutPlan(60, recognition, recognitionHash);
        settlement.setContributorPayouts(planId, PRICE, retained, "garden retained the delivered value");
        settlement.finalizeCommitmentPayoutPlan(planId);
        vm.stopPrank();

        ISettlementModule.CommitmentFunding memory closed = settlement.getCommitmentFunding(fundingId);
        assertEq(uint8(settlement.payoutPlanStatus(planId)), uint8(ISettlementModule.PayoutPlanStatus.Complete));
        assertEq(uint8(closed.state), uint8(ISettlementModule.FundingState.Closed));
        assertGt(closed.closedAt, 0);
        assertEq(closed.refundDisbursementId, 0);
        assertEq(vm.load(address(settlement), _mappingSlot(60, uint256(FUNDING_STATE_SLOT) + 5)), bytes32(fundingId));
    }

    function testConsumeRejectsAConflictingWriteOncePointerWithoutMutation() public {
        _setPricedOffer(62, FUNDER_A);
        uint256 fundingId = _pledgeAndDeposit(62, FUNDER_A, REFUND_A, PRICE, keccak256("pointer-conflict"));
        _accept(62, FUNDER_A);
        bytes32 pointerSlot = _mappingSlot(62, uint256(FUNDING_STATE_SLOT) + 5);
        uint256 conflictingFundingId = 999;
        vm.store(address(settlement), pointerSlot, bytes32(conflictingFundingId));

        vm.expectRevert(
            abi.encodeWithSelector(ISettlementModule.FundingRecordConflict.selector, 62, FUNDER_A, conflictingFundingId)
        );
        vm.prank(OWNER);
        settlement.consumeFunding(fundingId);

        ISettlementModule.CommitmentFunding memory funding = settlement.getCommitmentFunding(fundingId);
        assertEq(uint8(funding.state), uint8(ISettlementModule.FundingState.DepositRecorded));
        assertEq(funding.consumedAt, 0);
        assertEq(vm.load(address(settlement), pointerSlot), bytes32(conflictingFundingId));
    }

    function testSuccessfulAcknowledgmentClosesFundingWithoutPoolingRead() public {
        _enableGardenerDelivery(0);
        uint256 childId = _prepareFundedContributorPayout(61, FUNDER_A, REFUND_A, address(0xD061));
        vm.prank(OWNER);
        bytes32 commandMessageId = settlement.dispatchDisbursement(childId);
        ISettlementModule.Disbursement memory child = settlement.getDisbursement(childId);
        pooling.setCommitmentReadsDisabled(true);

        router.deliver(
            address(settlement),
            keccak256("local-funding-close"),
            1,
            EXECUTOR,
            SettlementMessageCodec.encodeAcknowledgment(
                1, child.executionKey, commandMessageId, true, uint8(ISettlementModule.FailureCode.None)
            )
        );

        uint256 fundingId = settlement.fundingOfCommitmentFunder(61, FUNDER_A);
        assertEq(uint8(settlement.getCommitmentFunding(fundingId).state), uint8(ISettlementModule.FundingState.Closed));
    }

    function testSuccessfulAcknowledgmentCompletesUnfundedPlanWithoutPoolingRead() public {
        pooling.setCommitment(63, _gardenRequest(PROTOCOL_GARDEN, PROVIDER_GARDEN));

        vm.startPrank(OWNER);
        uint256 planId = settlement.createCommitmentPayoutPlan(63, new ISettlementModule.RecognitionEntry[](0), bytes32(0));
        settlement.finalizeCommitmentPayoutPlan(planId);
        uint256 childId = settlement.prepareGardenBeneficiaryPayout(planId);
        bytes32 commandMessageId = settlement.dispatchDisbursement(childId);
        vm.stopPrank();
        ISettlementModule.Disbursement memory child = settlement.getDisbursement(childId);
        pooling.setCommitmentReadsDisabled(true);

        router.deliver(
            address(settlement),
            keccak256("local-unfunded-close"),
            1,
            EXECUTOR,
            SettlementMessageCodec.encodeAcknowledgment(
                1, child.executionKey, commandMessageId, true, uint8(ISettlementModule.FailureCode.None)
            )
        );

        assertEq(uint8(settlement.getDisbursement(childId).state), uint8(ISettlementModule.DisbursementState.Confirmed));
        assertEq(uint8(settlement.payoutPlanStatus(planId)), uint8(ISettlementModule.PayoutPlanStatus.Complete));
    }

    function testProposedFundedBatchAcknowledgmentFitsTheFixedSourceGasBudget() public {
        FundedBatchAttempt memory attempt = _deliverFundedBatchWithGasLimit(PROPOSED_BATCH_SIZE_LIMIT, 100);

        emit log_named_uint("settlement source acknowledgment gas / proposed funded batch (3)", attempt.gasUsed);
        assertTrue(attempt.success, "the proposed funded batch must fit the fixed source receiver budget");
        assertEq(attempt.returnData.length, 0);
        assertEq(uint8(settlement.getBatch(attempt.batchId).state), uint8(ISettlementModule.DisbursementState.Confirmed));
        _assertFundingState(100, ISettlementModule.FundingState.Closed);
        _assertFundingState(102, ISettlementModule.FundingState.Closed);
    }

    function testNextFundedBatchSizeDoesNotFitTheFixedSourceGasBudget() public {
        FundedBatchAttempt memory attempt = _deliverFundedBatchWithGasLimit(PROPOSED_BATCH_SIZE_LIMIT + 1, 150);

        emit log_named_uint("settlement source acknowledgment gas / first rejected funded batch (4)", attempt.gasUsed);
        assertFalse(
            attempt.success, "the first batch above the proposed limit must exceed the fixed source receiver budget"
        );
        assertEq(attempt.returnData.length, 0, "receiver-gas exhaustion must return no Solidity revert payload");
        assertEq(uint8(settlement.getBatch(attempt.batchId).state), uint8(ISettlementModule.DisbursementState.Dispatched));
        _assertFundingState(150, ISettlementModule.FundingState.Consumed);
        _assertFundingState(153, ISettlementModule.FundingState.Consumed);

        _coolSettlementAcknowledgmentPath();
        (bool retrySuccess, uint256 retryGasUsed, bytes memory retryData) = router.tryDeliverWithReceiverGas(
            address(settlement),
            keccak256(abi.encode("funded-batch-ack", PROPOSED_BATCH_SIZE_LIMIT + 1)),
            1,
            EXECUTOR,
            attempt.acknowledgment,
            1_000_000
        );
        emit log_named_uint("settlement source acknowledgment gas / funded batch retry (4)", retryGasUsed);
        assertTrue(retrySuccess, "the unchanged batch must succeed when only the receiver-gas cap is raised");
        assertEq(retryData.length, 0);
        assertEq(uint8(settlement.getBatch(attempt.batchId).state), uint8(ISettlementModule.DisbursementState.Confirmed));
        _assertFundingState(150, ISettlementModule.FundingState.Closed);
        _assertFundingState(153, ISettlementModule.FundingState.Closed);
    }

    function testHardMaxFundedBatchAcknowledgmentDoesNotFitTheFixedSourceGasBudget() public {
        FundedBatchAttempt memory attempt = _deliverFundedBatchWithGasLimit(HARD_MAX_BATCH_SIZE, 200);

        emit log_named_uint("settlement source acknowledgment gas / hard-max funded batch (24)", attempt.gasUsed);
        assertFalse(attempt.success, "the hard maximum must stay disabled because its funded acknowledgment exceeds 300k");
        assertEq(attempt.returnData.length, 0);
        assertEq(uint8(settlement.getBatch(attempt.batchId).state), uint8(ISettlementModule.DisbursementState.Dispatched));
        _assertFundingState(200, ISettlementModule.FundingState.Consumed);
        _assertFundingState(223, ISettlementModule.FundingState.Consumed);
    }

    function testFundingWritesRequireTheImmutableGardenSteward() public {
        _setPricedOffer(70, FUNDER_A);
        vm.expectRevert(abi.encodeWithSelector(ISettlementModule.NotSettlementSteward.selector, FUNDER_A, PROVIDER_GARDEN));
        vm.prank(FUNDER_A);
        settlement.recordFunding(70, FUNDER_A, REFUND_A);
    }

    function testPausedSourceAllowsRecordsOnlyFundingWritesButBlocksNewRefundAuthority() public {
        _setPricedOffer(71, FUNDER_A);
        vm.prank(OWNER);
        settlement.setPaused(true);

        vm.startPrank(OWNER);
        uint256 fundingId = settlement.recordFunding(71, FUNDER_A, REFUND_A);
        settlement.recordFundingDeposit(fundingId, PRICE, keccak256("paused-records"));
        vm.stopPrank();
        _accept(71, FUNDER_A);
        vm.prank(OWNER);
        settlement.consumeFunding(fundingId);

        ICommitmentPoolingModule.Commitment memory cancelled = pooling.getCommitment(71);
        cancelled.state = ICommitmentPoolingModule.CommitmentState.Cancelled;
        pooling.setCommitment(71, cancelled);
        vm.expectRevert(ISettlementModule.SourceMustBePaused.selector);
        vm.prank(OWNER);
        settlement.queueFundingRefund(fundingId);

        assertEq(uint8(settlement.getCommitmentFunding(fundingId).state), uint8(ISettlementModule.FundingState.Consumed));
    }

    function _assertFundingRace(
        uint256 commitmentId,
        address acceptedFunder,
        address acceptedRefund,
        address supersededFunder,
        address supersededRefund
    )
        private
    {
        _setPricedOffer(commitmentId, acceptedFunder);
        _addPendingClaim(commitmentId, supersededFunder);
        uint256 acceptedFunding = _pledgeAndDeposit(
            commitmentId, acceptedFunder, acceptedRefund, PRICE, keccak256(abi.encode(commitmentId, "accepted"))
        );
        uint256 supersededFunding = _pledgeAndDeposit(
            commitmentId, supersededFunder, supersededRefund, PRICE, keccak256(abi.encode(commitmentId, "superseded"))
        );
        _accept(commitmentId, acceptedFunder);

        vm.recordLogs();
        vm.startPrank(OWNER);
        settlement.consumeFunding(acceptedFunding);
        vm.expectRevert(
            abi.encodeWithSelector(
                ISettlementModule.FundingClaimantMismatch.selector, supersededFunding, supersededFunder, acceptedFunder
            )
        );
        settlement.consumeFunding(supersededFunding);
        uint256 refundId = settlement.queueFundingRefund(supersededFunding);
        vm.stopPrank();
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 consumedTopic = keccak256("FundingConsumed(uint256,uint256,address,uint256,address)");
        bytes32 queuedTopic = keccak256(
            "DisbursementQueued(uint256,uint256,address,uint256,address,address,uint8,uint8,address,address,address,uint256)"
        );
        assertEq(logs.length, 2, "the race outcome must emit only consumption then refund queueing");
        assertEq(logs[0].topics[0], consumedTopic, "consumption event must precede refund authority");
        assertEq(logs[1].topics[0], queuedTopic, "refund queue event must follow consumption");

        assertEq(
            uint8(settlement.getCommitmentFunding(acceptedFunding).state), uint8(ISettlementModule.FundingState.Consumed)
        );
        assertEq(
            uint8(settlement.getCommitmentFunding(supersededFunding).state),
            uint8(ISettlementModule.FundingState.RefundQueued)
        );
        assertEq(settlement.getDisbursement(refundId).contributor, supersededFunder);
    }

    function _deliverFundedBatchWithGasLimit(
        uint16 batchSize,
        uint256 commitmentSeed
    )
        private
        returns (FundedBatchAttempt memory attempt)
    {
        _enableGardenerDelivery(batchSize);

        uint256[] memory childIds = new uint256[](batchSize);
        for (uint256 index; index < batchSize; ++index) {
            uint256 commitmentId = commitmentSeed + index;
            address funder = address(uint160(0xF100 + commitmentId));
            address refundAccount = address(uint160(0xA100 + commitmentId));
            address contributor = address(uint160(0xD100 + commitmentId));
            childIds[index] = _prepareFundedContributorPayout(commitmentId, funder, refundAccount, contributor);
        }

        vm.startPrank(OWNER);
        attempt.batchId = settlement.createBatch(childIds);
        bytes32 commandMessageId = settlement.dispatchBatch(attempt.batchId);
        vm.stopPrank();

        ISettlementModule.Batch memory batch = settlement.getBatch(attempt.batchId);
        pooling.setCommitmentReadsDisabled(true);
        attempt.acknowledgment = SettlementMessageCodec.encodeAcknowledgment(
            1, batch.executionKey, commandMessageId, true, uint8(ISettlementModule.FailureCode.None)
        );
        _coolSettlementAcknowledgmentPath();
        (attempt.success, attempt.gasUsed, attempt.returnData) = router.tryDeliverWithReceiverGas(
            address(settlement),
            keccak256(abi.encode("funded-batch-ack", batchSize)),
            1,
            EXECUTOR,
            attempt.acknowledgment,
            SOURCE_ACKNOWLEDGMENT_GAS_LIMIT
        );
    }

    function _coolSettlementAcknowledgmentPath() private {
        VmAccessList accessList = VmAccessList(address(vm));
        accessList.cool(address(settlement));
        accessList.cool(address(settlementImplementation));
        accessList.cool(address(SettlementAcknowledgmentLib));
        accessList.cool(address(SettlementLifecycleLib));
        accessList.cool(address(SettlementFundingLib));
        accessList.cool(address(SettlementPlanLib));
    }

    function _assertFundingState(uint256 commitmentId, ISettlementModule.FundingState expected) private {
        address funder = address(uint160(0xF100 + commitmentId));
        uint256 fundingId = settlement.fundingOfCommitmentFunder(commitmentId, funder);
        assertEq(uint8(settlement.getCommitmentFunding(fundingId).state), uint8(expected));
    }

    function _enableGardenerDelivery(uint16 batchSize) private {
        vm.startPrank(OWNER);
        settlement.setPaused(true);
        settlement.setGardenerDeliveryEnabled(true);
        if (batchSize != 0) settlement.setBatchSizeLimit(batchSize);
        settlement.setPaused(false);
        vm.stopPrank();
    }

    function _prepareFundedContributorPayout(
        uint256 commitmentId,
        address funder,
        address refundAccount,
        address contributor
    )
        private
        returns (uint256 childId)
    {
        _setPricedOffer(commitmentId, funder);
        uint256 fundingId = _pledgeAndDeposit(
            commitmentId, funder, refundAccount, PRICE, keccak256(abi.encode("funded-payout", commitmentId))
        );
        _accept(commitmentId, funder);
        vm.prank(OWNER);
        settlement.consumeFunding(fundingId);

        ICommitmentPoolingModule.Commitment memory fulfilled = pooling.getCommitment(commitmentId);
        fulfilled.state = ICommitmentPoolingModule.CommitmentState.Fulfilled;
        pooling.setCommitment(commitmentId, fulfilled);
        bytes32 recognitionHash = keccak256(abi.encode("funded-recognition", commitmentId));
        pooling.setCanonicalRecognitionHash(recognitionHash);
        ISettlementModule.RecognitionEntry[] memory recognition = new ISettlementModule.RecognitionEntry[](1);
        recognition[0] = ISettlementModule.RecognitionEntry({ contributor: contributor, recognitionWeightBps: 10_000 });

        vm.startPrank(OWNER);
        uint256 planId = settlement.createCommitmentPayoutPlan(commitmentId, recognition, recognitionHash);
        settlement.finalizeCommitmentPayoutPlan(planId);
        childId = settlement.prepareContributorPayout(planId, contributor);
        vm.stopPrank();
    }

    function _setPricedOffer(uint256 commitmentId, address funder) private {
        ICommitmentPoolingModule.Pool memory pool;
        pool.garden = PROVIDER_GARDEN;
        pool.poolType = ICommitmentPoolingModule.PoolType.Garden;
        pool.state = ICommitmentPoolingModule.PoolState.Open;
        pooling.setPool(POOL_ID, pool);

        ICommitmentPoolingModule.Commitment memory commitment;
        commitment.poolId = POOL_ID;
        commitment.creator = address(0xC0DE);
        commitment.state = ICommitmentPoolingModule.CommitmentState.Offered;
        commitment.direction = ICommitmentPoolingModule.CommitmentDirection.Offer;
        commitment.claimType = ICommitmentPoolingModule.ClaimType.Individual;
        commitment.claimMode = ICommitmentPoolingModule.ClaimMode.ApprovalGated;
        commitment.consideration = ICommitmentPoolingModule.DeclaredConsideration({
            rail: ICommitmentPoolingModule.ConsiderationRail.CeloSettlement,
            source: address(0),
            token: address(0),
            amount: PRICE
        });
        pooling.setCommitment(commitmentId, commitment);
        _addPendingClaim(commitmentId, funder);
    }

    function _addPendingClaim(uint256 commitmentId, address funder) private {
        pooling.setPendingClaim(
            commitmentId,
            funder,
            ICommitmentPoolingModule.PendingClaim({
                claimant: funder,
                requestedBy: funder,
                kind: ICommitmentPoolingModule.ClaimType.Individual,
                gardenContext: PROVIDER_GARDEN,
                requestedAt: uint64(block.timestamp),
                active: true
            })
        );
    }

    function _pledge(uint256 commitmentId, address funder, address refundAccount) private returns (uint256 fundingId) {
        vm.prank(OWNER);
        fundingId = settlement.recordFunding(commitmentId, funder, refundAccount);
    }

    function _pledgeAndDeposit(
        uint256 commitmentId,
        address funder,
        address refundAccount,
        uint256 amount,
        bytes32 depositRef
    )
        private
        returns (uint256 fundingId)
    {
        fundingId = _pledge(commitmentId, funder, refundAccount);
        vm.prank(OWNER);
        settlement.recordFundingDeposit(fundingId, amount, depositRef);
    }

    function _accept(uint256 commitmentId, address funder) private {
        ICommitmentPoolingModule.Commitment memory commitment = pooling.getCommitment(commitmentId);
        commitment.state = ICommitmentPoolingModule.CommitmentState.Accepted;
        commitment.counterparty = funder;
        commitment.payerGarden = PROVIDER_GARDEN;
        commitment.providerGarden = PROVIDER_GARDEN;
        pooling.setCommitment(commitmentId, commitment);
    }

    function _acknowledge(
        uint256 childId,
        bytes32 commandMessageId,
        bool success,
        ISettlementModule.FailureCode failureCode
    )
        private
    {
        ISettlementModule.Disbursement memory child = settlement.getDisbursement(childId);
        router.deliver(
            address(settlement),
            keccak256(abi.encode(childId, commandMessageId, success)),
            1,
            EXECUTOR,
            SettlementMessageCodec.encodeAcknowledgment(
                1, child.executionKey, commandMessageId, success, uint8(failureCode)
            )
        );
    }

    function _mappingSlot(uint256 key, uint256 slot) private pure returns (bytes32) {
        return keccak256(abi.encode(key, slot));
    }

    function _mappingSlot(address key, uint256 slot) private pure returns (bytes32) {
        return keccak256(abi.encode(key, slot));
    }
}
