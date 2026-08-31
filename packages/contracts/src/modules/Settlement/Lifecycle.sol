// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

import { SettlementAcknowledgmentLib } from "../../lib/Settlement/AcknowledgmentLib.sol";
import { SettlementFundingLib } from "../../lib/Settlement/FundingLib.sol";
import { SettlementLifecycleLib } from "../../lib/Settlement/LifecycleLib.sol";
import { SettlementLoanLib } from "../../lib/Settlement/LoanLib.sol";
import { SettlementPlans } from "./Plans.sol";

/// @title SettlementLifecycle
/// @notice Funding, batching, dispatch, retry, cancellation, fee reserve, and acknowledgment receive.
abstract contract SettlementLifecycle is SettlementPlans {
    function queueFunding(address garden, uint256 amount) external override nonReentrant returns (uint256 disbursementId) {
        _requireNotPaused();
        if (msg.sender != owner()) _requireSteward(protocolGarden);
        if (garden == address(0) || garden == protocolGarden) revert InvalidPayoutVector();
        if (amount == 0) revert AmountRequired();
        SettlementAccount storage sourceAccount = _activeAccount(protocolGarden);
        SettlementAccount storage targetAccount = _activeAccount(garden);
        disbursementId = _queueDisbursement(
            0,
            0,
            address(0),
            garden,
            protocolGarden,
            DisbursementKind.Funding,
            FundingRoute.ProtocolToGarden,
            sourceAccount.account,
            targetAccount.account,
            gDollarToken,
            amount
        );
    }

    function recordFunding(
        uint256 commitmentId,
        address funder,
        address refundAccount
    )
        external
        override
        nonReentrant
        returns (uint256 fundingId)
    {
        return
            SettlementFundingLib.recordFunding(_settlementAccounts, _fundingConfig(), commitmentId, funder, refundAccount);
    }

    function recordFundingDeposit(
        uint256 fundingId,
        uint256 amount,
        bytes32 depositReference
    )
        external
        override
        nonReentrant
    {
        SettlementFundingLib.recordFundingDeposit(
            _settlementAccounts, _fundingConfig(), fundingId, amount, depositReference
        );
    }

    function consumeFunding(uint256 fundingId) external override nonReentrant {
        SettlementFundingLib.consumeFunding(_settlementAccounts, _fundingConfig(), fundingId);
    }

    function queueFundingRefund(uint256 fundingId) external override nonReentrant returns (uint256 disbursementId) {
        bool created;
        (disbursementId, created) = SettlementFundingLib.queueFundingRefund(
            _disbursements, _settlementAccounts, _fundingConfig(), _nextDisbursementId, fundingId
        );
        if (created) _nextDisbursementId = disbursementId + 1;
    }

    function queueLoanPrincipal(uint256 loanId) external override nonReentrant returns (uint256 disbursementId) {
        bool created;
        (disbursementId, created) = SettlementLoanLib.queueLoanPrincipal(_disbursements, _nextDisbursementId, loanId);
        if (created) _nextDisbursementId = disbursementId + 1;
    }

    function createBatch(uint256[] calldata disbursementIds) external override nonReentrant returns (uint256 batchId) {
        _requireNotPaused();
        if (disbursementIds.length == 0) revert BatchSizeOutOfBounds(0, batchSizeLimit);
        Disbursement storage first = _knownDisbursement(disbursementIds[0]);
        _requireSteward(first.executorGarden);
        batchId = SettlementLifecycleLib.createBatch(
            _disbursements, _batches, _settlementAccounts, _planState, _lifecycleConfig(), _nextBatchId, disbursementIds
        );
        _nextBatchId = batchId + 1;
    }

    function dispatchDisbursement(uint256 disbursementId) external override nonReentrant returns (bytes32 messageId) {
        _requireNotPaused();
        Disbursement storage disbursement = _knownDisbursement(disbursementId);
        _requireDispatcherOrSteward(disbursement.executorGarden);
        return SettlementLifecycleLib.dispatchDisbursement(
            _disbursements,
            _commandRecords,
            _commandPayloads,
            commandExecutionKeys,
            _settlementAccounts,
            _planState,
            _lifecycleConfig(),
            disbursementId
        );
    }

    function dispatchBatch(uint256 batchId) external override nonReentrant returns (bytes32 messageId) {
        _requireNotPaused();
        Batch storage batch = _knownBatch(batchId);
        _requireDispatcherOrSteward(batch.executorGarden);
        return SettlementLifecycleLib.dispatchBatch(
            _disbursements,
            _batches,
            _commandRecords,
            _commandPayloads,
            commandExecutionKeys,
            _settlementAccounts,
            _planState,
            _lifecycleConfig(),
            batchId
        );
    }

    function retryCommand(uint256 disbursementId) external override nonReentrant returns (bytes32 messageId) {
        _requireNotPaused();
        Disbursement storage disbursement = _knownDisbursement(disbursementId);
        _requireDispatcherOrSteward(disbursement.executorGarden);
        if (disbursement.state != DisbursementState.Dispatched) {
            revert DisbursementNotInState(disbursementId, disbursement.state);
        }
        if (disbursement.batchId != 0) revert BatchEntryMismatch(disbursementId);
        messageId = SettlementLifecycleLib.retry(
            _commandRecords, _commandPayloads, commandExecutionKeys, _lifecycleConfig(), disbursement.executionKey
        );
        disbursement.commandMessageId = messageId;
    }

    function retryBatchCommand(uint256 batchId) external override nonReentrant returns (bytes32 messageId) {
        _requireNotPaused();
        Batch storage batch = _knownBatch(batchId);
        _requireDispatcherOrSteward(batch.executorGarden);
        if (batch.state != DisbursementState.Dispatched) revert BatchNotInState(batchId, batch.state);
        messageId = SettlementLifecycleLib.retry(
            _commandRecords, _commandPayloads, commandExecutionKeys, _lifecycleConfig(), batch.executionKey
        );
        batch.commandMessageId = messageId;
        for (uint256 index; index < batch.disbursementIds.length; ++index) {
            _disbursements[batch.disbursementIds[index]].commandMessageId = messageId;
        }
    }

    function requeue(uint256 disbursementId) external override nonReentrant {
        _requireNotPaused();
        Disbursement storage disbursement = _knownDisbursement(disbursementId);
        _requireSteward(disbursement.executorGarden);
        SettlementLifecycleLib.requeue(_disbursements, _planState, disbursementId);
    }

    function cancelDisbursement(uint256 disbursementId, string calldata reasonCID) external override nonReentrant {
        Disbursement storage disbursement = _knownDisbursement(disbursementId);
        _requireSteward(disbursement.executorGarden);
        SettlementLifecycleLib.cancelDisbursement(_disbursements, _planState, disbursementId, reasonCID);
    }

    function cancelBatch(uint256 batchId, string calldata reasonCID) external override nonReentrant {
        Batch storage batch = _knownBatch(batchId);
        _requireSteward(batch.executorGarden);
        SettlementLifecycleLib.cancelBatch(_disbursements, _batches, _planState, batchId, reasonCID);
    }

    function failStrandedSubject(bool isBatch, uint256 subjectId) external override onlyOwner nonReentrant {
        SettlementLifecycleLib.failStrandedSubject(
            _disbursements, _batches, _commandRecords, _planState, _ccipRoute, isBatch, subjectId
        );
    }

    function fundFees() external payable override {
        emit FeeReserveFunded(msg.sender, msg.value);
    }

    function withdrawExcessFees(address payable recipient, uint256 amount) external override onlyOwner nonReentrant {
        SettlementLifecycleLib.withdrawExcessFees(feeReserveMinimum, recipient, amount);
    }

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        SettlementAcknowledgmentLib.receiveAcknowledgment(
            _disbursements, _batches, _commandRecords, commandExecutionKeys, _planState, _ccipRoute, message
        );
    }

    function _fundingConfig() private view returns (SettlementFundingLib.RuntimeConfig memory) {
        return SettlementFundingLib.RuntimeConfig({
            hatsModule: hatsModule,
            poolingModule: commitmentPoolingModule,
            gDollarToken: gDollarToken,
            destinationEvmChainId: DESTINATION_EVM_CHAIN_ID,
            paused: paused
        });
    }
}
