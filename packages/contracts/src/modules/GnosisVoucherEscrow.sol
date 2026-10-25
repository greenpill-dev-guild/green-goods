// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { VoucherRedemptionCodec as Legacy } from "../libraries/VoucherRedemptionCodec.sol";
import { VoucherServiceCodec as Codec } from "../libraries/VoucherServiceCodec.sol";
import { VoucherServiceEscrowStorage as Store } from "../libraries/VoucherServiceEscrowStorage.sol";
import { VoucherRedemptionTransfers as Transfers } from "../libraries/VoucherRedemptionTransfers.sol";
import { VoucherFinalAllocationLib as FinalAllocation } from "../lib/VoucherService/VoucherFinalAllocationLib.sol";
import { VoucherRedemptionReceiver } from "./VoucherRedemptionReceiver.sol";

/// @notice Pre-acceptance voucher custody and one holder-approved immutable final financial split.
/// @dev Financial closure neither fulfills the existing service promise nor proves non-delivery.
contract GnosisVoucherEscrow is VoucherRedemptionReceiver {
    // Retain the previously exported transfer-error ABI across the linked-library boundary.
    error WrongVoucherIssuer();
    error InexactVoucherTransfer();
    error UnlimitedVoucherAllowance();
    error IssuerOnly();
    error InvalidRedemptionQuantity();
    error PendingRedemptionAction();
    error WrongActionNonce();
    error NoRetryableAction();
    error ExecutionPaused();
    error SetupNotActive();
    error SetupAlreadyDecided();
    error ConflictingFinalAllocation();
    error WrongFinalDecision();
    error VoucherCustodyDeficit();

    event RedemptionIssuerApproved(bytes32 indexed redemptionId, address indexed issuer, bytes32 indexed payloadHash);
    event VoucherPresented(bytes32 indexed redemptionId, address indexed holder, address indexed token, uint256 units);
    event RedemptionReturnAuthorized(bytes32 indexed redemptionId, address indexed issuer, uint256 cumulativeReturnCeiling);
    event HolderDeliveryApproved(
        bytes32 indexed redemptionId,
        address indexed holder,
        bytes32 indexed actionHash,
        uint256 newlyApprovedServiceUnits,
        uint256 cumulativeApprovedServiceUnits,
        uint256 voucherUnits,
        uint256 cumulativeApprovedVoucherUnits
    );
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
        Legacy.ActionKind kind,
        uint256 voucherUnits,
        uint256 serviceUnits,
        bool success,
        bytes32 failureHash,
        bytes reason
    );
    event VoucherSetupActionResult(
        bytes32 indexed setupId, Codec.SetupAction indexed action, bool success, bytes32 failureHash, bytes reason
    );
    event VoucherSetupHolderAbortRequested(bytes32 indexed setupId, address indexed holder, bytes32 indexed messageId);
    event FinalAllocationFrozen(
        bytes32 indexed setupId,
        bytes32 indexed decisionId,
        address indexed holder,
        bytes32 payloadHash,
        bytes32 activationDecisionId,
        uint256 approvedDeliveredServiceUnits,
        uint256 releaseVoucherUnits,
        uint256 refundVoucherUnits,
        uint256 issuerReturnApprovalAtFreeze
    );
    event FinalLegResult(
        bytes32 indexed setupId,
        bytes32 indexed decisionId,
        Codec.FinalLeg indexed leg,
        bytes32 legId,
        address recipient,
        uint256 voucherUnits,
        Codec.LegState state,
        uint64 attempts,
        bytes32 failureHash
    );
    event VoucherEscrowFinanciallyClosed(bytes32 indexed setupId, bytes32 indexed decisionId);

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

    // Deprecated v1 selectors cannot bypass setup, activation or final-allocation approval.
    function approveAuthorization(bytes32, bytes32) external pure {
        revert LegacyVoucherServiceDisabled();
    }

    function present(bytes32, bytes32, uint64) external pure {
        revert LegacyVoucherServiceDisabled();
    }

    function approveDelivered(bytes32, bytes32, uint64, uint256, uint256) external pure {
        revert LegacyVoucherServiceDisabled();
    }

    function returnUndelivered(bytes32, bytes32, uint64, uint256) external pure {
        revert LegacyVoucherServiceDisabled();
    }

    function retry(bytes32) external pure {
        revert LegacyVoucherServiceDisabled();
    }

    function executeAction(bytes32) external pure {
        revert LegacyVoucherServiceDisabled();
    }

    function approveSetupAuthorization(bytes32 id, bytes32 expectedPayloadHash) external nonReentrant {
        Store.Execution storage e = _expectedSetup(id, expectedPayloadHash);
        Codec.SetupAuthorization memory a = _setupAuthorization(id);
        if (msg.sender != a.issuer) revert IssuerOnly();
        if (e.result.decision != Codec.SetupDecision.None) revert SetupAlreadyDecided();
        if (e.result.issuerApproved) return;
        Transfers.requireIssuer(a.token, a.issuer);
        e.result.issuerApproved = true;
        emit RedemptionIssuerApproved(id, msg.sender, expectedPayloadHash);
        _changedSetup(id);
    }

    function presentSetup(bytes32 id, bytes32 expectedPayloadHash) external nonReentrant {
        Store.Execution storage e = _holderSetup(id, expectedPayloadHash);
        if (e.result.decision != Codec.SetupDecision.None) revert SetupAlreadyDecided();
        if (e.result.depositedUnits != 0) return;
        if (e.pendingAction != Codec.SetupAction.None) revert PendingRedemptionAction();
        e.pendingAction = Codec.SetupAction.Deposit;
        _attemptSetup(id);
    }

    function retrySetupAction(bytes32 id) external nonReentrant {
        if (_knownSetup(id).pendingAction == Codec.SetupAction.None) revert NoRetryableAction();
        _attemptSetup(id);
    }

    function _attemptSetup(bytes32 id) internal override {
        Store.Execution storage e = _knownSetup(id);
        Codec.SetupAction action = e.pendingAction;
        bytes memory reason;
        try this.executeSetupAction(id) {
            e.result.actionSucceeded = true;
            e.result.failureHash = bytes32(0);
            e.pendingAction = Codec.SetupAction.None;
            delete e.failureReason;
        } catch (bytes memory failure) {
            reason = failure;
            e.result.actionSucceeded = false;
            e.result.failureHash = keccak256(failure);
            e.failureReason = failure;
        }
        emit VoucherSetupActionResult(id, action, e.result.actionSucceeded, e.result.failureHash, reason);
        _changedSetup(id);
    }

    /// @dev Exact transfer and custody consumption revert together; caught failures remain retryable.
    function executeSetupAction(bytes32 id) external {
        if (msg.sender != address(this)) revert SelfOnly();
        if (paused) revert ExecutionPaused();
        Store.Execution storage e = _knownSetup(id);
        Codec.SetupAuthorization memory a = _setupAuthorization(id);
        if (e.pendingAction == Codec.SetupAction.Deposit) {
            if (e.result.decision != Codec.SetupDecision.None || e.result.depositedUnits != 0) {
                revert SetupAlreadyDecided();
            }
            Transfers.requireIssuer(a.token, a.issuer);
            Store.state().liabilities[a.token] += a.voucherUnits;
            Transfers.present(a.token, a.holder, a.voucherUnits);
            e.result.depositedUnits = a.voucherUnits;
            e.result.depositReceiptHash = Codec.depositReceiptHash(a);
            e.result.phase = Codec.SetupPhase.Deposited;
            emit VoucherPresented(id, a.holder, a.token, a.voucherUnits);
        } else if (e.pendingAction == Codec.SetupAction.AbortRefund) {
            if (e.result.decision != Codec.SetupDecision.Abort || e.result.setupRefundedUnits != 0) {
                revert SetupAlreadyDecided();
            }
            FinalAllocation.consumeLiability(a.token, e.result.depositedUnits);
            e.result.setupRefundedUnits = e.result.depositedUnits;
            e.result.phase = Codec.SetupPhase.Aborted;
            Transfers.release(a.token, a.holder, e.result.depositedUnits);
        } else {
            revert NoRetryableAction();
        }
    }

    function quoteSetupAbortRequest(bytes32 id) public view returns (uint256) {
        Codec.SetupAuthorization memory a = _setupAuthorization(id);
        return _quote(
            Codec.encodeHolderAbortRequest(Codec.HolderAbortRequest(Codec.VERSION, id, Codec.hash(a), a.holder)),
            ACKNOWLEDGMENT_GAS_LIMIT
        );
    }

    /// @notice Requests source arbitration against acceptance; never refunds from a Gnosis timeout.
    function requestSetupAbort(
        bytes32 id,
        bytes32 expectedPayloadHash
    )
        external
        payable
        nonReentrant
        returns (bytes32 messageId)
    {
        Store.Execution storage e = _expectedSetup(id, expectedPayloadHash);
        Codec.SetupAuthorization memory a = _setupAuthorization(id);
        if (msg.sender != a.holder) revert HolderOnly();
        if (e.result.decision != Codec.SetupDecision.None) revert SetupAlreadyDecided();
        uint256 fee = quoteSetupAbortRequest(id);
        if (msg.value != fee) revert IncorrectAcknowledgmentFee(fee, msg.value);
        messageId = _send(
            Codec.encodeHolderAbortRequest(Codec.HolderAbortRequest(Codec.VERSION, id, expectedPayloadHash, a.holder)),
            ACKNOWLEDGMENT_GAS_LIMIT
        );
        e.holderAbortRequested = true;
        emit VoucherSetupHolderAbortRequested(id, msg.sender, messageId);
    }

    /// @notice Mutual remedy permission only; it cannot move funds or revise a frozen allocation.
    function authorizeReturn(
        bytes32 id,
        bytes32 expectedPayloadHash,
        uint256 cumulativeReturnCeiling
    )
        external
        nonReentrant
    {
        Store.Execution storage e = _expectedSetup(id, expectedPayloadHash);
        Codec.SetupAuthorization memory a = _setupAuthorization(id);
        if (msg.sender != a.issuer) revert IssuerOnly();
        if (!e.result.issuerApproved) revert IssuerApprovalRequired();
        if (cumulativeReturnCeiling < e.issuerReturnCeiling || cumulativeReturnCeiling > a.voucherUnits) {
            revert InvalidRedemptionQuantity();
        }
        e.issuerReturnCeiling = cumulativeReturnCeiling;
        emit RedemptionReturnAuthorized(id, msg.sender, cumulativeReturnCeiling);
    }

    /// @notice Freeze the complete split without transferring vouchers or fulfilling the core promise.
    function finalizeAllocation(
        bytes32 id,
        bytes32 expectedPayloadHash,
        Codec.FinalAllocation calldata allocation
    )
        external
        nonReentrant
        returns (bytes32 decisionId)
    {
        Store.Execution storage e = _holderSetup(id, expectedPayloadHash);
        bool changed;
        (decisionId, changed) = FinalAllocation.freeze(e, _setupAuthorization(id), allocation, paused);
        if (changed) {
            emit FinalAllocationFrozen(
                id,
                decisionId,
                msg.sender,
                expectedPayloadHash,
                e.finalAllocation.activationDecisionId,
                allocation.approvedDeliveredServiceUnits,
                allocation.releaseVoucherUnits,
                allocation.refundVoucherUnits,
                e.issuerReturnCeiling
            );
            _changedFinal(id);
        }
    }

    function executeFinalLeg(bytes32 id, bytes32 expectedDecisionId, Codec.FinalLeg leg) external nonReentrant {
        Store.Execution storage e = _knownSetup(id);
        Codec.FinalAllocationRecord storage f = e.finalAllocation;
        if (f.decisionId == bytes32(0) || f.decisionId != expectedDecisionId) revert WrongFinalDecision();
        Codec.LegProgress storage progress = leg == Codec.FinalLeg.ReleaseToIssuer ? f.release : f.refund;
        if (progress.state == Codec.LegState.NotRequired || progress.state == Codec.LegState.Succeeded) return;
        ++progress.attempts;
        try this.executeStoredFinalLeg(id, leg) {
            progress.failureHash = bytes32(0);
        } catch (bytes memory reason) {
            progress.state = Codec.LegState.Failed;
            progress.failureHash = keccak256(reason);
        }
        Codec.SetupAuthorization memory a = _setupAuthorization(id);
        uint256 units =
            leg == Codec.FinalLeg.ReleaseToIssuer ? f.allocation.releaseVoucherUnits : f.allocation.refundVoucherUnits;
        emit FinalLegResult(
            id,
            f.decisionId,
            leg,
            Codec.legId(a, f.decisionId, leg, units),
            leg == Codec.FinalLeg.ReleaseToIssuer ? a.issuer : a.holder,
            units,
            progress.state,
            progress.attempts,
            progress.failureHash
        );
        if (FinalAllocation.closed(f)) emit VoucherEscrowFinanciallyClosed(id, f.decisionId);
        _changedFinal(id);
    }

    function executeStoredFinalLeg(bytes32 id, Codec.FinalLeg leg) external {
        if (msg.sender != address(this)) revert SelfOnly();
        if (paused) revert ExecutionPaused();
        _knownSetup(id);
        FinalAllocation.executeLeg(id, leg);
    }

    function getFinalAllocation(bytes32 id) external view returns (Codec.FinalAllocationRecord memory) {
        return Store.state().executions[id].finalAllocation;
    }

    function isFinanciallyClosed(bytes32 id) external view returns (bool) {
        return FinalAllocation.closed(Store.state().executions[id].finalAllocation);
    }

    function _changedFinal(bytes32 id) private {
        ++Store.state().executions[id].finalSequence;
        _tryAcknowledgment(id, true);
    }

    function _holderSetup(bytes32 id, bytes32 payloadHash) private view returns (Store.Execution storage e) {
        e = _expectedSetup(id, payloadHash);
        if (msg.sender != _setupAuthorization(id).holder) revert HolderOnly();
        if (!e.result.issuerApproved) revert IssuerApprovalRequired();
    }
}
