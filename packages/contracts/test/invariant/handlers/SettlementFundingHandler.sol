// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ISettlementModule } from "../../../src/interfaces/ISettlementModule.sol";
import { SettlementMessageCodec } from "../../../src/libraries/SettlementMessageCodec.sol";

interface ISettlementFundingRouter {
    function deliver(
        address receiver,
        bytes32 messageId,
        uint64 sourceSelector,
        address sender,
        bytes calldata data
    )
        external;
}

/// @title SettlementFundingHandler
/// @notice Drives one deposited refund obligation through arbitrary retry and cancellation order.
/// @dev Expected reverts are swallowed so invariant campaigns explore every reachable ordering.
contract SettlementFundingHandler {
    ISettlementModule private immutable settlement;
    ISettlementFundingRouter private immutable router;
    uint256 public immutable fundingId;
    address private immutable executor;

    uint256 public firstRefundDisbursementId;
    bool public replacementObserved;
    uint256 public queuedCount;
    uint256 public failedCount;
    uint256 public requeuedCount;
    uint256 public refundedCount;

    constructor(address settlement_, address router_, uint256 fundingId_, address executor_) {
        settlement = ISettlementModule(settlement_);
        router = ISettlementFundingRouter(router_);
        fundingId = fundingId_;
        executor = executor_;
    }

    function queueRefund() public {
        try settlement.queueFundingRefund(fundingId) returns (uint256 disbursementId) {
            if (disbursementId == 0) return;
            if (firstRefundDisbursementId == 0) firstRefundDisbursementId = disbursementId;
            else if (disbursementId != firstRefundDisbursementId) replacementObserved = true;
            queuedCount++;
        } catch { }
    }

    function cancelRefund() external {
        queueRefund();
        uint256 disbursementId = firstRefundDisbursementId;
        if (disbursementId == 0) return;
        try settlement.cancelDisbursement(disbursementId, "bafy-invariant-refund-cancel") { } catch { }
    }

    function dispatchAndFailRefund() external {
        queueRefund();
        uint256 disbursementId = firstRefundDisbursementId;
        if (disbursementId == 0) return;

        try settlement.dispatchDisbursement(disbursementId) returns (bytes32 commandMessageId) {
            ISettlementModule.Disbursement memory child = settlement.getDisbursement(disbursementId);
            router.deliver(
                address(settlement),
                keccak256(abi.encode("invariant-refund-failure", commandMessageId)),
                1,
                executor,
                SettlementMessageCodec.encodeAcknowledgment(
                    1, child.executionKey, commandMessageId, false, uint8(ISettlementModule.FailureCode.RouteReverted)
                )
            );
            failedCount++;
        } catch { }
    }

    function requeueRefund() external {
        uint256 disbursementId = firstRefundDisbursementId;
        if (disbursementId == 0) return;
        try settlement.requeue(disbursementId) {
            requeuedCount++;
        } catch { }
    }

    function dispatchAndSucceedRefund() external {
        queueRefund();
        uint256 disbursementId = firstRefundDisbursementId;
        if (disbursementId == 0) return;

        try settlement.dispatchDisbursement(disbursementId) returns (bytes32 commandMessageId) {
            ISettlementModule.Disbursement memory child = settlement.getDisbursement(disbursementId);
            router.deliver(
                address(settlement),
                keccak256(abi.encode("invariant-refund-success", commandMessageId)),
                1,
                executor,
                SettlementMessageCodec.encodeAcknowledgment(
                    1, child.executionKey, commandMessageId, true, uint8(ISettlementModule.FailureCode.None)
                )
            );
            refundedCount++;
        } catch { }
    }
}
