// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ISettlementModule } from "../../interfaces/ISettlementModule.sol";
import { SettlementCommandLib } from "./CommandLib.sol";
import { SettlementPlanLib } from "./PlanLib.sol";

/// @notice Batch and child lifecycle behavior for the Arbitrum settlement source.
library SettlementLifecycleLib {
    uint16 internal constant HARD_MAX_BATCH_SIZE = 24;

    struct RuntimeConfig {
        address router;
        uint64 sourceChainSelector;
        uint64 destinationEvmChainId;
        uint256 feeReserveMinimum;
        uint16 batchSizeLimit;
        address protocolGarden;
        ISettlementModule.CcipRoute route;
    }

    event BatchCreated(
        uint256 indexed batchId,
        address indexed executorGarden,
        address indexed source,
        address token,
        uint8 kind,
        uint8 fundingRoute,
        uint256[] disbursementIds
    );
    event DisbursementRequeued(uint256 indexed disbursementId, uint32 attempt);
    event DisbursementCancelled(
        uint256 indexed disbursementId, address indexed actor, uint8 cancelledFromState, string reasonCID
    );
    event BatchCancelled(uint256 indexed batchId, address indexed actor, string reasonCID);

    /// @dev Keeps the full batch-homogeneity proof adjacent to the state transition it authorizes.
    // solhint-disable-next-line code-complexity
    function createBatch(
        mapping(uint256 disbursementId => ISettlementModule.Disbursement disbursement) storage disbursements,
        mapping(uint256 batchId => ISettlementModule.Batch batch) storage batches,
        mapping(address garden => ISettlementModule.SettlementAccount account) storage accounts,
        SettlementPlanLib.State storage planState,
        RuntimeConfig memory config,
        uint256 nextBatchId,
        uint256[] calldata disbursementIds
    )
        public
        returns (uint256 batchId)
    {
        uint256 length = disbursementIds.length;
        uint16 limit = config.batchSizeLimit;
        if (limit == 0 || length == 0 || length > limit || length > HARD_MAX_BATCH_SIZE) {
            revert ISettlementModule.BatchSizeOutOfBounds(length, limit);
        }

        ISettlementModule.Disbursement storage first = _knownDisbursement(disbursements, disbursementIds[0]);
        if (first.state != ISettlementModule.DisbursementState.Queued) {
            revert ISettlementModule.DisbursementNotInState(disbursementIds[0], first.state);
        }
        if (first.batchId != 0) revert ISettlementModule.DuplicateBatchEntry(disbursementIds[0]);

        for (uint256 index; index < length; ++index) {
            ISettlementModule.Disbursement storage entry = _knownDisbursement(disbursements, disbursementIds[index]);
            if (entry.state != ISettlementModule.DisbursementState.Queued) {
                revert ISettlementModule.DisbursementNotInState(disbursementIds[index], entry.state);
            }
            if (
                entry.batchId != 0 || entry.executorGarden != first.executorGarden || entry.source != first.source
                    || entry.token != first.token || entry.kind != first.kind || entry.fundingRoute != first.fundingRoute
            ) revert ISettlementModule.BatchEntryMismatch(disbursementIds[index]);
            _recheckDisbursement(accounts, planState, config, entry);
            for (uint256 prior; prior < index; ++prior) {
                if (disbursementIds[prior] == disbursementIds[index]) {
                    revert ISettlementModule.DuplicateBatchEntry(disbursementIds[index]);
                }
                if (disbursements[disbursementIds[prior]].recipient == entry.recipient) {
                    revert ISettlementModule.DuplicateBatchRecipient(entry.recipient);
                }
            }
        }

        batchId = nextBatchId;
        ISettlementModule.Batch storage batch = batches[batchId];
        batch.executorGarden = first.executorGarden;
        batch.source = first.source;
        batch.token = first.token;
        batch.kind = first.kind;
        batch.fundingRoute = first.fundingRoute;
        batch.state = ISettlementModule.DisbursementState.Queued;
        for (uint256 index; index < length; ++index) {
            batch.disbursementIds.push(disbursementIds[index]);
            disbursements[disbursementIds[index]].batchId = batchId;
        }
        emit BatchCreated(
            batchId,
            batch.executorGarden,
            batch.source,
            batch.token,
            uint8(batch.kind),
            uint8(batch.fundingRoute),
            disbursementIds
        );
    }

    function dispatchDisbursement(
        mapping(uint256 disbursementId => ISettlementModule.Disbursement disbursement) storage disbursements,
        mapping(bytes32 executionKey => ISettlementModule.CommandRecord record) storage records,
        mapping(bytes32 executionKey => bytes payload) storage payloads,
        mapping(bytes32 commandMessageId => bytes32 executionKey) storage executionKeys,
        mapping(address garden => ISettlementModule.SettlementAccount account) storage accounts,
        SettlementPlanLib.State storage planState,
        RuntimeConfig memory config,
        uint256 disbursementId
    )
        public
        returns (bytes32 messageId)
    {
        ISettlementModule.Disbursement storage disbursement = _knownDisbursement(disbursements, disbursementId);
        if (disbursement.state != ISettlementModule.DisbursementState.Queued) {
            revert ISettlementModule.DisbursementNotInState(disbursementId, disbursement.state);
        }
        if (disbursement.batchId != 0) {
            revert ISettlementModule.BatchedDisbursementCannotBeCancelled(disbursementId, disbursement.batchId);
        }
        _recheckDisbursement(accounts, planState, config, disbursement);

        address[] memory recipients = new address[](1);
        recipients[0] = disbursement.recipient;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = disbursement.amount;
        messageId = SettlementCommandLib.dispatch(
            records,
            payloads,
            executionKeys,
            _dispatchRequest(
                config,
                false,
                disbursementId,
                disbursement.attempt,
                disbursement.executorGarden,
                disbursement.kind,
                recipients,
                amounts
            )
        );
        disbursement.state = ISettlementModule.DisbursementState.Dispatched;
        disbursement.commandMessageId = messageId;
        disbursement.dispatchedAt = uint64(block.timestamp);
        disbursement.executionKey = _executionKey(config.sourceChainSelector, false, disbursementId, disbursement.attempt);
    }

    function dispatchBatch(
        mapping(uint256 disbursementId => ISettlementModule.Disbursement disbursement) storage disbursements,
        mapping(uint256 batchId => ISettlementModule.Batch batch) storage batches,
        mapping(bytes32 executionKey => ISettlementModule.CommandRecord record) storage records,
        mapping(bytes32 executionKey => bytes payload) storage payloads,
        mapping(bytes32 commandMessageId => bytes32 executionKey) storage executionKeys,
        mapping(address garden => ISettlementModule.SettlementAccount account) storage accounts,
        SettlementPlanLib.State storage planState,
        RuntimeConfig memory config,
        uint256 batchId
    )
        public
        returns (bytes32 messageId)
    {
        ISettlementModule.Batch storage batch = _knownBatch(batches, batchId);
        if (batch.state != ISettlementModule.DisbursementState.Queued) {
            revert ISettlementModule.BatchNotInState(batchId, batch.state);
        }
        (address[] memory recipients, uint256[] memory amounts) =
            _batchFactsAndRecheck(disbursements, accounts, planState, config, batch);
        messageId = SettlementCommandLib.dispatch(
            records,
            payloads,
            executionKeys,
            _dispatchRequest(config, true, batchId, batch.attempt, batch.executorGarden, batch.kind, recipients, amounts)
        );
        bytes32 key = _executionKey(config.sourceChainSelector, true, batchId, batch.attempt);
        _markBatchDispatched(disbursements, batch, key, messageId);
    }

    function _markBatchDispatched(
        mapping(uint256 disbursementId => ISettlementModule.Disbursement disbursement) storage disbursements,
        ISettlementModule.Batch storage batch,
        bytes32 key,
        bytes32 messageId
    )
        private
    {
        batch.state = ISettlementModule.DisbursementState.Dispatched;
        batch.executionKey = key;
        batch.commandMessageId = messageId;
        batch.dispatchedAt = uint64(block.timestamp);
        for (uint256 index; index < batch.disbursementIds.length; ++index) {
            ISettlementModule.Disbursement storage entry = disbursements[batch.disbursementIds[index]];
            entry.state = ISettlementModule.DisbursementState.Dispatched;
            entry.executionKey = key;
            entry.commandMessageId = messageId;
            entry.dispatchedAt = batch.dispatchedAt;
        }
    }

    function _batchFactsAndRecheck(
        mapping(uint256 disbursementId => ISettlementModule.Disbursement disbursement) storage disbursements,
        mapping(address garden => ISettlementModule.SettlementAccount account) storage accounts,
        SettlementPlanLib.State storage planState,
        RuntimeConfig memory config,
        ISettlementModule.Batch storage batch
    )
        private
        view
        returns (address[] memory recipients, uint256[] memory amounts)
    {
        uint256 length = batch.disbursementIds.length;
        recipients = new address[](length);
        amounts = new uint256[](length);
        for (uint256 index; index < length; ++index) {
            ISettlementModule.Disbursement storage entry = disbursements[batch.disbursementIds[index]];
            _recheckDisbursement(accounts, planState, config, entry);
            recipients[index] = entry.recipient;
            amounts[index] = entry.amount;
        }
    }

    function retry(
        mapping(bytes32 executionKey => ISettlementModule.CommandRecord record) storage records,
        mapping(bytes32 executionKey => bytes payload) storage payloads,
        mapping(bytes32 commandMessageId => bytes32 executionKey) storage executionKeys,
        RuntimeConfig memory config,
        bytes32 key
    )
        public
        returns (bytes32 messageId)
    {
        return SettlementCommandLib.retry(
            records,
            payloads,
            executionKeys,
            SettlementCommandLib.RetryRequest({
                router: config.router,
                feeReserveMinimum: config.feeReserveMinimum,
                executionKey: key
            })
        );
    }

    function requeue(
        mapping(uint256 disbursementId => ISettlementModule.Disbursement disbursement) storage disbursements,
        SettlementPlanLib.State storage planState,
        uint256 disbursementId
    )
        public
    {
        ISettlementModule.Disbursement storage disbursement = _knownDisbursement(disbursements, disbursementId);
        if (disbursement.state != ISettlementModule.DisbursementState.Failed) {
            revert ISettlementModule.DisbursementNotInState(disbursementId, disbursement.state);
        }
        if (disbursement.payoutPlanId != 0) {
            --planState.payoutPlans[disbursement.payoutPlanId].failedPayoutCount;
        }
        disbursement.state = ISettlementModule.DisbursementState.Queued;
        disbursement.batchId = 0;
        ++disbursement.attempt;
        disbursement.executionKey = bytes32(0);
        disbursement.commandMessageId = bytes32(0);
        disbursement.acknowledgmentMessageId = bytes32(0);
        disbursement.dispatchedAt = 0;
        disbursement.confirmedAt = 0;
        emit DisbursementRequeued(disbursementId, disbursement.attempt);
    }

    function cancelDisbursement(
        mapping(uint256 disbursementId => ISettlementModule.Disbursement disbursement) storage disbursements,
        SettlementPlanLib.State storage planState,
        uint256 disbursementId,
        string calldata reasonCID
    )
        public
    {
        ISettlementModule.Disbursement storage disbursement = _knownDisbursement(disbursements, disbursementId);
        if (disbursement.state == ISettlementModule.DisbursementState.Dispatched) {
            revert ISettlementModule.DispatchedSettlementCannotBeCancelled();
        }
        if (
            disbursement.state != ISettlementModule.DisbursementState.Queued
                && disbursement.state != ISettlementModule.DisbursementState.Failed
        ) revert ISettlementModule.DisbursementNotInState(disbursementId, disbursement.state);
        if (disbursement.batchId != 0 && disbursement.state == ISettlementModule.DisbursementState.Queued) {
            revert ISettlementModule.BatchedDisbursementCannotBeCancelled(disbursementId, disbursement.batchId);
        }
        ISettlementModule.DisbursementState previous = disbursement.state;
        if (disbursement.payoutPlanId != 0) {
            ISettlementModule.CommitmentPayoutPlan storage plan = planState.payoutPlans[disbursement.payoutPlanId];
            if (previous == ISettlementModule.DisbursementState.Failed) --plan.failedPayoutCount;
            ++plan.cancelledPayoutCount;
        }
        disbursement.state = ISettlementModule.DisbursementState.Cancelled;
        disbursement.cancelledFromState = previous;
        disbursement.reasonCID = reasonCID;
        emit DisbursementCancelled(disbursementId, msg.sender, uint8(previous), reasonCID);
    }

    function cancelBatch(
        mapping(uint256 disbursementId => ISettlementModule.Disbursement disbursement) storage disbursements,
        mapping(uint256 batchId => ISettlementModule.Batch batch) storage batches,
        SettlementPlanLib.State storage planState,
        uint256 batchId,
        string calldata reasonCID
    )
        public
    {
        ISettlementModule.Batch storage batch = _knownBatch(batches, batchId);
        if (batch.state != ISettlementModule.DisbursementState.Queued) {
            revert ISettlementModule.BatchNotInState(batchId, batch.state);
        }
        batch.state = ISettlementModule.DisbursementState.Cancelled;
        for (uint256 index; index < batch.disbursementIds.length; ++index) {
            ISettlementModule.Disbursement storage entry = disbursements[batch.disbursementIds[index]];
            entry.state = ISettlementModule.DisbursementState.Cancelled;
            entry.cancelledFromState = ISettlementModule.DisbursementState.Queued;
            entry.reasonCID = reasonCID;
            if (entry.payoutPlanId != 0) ++planState.payoutPlans[entry.payoutPlanId].cancelledPayoutCount;
        }
        emit BatchCancelled(batchId, msg.sender, reasonCID);
    }

    function _dispatchRequest(
        RuntimeConfig memory config,
        bool isBatch,
        uint256 subjectId,
        uint32 attempt,
        address executorGarden,
        ISettlementModule.DisbursementKind kind,
        address[] memory recipients,
        uint256[] memory amounts
    )
        private
        pure
        returns (SettlementCommandLib.DispatchRequest memory request)
    {
        request = SettlementCommandLib.DispatchRequest({
            router: config.router,
            sourceChainSelector: config.sourceChainSelector,
            feeReserveMinimum: config.feeReserveMinimum,
            route: config.route,
            isBatch: isBatch,
            subjectId: subjectId,
            attempt: attempt,
            executorGarden: executorGarden,
            kind: kind,
            recipients: recipients,
            amounts: amounts
        });
    }

    function _recheckDisbursement(
        mapping(address garden => ISettlementModule.SettlementAccount account) storage accounts,
        SettlementPlanLib.State storage planState,
        RuntimeConfig memory config,
        ISettlementModule.Disbursement storage disbursement
    )
        private
        view
    {
        if (
            disbursement.kind == ISettlementModule.DisbursementKind.ContributorConsideration
                || disbursement.kind == ISettlementModule.DisbursementKind.GardenBeneficiary
        ) {
            ISettlementModule.CommitmentPayoutPlan storage plan = planState.payoutPlans[disbursement.payoutPlanId];
            _activeAccountMatches(accounts, plan.payerGarden, disbursement.source, config.destinationEvmChainId);
            if (disbursement.kind == ISettlementModule.DisbursementKind.GardenBeneficiary) {
                _activeAccountMatches(
                    accounts, plan.beneficiaryGarden, disbursement.recipient, config.destinationEvmChainId
                );
            }
        } else if (disbursement.kind == ISettlementModule.DisbursementKind.Funding) {
            _activeAccountMatches(accounts, config.protocolGarden, disbursement.source, config.destinationEvmChainId);
            _activeAccountMatches(accounts, disbursement.garden, disbursement.recipient, config.destinationEvmChainId);
        } else {
            revert ISettlementModule.InvalidPayoutVector();
        }
    }

    function _activeAccountMatches(
        mapping(address garden => ISettlementModule.SettlementAccount account) storage accounts,
        address garden,
        address expected,
        uint64 destinationEvmChainId
    )
        private
        view
    {
        ISettlementModule.SettlementAccount storage account = accounts[garden];
        if (account.account == address(0)) revert ISettlementModule.UnknownSettlementAccount(garden);
        if (!account.active) revert ISettlementModule.SettlementAccountInactive(garden);
        if (account.chainId != destinationEvmChainId) {
            revert ISettlementModule.InvalidSettlementChain(account.chainId);
        }
        if (account.account != expected) revert ISettlementModule.UnknownSettlementAccount(garden);
    }

    function _knownDisbursement(
        mapping(uint256 disbursementId => ISettlementModule.Disbursement disbursement) storage disbursements,
        uint256 disbursementId
    )
        private
        view
        returns (ISettlementModule.Disbursement storage disbursement)
    {
        disbursement = disbursements[disbursementId];
        if (disbursement.state == ISettlementModule.DisbursementState.None) {
            revert ISettlementModule.UnknownDisbursement(disbursementId);
        }
    }

    function _knownBatch(
        mapping(uint256 batchId => ISettlementModule.Batch batch) storage batches,
        uint256 batchId
    )
        private
        view
        returns (ISettlementModule.Batch storage batch)
    {
        batch = batches[batchId];
        if (batch.state == ISettlementModule.DisbursementState.None) {
            revert ISettlementModule.UnknownBatch(batchId);
        }
    }

    function _executionKey(
        uint64 sourceChainSelector,
        bool isBatch,
        uint256 settlementId,
        uint32 attempt
    )
        private
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(sourceChainSelector, address(this), isBatch, settlementId, attempt));
    }
}
