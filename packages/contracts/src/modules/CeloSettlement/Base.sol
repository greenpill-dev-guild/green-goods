// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IRouterClient } from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

import { IGoodDollarToken } from "../../interfaces/IZodiacRoles.sol";
import { SettlementMessageCodec } from "../../libraries/SettlementMessageCodec.sol";
import { CeloSettlementStorage } from "./Storage.sol";

/// @title CeloSettlementBase
/// @notice Shared guards, token probes, period accounting, and the acknowledgment send path.
abstract contract CeloSettlementBase is CeloSettlementStorage {
    function _requirePaused() internal view {
        if (!paused) revert ExecutorMustBePaused();
    }

    function _knownResult(bytes32 executionKey) internal view returns (ExecutionResult storage result) {
        result = _executionResults[executionKey];
        if (result.status == ResultStatus.None) revert UnknownExecutionKey(executionKey);
    }

    function _feeQuote(
        uint256 amount,
        address sender,
        address recipient
    )
        internal
        view
        returns (bool success, uint256 fee, bool senderPays)
    {
        bytes memory data;
        (success, data) = G_DOLLAR_TOKEN.staticcall(abi.encodeCall(IGoodDollarToken.getFees, (amount, sender, recipient)));
        if (!success || data.length != 64) return (false, 0, false);
        (fee, senderPays) = abi.decode(data, (uint256, bool));
    }

    function _tokenBalance(address account) internal view returns (bool success, uint256 balance) {
        bytes memory data;
        (success, data) = G_DOLLAR_TOKEN.staticcall(abi.encodeCall(IGoodDollarToken.balanceOf, (account)));
        if (!success || data.length != 32) return (false, 0);
        balance = abi.decode(data, (uint256));
    }

    function _withinPeriodicCap(address garden, uint256 amount) internal view returns (bool) {
        if (periodDuration == 0 || maxPeriodAmount == 0) return false;
        GardenPeriodSpend memory spend = _gardenPeriodSpends[garden];
        uint256 current = spend.periodStartedAt == 0 || block.timestamp >= uint256(spend.periodStartedAt) + periodDuration
            ? 0
            : spend.amount;
        return current + amount <= maxPeriodAmount;
    }

    function _recordPeriodSpend(address garden, uint256 amount) internal {
        GardenPeriodSpend storage spend = _gardenPeriodSpends[garden];
        if (spend.periodStartedAt == 0 || block.timestamp >= uint256(spend.periodStartedAt) + periodDuration) {
            spend.periodStartedAt = uint64(block.timestamp);
            spend.amount = amount;
        } else {
            spend.amount += amount;
        }
    }

    function _trySendAcknowledgment(
        bytes32 executionKey,
        ExecutionResult storage result,
        bool reserveFunded
    )
        internal
        returns (bytes32 messageId)
    {
        Client.EVM2AnyMessage memory acknowledgment = _buildAcknowledgment(executionKey, result);
        uint256 fee;
        try IRouterClient(CCIP_ROUTER).getFee(_sourcePeer.sourceChainSelector, acknowledgment) returns (uint256 quoted) {
            fee = quoted;
        } catch {
            _deferAcknowledgment(executionKey, result, AcknowledgmentDeferralCode.QuoteFailed);
            return bytes32(0);
        }
        if (address(this).balance < fee + acknowledgmentFeeReserveMinimum) {
            _deferAcknowledgment(executionKey, result, AcknowledgmentDeferralCode.FeeReserveLow);
            return bytes32(0);
        }
        try IRouterClient(CCIP_ROUTER).ccipSend{ value: fee }(_sourcePeer.sourceChainSelector, acknowledgment) returns (
            bytes32 sentMessageId
        ) {
            messageId = sentMessageId;
            _recordAcknowledgment(executionKey, result, messageId, fee, reserveFunded);
        } catch {
            _deferAcknowledgment(executionKey, result, AcknowledgmentDeferralCode.SendFailed);
        }
    }

    function _recordAcknowledgment(
        bytes32 executionKey,
        ExecutionResult storage result,
        bytes32 messageId,
        uint256 fee,
        bool reserveFunded
    )
        internal
    {
        result.acknowledgmentMessageId = messageId;
        result.acknowledgmentSent = true;
        result.acknowledgmentDeferralCode = AcknowledgmentDeferralCode.None;
        emit AcknowledgmentSent(executionKey, result.commandMessageId, messageId, fee, reserveFunded);
    }

    function _deferAcknowledgment(
        bytes32 executionKey,
        ExecutionResult storage result,
        AcknowledgmentDeferralCode reasonCode
    )
        internal
    {
        result.acknowledgmentDeferralCode = reasonCode;
        emit AcknowledgmentDeferred(executionKey, result.commandMessageId, reasonCode);
    }

    function _buildAcknowledgment(
        bytes32 executionKey,
        ExecutionResult storage result
    )
        internal
        view
        returns (Client.EVM2AnyMessage memory)
    {
        Client.EVMTokenAmount[] memory noTokens = new Client.EVMTokenAmount[](0);
        return Client.EVM2AnyMessage({
            receiver: abi.encode(result.acknowledgmentReceiver),
            data: SettlementMessageCodec.encodeAcknowledgment(
                result.protocolVersion,
                executionKey,
                result.commandMessageId,
                result.status == ResultStatus.Success,
                uint8(result.failureCode)
            ),
            tokenAmounts: noTokens,
            feeToken: address(0),
            extraArgs: Client._argsToBytes(Client.EVMExtraArgsV1({ gasLimit: _ACKNOWLEDGMENT_GAS_LIMIT }))
        });
    }
}
