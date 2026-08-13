// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../src/interfaces/ICommitmentPoolingModule.sol";
import { ISettlementModule } from "../../src/interfaces/ISettlementModule.sol";
import { SettlementPayerTest } from "../unit/SettlementPayer.t.sol";
import { SettlementFundingHandler } from "./handlers/SettlementFundingHandler.sol";

/// @title SettlementFundingInvariantTest
/// @notice The refund obligation keeps one immutable child across failure, retry, and cancellation.
contract SettlementFundingInvariantTest is SettlementPayerTest {
    uint256 private constant POOL_ID = 77;
    uint256 private constant COMMITMENT_ID = 88;
    address private constant FUNDER = address(0xF00A);
    address private constant REFUND_ACCOUNT = address(0xA00A);
    address private constant EXECUTOR = address(0x8000);
    uint256 private constant PRICE = 100 ether;
    uint256 private constant DEPOSIT = 125 ether;

    SettlementFundingHandler private handler;
    uint256 private fundingId;
    address[] private _targetedContracts;

    function targetContracts() public view returns (address[] memory) {
        return _targetedContracts;
    }

    function setUp() public override {
        super.setUp();
        _setDepositedFunding();

        handler = new SettlementFundingHandler(address(settlement), address(router), fundingId, EXECUTOR);
        hats.setSteward(PROVIDER_GARDEN, address(handler), true);
        _targetedContracts.push(address(handler));
    }

    /// forge-config: default.invariant.runs = 32
    /// forge-config: default.invariant.depth = 64
    function invariant_SettlementFunding_refundRelationshipNeverPointsAtAReplacementChild() public {
        ISettlementModule.CommitmentFunding memory funding = settlement.getCommitmentFunding(fundingId);
        uint256 childId = settlement.fundingRefundDisbursementOf(fundingId);

        assertFalse(handler.replacementObserved(), "a second refund child was returned");
        assertEq(funding.refundDisbursementId, childId, "forward and reverse refund links diverged");
        if (childId == 0) {
            assertEq(uint8(funding.state), uint8(ISettlementModule.FundingState.DepositRecorded));
            return;
        }

        assertEq(childId, handler.firstRefundDisbursementId(), "the persistent refund child changed");
        assertTrue(
            funding.state == ISettlementModule.FundingState.RefundQueued
                || funding.state == ISettlementModule.FundingState.Refunded,
            "linked funding entered an invalid state"
        );
    }

    /// forge-config: default.invariant.runs = 32
    /// forge-config: default.invariant.depth = 64
    function invariant_SettlementFunding_refundChildPreservesTheRecordedObligation() public {
        ISettlementModule.CommitmentFunding memory funding = settlement.getCommitmentFunding(fundingId);
        assertEq(funding.commitmentId, COMMITMENT_ID);
        assertEq(funding.funder, FUNDER);
        assertEq(funding.garden, PROVIDER_GARDEN);
        assertEq(funding.refundAccount, REFUND_ACCOUNT);
        assertEq(funding.expectedAmount, PRICE);
        assertEq(funding.depositedAmount, DEPOSIT);

        if (funding.refundDisbursementId == 0) return;
        ISettlementModule.Disbursement memory child = settlement.getDisbursement(funding.refundDisbursementId);
        assertEq(child.commitmentId, COMMITMENT_ID);
        assertEq(child.contributor, FUNDER);
        assertEq(child.garden, PROVIDER_GARDEN);
        assertEq(child.executorGarden, PROVIDER_GARDEN);
        assertEq(child.source, BENEFICIARY_SAFE);
        assertEq(child.recipient, REFUND_ACCOUNT);
        assertEq(child.token, GDOLLAR);
        assertEq(child.amount, DEPOSIT);
        assertEq(uint8(child.kind), uint8(ISettlementModule.DisbursementKind.Refund));

        if (funding.state == ISettlementModule.FundingState.Refunded) {
            assertEq(uint8(child.state), uint8(ISettlementModule.DisbursementState.Confirmed));
        }
    }

    /// forge-config: default.invariant.runs = 32
    /// forge-config: default.invariant.depth = 64
    function invariant_SettlementFunding_atMostOneRefundChildAndOneConfirmedRefundExist() public {
        uint256 refundChildren;
        uint256 confirmedRefunds;
        // This isolated campaign starts at disbursement ID 1 and can allocate only through the
        // single funding obligation. Scan a bounded surplus so an orphan replacement child is
        // detected independently of the funding record's forward pointer.
        for (uint256 disbursementId = 1; disbursementId <= 8; ++disbursementId) {
            try settlement.getDisbursement(disbursementId) returns (ISettlementModule.Disbursement memory child) {
                if (
                    child.kind != ISettlementModule.DisbursementKind.Refund || child.commitmentId != COMMITMENT_ID
                        || child.contributor != FUNDER
                ) continue;
                ++refundChildren;
                if (child.state == ISettlementModule.DisbursementState.Confirmed) ++confirmedRefunds;
            } catch { }
        }
        assertLe(refundChildren, 1, "more than one refund child exists");
        assertLe(confirmedRefunds, 1, "more than one refund confirmed");
    }

    function testSettlementFundingHandler_reachesFailureRequeueAndRefundWithoutReplacingTheChild() public {
        handler.dispatchAndFailRefund();
        handler.requeueRefund();
        handler.dispatchAndSucceedRefund();

        assertEq(handler.failedCount(), 1);
        assertEq(handler.requeuedCount(), 1);
        assertEq(handler.refundedCount(), 1);
        assertFalse(handler.replacementObserved());
        assertEq(uint8(settlement.getCommitmentFunding(fundingId).state), uint8(ISettlementModule.FundingState.Refunded));
    }

    function _setDepositedFunding() private {
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
        pooling.setCommitment(COMMITMENT_ID, commitment);
        pooling.setPendingClaim(
            COMMITMENT_ID,
            FUNDER,
            ICommitmentPoolingModule.PendingClaim({
                claimant: FUNDER,
                requestedBy: FUNDER,
                kind: ICommitmentPoolingModule.ClaimType.Individual,
                gardenContext: PROVIDER_GARDEN,
                requestedAt: uint64(block.timestamp),
                active: true
            })
        );

        vm.startPrank(OWNER);
        fundingId = settlement.recordFunding(COMMITMENT_ID, FUNDER, REFUND_ACCOUNT);
        settlement.recordFundingDeposit(fundingId, DEPOSIT, keccak256("invariant-deposit"));
        vm.stopPrank();
    }
}
