// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { VoucherRedemptionTransfers as Transfers } from "../../libraries/VoucherRedemptionTransfers.sol";
import { VoucherServiceCodec as Codec } from "../../libraries/VoucherServiceCodec.sol";
import { VoucherServiceEscrowStorage as Store } from "../../libraries/VoucherServiceEscrowStorage.sol";

/// @notice Final allocation conservation, immutable freeze and exact custody-liability consumption.
/// @dev The endpoint owns caller, holder, self-call, pause and acknowledgment orchestration. Internal
///      functions own final-leg transfers and liability rollback in its existing namespace, without new links or state.
library VoucherFinalAllocationLib {
    function freeze(
        Store.Execution storage e,
        Codec.SetupAuthorization memory a,
        Codec.FinalAllocation calldata allocation,
        bool paused
    )
        internal
        returns (bytes32 decisionId, bool changed)
    {
        Codec.FinalAllocationRecord storage f = e.finalAllocation;
        if (f.decisionId != bytes32(0)) {
            if (keccak256(abi.encode(f.allocation)) != keccak256(abi.encode(allocation))) {
                _fail(bytes4(keccak256("ConflictingFinalAllocation()")));
            }
            return (f.decisionId, false);
        }
        if (paused) _fail(bytes4(keccak256("ExecutionPaused()")));
        if (e.result.phase != Codec.SetupPhase.Active || e.result.decision != Codec.SetupDecision.Activate) {
            _fail(bytes4(keccak256("SetupNotActive()")));
        }
        if (
            e.result.depositedUnits != a.voucherUnits || allocation.releaseVoucherUnits > a.voucherUnits
                || allocation.refundVoucherUnits != a.voucherUnits - allocation.releaseVoucherUnits
                || allocation.approvedDeliveredServiceUnits > a.serviceUnits
                || (allocation.releaseVoucherUnits != 0 && allocation.approvedDeliveredServiceUnits == 0)
                || allocation.refundVoucherUnits > e.issuerReturnCeiling
        ) _fail(bytes4(keccak256("InvalidRedemptionQuantity()")));
        decisionId = Codec.finalDecisionId(a, e.result.appliedDecisionId, allocation, e.issuerReturnCeiling);
        f.decisionId = decisionId;
        f.activationDecisionId = e.result.appliedDecisionId;
        f.issuerReturnApprovalAtFreeze = e.issuerReturnCeiling;
        f.allocation = allocation;
        f.release.state = allocation.releaseVoucherUnits == 0 ? Codec.LegState.NotRequired : Codec.LegState.Pending;
        f.refund.state = allocation.refundVoucherUnits == 0 ? Codec.LegState.NotRequired : Codec.LegState.Pending;
        return (decisionId, true);
    }

    function closed(Codec.FinalAllocationRecord storage f) internal view returns (bool) {
        return f.decisionId != bytes32(0)
            && (f.release.state == Codec.LegState.Succeeded || f.release.state == Codec.LegState.NotRequired)
            && (f.refund.state == Codec.LegState.Succeeded || f.refund.state == Codec.LegState.NotRequired);
    }

    function consumeLiability(address token, uint256 units) internal {
        Store.State storage s = Store.state();
        if (IERC20(token).balanceOf(address(this)) < s.liabilities[token]) {
            _fail(bytes4(keccak256("VoucherCustodyDeficit()")));
        }
        s.liabilities[token] -= units;
    }

    function executeLeg(bytes32 id, Codec.FinalLeg leg) internal {
        Store.Execution storage e = Store.state().executions[id];
        Codec.FinalAllocationRecord storage f = e.finalAllocation;
        if (e.result.phase != Codec.SetupPhase.Active || f.decisionId == bytes32(0)) {
            _fail(bytes4(keccak256("SetupNotActive()")));
        }
        Codec.LegProgress storage progress = leg == Codec.FinalLeg.ReleaseToIssuer ? f.release : f.refund;
        if (progress.state != Codec.LegState.Pending && progress.state != Codec.LegState.Failed) {
            _fail(bytes4(keccak256("NoRetryableAction()")));
        }
        Codec.SetupAuthorization memory a = Codec.decodeAuthorization(e.authorization);
        uint256 units =
            leg == Codec.FinalLeg.ReleaseToIssuer ? f.allocation.releaseVoucherUnits : f.allocation.refundVoucherUnits;
        consumeLiability(a.token, units);
        progress.state = Codec.LegState.Succeeded;
        progress.failureHash = bytes32(0);
        Transfers.release(a.token, leg == Codec.FinalLeg.ReleaseToIssuer ? a.issuer : a.holder, units);
    }

    // Keep concrete qualified error references and ABI metadata while reverting their exact selectors.
    function _fail(bytes4 selector) private pure {
        assembly ("memory-safe") {
            mstore(0, selector)
            revert(0, 4)
        }
    }
}
