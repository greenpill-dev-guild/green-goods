// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { SettlementCommandLib } from "../../lib/Settlement/CommandLib.sol";
import { SettlementLoanLib } from "../../lib/Settlement/LoanLib.sol";
import { SettlementPlanLib } from "../../lib/Settlement/PlanLib.sol";
import { SettlementLifecycle } from "./Lifecycle.sol";

/// @title SettlementViews
/// @notice Read-only surface over disbursements, batches, plans, commands, and fee reserve.
abstract contract SettlementViews is SettlementLifecycle {
    function getDisbursement(uint256 disbursementId) external view override returns (Disbursement memory) {
        if (_disbursements[disbursementId].state == DisbursementState.None) {
            revert UnknownDisbursement(disbursementId);
        }
        return _disbursements[disbursementId];
    }

    function getBatch(uint256 batchId) external view override returns (Batch memory) {
        if (_batches[batchId].state == DisbursementState.None) revert UnknownBatch(batchId);
        return _batches[batchId];
    }

    function settlementAccountOf(address garden) external view override returns (SettlementAccount memory) {
        return _settlementAccounts[garden];
    }

    function settlementGardenOf(address account) external view override returns (address garden) {
        return _settlementAccountGardens[account];
    }

    function getPayoutPlan(uint256 payoutPlanId) external view override returns (CommitmentPayoutPlan memory) {
        if (_planState.payoutPlans[payoutPlanId].commitmentId == 0) revert UnknownPayoutPlan(payoutPlanId);
        return _planState.payoutPlans[payoutPlanId];
    }

    function contributorPayoutOf(
        uint256 payoutPlanId,
        address contributor
    )
        external
        view
        override
        returns (ContributorPayout memory)
    {
        return _planState.contributorPayouts[payoutPlanId][contributor];
    }

    function payoutContributors(uint256 payoutPlanId) external view override returns (address[] memory) {
        if (_planState.payoutPlans[payoutPlanId].commitmentId == 0) revert UnknownPayoutPlan(payoutPlanId);
        return _planState.payoutPlans[payoutPlanId].contributorOrder;
    }

    function payoutPlanOfCommitment(uint256 commitmentId) external view override returns (uint256) {
        return _planState.payoutPlanOfCommitment[commitmentId];
    }

    function loanPrincipalDisbursementOf(address registry, uint256 loanId) external view override returns (uint256) {
        return SettlementLoanLib.loanPrincipalDisbursementOf(registry, loanId);
    }

    function loanPrincipalRelationshipOf(uint256 disbursementId)
        external
        view
        override
        returns (LoanPrincipalRelationship memory)
    {
        return SettlementLoanLib.loanPrincipalRelationshipOf(disbursementId);
    }

    function creditRegistry() external view override returns (address) {
        return SettlementLoanLib.configuredCreditRegistry();
    }

    function payoutPlanStatus(uint256 payoutPlanId) public view override returns (PayoutPlanStatus) {
        return SettlementPlanLib.payoutPlanStatus(_planState, payoutPlanId);
    }

    function isAcknowledgmentPending(bool isBatch, uint256 subjectId) external view override returns (bool) {
        bytes32 key = isBatch ? _batches[subjectId].executionKey : _disbursements[subjectId].executionKey;
        if (key == bytes32(0)) return false;
        CommandRecord storage record = _commandRecords[key];
        return record.subjectId != 0 && !record.acknowledged;
    }

    function commandRecord(bytes32 executionKey) external view override returns (CommandRecord memory) {
        return _commandRecords[executionKey];
    }

    function ccipRoute() external view override returns (CcipRoute memory) {
        return _ccipRoute;
    }

    function quoteCommandFee(bool isBatch, uint256 subjectId) external view override returns (uint256) {
        return SettlementCommandLib.quote(
            _disbursements,
            _batches,
            _commandRecords,
            _commandPayloads,
            SettlementCommandLib.QuoteRequest({
                router: CCIP_ROUTER,
                route: _ccipRoute,
                isBatch: isBatch,
                subjectId: subjectId
            })
        );
    }

    function nativeFeeBalance() external view override returns (uint256) {
        return address(this).balance;
    }

    function isFeeReserveLow() external view override returns (bool) {
        return address(this).balance < feeReserveMinimum;
    }

    function MAX_PAYOUT_CONTRIBUTORS() external pure override returns (uint256) {
        return SettlementPlanLib.MAX_PAYOUT_CONTRIBUTORS;
    }

    function HARD_MAX_BATCH_SIZE() external pure override returns (uint256) {
        return _HARD_MAX_BATCH_SIZE;
    }
}
