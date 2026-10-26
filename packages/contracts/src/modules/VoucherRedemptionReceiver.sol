// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { VoucherRedemptionCodec as Codec } from "../libraries/VoucherRedemptionCodec.sol";
import { VoucherServiceCodec as Service } from "../libraries/VoucherServiceCodec.sol";
import { VoucherServiceEscrowStorage as Store } from "../libraries/VoucherServiceEscrowStorage.sol";
import { VoucherEndpoint } from "./VoucherEndpoint.sol";

/// @notice Authenticated v2 setup decisions and durable independent result transport.
abstract contract VoucherRedemptionReceiver is VoucherEndpoint {
    uint256 public constant ACKNOWLEDGMENT_GAS_LIMIT = 750_000;

    // Frozen v1 structs and linear state: no live v1 migration is claimed.
    struct PendingAction {
        uint64 nonce;
        Codec.ActionKind kind;
        uint256 voucherUnits;
        uint256 serviceUnits;
        bytes32 actionHash;
    }

    struct Execution {
        Codec.Result current;
        uint64 acknowledgmentSequence;
        bytes32 acknowledgmentMessageId;
        bytes32 acknowledgmentFailureHash;
    }
    mapping(bytes32 redemptionId => Execution result) internal _results;
    mapping(bytes32 redemptionId => bytes authorization) internal _commands;
    mapping(bytes32 messageId => bytes32 payloadHash) public transportPayloads;
    mapping(bytes32 redemptionId => bytes reason) public failureReason;
    mapping(bytes32 redemptionId => PendingAction action) internal _pendingActions;
    uint256[45] private __gap;

    error InvalidRedemptionAuthorization();
    error UnknownRedemption();
    error ConflictingRedemptionPayload();
    error WrongRedemptionPayload();
    error HolderOnly();
    error IssuerApprovalRequired();
    error SelfOnly();
    error IncorrectAcknowledgmentFee(uint256 required, uint256 provided);
    error LegacyVoucherServiceDisabled();
    error ConflictingSetupDecision();
    error InvalidSetupDecision();

    event RedemptionAuthorizationRecorded(
        bytes32 indexed redemptionId, bytes32 indexed payloadHash, bytes32 indexed messageId
    );
    event RedemptionAcknowledgmentSent(bytes32 indexed redemptionId, uint64 indexed sequence, bytes32 indexed messageId);
    event RedemptionAcknowledgmentFailed(bytes32 indexed redemptionId, uint64 indexed sequence, bytes reason);
    event VoucherSetupAuthorizationRecorded(
        bytes32 indexed setupId,
        bytes32 indexed authorizationHash,
        bytes32 indexed messageId,
        Service.SetupAuthorization authorization
    );
    event VoucherSetupDecisionApplied(bytes32 indexed setupId, bytes32 indexed decisionId, Service.SetupDecision decision);
    event VoucherSetupResultRecorded(bytes32 indexed setupId, uint64 indexed sequence, Service.SetupResult result);
    event VoucherServiceAcknowledgmentSent(
        bytes32 indexed setupId, bool indexed finalResult, uint64 indexed sequence, bytes32 messageId
    );
    event VoucherServiceAcknowledgmentFailed(
        bytes32 indexed setupId, bool indexed finalResult, uint64 indexed sequence, bytes reason
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address router_) VoucherEndpoint(router_) { }

    function getExecutionResult(bytes32 id) external view returns (Execution memory) {
        return _results[id];
    }

    function getPendingAction(bytes32 id) external view returns (PendingAction memory) {
        return _pendingActions[id];
    }

    function getCommand(bytes32 id) external view returns (bytes memory) {
        return _commands[id];
    }

    function getSetupExecution(bytes32 id) external view returns (Store.Execution memory) {
        return Store.state().executions[id];
    }

    function getSetupResult(bytes32 id) external view returns (Service.SetupResult memory) {
        return Store.state().executions[id].result;
    }

    function getSetupAuthorization(bytes32 id) external view returns (bytes memory) {
        return Store.state().executions[id].authorization;
    }

    function unspentVoucherLiability(address token) external view returns (uint256) {
        return Store.state().liabilities[token];
    }

    function quoteAcknowledgment(bytes32) public pure returns (uint256) {
        revert LegacyVoucherServiceDisabled();
    }

    function retryAcknowledgment(bytes32) external payable {
        revert LegacyVoucherServiceDisabled();
    }

    function sendAcknowledgment(bytes32) external pure returns (bytes32) {
        revert LegacyVoucherServiceDisabled();
    }

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override nonReentrant {
        _authenticate(message);
        Store.State storage s = Store.state();
        bytes32 dataHash = keccak256(message.data);
        bytes32 previous = s.transportPayloads[message.messageId];
        if (previous != bytes32(0)) {
            if (previous != dataHash) revert ConflictingRedemptionPayload();
            return;
        }
        bytes32 kind = Service.messageKind(message.data);
        if (kind == Service.AUTHORIZATION_KIND) {
            Service.SetupAuthorization memory a = Service.decodeAuthorization(message.data);
            if (_recordAuthorization(a, message.messageId)) _changedSetup(Service.setupId(a));
        } else if (kind == Service.DECISION_KIND) {
            (Service.SetupAuthorization memory a, Service.SetupDecisionCommand memory command) =
                Service.decodeDecision(message.data);
            _recordAuthorization(a, message.messageId);
            _applyDecision(a, command, message.data);
        } else {
            revert Service.UnsupportedVoucherServiceMessage();
        }
        s.transportPayloads[message.messageId] = dataHash;
    }

    function _recordAuthorization(Service.SetupAuthorization memory a, bytes32 messageId) private returns (bool fresh) {
        _validateAuthorization(a);
        bytes32 id = Service.setupId(a);
        bytes32 payloadHash = Service.hash(a);
        Store.Execution storage e = Store.state().executions[id];
        if (e.result.authorizationHash != bytes32(0)) {
            if (e.result.authorizationHash != payloadHash) revert ConflictingRedemptionPayload();
            return false;
        }
        e.authorization = Service.encodeAuthorization(a);
        e.result.version = Service.VERSION;
        e.result.setupId = id;
        e.result.authorizationHash = payloadHash;
        e.result.phase = Service.SetupPhase.Authorized;
        e.result.actionSucceeded = true;
        emit VoucherSetupAuthorizationRecorded(id, payloadHash, messageId, a);
        return true;
    }

    function _applyDecision(
        Service.SetupAuthorization memory a,
        Service.SetupDecisionCommand memory command,
        bytes memory encoded
    )
        private
    {
        bytes32 id = Service.setupId(a);
        Store.Execution storage e = _expectedSetup(id, Service.hash(a));
        if (command.setupId != id || command.authorizationHash != e.result.authorizationHash) {
            revert InvalidSetupDecision();
        }
        bytes32 decision = Service.decisionId(command);
        if (e.result.appliedDecisionId != bytes32(0)) {
            if (e.result.appliedDecisionId != decision) revert ConflictingSetupDecision();
            return;
        }
        if (command.decision == Service.SetupDecision.Activate) {
            if (
                e.result.phase != Service.SetupPhase.Deposited || !e.result.issuerApproved
                    || e.result.depositedUnits != a.voucherUnits
                    || command.expectedDepositReceiptHash != e.result.depositReceiptHash
                    || command.coreAcceptanceHash == bytes32(0) || command.abortReason != Service.AbortReason.None
            ) revert InvalidSetupDecision();
            e.result.phase = Service.SetupPhase.Active;
        } else if (command.decision == Service.SetupDecision.Abort) {
            if (
                command.coreAcceptanceHash != bytes32(0) || command.abortReason == Service.AbortReason.None
                    || (command.expectedDepositReceiptHash != bytes32(0)
                        && command.expectedDepositReceiptHash != Service.depositReceiptHash(a))
            ) revert InvalidSetupDecision();
            e.result.phase =
                e.result.depositedUnits == 0 ? Service.SetupPhase.Aborted : Service.SetupPhase.AbortRefundPending;
            e.pendingAction = e.result.depositedUnits == 0 ? Service.SetupAction.None : Service.SetupAction.AbortRefund;
            e.result.actionSucceeded = true;
            e.result.failureHash = bytes32(0);
            delete e.failureReason;
        } else {
            revert InvalidSetupDecision();
        }
        e.decision = encoded;
        e.result.decision = command.decision;
        e.result.appliedDecisionId = decision;
        emit VoucherSetupDecisionApplied(id, decision, command.decision);
        if (e.pendingAction == Service.SetupAction.AbortRefund) _attemptSetup(id);
        else _changedSetup(id);
    }

    function quoteSetupAcknowledgment(bytes32 id) public view returns (uint256) {
        return _quote(Service.encodeSetupResult(_knownSetup(id).result), ACKNOWLEDGMENT_GAS_LIMIT);
    }

    function quoteFinalAcknowledgment(bytes32 id) public view returns (uint256) {
        return _quote(Service.encodeFinalResult(_finalResult(id)), ACKNOWLEDGMENT_GAS_LIMIT);
    }

    function retrySetupAcknowledgment(bytes32 id) external payable nonReentrant {
        _retryAcknowledgment(id, false);
    }

    function retryFinalAcknowledgment(bytes32 id) external payable nonReentrant {
        _retryAcknowledgment(id, true);
    }

    function sendServiceAcknowledgment(bytes32 id, bool finalResult) external returns (bytes32) {
        if (msg.sender != address(this)) revert SelfOnly();
        uint256 reserve = address(this).balance;
        uint256 fee = finalResult ? quoteFinalAcknowledgment(id) : quoteSetupAcknowledgment(id);
        if (fee != 0) revert InsufficientTransportFee(fee, 0);
        bytes memory data =
            finalResult ? Service.encodeFinalResult(_finalResult(id)) : Service.encodeSetupResult(_knownSetup(id).result);
        bytes32 messageId = _send(data, ACKNOWLEDGMENT_GAS_LIMIT);
        if (address(this).balance < reserve) revert InsufficientTransportFee(reserve, address(this).balance);
        return messageId;
    }

    function _retryAcknowledgment(bytes32 id, bool finalResult) private {
        uint256 fee = finalResult ? quoteFinalAcknowledgment(id) : quoteSetupAcknowledgment(id);
        if (msg.value != fee) revert IncorrectAcknowledgmentFee(fee, msg.value);
        uint256 reserve = address(this).balance - msg.value;
        bytes memory data =
            finalResult ? Service.encodeFinalResult(_finalResult(id)) : Service.encodeSetupResult(_knownSetup(id).result);
        bytes32 messageId = _send(data, ACKNOWLEDGMENT_GAS_LIMIT);
        if (address(this).balance < reserve) revert InsufficientTransportFee(reserve, address(this).balance);
        _recordAcknowledgment(id, finalResult, messageId);
    }

    function _tryAcknowledgment(bytes32 id, bool finalResult) internal {
        try this.sendServiceAcknowledgment(id, finalResult) returns (bytes32 messageId) {
            _recordAcknowledgment(id, finalResult, messageId);
        } catch (bytes memory reason) {
            Store.Execution storage e = Store.state().executions[id];
            Store.Acknowledgment storage ack = finalResult ? e.finalAcknowledgment : e.setupAcknowledgment;
            ack.failureHash = keccak256(reason);
            emit VoucherServiceAcknowledgmentFailed(
                id, finalResult, finalResult ? e.finalSequence : e.result.resultSequence, reason
            );
        }
    }

    function _recordAcknowledgment(bytes32 id, bool finalResult, bytes32 messageId) private {
        Store.Execution storage e = Store.state().executions[id];
        Store.Acknowledgment storage ack = finalResult ? e.finalAcknowledgment : e.setupAcknowledgment;
        ack.sequence = finalResult ? e.finalSequence : e.result.resultSequence;
        ack.messageId = messageId;
        ack.failureHash = bytes32(0);
        emit VoucherServiceAcknowledgmentSent(id, finalResult, ack.sequence, messageId);
    }

    function _changedSetup(bytes32 id) internal {
        Service.SetupResult storage result = Store.state().executions[id].result;
        ++result.resultSequence;
        emit VoucherSetupResultRecorded(id, result.resultSequence, result);
        _tryAcknowledgment(id, false);
    }

    function getFinalResult(bytes32 id) external view returns (Service.FinalResultV2 memory) {
        return _finalResult(id);
    }

    function _finalResult(bytes32 id) internal view returns (Service.FinalResultV2 memory r) {
        Store.Execution storage e = _knownSetup(id);
        Service.FinalAllocationRecord storage f = e.finalAllocation;
        if (f.decisionId == bytes32(0)) revert UnknownRedemption();
        r = Service.FinalResultV2(
            Service.VERSION,
            id,
            e.result.authorizationHash,
            e.finalSequence,
            f.activationDecisionId,
            f.decisionId,
            f.issuerReturnApprovalAtFreeze,
            f.allocation,
            f.release,
            f.refund
        );
    }

    function _validateAuthorization(Service.SetupAuthorization memory a) private view {
        if (
            a.sourceChainId != remoteChainId || a.sourceModule != remotePeer || a.coreModule == address(0)
                || a.destinationChainId != block.chainid || a.destinationEscrow != address(this) || a.commitmentId == 0
                || a.termsRevision == 0 || a.requestNonce == 0 || a.claimHash == bytes32(0) || a.termsHash == bytes32(0)
                || a.buyer == address(0) || a.holder == address(0) || a.holder == address(this) || a.issuer == address(0)
                || a.issuer == address(this) || a.buyerGarden == address(0) || a.providerGarden == address(0)
                || a.token.code.length == 0 || a.voucherUnits == 0 || a.voucherUnits == type(uint256).max
                || a.serviceUnits == 0 || a.unitLabelHash == bytes32(0) || a.serviceTermsRef == bytes32(0)
                || a.remedyTermsRef == bytes32(0) || a.acceptanceDeadline == 0 || a.remedyPolicy != Service.MUTUAL_CONSENT
        ) {
            revert InvalidRedemptionAuthorization();
        }
    }

    function _expectedSetup(bytes32 id, bytes32 payloadHash) internal view returns (Store.Execution storage e) {
        e = _knownSetup(id);
        if (e.result.authorizationHash != payloadHash) revert WrongRedemptionPayload();
    }

    function _knownSetup(bytes32 id) internal view returns (Store.Execution storage e) {
        e = Store.state().executions[id];
        if (e.result.authorizationHash == bytes32(0)) revert UnknownRedemption();
    }

    function _setupAuthorization(bytes32 id) internal view returns (Service.SetupAuthorization memory) {
        return Service.decodeAuthorization(Store.state().executions[id].authorization);
    }
    function _attemptSetup(bytes32 id) internal virtual;
}
