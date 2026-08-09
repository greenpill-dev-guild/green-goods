// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

import { ISettlementModule } from "../../interfaces/ISettlementModule.sol";
import { SettlementMessageCodec } from "../../libraries/SettlementMessageCodec.sol";
import { SettlementLifecycleLib } from "./LifecycleLib.sol";
import { SettlementPlanLib } from "./PlanLib.sol";

/// @notice Authenticated source-side application of Celo execution acknowledgments.
library SettlementAcknowledgmentLib {
    event SettlementAcknowledged(
        bytes32 indexed executionKey,
        bytes32 indexed acknowledgmentMessageId,
        bytes32 indexed originatingCommandMessageId,
        bool isBatch,
        uint256 subjectId,
        bool success,
        uint8 failureCode
    );
    event DuplicateAcknowledgmentIgnored(bytes32 indexed executionKey, bytes32 indexed acknowledgmentMessageId);
    event StaleAcknowledgmentIgnored(bytes32 indexed executionKey, bytes32 indexed acknowledgmentMessageId);

    /// @dev Keeps authentication, stale-attempt handling, and aggregate accounting in one ordered boundary.
    // solhint-disable-next-line code-complexity
    function receiveAcknowledgment(
        mapping(uint256 disbursementId => ISettlementModule.Disbursement disbursement) storage disbursements,
        mapping(uint256 batchId => ISettlementModule.Batch batch) storage batches,
        mapping(bytes32 executionKey => ISettlementModule.CommandRecord record) storage records,
        mapping(bytes32 commandMessageId => bytes32 executionKey) storage executionKeys,
        SettlementPlanLib.State storage planState,
        ISettlementModule.CcipRoute memory route,
        Client.Any2EVMMessage memory message
    )
        public
    {
        if (message.destTokenAmounts.length != 0) revert ISettlementModule.CcipTokensNotAllowed();
        SettlementMessageCodec.Acknowledgment memory acknowledgment =
            SettlementMessageCodec.decodeAcknowledgment(message.data);
        if (acknowledgment.version != 1) revert ISettlementModule.UnsupportedMessageVersion();
        if (
            acknowledgment.failureCode > uint8(ISettlementModule.FailureCode.BalanceDeltaMismatch)
                || (acknowledgment.success && acknowledgment.failureCode != uint8(ISettlementModule.FailureCode.None))
                || (!acknowledgment.success && acknowledgment.failureCode == uint8(ISettlementModule.FailureCode.None))
        ) revert ISettlementModule.UnsupportedMessageVersion();

        ISettlementModule.CommandRecord storage record = records[acknowledgment.executionKey];
        if (record.subjectId == 0) revert ISettlementModule.InvalidExecutionKey();
        if (message.sourceChainSelector != record.destinationChainSelector) {
            revert ISettlementModule.InvalidCcipSource();
        }
        address sender = abi.decode(message.sender, (address));
        if (sender != record.destinationExecutor) {
            revert ISettlementModule.InvalidCcipSender();
        }
        // Matching the snapshot is not enough — the snapshot is whatever was configured when the
        // command went out, and it never expires. Replacing an executor already requires a grace
        // window (`ConfigurationLib.setCcipRoute` refuses a zero-grace swap), but nothing enforced
        // that window's expiry here, so a retired executor kept authority over everything already
        // dispatched to it forever and could mark those subjects Confirmed with no G$ moved. The
        // sender must also still be who we trust now: the active peer, or the previous one inside
        // its unexpired window (Decision Log #60; settlement-spec §3.1.3). Subjects left behind
        // when the window closes go through `failStrandedSubject`, not through a retired peer.
        if (!SettlementLifecycleLib.canStillAcknowledge(route, sender)) {
            revert ISettlementModule.RetiredPeerAcknowledgment(sender);
        }
        if (executionKeys[acknowledgment.originatingCommandMessageId] != acknowledgment.executionKey) {
            revert ISettlementModule.InvalidExecutionKey();
        }
        if (record.acknowledged) {
            emit DuplicateAcknowledgmentIgnored(acknowledgment.executionKey, message.messageId);
            return;
        }
        if (!_isCurrentExecution(disbursements, batches, record, acknowledgment.executionKey)) {
            emit StaleAcknowledgmentIgnored(acknowledgment.executionKey, message.messageId);
            return;
        }

        record.acknowledged = true;
        if (record.isBatch) {
            _acknowledgeBatch(disbursements, batches, planState, record.subjectId, message.messageId, acknowledgment);
        } else {
            _acknowledgeDisbursement(disbursements, planState, record.subjectId, message.messageId, acknowledgment);
        }
        emit SettlementAcknowledged(
            acknowledgment.executionKey,
            message.messageId,
            acknowledgment.originatingCommandMessageId,
            record.isBatch,
            record.subjectId,
            acknowledgment.success,
            acknowledgment.failureCode
        );
    }

    function _acknowledgeDisbursement(
        mapping(uint256 disbursementId => ISettlementModule.Disbursement disbursement) storage disbursements,
        SettlementPlanLib.State storage planState,
        uint256 disbursementId,
        bytes32 acknowledgmentMessageId,
        SettlementMessageCodec.Acknowledgment memory acknowledgment
    )
        private
    {
        ISettlementModule.Disbursement storage disbursement = disbursements[disbursementId];
        disbursement.state = acknowledgment.success
            ? ISettlementModule.DisbursementState.Confirmed
            : ISettlementModule.DisbursementState.Failed;
        disbursement.acknowledgmentMessageId = acknowledgmentMessageId;
        disbursement.failureCode = acknowledgment.failureCode;
        if (acknowledgment.success) disbursement.confirmedAt = uint64(block.timestamp);
        _recordPlanOutcome(planState, disbursement.payoutPlanId, acknowledgment.success);
    }

    function _acknowledgeBatch(
        mapping(uint256 disbursementId => ISettlementModule.Disbursement disbursement) storage disbursements,
        mapping(uint256 batchId => ISettlementModule.Batch batch) storage batches,
        SettlementPlanLib.State storage planState,
        uint256 batchId,
        bytes32 acknowledgmentMessageId,
        SettlementMessageCodec.Acknowledgment memory acknowledgment
    )
        private
    {
        ISettlementModule.Batch storage batch = batches[batchId];
        batch.state = acknowledgment.success
            ? ISettlementModule.DisbursementState.Confirmed
            : ISettlementModule.DisbursementState.Failed;
        batch.acknowledgmentMessageId = acknowledgmentMessageId;
        batch.failureCode = acknowledgment.failureCode;
        if (acknowledgment.success) batch.confirmedAt = uint64(block.timestamp);
        for (uint256 index; index < batch.disbursementIds.length; ++index) {
            ISettlementModule.Disbursement storage entry = disbursements[batch.disbursementIds[index]];
            entry.state = batch.state;
            entry.acknowledgmentMessageId = acknowledgmentMessageId;
            entry.failureCode = acknowledgment.failureCode;
            if (acknowledgment.success) entry.confirmedAt = batch.confirmedAt;
            _recordPlanOutcome(planState, entry.payoutPlanId, acknowledgment.success);
        }
    }

    function _recordPlanOutcome(SettlementPlanLib.State storage planState, uint256 payoutPlanId, bool success) private {
        if (payoutPlanId == 0) return;
        if (success) ++planState.payoutPlans[payoutPlanId].confirmedPayoutCount;
        else ++planState.payoutPlans[payoutPlanId].failedPayoutCount;
    }

    function _isCurrentExecution(
        mapping(uint256 disbursementId => ISettlementModule.Disbursement disbursement) storage disbursements,
        mapping(uint256 batchId => ISettlementModule.Batch batch) storage batches,
        ISettlementModule.CommandRecord storage record,
        bytes32 key
    )
        private
        view
        returns (bool)
    {
        if (record.isBatch) return batches[record.subjectId].executionKey == key;
        return disbursements[record.subjectId].executionKey == key;
    }
}
