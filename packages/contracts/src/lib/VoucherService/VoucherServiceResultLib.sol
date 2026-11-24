// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { VoucherServiceCodec as Codec } from "../../libraries/VoucherServiceCodec.sol";

/// @notice Authenticated cumulative ledger checks, separate from transport replay and service truth.
library VoucherServiceResultLib {
    function validateSetup(
        Codec.SetupResult memory r,
        Codec.SetupAuthorization memory a,
        Codec.SetupDecision decision,
        bytes32 decisionId
    )
        public
        pure
    {
        if (
            r.setupId != Codec.setupId(a) || r.authorizationHash != Codec.hash(a) || r.resultSequence == 0
                || r.phase == Codec.SetupPhase.None || r.actionSucceeded != (r.failureHash == bytes32(0))
                || (r.depositedUnits != 0 && r.depositedUnits != a.voucherUnits)
                || (r.setupRefundedUnits != 0 && r.setupRefundedUnits != r.depositedUnits)
        ) _invalid();
        _depositLedger(r, a);
        _decision(r, decision, decisionId);
        _phase(r, a.voucherUnits);
    }

    function _depositLedger(Codec.SetupResult memory r, Codec.SetupAuthorization memory a) private pure {
        if (r.depositedUnits == 0) {
            if (r.depositReceiptHash != bytes32(0) || r.setupRefundedUnits != 0) _invalid();
        } else if (!r.issuerApproved || r.depositReceiptHash != Codec.depositReceiptHash(a)) {
            _invalid();
        }
    }

    function _decision(Codec.SetupResult memory r, Codec.SetupDecision decision, bytes32 decisionId) private pure {
        if (r.decision == Codec.SetupDecision.None) {
            if (r.appliedDecisionId != bytes32(0) || r.setupRefundedUnits != 0) _invalid();
        } else if (r.decision != decision || r.appliedDecisionId != decisionId || decisionId == bytes32(0)) {
            _invalid();
        }
    }

    function _phase(Codec.SetupResult memory r, uint256 voucherUnits) private pure {
        if (r.phase == Codec.SetupPhase.Authorized) {
            if (r.depositedUnits != 0 || r.decision != Codec.SetupDecision.None) _invalid();
        } else if (r.phase == Codec.SetupPhase.Deposited || r.phase == Codec.SetupPhase.Active) {
            Codec.SetupDecision expected =
                r.phase == Codec.SetupPhase.Active ? Codec.SetupDecision.Activate : Codec.SetupDecision.None;
            if (
                r.depositedUnits != voucherUnits || r.decision != expected || r.setupRefundedUnits != 0
                    || !r.actionSucceeded
            ) _invalid();
        } else {
            if (r.decision != Codec.SetupDecision.Abort) _invalid();
            if (r.phase == Codec.SetupPhase.Aborted && (r.setupRefundedUnits != r.depositedUnits || !r.actionSucceeded)) {
                _invalid();
            }
            if (
                r.phase == Codec.SetupPhase.AbortRefundPending
                    && (r.setupRefundedUnits != 0 || r.depositedUnits != voucherUnits || r.actionSucceeded)
            ) _invalid();
        }
    }

    function setupProgress(Codec.SetupResult memory previous, Codec.SetupResult memory next) public pure {
        if (previous.resultSequence == 0) return;
        if (
            next.phase < previous.phase || next.depositedUnits < previous.depositedUnits
                || next.setupRefundedUnits < previous.setupRefundedUnits
                || (previous.issuerApproved && !next.issuerApproved)
                || (previous.decision != Codec.SetupDecision.None && next.decision != previous.decision)
                || (previous.depositReceiptHash != bytes32(0) && next.depositReceiptHash != previous.depositReceiptHash)
                || (previous.appliedDecisionId != bytes32(0) && next.appliedDecisionId != previous.appliedDecisionId)
        ) _invalid();
    }

    function validateFinal(
        Codec.FinalResultV2 memory r,
        Codec.SetupAuthorization memory a,
        bytes32 activationDecisionId
    )
        public
        pure
    {
        Codec.FinalAllocation memory allocation = r.allocation;
        if (
            r.setupId != Codec.setupId(a) || r.payloadHash != Codec.hash(a) || r.sequence == 0
                || r.activationDecisionId != activationDecisionId || activationDecisionId == bytes32(0)
                || r.issuerReturnApprovalAtFreeze > a.voucherUnits || allocation.releaseVoucherUnits > a.voucherUnits
                || allocation.refundVoucherUnits != a.voucherUnits - allocation.releaseVoucherUnits
                || allocation.refundVoucherUnits > r.issuerReturnApprovalAtFreeze
                || allocation.approvedDeliveredServiceUnits > a.serviceUnits
                || (allocation.releaseVoucherUnits != 0 && allocation.approvedDeliveredServiceUnits == 0)
                || r.decisionId
                    != Codec.finalDecisionId(a, activationDecisionId, allocation, r.issuerReturnApprovalAtFreeze)
        ) {
            _invalid();
        }
        _validateLeg(r.release, allocation.releaseVoucherUnits);
        _validateLeg(r.refund, allocation.refundVoucherUnits);
    }

    function finalProgress(Codec.FinalResultV2 memory previous, Codec.FinalResultV2 memory next) public pure {
        if (previous.sequence == 0) return;
        if (
            previous.decisionId != next.decisionId || previous.activationDecisionId != next.activationDecisionId
                || previous.issuerReturnApprovalAtFreeze != next.issuerReturnApprovalAtFreeze
                || keccak256(abi.encode(previous.allocation)) != keccak256(abi.encode(next.allocation))
        ) _invalid();
        _legProgress(previous.release, next.release);
        _legProgress(previous.refund, next.refund);
    }

    function _validateLeg(Codec.LegProgress memory leg, uint256 units) private pure {
        if (units == 0) {
            if (leg.state != Codec.LegState.NotRequired || leg.attempts != 0 || leg.failureHash != bytes32(0)) _invalid();
        } else if (leg.state == Codec.LegState.NotRequired) {
            _invalid();
        } else if (leg.state == Codec.LegState.Pending) {
            if (leg.attempts != 0 || leg.failureHash != bytes32(0)) _invalid();
        } else if (leg.attempts == 0 || (leg.state == Codec.LegState.Failed) != (leg.failureHash != bytes32(0))) {
            _invalid();
        }
    }

    function _legProgress(Codec.LegProgress memory previous, Codec.LegProgress memory next) private pure {
        if (
            next.attempts < previous.attempts
                || (previous.state == Codec.LegState.Succeeded
                    && (next.state != Codec.LegState.Succeeded || next.attempts != previous.attempts))
                || (previous.state == Codec.LegState.NotRequired && next.state != Codec.LegState.NotRequired)
                || (previous.state == Codec.LegState.Failed && next.state == Codec.LegState.Pending)
        ) _invalid();
        if (next.attempts == previous.attempts && keccak256(abi.encode(next)) != keccak256(abi.encode(previous))) {
            _invalid();
        }
    }

    function _invalid() private pure {
        revert Codec.InvalidVoucherServiceResult();
    }
}
