// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { VoucherMessageCodec } from "../libraries/VoucherMessageCodec.sol";
import { VoucherEndpoint } from "./VoucherEndpoint.sol";

/// @notice Distributes authenticated earned vouchers from an issuer reserve's finite allowance.
/// @dev The community Safe owns this endpoint. Each reserve separately authorizes its token and
///      source issuer authority. Neither endpoint ownership nor garden authority grants reserve
///      spending rights. This adapter has no mint, pool, withdrawal, or token recovery capability.
contract GnosisVoucherAdapter is VoucherEndpoint {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_RECIPIENTS = 40;
    uint256 private constant _ACKNOWLEDGMENT_GAS_LIMIT = 400_000;

    struct AssetAuthorization {
        address issuerAuthority;
        bool enabled;
    }

    struct ExecutionResult {
        bytes32 payloadHash;
        uint64 sequence;
        bool success;
        uint64 acknowledgmentSequence;
        bytes32 failureHash;
        bytes32 acknowledgmentMessageId;
        bytes32 acknowledgmentFailureHash;
    }

    mapping(address issuer => mapping(address token => AssetAuthorization authorization)) public assetAuthorizations;
    mapping(bytes32 entitlementId => ExecutionResult result) private _results;
    mapping(bytes32 entitlementId => bytes command) private _commands;
    mapping(bytes32 entitlementId => bytes reason) public failureReason;
    mapping(bytes32 messageId => bytes32 payloadHash) public transportPayloads;
    uint256[45] private __gap;

    error InvalidCommand();
    error ConflictingPayload();
    error UnknownEntitlement();
    error AlreadyDelivered();
    error IssuerOnly();
    error SelfOnly();
    error AssetNotAuthorized();
    error ExecutionPaused();
    error UnlimitedAllowance();
    error InsufficientAllowance();
    error InsufficientReserve();
    error InexactTransfer();
    error IncorrectAcknowledgmentFee(uint256 required, uint256 provided);

    event AssetConfigured(address indexed issuer, address indexed token, address indexed issuerAuthority, bool enabled);
    event CommandRecorded(bytes32 indexed entitlementId, bytes32 indexed payloadHash, bytes32 indexed messageId);
    event DistributionResult(
        bytes32 indexed entitlementId, uint64 indexed sequence, bool indexed success, bytes32 failureHash, bytes reason
    );
    event AcknowledgmentSent(bytes32 indexed entitlementId, uint64 indexed sequence, bytes32 indexed messageId);
    event AcknowledgmentFailed(bytes32 indexed entitlementId, uint64 indexed sequence, bytes reason);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address router_) VoucherEndpoint(router_) { }

    function initialize(
        address owner_,
        address guardian_,
        uint64 sourceSelector_,
        uint256 sourceChainId_,
        address sourceModule_
    )
        external
        initializer
    {
        __VoucherEndpoint_init(owner_, guardian_, sourceSelector_, sourceChainId_, sourceModule_);
    }

    /// @notice The reserve itself controls authorization; the endpoint owner cannot grant it.
    function configureAsset(address token, address issuerAuthority, bool enabled) external nonReentrant {
        if (token.code.length == 0 || issuerAuthority == address(0)) revert InvalidCommand();
        assetAuthorizations[msg.sender][token] = AssetAuthorization(issuerAuthority, enabled);
        emit AssetConfigured(msg.sender, token, issuerAuthority, enabled);
    }

    function getExecutionResult(bytes32 entitlementId) external view returns (ExecutionResult memory) {
        return _results[entitlementId];
    }

    function getCommand(bytes32 entitlementId) external view returns (bytes memory) {
        return _commands[entitlementId];
    }

    /// @notice Retries exactly the stored authorization after allowance, reserve or pause repair.
    /// @dev Reconcile its durable result with a separate caller-funded acknowledgment retry.
    function retry(bytes32 entitlementId) external nonReentrant {
        _requireRetryable(entitlementId);
        _attempt(entitlementId);
    }

    /// @notice Safe-operated fallback: the issuer can retry only an existing authenticated command.
    function safeRetry(bytes32 entitlementId) external nonReentrant {
        _requireRetryable(entitlementId);
        VoucherMessageCodec.Command memory command = VoucherMessageCodec.decodeCommand(_commands[entitlementId]);
        if (msg.sender != command.issuer) revert IssuerOnly();
        _attempt(entitlementId);
    }

    /// @notice Resends the current result for exactly the quoted fee, without distributing again.
    /// @dev Quote/send failure reverts only this paid retry, refunding its value automatically.
    function retryAcknowledgment(bytes32 entitlementId) external payable nonReentrant {
        uint256 fee = quoteAcknowledgment(entitlementId);
        if (msg.value != fee) revert IncorrectAcknowledgmentFee(fee, msg.value);
        _recordAcknowledgment(entitlementId, this.sendAcknowledgment(entitlementId));
    }

    /// @notice The exact native fee required for a caller-funded resend of the current result.
    function quoteAcknowledgment(bytes32 entitlementId) public view returns (uint256) {
        if (_results[entitlementId].sequence == 0) revert UnknownEntitlement();
        return _quote(_acknowledgmentPayload(entitlementId), _ACKNOWLEDGMENT_GAS_LIMIT);
    }

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override nonReentrant {
        _authenticate(message);
        VoucherMessageCodec.Command memory command = VoucherMessageCodec.decodeCommand(message.data);
        _validateCommand(command);
        bytes32 payloadHash = VoucherMessageCodec.hash(command);
        bytes32 entitlementId = VoucherMessageCodec.entitlementId(command);
        bytes32 priorTransportHash = transportPayloads[message.messageId];
        if (priorTransportHash != bytes32(0) && priorTransportHash != payloadHash) revert ConflictingPayload();
        ExecutionResult storage result = _results[entitlementId];
        if (result.payloadHash != bytes32(0) && result.payloadHash != payloadHash) revert ConflictingPayload();
        transportPayloads[message.messageId] = payloadHash;
        if (result.payloadHash == bytes32(0)) {
            result.payloadHash = payloadHash;
            _commands[entitlementId] = VoucherMessageCodec.encodeCommand(command);
            emit CommandRecorded(entitlementId, payloadHash, message.messageId);
            _attempt(entitlementId);
            // A first authenticated intake sponsors at most one acknowledgment attempt.
            _tryAcknowledgment(entitlementId);
        }
        // Duplicate transport cannot spend the native reserve. Lost acks use a funded retry.
    }

    function _validateCommand(VoucherMessageCodec.Command memory command) private view {
        uint256 length = command.recipients.length;
        if (
            command.version != VoucherMessageCodec.VERSION || command.sourceChainId != remoteChainId
                || command.sourceModule != remotePeer || command.destinationChainId != block.chainid
                || command.destinationAdapter != address(this) || command.issuer == address(0)
                || command.issuerAuthority == address(0) || command.token.code.length == 0 || command.revision == 0
                || command.totalUnits == 0 || command.termsHash == bytes32(0) || command.recognitionHash == bytes32(0)
                || command.policyContext == bytes32(0) || length == 0 || length > MAX_RECIPIENTS
                || length != command.amounts.length
        ) revert InvalidCommand();
        uint256 total;
        address previous;
        for (uint256 i; i < length; ++i) {
            address recipient = command.recipients[i];
            if (recipient <= previous) revert InvalidCommand();
            previous = recipient;
            total += command.amounts[i];
        }
        if (total != command.totalUnits) revert InvalidCommand();
    }

    function _requireRetryable(bytes32 entitlementId) private view {
        ExecutionResult storage result = _results[entitlementId];
        if (result.payloadHash == bytes32(0)) revert UnknownEntitlement();
        if (result.success) revert AlreadyDelivered();
    }

    function _attempt(bytes32 entitlementId) private {
        ExecutionResult storage result = _results[entitlementId];
        ++result.sequence;
        result.acknowledgmentFailureHash = bytes32(0);
        try this.executeDistribution(entitlementId) {
            result.success = true;
            result.failureHash = bytes32(0);
            delete failureReason[entitlementId];
            emit DistributionResult(entitlementId, result.sequence, true, bytes32(0), "");
        } catch (bytes memory reason) {
            result.failureHash = keccak256(reason);
            failureReason[entitlementId] = reason;
            emit DistributionResult(entitlementId, result.sequence, false, result.failureHash, reason);
        }
    }

    /// @dev The isolated self-call makes every transfer and balance check atomic while preserving
    ///      a durable recoverable failure in the outer transaction. The outer entrypoint holds the
    ///      reentrancy guard; this self-only function cannot enter through any other caller.
    function executeDistribution(bytes32 entitlementId) external {
        if (msg.sender != address(this)) revert SelfOnly();
        if (paused) revert ExecutionPaused();
        VoucherMessageCodec.Command memory command = VoucherMessageCodec.decodeCommand(_commands[entitlementId]);
        AssetAuthorization storage authorization = assetAuthorizations[command.issuer][command.token];
        if (!authorization.enabled || authorization.issuerAuthority != command.issuerAuthority) {
            revert AssetNotAuthorized();
        }
        IERC20 token = IERC20(command.token);
        uint256 allowance = token.allowance(command.issuer, address(this));
        if (allowance == type(uint256).max) revert UnlimitedAllowance();
        if (allowance < command.totalUnits) revert InsufficientAllowance();
        _transferExact(token, command);
        if (token.allowance(command.issuer, address(this)) != allowance - command.totalUnits) revert InexactTransfer();
    }

    function _transferExact(IERC20 token, VoucherMessageCodec.Command memory command) private {
        uint256 reserveBefore = token.balanceOf(command.issuer);
        uint256 reserveDebit = command.totalUnits;
        uint256[] memory balancesBefore = new uint256[](command.recipients.length);
        for (uint256 i; i < command.recipients.length; ++i) {
            balancesBefore[i] = token.balanceOf(command.recipients[i]);
            if (command.recipients[i] == command.issuer) reserveDebit -= command.amounts[i];
        }
        if (reserveBefore < reserveDebit) revert InsufficientReserve();
        for (uint256 i; i < command.recipients.length; ++i) {
            if (command.amounts[i] != 0) token.safeTransferFrom(command.issuer, command.recipients[i], command.amounts[i]);
        }
        uint256 reserveAfter = token.balanceOf(command.issuer);
        if (reserveAfter > reserveBefore || reserveBefore - reserveAfter != reserveDebit) revert InexactTransfer();
        _checkCredits(token, command, balancesBefore);
    }

    function _checkCredits(
        IERC20 token,
        VoucherMessageCodec.Command memory command,
        uint256[] memory balancesBefore
    )
        private
        view
    {
        for (uint256 i; i < command.recipients.length; ++i) {
            if (command.recipients[i] == command.issuer) continue;
            uint256 balanceAfter = token.balanceOf(command.recipients[i]);
            if (balanceAfter < balancesBefore[i] || balanceAfter - balancesBefore[i] != command.amounts[i]) {
                revert InexactTransfer();
            }
        }
    }

    function _tryAcknowledgment(bytes32 entitlementId) private {
        ExecutionResult storage result = _results[entitlementId];
        try this.sendAcknowledgment(entitlementId) returns (bytes32 messageId) {
            _recordAcknowledgment(entitlementId, messageId);
        } catch (bytes memory reason) {
            result.acknowledgmentFailureHash = keccak256(reason);
            emit AcknowledgmentFailed(entitlementId, result.sequence, reason);
        }
    }

    /// @dev Self-call isolates quoting/sending failure from the durable distribution result.
    function sendAcknowledgment(bytes32 entitlementId) external returns (bytes32) {
        if (msg.sender != address(this)) revert SelfOnly();
        return _send(_acknowledgmentPayload(entitlementId), _ACKNOWLEDGMENT_GAS_LIMIT);
    }

    function _recordAcknowledgment(bytes32 entitlementId, bytes32 messageId) private {
        ExecutionResult storage result = _results[entitlementId];
        result.acknowledgmentMessageId = messageId;
        result.acknowledgmentFailureHash = bytes32(0);
        result.acknowledgmentSequence = result.sequence;
        emit AcknowledgmentSent(entitlementId, result.sequence, messageId);
    }

    function _acknowledgmentPayload(bytes32 entitlementId) private view returns (bytes memory) {
        ExecutionResult storage result = _results[entitlementId];
        VoucherMessageCodec.Ack memory acknowledgment = VoucherMessageCodec.Ack({
            version: VoucherMessageCodec.VERSION,
            entitlementId: entitlementId,
            payloadHash: result.payloadHash,
            resultSequence: result.sequence,
            success: result.success,
            failureHash: result.failureHash
        });
        return VoucherMessageCodec.encodeAck(acknowledgment);
    }
}
