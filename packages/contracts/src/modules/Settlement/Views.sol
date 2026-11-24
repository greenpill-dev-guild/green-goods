// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { SettlementCommandLib } from "../../lib/Settlement/CommandLib.sol";
import { SettlementFundingLib } from "../../lib/Settlement/FundingLib.sol";
import { SettlementLifecycleLib } from "../../lib/Settlement/LifecycleLib.sol";
import { SettlementLoanLib } from "../../lib/Settlement/LoanLib.sol";
import { SettlementPlanLib } from "../../lib/Settlement/PlanLib.sol";
import { SettlementLifecycle } from "./Lifecycle.sol";

/// @title SettlementViews
/// @notice Read-only surface over disbursements, batches, plans, commands, and fee reserve.
abstract contract SettlementViews is SettlementLifecycle {
    function getPersonalServicePurchase(uint256 fundingId) external view override returns (PersonalServicePurchase memory) {
        _forwardSettlementView(abi.encodeWithSelector(SettlementFundingLib.getPersonalServicePurchase.selector, fundingId));
        // Unreachable: prevent an unused default-return tuple encoder in this shell.
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") { revert(0, 0) }
    }

    function fundingOfPersonalServicePurchase(bytes32 purchaseId) external view override returns (uint256) {
        return SettlementFundingLib.fundingOfPersonalServicePurchase(purchaseId);
    }

    function personalServiceDepositFunding(
        uint64 chainId,
        bytes32 transactionHash,
        uint32 logIndex
    )
        external
        view
        override
        returns (uint256)
    {
        return SettlementFundingLib.personalServiceDepositFunding(chainId, transactionHash, logIndex);
    }

    function getDisbursement(uint256 disbursementId) external view override returns (Disbursement memory) {
        uint256 slot;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") { slot := _disbursements.slot }
        _forwardSettlementView(
            abi.encodeWithSelector(SettlementLifecycleLib.getDisbursement.selector, slot, disbursementId)
        );
        // Unreachable: prevent an unused default-return tuple encoder in this shell.
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") { revert(0, 0) }
    }

    function getBatch(uint256 batchId) external view override returns (Batch memory) {
        uint256 slot;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") { slot := _batches.slot }
        _forwardSettlementView(abi.encodeWithSelector(SettlementLifecycleLib.getBatch.selector, slot, batchId));
        // Unreachable: prevent an unused default-return tuple encoder in this shell.
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") { revert(0, 0) }
    }

    function settlementAccountOf(address garden) external view override returns (SettlementAccount memory) {
        return _settlementAccounts[garden];
    }

    function settlementGardenOf(address account) external view override returns (address garden) {
        return _settlementAccountGardens[account];
    }

    function getPayoutPlan(uint256 payoutPlanId) external view override returns (CommitmentPayoutPlan memory) {
        uint256 slot;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") { slot := _planState.slot }
        _forwardSettlementView(abi.encodeWithSelector(SettlementPlanLib.getPayoutPlan.selector, slot, payoutPlanId));
        // Unreachable: prevent an unused default-return tuple encoder in this shell.
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") { revert(0, 0) }
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
                router: CCIP_ROUTER, route: _ccipRoute, isBatch: isBatch, subjectId: subjectId
            })
        );
    }

    function nativeFeeBalance() external view override returns (uint256) {
        return address(this).balance;
    }

    function isFeeReserveLow() external view override returns (bool) {
        return address(this).balance < feeReserveMinimum;
    }

    error UnsupportedSettlementView();

    /// @notice Self-only executor for four fixed read selectors in already-linked libraries.
    /// @dev View shells enter through STATICCALL, which remains static through DELEGATECALL.
    /// The allowlist prevents a future internal caller from selecting a mutation or target.
    function settlementViewDelegate(bytes calldata data) external {
        if (msg.sender != address(this)) revert UnauthorizedCaller(msg.sender);
        if (data.length < 4) revert UnsupportedSettlementView();
        bytes4 selector = bytes4(data[:4]);
        address target;
        if (selector == SettlementPlanLib.getPayoutPlan.selector) {
            target = address(SettlementPlanLib);
        } else if (
            selector == SettlementLifecycleLib.getDisbursement.selector
                || selector == SettlementLifecycleLib.getBatch.selector
        ) {
            target = address(SettlementLifecycleLib);
        } else if (selector == SettlementFundingLib.getPersonalServicePurchase.selector) {
            target = address(SettlementFundingLib);
        } else {
            revert UnsupportedSettlementView();
        }
        // solhint-disable-next-line avoid-low-level-calls
        (bool ok, bytes memory result) = target.delegatecall(data);
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            switch ok
            case 0 { revert(add(result, 0x20), mload(result)) }
            default { return(add(result, 0x20), mload(result)) }
        }
    }

    /// @dev Return and revert data pass through verbatim; no tuple repacking or storage layout guesses.
    function _forwardSettlementView(bytes memory data) private view {
        // solhint-disable-next-line avoid-low-level-calls
        (bool ok, bytes memory result) =
            address(this).staticcall(abi.encodeWithSelector(this.settlementViewDelegate.selector, data));
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            switch ok
            case 0 { revert(add(result, 0x20), mload(result)) }
            default { return(add(result, 0x20), mload(result)) }
        }
    }

    function MAX_PAYOUT_CONTRIBUTORS() external pure override returns (uint256) {
        return SettlementPlanLib.MAX_PAYOUT_CONTRIBUTORS;
    }

    function HARD_MAX_BATCH_SIZE() external pure override returns (uint256) {
        return _HARD_MAX_BATCH_SIZE;
    }
}
