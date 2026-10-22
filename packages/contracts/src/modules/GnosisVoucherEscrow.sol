// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { VoucherRedemptionCodec as Codec } from "../libraries/VoucherRedemptionCodec.sol";
import { VoucherRedemptionTransfers as Transfers } from "../libraries/VoucherRedemptionTransfers.sol";
import { VoucherRedemptionReceiver } from "./VoucherRedemptionReceiver.sol";

/// @notice Gnosis voucher custody, explicit holder service approvals and mutual financial returns.
/// @dev Closed escrow allocation never resolves or replaces the existing core service promise.
contract GnosisVoucherEscrow is VoucherRedemptionReceiver {
    error IssuerOnly();
    error InvalidRedemptionQuantity();
    error PendingRedemptionAction();
    error WrongActionNonce();
    error NoRetryableAction();
    error ExecutionPaused();

    event RedemptionIssuerApproved(bytes32 indexed redemptionId, address indexed issuer, bytes32 indexed payloadHash);
    event VoucherPresented(bytes32 indexed redemptionId, address indexed holder, address indexed token, uint256 units);
    event HolderDeliveryApproved(
        bytes32 indexed redemptionId,
        address indexed holder,
        bytes32 indexed actionHash,
        uint256 newlyApprovedServiceUnits,
        uint256 cumulativeApprovedServiceUnits,
        uint256 voucherUnits,
        uint256 cumulativeApprovedVoucherUnits
    );
    event RedemptionReturnAuthorized(bytes32 indexed redemptionId, address indexed issuer, uint256 cumulativeReturnCeiling);
    event HolderReturnApproved(
        bytes32 indexed redemptionId,
        address indexed holder,
        bytes32 indexed actionHash,
        uint256 units,
        uint256 cumulativeReturnUnits
    );
    event RedemptionActionResult(
        bytes32 indexed redemptionId,
        bytes32 indexed actionHash,
        uint64 indexed sequence,
        Codec.ActionKind kind,
        uint256 voucherUnits,
        uint256 serviceUnits,
        bool success,
        bytes32 failureHash,
        bytes reason
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address router_) VoucherRedemptionReceiver(router_) { }

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

    function approveAuthorization(bytes32 id, bytes32 expectedPayloadHash) external nonReentrant {
        Execution storage execution = _expected(id, expectedPayloadHash);
        Codec.Authorization memory authorization = _authorization(id);
        if (msg.sender != authorization.issuer) revert IssuerOnly();
        if (execution.current.issuerApproved) return;
        Transfers.requireIssuer(authorization.token, authorization.issuer);
        execution.current.issuerApproved = true;
        ++execution.current.resultSequence;
        emit RedemptionIssuerApproved(id, msg.sender, expectedPayloadHash);
    }

    function present(bytes32 id, bytes32 expectedPayloadHash, uint64 expectedActionNonce) external nonReentrant {
        Execution storage execution = _holder(id, expectedPayloadHash);
        Codec.Authorization memory authorization = _authorization(id);
        if (execution.current.escrowedUnits != 0) revert InvalidRedemptionQuantity();
        Transfers.requireIssuer(authorization.token, authorization.issuer);
        _begin(id, expectedActionNonce, Codec.ActionKind.Present, authorization.totalVoucherUnits, 0);
        _attempt(id);
    }

    /// @notice Explicit cumulative service approval and additional vouchers, without a conversion formula.
    function approveDelivered(
        bytes32 id,
        bytes32 expectedPayloadHash,
        uint64 expectedActionNonce,
        uint256 cumulativeDeliveredServiceUnits,
        uint256 voucherUnits
    )
        external
        nonReentrant
    {
        Codec.Result storage result = _holder(id, expectedPayloadHash).current;
        if (
            cumulativeDeliveredServiceUnits == 0 || cumulativeDeliveredServiceUnits < result.holderApprovedServiceUnits
                || cumulativeDeliveredServiceUnits > _authorization(id).totalServiceUnits
        ) revert InvalidRedemptionQuantity();
        _requireAvailable(result, voucherUnits);
        uint256 serviceDelta = cumulativeDeliveredServiceUnits - result.holderApprovedServiceUnits;
        result.holderApprovedServiceUnits = cumulativeDeliveredServiceUnits;
        result.holderApprovedVoucherUnits += voucherUnits;
        _begin(id, expectedActionNonce, Codec.ActionKind.Release, voucherUnits, serviceDelta);
        emit HolderDeliveryApproved(
            id,
            msg.sender,
            result.actionHash,
            serviceDelta,
            cumulativeDeliveredServiceUnits,
            voucherUnits,
            result.holderApprovedVoucherUnits
        );
        _attempt(id);
    }

    /// @notice Permission only: the reserve cannot force a return or reserve unapproved units.
    function authorizeReturn(
        bytes32 id,
        bytes32 expectedPayloadHash,
        uint256 cumulativeReturnCeiling
    )
        external
        nonReentrant
    {
        Execution storage execution = _expected(id, expectedPayloadHash);
        Codec.Authorization memory authorization = _authorization(id);
        if (msg.sender != authorization.issuer) revert IssuerOnly();
        if (!execution.current.issuerApproved) revert IssuerApprovalRequired();
        if (
            cumulativeReturnCeiling < execution.current.issuerReturnCeiling
                || cumulativeReturnCeiling > authorization.totalVoucherUnits
        ) revert InvalidRedemptionQuantity();
        if (cumulativeReturnCeiling == execution.current.issuerReturnCeiling) return;
        if (execution.current.releasedUnits + execution.current.returnedUnits == authorization.totalVoucherUnits) {
            revert InvalidRedemptionQuantity();
        }
        execution.current.issuerReturnCeiling = cumulativeReturnCeiling;
        ++execution.current.resultSequence;
        emit RedemptionReturnAuthorized(id, msg.sender, cumulativeReturnCeiling);
    }

    function returnUndelivered(
        bytes32 id,
        bytes32 expectedPayloadHash,
        uint64 expectedActionNonce,
        uint256 units
    )
        external
        nonReentrant
    {
        Codec.Result storage result = _holder(id, expectedPayloadHash).current;
        _requireAvailable(result, units);
        if (units > result.issuerReturnCeiling - result.mutualReturnUnits) revert InvalidRedemptionQuantity();
        result.mutualReturnUnits += units;
        _begin(id, expectedActionNonce, Codec.ActionKind.Return, units, 0);
        emit HolderReturnApproved(id, msg.sender, result.actionHash, units, result.mutualReturnUnits);
        _attempt(id);
    }

    function retry(bytes32 id) external nonReentrant {
        _known(id);
        if (_pendingActions[id].nonce == 0) revert NoRetryableAction();
        _attempt(id);
    }

    function _begin(bytes32 id, uint64 nonce, Codec.ActionKind kind, uint256 voucherUnits, uint256 serviceUnits) private {
        Codec.Result storage result = _results[id].current;
        if (_pendingActions[id].nonce != 0) revert PendingRedemptionAction();
        if (nonce != result.actionNonce + 1) revert WrongActionNonce();
        bytes32 actionHash = Codec.actionHash(
            id,
            result.payloadHash,
            nonce,
            kind,
            voucherUnits,
            serviceUnits,
            result.holderApprovedServiceUnits,
            result.holderApprovedVoucherUnits,
            result.mutualReturnUnits
        );
        _pendingActions[id] = PendingAction(nonce, kind, voucherUnits, serviceUnits, actionHash);
        result.actionNonce = nonce;
        result.actionHash = actionHash;
        result.actionKind = kind;
        result.actionVoucherUnits = voucherUnits;
        result.actionServiceUnits = serviceUnits;
    }

    function _attempt(bytes32 id) private {
        Execution storage execution = _results[id];
        Codec.Result storage result = execution.current;
        ++result.resultSequence;
        execution.acknowledgmentFailureHash = bytes32(0);
        bytes memory reason;
        try this.executeAction(id) {
            result.actionSucceeded = true;
            result.failureHash = bytes32(0);
            delete _pendingActions[id];
            delete failureReason[id];
        } catch (bytes memory failure) {
            reason = failure;
            result.actionSucceeded = false;
            result.failureHash = keccak256(failure);
            failureReason[id] = failure;
        }
        emit RedemptionActionResult(
            id,
            result.actionHash,
            result.resultSequence,
            result.actionKind,
            result.actionVoucherUnits,
            result.actionServiceUnits,
            result.actionSucceeded,
            result.failureHash,
            reason
        );
    }

    /// @dev All transfers and successful execution counters share one reverting self-call.
    function executeAction(bytes32 id) external {
        if (msg.sender != address(this)) revert SelfOnly();
        if (paused) revert ExecutionPaused();
        PendingAction storage action = _pendingActions[id];
        Codec.Authorization memory authorization = _authorization(id);
        Codec.Result storage result = _results[id].current;
        if (action.kind == Codec.ActionKind.Present) {
            Transfers.requireIssuer(authorization.token, authorization.issuer);
            Transfers.present(authorization.token, authorization.holder, action.voucherUnits);
            result.escrowedUnits = action.voucherUnits;
            emit VoucherPresented(id, authorization.holder, authorization.token, action.voucherUnits);
        } else if (action.kind == Codec.ActionKind.Release) {
            Transfers.release(authorization.token, authorization.issuer, action.voucherUnits);
            result.releasedUnits += action.voucherUnits;
        } else if (action.kind == Codec.ActionKind.Return) {
            Transfers.release(authorization.token, authorization.holder, action.voucherUnits);
            result.returnedUnits += action.voucherUnits;
        } else {
            revert NoRetryableAction();
        }
    }

    function _requireAvailable(Codec.Result storage result, uint256 units) private view {
        if (
            units == 0 || result.escrowedUnits == 0
                || units > result.escrowedUnits - result.holderApprovedVoucherUnits - result.mutualReturnUnits
        ) {
            revert InvalidRedemptionQuantity();
        }
    }
}
