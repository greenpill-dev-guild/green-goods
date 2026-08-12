// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { SettlementCommandLib } from "../../lib/Settlement/CommandLib.sol";
import { SettlementFundingLib } from "../../lib/Settlement/FundingLib.sol";
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

    function getCommitmentFunding(uint256 fundingId) external view override returns (CommitmentFunding memory) {
        // The all-static tuple is returned directly from its frozen ERC-7201 mapping layout. This
        // avoids pulling the large Solidity tuple encoder into the EIP-170-constrained module and
        // adds no helper selector outside ISettlementModule. The four uint64 timestamps share the
        // final storage word, so each is expanded into its ABI word explicitly.
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            mstore(0, fundingId)
            mstore(0x20, 0x14790e171eb52cfebe9fb0c814ca455ea33a3bcc183d5784757d5df85dd1e401)
            let fundingSlot := keccak256(0, 0x40)
            if iszero(sload(add(fundingSlot, 7))) {
                mstore(0, shl(224, 0x5f8d9b40))
                mstore(4, fundingId)
                revert(0, 0x24)
            }
            for { let index := 0 } lt(index, 9) { index := add(index, 1) } {
                mstore(shl(5, index), sload(add(fundingSlot, index)))
            }
            let timestamps := sload(add(fundingSlot, 9))
            let uint64Mask := 0xffffffffffffffff
            mstore(0x120, and(timestamps, uint64Mask))
            mstore(0x140, and(shr(64, timestamps), uint64Mask))
            mstore(0x160, and(shr(128, timestamps), uint64Mask))
            mstore(0x180, shr(192, timestamps))
            return(0, 0x1a0)
        }
    }

    function fundingOfCommitmentFunder(uint256 commitmentId, address funder) external view override returns (uint256) {
        return SettlementFundingLib.fundingOfCommitmentFunder(commitmentId, funder);
    }

    function fundingRefundDisbursementOf(uint256 fundingId) external view override returns (uint256) {
        return SettlementFundingLib.fundingRefundDisbursementOf(fundingId);
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
