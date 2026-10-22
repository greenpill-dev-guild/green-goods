// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { VoucherRedemptionCodec as Codec } from "../libraries/VoucherRedemptionCodec.sol";
import { VoucherEndpoint } from "./VoucherEndpoint.sol";

/// @notice Durable authenticated authorizations, replay protection and independent result transport.
/// @dev Concrete escrow owns holder/issuer approval, quantity allocation and atomic economic actions.
abstract contract VoucherRedemptionReceiver is VoucherEndpoint {
    uint256 public constant ACKNOWLEDGMENT_GAS_LIMIT = 750_000;

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

    event RedemptionAuthorizationRecorded(
        bytes32 indexed redemptionId, bytes32 indexed payloadHash, bytes32 indexed messageId
    );
    event RedemptionAcknowledgmentSent(bytes32 indexed redemptionId, uint64 indexed sequence, bytes32 indexed messageId);
    event RedemptionAcknowledgmentFailed(bytes32 indexed redemptionId, uint64 indexed sequence, bytes reason);

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

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override nonReentrant {
        _authenticate(message);
        Codec.Authorization memory authorization = Codec.decodeAuthorization(message.data);
        _validateAuthorization(authorization);
        bytes32 id = Codec.redemptionId(authorization);
        bytes32 payloadHash = Codec.hash(authorization);
        bytes32 previousTransport = transportPayloads[message.messageId];
        Execution storage execution = _results[id];
        if (
            (previousTransport != bytes32(0) && previousTransport != payloadHash)
                || (execution.current.payloadHash != bytes32(0) && execution.current.payloadHash != payloadHash)
        ) {
            revert ConflictingRedemptionPayload();
        }
        transportPayloads[message.messageId] = payloadHash;
        if (execution.current.payloadHash != bytes32(0)) return;
        _commands[id] = Codec.encodeAuthorization(authorization);
        execution.current.version = Codec.VERSION;
        execution.current.redemptionId = id;
        execution.current.payloadHash = payloadHash;
        execution.current.resultSequence = 1;
        execution.current.actionSucceeded = true;
        emit RedemptionAuthorizationRecorded(id, payloadHash, message.messageId);
        _tryAcknowledgment(id);
    }

    function quoteAcknowledgment(bytes32 id) public view returns (uint256) {
        return _quote(Codec.encodeResult(_known(id).current), ACKNOWLEDGMENT_GAS_LIMIT);
    }

    function retryAcknowledgment(bytes32 id) external payable nonReentrant {
        uint256 fee = quoteAcknowledgment(id);
        if (msg.value != fee) revert IncorrectAcknowledgmentFee(fee, msg.value);
        _recordAcknowledgment(id, this.sendAcknowledgment(id));
    }

    function sendAcknowledgment(bytes32 id) external returns (bytes32) {
        if (msg.sender != address(this)) revert SelfOnly();
        return _send(Codec.encodeResult(_known(id).current), ACKNOWLEDGMENT_GAS_LIMIT);
    }

    function _tryAcknowledgment(bytes32 id) private {
        try this.sendAcknowledgment(id) returns (bytes32 messageId) {
            _recordAcknowledgment(id, messageId);
        } catch (bytes memory reason) {
            _results[id].acknowledgmentFailureHash = keccak256(reason);
            emit RedemptionAcknowledgmentFailed(id, _results[id].current.resultSequence, reason);
        }
    }

    function _recordAcknowledgment(bytes32 id, bytes32 messageId) private {
        Execution storage execution = _results[id];
        execution.acknowledgmentSequence = execution.current.resultSequence;
        execution.acknowledgmentMessageId = messageId;
        execution.acknowledgmentFailureHash = bytes32(0);
        emit RedemptionAcknowledgmentSent(id, execution.current.resultSequence, messageId);
    }

    function _validateAuthorization(Codec.Authorization memory authorization) private view {
        if (
            authorization.sourceChainId != remoteChainId || authorization.sourceModule != remotePeer
                || authorization.destinationChainId != block.chainid || authorization.destinationEscrow != address(this)
                || authorization.commitmentId == 0 || authorization.revision == 0
                || authorization.acceptedClaimHash == bytes32(0) || authorization.termsHash == bytes32(0)
                || authorization.buyer == address(0) || authorization.holder == address(0)
                || authorization.holder == address(this) || authorization.issuer == address(0)
                || authorization.issuer == address(this) || authorization.buyerGarden == address(0)
                || authorization.providerGarden == address(0) || authorization.token.code.length == 0
                || authorization.totalVoucherUnits == 0 || authorization.totalVoucherUnits == type(uint256).max
                || authorization.totalServiceUnits == 0 || authorization.serviceUnitLabelHash == bytes32(0)
                || authorization.serviceTermsRef == bytes32(0) || authorization.remedyTermsRef == bytes32(0)
                || authorization.remedyPolicy != Codec.MUTUAL_CONSENT
        ) {
            revert InvalidRedemptionAuthorization();
        }
    }

    function _holder(bytes32 id, bytes32 payloadHash) internal view returns (Execution storage execution) {
        execution = _expected(id, payloadHash);
        if (msg.sender != _authorization(id).holder) revert HolderOnly();
        if (!execution.current.issuerApproved) revert IssuerApprovalRequired();
    }

    function _expected(bytes32 id, bytes32 payloadHash) internal view returns (Execution storage execution) {
        execution = _known(id);
        if (execution.current.payloadHash != payloadHash) revert WrongRedemptionPayload();
    }

    function _known(bytes32 id) internal view returns (Execution storage execution) {
        execution = _results[id];
        if (execution.current.payloadHash == bytes32(0)) revert UnknownRedemption();
    }

    function _authorization(bytes32 id) internal view returns (Codec.Authorization memory) {
        return Codec.decodeAuthorization(_commands[id]);
    }
}
