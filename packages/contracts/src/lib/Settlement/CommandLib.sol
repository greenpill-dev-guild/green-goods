// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IRouterClient } from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

import { ISettlementModule } from "../../interfaces/ISettlementModule.sol";
import { SettlementMessageCodec } from "../../libraries/SettlementMessageCodec.sol";

/// @notice CCIP command construction, immutable command snapshots, and retries.
/// @dev Public functions execute with DELEGATECALL so native fees remain held and spent by
///      SettlementModule while this code stays outside its EIP-170 runtime budget.
library SettlementCommandLib {
    struct DispatchRequest {
        address router;
        uint64 sourceChainSelector;
        uint256 feeReserveMinimum;
        ISettlementModule.CcipRoute route;
        bool isBatch;
        uint256 subjectId;
        uint32 attempt;
        address executorGarden;
        ISettlementModule.DisbursementKind kind;
        address[] recipients;
        uint256[] amounts;
    }

    struct RetryRequest {
        address router;
        uint256 feeReserveMinimum;
        bytes32 executionKey;
    }

    struct QuoteRequest {
        address router;
        ISettlementModule.CcipRoute route;
        bool isBatch;
        uint256 subjectId;
    }

    struct CommandFacts {
        address executorGarden;
        ISettlementModule.DisbursementKind kind;
        uint32 attempt;
        address[] recipients;
        uint256[] amounts;
    }

    event SettlementCommandDispatched(
        bytes32 indexed executionKey,
        bytes32 indexed commandMessageId,
        bool indexed isBatch,
        uint256 subjectId,
        uint32 attempt,
        uint64 destinationChainSelector,
        address destinationExecutor,
        uint32 destinationGasLimit,
        uint8 protocolVersion,
        bytes32 commandPayloadHash,
        uint256 fee
    );
    event SettlementCommandRetried(
        bytes32 indexed executionKey,
        bytes32 indexed commandMessageId,
        bool indexed isBatch,
        uint256 subjectId,
        uint32 attempt,
        uint64 destinationChainSelector,
        address destinationExecutor,
        uint32 destinationGasLimit,
        uint8 protocolVersion,
        bytes32 commandPayloadHash,
        uint256 fee
    );

    function dispatch(
        mapping(bytes32 executionKey => ISettlementModule.CommandRecord record) storage records,
        mapping(bytes32 executionKey => bytes payload) storage payloads,
        mapping(bytes32 commandMessageId => bytes32 executionKey) storage executionKeys,
        DispatchRequest memory request
    )
        public
        returns (bytes32 messageId)
    {
        ISettlementModule.CcipRoute memory route = request.route;
        if (
            route.destinationChainSelector == 0 || route.destinationExecutor == address(0) || route.destinationGasLimit == 0
                || route.protocolVersion != 1
        ) revert ISettlementModule.SourceNotReady();

        bytes32 key = keccak256(
            abi.encode(request.sourceChainSelector, address(this), request.isBatch, request.subjectId, request.attempt)
        );
        bytes memory payload = SettlementMessageCodec.encodeCommand(
            route.protocolVersion,
            request.subjectId,
            request.isBatch,
            request.attempt,
            request.executorGarden,
            uint8(request.kind),
            request.recipients,
            request.amounts
        );
        Client.EVM2AnyMessage memory message = _buildMessage(route.destinationExecutor, route.destinationGasLimit, payload);
        uint256 fee = IRouterClient(request.router).getFee(route.destinationChainSelector, message);
        _requireFeeReserve(fee, request.feeReserveMinimum);

        ISettlementModule.CommandRecord storage record = records[key];
        if (record.subjectId != 0) revert ISettlementModule.InvalidExecutionKey();
        record.isBatch = request.isBatch;
        record.subjectId = request.subjectId;
        record.attempt = request.attempt;
        record.destinationChainSelector = route.destinationChainSelector;
        record.destinationExecutor = route.destinationExecutor;
        record.destinationGasLimit = route.destinationGasLimit;
        record.protocolVersion = route.protocolVersion;
        record.commandPayloadHash = keccak256(payload);
        payloads[key] = payload;

        messageId = IRouterClient(request.router).ccipSend{ value: fee }(route.destinationChainSelector, message);
        record.latestCommandMessageId = messageId;
        executionKeys[messageId] = key;
        _emitDispatched(key, messageId, record, fee);
    }

    function retry(
        mapping(bytes32 executionKey => ISettlementModule.CommandRecord record) storage records,
        mapping(bytes32 executionKey => bytes payload) storage payloads,
        mapping(bytes32 commandMessageId => bytes32 executionKey) storage executionKeys,
        RetryRequest memory request
    )
        public
        returns (bytes32 messageId)
    {
        ISettlementModule.CommandRecord storage record = records[request.executionKey];
        if (record.subjectId == 0 || record.acknowledged) revert ISettlementModule.InvalidExecutionKey();
        bytes memory payload = payloads[request.executionKey];
        Client.EVM2AnyMessage memory message =
            _buildMessage(record.destinationExecutor, record.destinationGasLimit, payload);
        uint256 fee = IRouterClient(request.router).getFee(record.destinationChainSelector, message);
        _requireFeeReserve(fee, request.feeReserveMinimum);
        messageId = IRouterClient(request.router).ccipSend{ value: fee }(record.destinationChainSelector, message);
        record.latestCommandMessageId = messageId;
        executionKeys[messageId] = request.executionKey;
        _emitRetried(request.executionKey, messageId, record, fee);
    }

    function quote(
        mapping(uint256 disbursementId => ISettlementModule.Disbursement disbursement) storage disbursements,
        mapping(uint256 batchId => ISettlementModule.Batch batch) storage batches,
        mapping(bytes32 executionKey => ISettlementModule.CommandRecord record) storage records,
        mapping(bytes32 executionKey => bytes payload) storage payloads,
        QuoteRequest memory request
    )
        public
        view
        returns (uint256)
    {
        bytes32 key =
            request.isBatch ? batches[request.subjectId].executionKey : disbursements[request.subjectId].executionKey;
        if (key != bytes32(0)) {
            ISettlementModule.CommandRecord storage record = records[key];
            return IRouterClient(request.router)
                .getFee(
                    record.destinationChainSelector,
                    _buildMessage(record.destinationExecutor, record.destinationGasLimit, payloads[key])
                );
        }
        CommandFacts memory facts = _commandFacts(disbursements, batches, request.isBatch, request.subjectId);
        ISettlementModule.CcipRoute memory route = request.route;
        bytes memory payload = SettlementMessageCodec.encodeCommand(
            route.protocolVersion,
            request.subjectId,
            request.isBatch,
            facts.attempt,
            facts.executorGarden,
            uint8(facts.kind),
            facts.recipients,
            facts.amounts
        );
        return IRouterClient(request.router)
            .getFee(
                route.destinationChainSelector, _buildMessage(route.destinationExecutor, route.destinationGasLimit, payload)
            );
    }

    function _commandFacts(
        mapping(uint256 disbursementId => ISettlementModule.Disbursement disbursement) storage disbursements,
        mapping(uint256 batchId => ISettlementModule.Batch batch) storage batches,
        bool isBatch,
        uint256 subjectId
    )
        private
        view
        returns (CommandFacts memory facts)
    {
        if (isBatch) {
            ISettlementModule.Batch storage batch = batches[subjectId];
            if (batch.state == ISettlementModule.DisbursementState.None) {
                revert ISettlementModule.UnknownBatch(subjectId);
            }
            facts.executorGarden = batch.executorGarden;
            facts.kind = batch.kind;
            facts.attempt = batch.attempt;
            facts.recipients = new address[](batch.disbursementIds.length);
            facts.amounts = new uint256[](batch.disbursementIds.length);
            for (uint256 index; index < batch.disbursementIds.length; ++index) {
                ISettlementModule.Disbursement storage entry = disbursements[batch.disbursementIds[index]];
                facts.recipients[index] = entry.recipient;
                facts.amounts[index] = entry.amount;
            }
        } else {
            ISettlementModule.Disbursement storage entry = disbursements[subjectId];
            if (entry.state == ISettlementModule.DisbursementState.None) {
                revert ISettlementModule.UnknownDisbursement(subjectId);
            }
            facts.executorGarden = entry.executorGarden;
            facts.kind = entry.kind;
            facts.attempt = entry.attempt;
            facts.recipients = new address[](1);
            facts.amounts = new uint256[](1);
            facts.recipients[0] = entry.recipient;
            facts.amounts[0] = entry.amount;
        }
    }

    function _buildMessage(
        address destinationExecutor,
        uint32 gasLimit,
        bytes memory payload
    )
        private
        pure
        returns (Client.EVM2AnyMessage memory)
    {
        Client.EVMTokenAmount[] memory noTokens = new Client.EVMTokenAmount[](0);
        return Client.EVM2AnyMessage({
            receiver: abi.encode(destinationExecutor),
            data: payload,
            tokenAmounts: noTokens,
            feeToken: address(0),
            extraArgs: Client._argsToBytes(Client.EVMExtraArgsV1({ gasLimit: gasLimit }))
        });
    }

    function _requireFeeReserve(uint256 fee, uint256 minimum) private view {
        if (address(this).balance < fee) revert ISettlementModule.InsufficientNativeFee();
        uint256 remaining = address(this).balance - fee;
        if (remaining < minimum) revert ISettlementModule.FeeReserveFloorViolated(minimum, remaining);
    }

    function _emitDispatched(
        bytes32 key,
        bytes32 messageId,
        ISettlementModule.CommandRecord storage record,
        uint256 fee
    )
        private
    {
        emit SettlementCommandDispatched(
            key,
            messageId,
            record.isBatch,
            record.subjectId,
            record.attempt,
            record.destinationChainSelector,
            record.destinationExecutor,
            record.destinationGasLimit,
            record.protocolVersion,
            record.commandPayloadHash,
            fee
        );
    }

    function _emitRetried(
        bytes32 key,
        bytes32 messageId,
        ISettlementModule.CommandRecord storage record,
        uint256 fee
    )
        private
    {
        emit SettlementCommandRetried(
            key,
            messageId,
            record.isBatch,
            record.subjectId,
            record.attempt,
            record.destinationChainSelector,
            record.destinationExecutor,
            record.destinationGasLimit,
            record.protocolVersion,
            record.commandPayloadHash,
            fee
        );
    }
}
