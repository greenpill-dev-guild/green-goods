// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IRouterClient } from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

import { CeloSettlementAdmin } from "./Admin.sol";

/// @title CeloSettlementAcknowledgments
/// @notice Caller-funded and sponsored acknowledgment retry plus the acknowledgment fee reserve.
abstract contract CeloSettlementAcknowledgments is CeloSettlementAdmin {
    function quoteAcknowledgmentFee(bytes32 executionKey) public view override returns (uint256) {
        ExecutionResult storage result = _knownResult(executionKey);
        return
            IRouterClient(CCIP_ROUTER).getFee(_sourcePeer.sourceChainSelector, _buildAcknowledgment(executionKey, result));
    }

    function retryAcknowledgment(bytes32 executionKey) external payable override nonReentrant returns (bytes32 messageId) {
        ExecutionResult storage result = _knownResult(executionKey);
        Client.EVM2AnyMessage memory acknowledgment = _buildAcknowledgment(executionKey, result);
        uint256 fee = IRouterClient(CCIP_ROUTER).getFee(_sourcePeer.sourceChainSelector, acknowledgment);
        if (msg.value != fee) revert IncorrectAcknowledgmentFee(fee, msg.value);
        messageId = IRouterClient(CCIP_ROUTER).ccipSend{ value: fee }(_sourcePeer.sourceChainSelector, acknowledgment);
        _recordAcknowledgment(executionKey, result, messageId, fee, false);
    }

    function retryAcknowledgmentSponsored(bytes32 executionKey)
        external
        override
        onlyOwner
        nonReentrant
        returns (bytes32 messageId)
    {
        ExecutionResult storage result = _knownResult(executionKey);
        return _trySendAcknowledgment(executionKey, result, true);
    }

    function fundAcknowledgmentFees() external payable override {
        emit AcknowledgmentFeeReserveFunded(msg.sender, msg.value);
    }

    function withdrawExcessAcknowledgmentFees(
        address payable recipient,
        uint256 amount
    )
        external
        override
        onlyOwner
        nonReentrant
    {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount > address(this).balance) {
            revert AcknowledgmentFeeReserveFloorViolated(acknowledgmentFeeReserveMinimum, 0);
        }
        uint256 remaining = address(this).balance - amount;
        if (remaining < acknowledgmentFeeReserveMinimum) {
            revert AcknowledgmentFeeReserveFloorViolated(acknowledgmentFeeReserveMinimum, remaining);
        }
        (bool success,) = recipient.call{ value: amount }("");
        if (!success) revert AcknowledgmentFeeReserveFloorViolated(acknowledgmentFeeReserveMinimum, remaining);
        emit ExcessAcknowledgmentFeesWithdrawn(recipient, amount);
    }
}
