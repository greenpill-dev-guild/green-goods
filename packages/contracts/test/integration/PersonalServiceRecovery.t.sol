// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule as Core } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ISettlementModule as Settlement } from "../../src/interfaces/ISettlementModule.sol";
import {
    ISettlementPersonalServicePurchases as Personal
} from "../../src/interfaces/ISettlementPersonalServicePurchases.sol";
import { ICeloSettlementExecutor } from "../../src/interfaces/ICeloSettlementExecutor.sol";
import { PersonalServicePurchaseFixture } from "../helpers/PersonalServicePurchaseFixture.sol";

contract PersonalServiceRecoveryIntegrationTest is PersonalServicePurchaseFixture {
    function setUp() public {
        _setUpPersonalFixture();
    }

    function testIntegration_PersonalServiceRecovery_fullAllocationConservesPriceAndSuccessfulExcess() public {
        uint256 id = _personalOffer(keccak256("full-allocation"));
        uint256 fundingId = _funded(id, PRICE + 20 ether);
        _fulfill(id, true);
        (uint256 planId, uint256 first) = _prepare(id);
        vm.startPrank(BUYER_STEWARD);
        uint256 second = settlement.prepareContributorPayout(planId, SECOND_PROVIDER);
        uint256[] memory children = new uint256[](2);
        children[0] = first;
        children[1] = second;
        uint256 batchId = settlement.createBatch(children);
        token.setBalance(address(buyerSafe), PRICE + 20 ether);
        settlement.dispatchBatch(batchId);
        vm.stopPrank();
        _deliverCommand();
        assertEq(token.balanceOf(CREATOR), PRICE / 2 + 1);
        assertEq(token.balanceOf(SECOND_PROVIDER), PRICE / 2);
        assertEq(token.balanceOf(CREATOR) + token.balanceOf(SECOND_PROVIDER), PRICE);
        assertEq(token.balanceOf(address(buyerSafe)), 20 ether);
        assertEq(settlement.getPayoutPlan(planId).gardenRetainedAmount, 0);
        assertEq(uint256(settlement.getBatch(batchId).state), uint256(Settlement.DisbursementState.Dispatched));
        vm.etch(address(module), hex"60006000fd"); // Any current-core call would revert; ACK uses only frozen local facts.
        _deliverResult();
        assertEq(
            uint256(personal.getPersonalServicePurchase(fundingId).outcome),
            uint256(Personal.PersonalPurchaseOutcome.Settled)
        );
        assertEq(uint256(settlement.getCommitmentFunding(fundingId).state), uint256(Settlement.FundingState.Closed));
    }

    function testIntegration_PersonalServiceRecovery_lostAcknowledgmentNeverAuthorizesReplacementValue() public {
        uint256 id = _personalOffer(keccak256("lost-ack"));
        uint256 fundingId = _funded(id, PRICE);
        _fulfill(id, false);
        (, uint256 childId) = _prepare(id);
        token.setBalance(address(buyerSafe), PRICE);
        celoRouter.setFailures(false, true);
        vm.prank(BUYER_STEWARD);
        settlement.dispatchDisbursement(childId);
        bytes32 key = settlement.getDisbursement(childId).executionKey;
        _deliverCommand();
        assertEq(token.balanceOf(CREATOR), PRICE);
        assertEq(uint256(executor.executionResultOf(key).status), uint256(ICeloSettlementExecutor.ResultStatus.Success));
        assertFalse(executor.executionResultOf(key).acknowledgmentSent);
        bytes32 purchaseId = personal.getPersonalServicePurchase(fundingId).terms.purchaseId;
        vm.expectRevert(
            abi.encodeWithSelector(
                Personal.PersonalServiceOutcomeConflict.selector, purchaseId, Personal.PersonalPurchaseOutcome.Payout
            )
        );
        vm.prank(BUYER_STEWARD);
        settlement.queueFundingRefund(fundingId);
        vm.expectRevert(abi.encodeWithSelector(Personal.PersonalServiceUnsafeRecovery.selector, childId));
        vm.prank(BUYER_STEWARD);
        settlement.cancelDisbursement(childId, "late receipt is not non-delivery");
        vm.prank(BUYER_STEWARD);
        settlement.retryCommand(childId);
        assertEq(settlement.getDisbursement(childId).executionKey, key);
        _deliverCommand();
        assertEq(token.balanceOf(CREATOR), PRICE);
        celoRouter.setFailures(false, false);
        vm.chainId(CELO_CHAIN_ID);
        executor.retryAcknowledgment(key);
        vm.chainId(42_161);
        _deliverResult();
        _ack(childId, false, Settlement.FailureCode.RouteReverted);
        assertEq(uint256(settlement.getDisbursement(childId).state), uint256(Settlement.DisbursementState.Confirmed));
        assertEq(
            uint256(personal.getPersonalServicePurchase(fundingId).outcome),
            uint256(Personal.PersonalPurchaseOutcome.Settled)
        );
        assertEq(token.balanceOf(CREATOR), PRICE);
    }

    function testIntegration_PersonalServiceRecovery_authenticatedFailureRepairsTheSameEconomicPayout() public {
        uint256 id = _personalOffer(keccak256("safe-depletion"));
        _funded(id, PRICE);
        _fulfill(id, false);
        (, uint256 childId) = _prepare(id);
        vm.prank(BUYER_STEWARD);
        settlement.dispatchDisbursement(childId);
        bytes32 firstKey = settlement.getDisbursement(childId).executionKey;
        _deliverCommand();
        _deliverResult();
        assertEq(uint256(settlement.getDisbursement(childId).state), uint256(Settlement.DisbursementState.Failed));
        assertEq(token.balanceOf(CREATOR), 0);
        token.setBalance(address(buyerSafe), PRICE);
        vm.startPrank(BUYER_STEWARD);
        settlement.requeue(childId);
        settlement.dispatchDisbursement(childId);
        vm.stopPrank();
        assertTrue(settlement.getDisbursement(childId).executionKey != firstKey);
        _deliverCommand();
        _deliverResult();
        assertEq(token.balanceOf(CREATOR), PRICE);
        assertEq(settlement.getDisbursement(childId).attempt, 1);
        assertEq(settlement.getDisbursement(childId).source, address(buyerSafe));
        assertEq(settlement.getDisbursement(childId).amount, PRICE);
    }

    function testIntegration_PersonalServiceRecovery_exactRefundAndFreshNonceKeepOldResultsSeparate() public {
        uint256 id = _personalOffer(keccak256("refund-renew"));
        bytes32 oldClaim = _request(id, 1);
        uint256 oldFunding = _pledge(id);
        _recordDeposit(oldFunding, PRICE + 10 ether);
        bytes32 oldPurchase = personal.getPersonalServicePurchase(oldFunding).terms.purchaseId;
        vm.prank(BUYER);
        services.withdrawServiceClaim(id, oldClaim);
        vm.prank(BUYER_STEWARD);
        uint256 refund = settlement.queueFundingRefund(oldFunding);
        token.setBalance(address(buyerSafe), PRICE + 10 ether);
        vm.prank(BUYER_STEWARD);
        settlement.dispatchDisbursement(refund);
        _deliverCommand();
        assertEq(token.balanceOf(REFUND_ACCOUNT), PRICE + 10 ether);
        assertEq(uint256(settlement.getCommitmentFunding(oldFunding).state), uint256(Settlement.FundingState.RefundQueued));
        _deliverResult();
        _request(id, 2);
        uint256 fresh = _pledge(id);
        assertTrue(fresh != oldFunding);
        assertTrue(personal.getPersonalServicePurchase(fresh).terms.purchaseId != oldPurchase);
        _recordDeposit(fresh, PRICE);
        _accept(id);
        _consume(fresh);
        _ack(refund, true, Settlement.FailureCode.None);
        _ack(refund, false, Settlement.FailureCode.RouteReverted);
        assertEq(uint256(settlement.getCommitmentFunding(oldFunding).state), uint256(Settlement.FundingState.Refunded));
        assertEq(uint256(settlement.getCommitmentFunding(fresh).state), uint256(Settlement.FundingState.Consumed));
        assertEq(settlement.fundingOfCommitmentFunder(id, BUYER), fresh);
        assertEq(personal.fundingOfPersonalServicePurchase(oldPurchase), oldFunding);
        assertEq(token.balanceOf(REFUND_ACCOUNT), PRICE + 10 ether);
    }

    function testIntegration_PersonalServiceRecovery_pauseBlocksCommandsButAllowsAuthenticatedCompletion() public {
        uint256 id = _personalOffer(keccak256("paused-ack"));
        uint256 fundingId = _funded(id, PRICE);
        _fulfill(id, false);
        (, uint256 childId) = _prepare(id);
        token.setBalance(address(buyerSafe), PRICE);
        vm.prank(BUYER_STEWARD);
        settlement.dispatchDisbursement(childId);
        _deliverCommand();
        settlement.setPaused(true);
        vm.expectRevert(Settlement.SourceMustBePaused.selector);
        vm.prank(BUYER_STEWARD);
        settlement.retryCommand(childId);
        vm.etch(address(module), hex"60006000fd"); // Any current-core call would revert; ACK uses only frozen local facts.
        _deliverResult();
        assertEq(
            uint256(personal.getPersonalServicePurchase(fundingId).outcome),
            uint256(Personal.PersonalPurchaseOutcome.Settled)
        );
        assertEq(token.balanceOf(CREATOR), PRICE);
    }

    function testIntegration_PersonalServiceRecovery_buyerGardenFundsProtocolOfferWithoutUsingProtocolReserve() public {
        uint256 protocolId = module.registerPool(ROOT_GARDEN, Core.PoolType.Protocol);
        module.setProviderOpenCommitmentCap(protocolId, 128);
        module.setPoolCharter(protocolId, "fictional-protocol-service-charter");
        module.markPoolReady(protocolId);
        module.openPool(protocolId);
        hats.setOperator(ROOT_GARDEN, CREATOR, true);
        hats.setOperator(ROOT_GARDEN, PROVIDER_STEWARD, true);
        Core.CreateCommitmentParams memory params = _baseParams(keccak256("protocol-personal-purchase"));
        params.poolId = protocolId;
        params.claimMode = Core.ClaimMode.ApprovalGated;
        vm.prank(CREATOR);
        uint256 id = module.createCommitment(params);
        services.setServiceOfferTerms(id, 0, _personalTerms(), PRICE);
        uint256 fundingId = _funded(id, PRICE);
        _fulfill(id, false);
        (uint256 planId, uint256 childId) = _prepare(id);
        token.setBalance(address(buyerSafe), PRICE);
        token.setBalance(address(protocolSafe), 999 ether);
        vm.prank(BUYER_STEWARD);
        settlement.dispatchDisbursement(childId);
        _deliverCommand();
        _deliverResult();
        assertEq(settlement.getPayoutPlan(planId).providerGarden, ROOT_GARDEN);
        assertEq(settlement.getPayoutPlan(planId).payerGarden, BUYER_GARDEN);
        assertEq(settlement.getDisbursement(childId).source, address(buyerSafe));
        assertEq(token.balanceOf(CREATOR), PRICE);
        assertEq(token.balanceOf(address(protocolSafe)), 999 ether);
        assertEq(token.balanceOf(address(buyerSafe)), 0);
        assertEq(
            uint256(personal.getPersonalServicePurchase(fundingId).outcome),
            uint256(Personal.PersonalPurchaseOutcome.Settled)
        );
    }

    function testIntegration_PersonalServiceRecovery_lateWithdrawnDepositRefundsOnlyItsOldBooking() public {
        uint256 id = _personalOffer(keccak256("late-withdrawn-deposit"));
        bytes32 oldClaim = _request(id, 1);
        uint256 oldFunding = _pledge(id);
        bytes32 oldPurchase = personal.getPersonalServicePurchase(oldFunding).terms.purchaseId;
        vm.prank(BUYER);
        services.withdrawServiceClaim(id, oldClaim);
        vm.prank(BUYER_STEWARD);
        assertEq(settlement.queueFundingRefund(oldFunding), 0);
        assertEq(uint256(settlement.getCommitmentFunding(oldFunding).state), uint256(Settlement.FundingState.Withdrawn));
        _request(id, 2);
        uint256 fresh = _pledge(id);
        Personal.VerifiedCeloDeposit memory lateReceipt = _receipt(oldFunding, PRICE + 10 ether);
        vm.prank(BUYER_STEWARD);
        personal.recordPersonalServiceDeposit(oldFunding, lateReceipt);
        assertEq(
            uint256(personal.getPersonalServicePurchase(oldFunding).outcome),
            uint256(Personal.PersonalPurchaseOutcome.Refund)
        );
        assertEq(settlement.getCommitmentFunding(oldFunding).closedAt, 0);
        assertEq(settlement.fundingOfCommitmentFunder(id, BUYER), fresh);
        assertEq(personal.getPersonalServicePurchase(oldFunding).terms.purchaseId, oldPurchase);
        assertEq(uint256(settlement.getCommitmentFunding(fresh).state), uint256(Settlement.FundingState.Pledged));
        vm.expectRevert(
            abi.encodeWithSelector(
                Personal.PersonalServiceOutcomeConflict.selector, oldPurchase, Personal.PersonalPurchaseOutcome.Refund
            )
        );
        _consume(oldFunding);
        bytes32 receiptKey = keccak256(abi.encode(lateReceipt.chainId, lateReceipt.transactionHash, lateReceipt.logIndex));
        vm.expectRevert(abi.encodeWithSelector(Settlement.FundingDepositReferenceUsed.selector, receiptKey, oldFunding));
        vm.prank(BUYER_STEWARD);
        personal.recordPersonalServiceDeposit(fresh, lateReceipt);
        _recordDeposit(fresh, PRICE);
        _accept(id);
        _consume(fresh);
        vm.prank(BUYER_STEWARD);
        uint256 refund = settlement.queueFundingRefund(oldFunding);
        vm.prank(BUYER_STEWARD);
        assertEq(settlement.queueFundingRefund(oldFunding), refund);
        token.setBalance(address(buyerSafe), PRICE + 10 ether);
        vm.prank(BUYER_STEWARD);
        settlement.dispatchDisbursement(refund);
        _deliverCommand();
        _deliverResult();
        _ack(refund, true, Settlement.FailureCode.None);
        _ack(refund, false, Settlement.FailureCode.RouteReverted);
        assertEq(token.balanceOf(REFUND_ACCOUNT), PRICE + 10 ether);
        assertEq(
            uint256(personal.getPersonalServicePurchase(oldFunding).outcome),
            uint256(Personal.PersonalPurchaseOutcome.Refunded)
        );
        assertEq(uint256(settlement.getCommitmentFunding(fresh).state), uint256(Settlement.FundingState.Consumed));
        assertEq(settlement.fundingOfCommitmentFunder(id, BUYER), fresh);
    }

    function testIntegration_PersonalServiceRecovery_senderFeeCapRepairPreservesExactRecipientAmount() public {
        uint256 id = _personalOffer(keccak256("sender-fee-cap"));
        _funded(id, PRICE);
        _fulfill(id, false);
        (, uint256 childId) = _prepare(id);
        token.setBalance(address(buyerSafe), PRICE + 2 ether);
        token.setFee(2 ether, true);
        vm.prank(BUYER_STEWARD);
        settlement.dispatchDisbursement(childId);
        _deliverCommand();
        _deliverResult();
        assertEq(uint256(settlement.getDisbursement(childId).state), uint256(Settlement.DisbursementState.Failed));
        assertEq(token.balanceOf(CREATOR), 0);
        assertEq(token.balanceOf(address(buyerSafe)), PRICE + 2 ether);
        token.setFee(1 ether, true);
        vm.startPrank(BUYER_STEWARD);
        settlement.requeue(childId);
        settlement.dispatchDisbursement(childId);
        vm.stopPrank();
        _deliverCommand();
        _deliverResult();
        assertEq(token.balanceOf(CREATOR), PRICE);
        assertEq(token.balanceOf(address(buyerSafe)), 1 ether);
        assertEq(settlement.getDisbursement(childId).amount, PRICE);
    }

    function testIntegration_PersonalServiceRecovery_exactRefundNeverDeductsSenderFeeFromBuyerNet() public {
        uint256 id = _personalOffer(keccak256("refund-sender-fee"));
        bytes32 hash = _request(id, 1);
        uint256 fundingId = _pledge(id);
        _recordDeposit(fundingId, PRICE);
        vm.prank(BUYER);
        services.withdrawServiceClaim(id, hash);
        vm.prank(BUYER_STEWARD);
        uint256 refund = settlement.queueFundingRefund(fundingId);
        token.setBalance(address(buyerSafe), PRICE);
        token.setFee(1 ether, true);
        vm.prank(BUYER_STEWARD);
        settlement.dispatchDisbursement(refund);
        _deliverCommand();
        _deliverResult();
        assertEq(token.balanceOf(REFUND_ACCOUNT), 0);
        assertEq(token.balanceOf(address(buyerSafe)), PRICE);
        assertEq(uint256(settlement.getDisbursement(refund).state), uint256(Settlement.DisbursementState.Failed));
        token.setBalance(address(buyerSafe), PRICE + 1 ether);
        vm.startPrank(BUYER_STEWARD);
        settlement.requeue(refund);
        settlement.dispatchDisbursement(refund);
        vm.stopPrank();
        _deliverCommand();
        _deliverResult();
        assertEq(token.balanceOf(REFUND_ACCOUNT), PRICE);
        assertEq(token.balanceOf(address(buyerSafe)), 0);
        assertEq(
            uint256(personal.getPersonalServicePurchase(fundingId).outcome),
            uint256(Personal.PersonalPurchaseOutcome.Refunded)
        );
    }
}
