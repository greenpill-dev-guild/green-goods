// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentPoolingModule } from "../../interfaces/ICommitmentPoolingModule.sol";
import { ISettlementModule } from "../../interfaces/ISettlementModule.sol";
import { SettlementFundingLib } from "./FundingLib.sol";
import { SettlementFundingGuardLib as Guard } from "./FundingGuardLib.sol";
import { PersonalPurchaseOutcomeLib as Outcome } from "./PersonalPurchaseOutcomeLib.sol";

/// @notice The existing one-child exact-deposit refund rail, including versioned service wind-down.
library SettlementFundingRefundLib {
    function queue(
        SettlementFundingLib.State storage state,
        mapping(uint256 disbursementId => ISettlementModule.Disbursement disbursement) storage disbursements,
        mapping(address garden => ISettlementModule.SettlementAccount account) storage accounts,
        SettlementFundingLib.RuntimeConfig memory config,
        uint256 nextDisbursementId,
        uint256 fundingId
    )
        internal
        returns (uint256 disbursementId, bool created)
    {
        ISettlementModule.CommitmentFunding storage funding = state.fundings[fundingId];
        if (funding.state == ISettlementModule.FundingState.None) {
            revert ISettlementModule.UnknownCommitmentFunding(fundingId);
        }
        Guard.requireSteward(config.hatsModule, funding.garden);
        Outcome.requireRefundEligible(config, fundingId, funding);
        disbursementId = funding.refundDisbursementId;
        if (disbursementId != 0) {
            if (state.fundingOfRefundDisbursement[disbursementId] != fundingId) {
                revert ISettlementModule.FundingRefundAlreadyLinked(fundingId, disbursementId);
            }
            return (disbursementId, false);
        }
        if (funding.state == ISettlementModule.FundingState.Pledged) {
            funding.state = ISettlementModule.FundingState.Withdrawn;
            funding.closedAt = uint64(block.timestamp);
            emit ISettlementModule.FundingWithdrawn(fundingId, funding.commitmentId, funding.funder, msg.sender);
            return (0, false);
        }
        _requireRefundableFundingState(funding, config.poolingModule, fundingId);
        if (config.paused) revert ISettlementModule.SourceMustBePaused();
        ISettlementModule.SettlementAccount storage source =
            Guard.activeAccount(accounts, funding.garden, config.destinationEvmChainId);

        disbursementId = nextDisbursementId;
        if (disbursementId == 0) revert ISettlementModule.FundingConfigurationIncomplete();
        funding.refundDisbursementId = disbursementId;
        funding.state = ISettlementModule.FundingState.RefundQueued;
        Outcome.selectRefund(fundingId, disbursementId);
        state.fundingOfRefundDisbursement[disbursementId] = fundingId;
        disbursements[disbursementId] = ISettlementModule.Disbursement({
            commitmentId: funding.commitmentId,
            payoutPlanId: 0,
            contributor: funding.funder,
            garden: funding.garden,
            executorGarden: funding.garden,
            kind: ISettlementModule.DisbursementKind.Refund,
            fundingRoute: ISettlementModule.FundingRoute.None,
            source: source.account,
            recipient: funding.refundAccount,
            token: config.gDollarToken,
            amount: funding.depositedAmount,
            state: ISettlementModule.DisbursementState.Queued,
            batchId: 0,
            reasonCID: "",
            attempt: 0,
            executionKey: bytes32(0),
            commandMessageId: bytes32(0),
            dispatchedAt: 0,
            confirmedAt: 0,
            acknowledgmentMessageId: bytes32(0),
            failureCode: 0,
            cancelledFromState: ISettlementModule.DisbursementState.None
        });
        // A changed route must revert the entire selection, not strand an immutable refund
        // child whose later dispatch can never match the buyer's frozen custody consent.
        Outcome.recheckRefund(fundingId, config.destinationEvmChainId, disbursements[disbursementId]);
        _emitRefundQueued(disbursementId, funding, source.account, config.gDollarToken);
        created = true;
    }

    function _requireRefundableFundingState(
        ISettlementModule.CommitmentFunding storage funding,
        address poolingModule,
        uint256 fundingId
    )
        private
        view
    {
        if (funding.state == ISettlementModule.FundingState.Consumed) {
            ICommitmentPoolingModule.Commitment memory commitment =
                ICommitmentPoolingModule(poolingModule).getCommitment(funding.commitmentId);
            if (
                commitment.state != ICommitmentPoolingModule.CommitmentState.Cancelled
                    && commitment.state != ICommitmentPoolingModule.CommitmentState.Expired
            ) revert ISettlementModule.FundingRefundNotEligible(fundingId);
        } else if (funding.state != ISettlementModule.FundingState.DepositRecorded) {
            revert ISettlementModule.FundingRefundNotEligible(fundingId);
        }
    }

    function recheck(
        SettlementFundingLib.State storage state,
        mapping(address garden => ISettlementModule.SettlementAccount account) storage accounts,
        uint64 destinationEvmChainId,
        address gDollarToken,
        uint256 disbursementId,
        ISettlementModule.Disbursement storage disbursement
    )
        internal
        view
    {
        uint256 fundingId = state.fundingOfRefundDisbursement[disbursementId];
        ISettlementModule.CommitmentFunding storage funding = state.fundings[fundingId];
        if (
            fundingId == 0 || funding.refundDisbursementId != disbursementId
                || funding.state != ISettlementModule.FundingState.RefundQueued
        ) revert ISettlementModule.FundingRefundAlreadyLinked(fundingId, disbursementId);
        Outcome.recheckRefund(fundingId, destinationEvmChainId, disbursement);
        ISettlementModule.SettlementAccount storage source =
            Guard.activeAccount(accounts, funding.garden, destinationEvmChainId);
        if (
            disbursement.commitmentId != funding.commitmentId || disbursement.payoutPlanId != 0
                || disbursement.contributor != funding.funder || disbursement.garden != funding.garden
                || disbursement.executorGarden != funding.garden || disbursement.source != source.account
                || disbursement.recipient != funding.refundAccount || disbursement.token != gDollarToken
                || disbursement.amount != funding.depositedAmount
                || disbursement.kind != ISettlementModule.DisbursementKind.Refund
                || disbursement.fundingRoute != ISettlementModule.FundingRoute.None
        ) revert ISettlementModule.FundingRefundAlreadyLinked(fundingId, disbursementId);
    }

    function recordOutcome(SettlementFundingLib.State storage state, uint256 disbursementId, bool success) internal {
        if (!success) return;
        uint256 fundingId = state.fundingOfRefundDisbursement[disbursementId];
        if (fundingId == 0) return;
        ISettlementModule.CommitmentFunding storage funding = state.fundings[fundingId];
        if (funding.refundDisbursementId != disbursementId || funding.state != ISettlementModule.FundingState.RefundQueued)
        {
            revert ISettlementModule.FundingRefundAlreadyLinked(fundingId, disbursementId);
        }
        funding.state = ISettlementModule.FundingState.Refunded;
        funding.closedAt = uint64(block.timestamp);
        Outcome.complete(fundingId, 0, true);
    }

    function _emitRefundQueued(
        uint256 disbursementId,
        ISettlementModule.CommitmentFunding storage funding,
        address source,
        address token
    )
        private
    {
        emit ISettlementModule.DisbursementQueued(
            disbursementId,
            funding.commitmentId,
            funding.garden,
            0,
            funding.funder,
            funding.garden,
            uint8(ISettlementModule.DisbursementKind.Refund),
            uint8(ISettlementModule.FundingRoute.None),
            source,
            funding.refundAccount,
            token,
            funding.depositedAmount
        );
    }
}
