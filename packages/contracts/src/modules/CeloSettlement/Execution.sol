// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";

import { IZodiacRoles, SafeOperation } from "../../interfaces/IZodiacRoles.sol";
import { SettlementMessageCodec } from "../../libraries/SettlementMessageCodec.sol";
import { CeloSettlementAcknowledgments } from "./Acknowledgments.sol";

/// @title CeloSettlementExecution
/// @notice Authenticated CCIP command execution through bounded Zodiac Roles.
abstract contract CeloSettlementExecution is CeloSettlementAcknowledgments {
    bytes4 internal constant _ROLE_REJECTED_SELECTOR = bytes4(keccak256("RoleExecutionRejected()"));
    bytes4 internal constant _BALANCE_DELTA_SELECTOR = bytes4(keccak256("BalanceDeltaMismatch()"));

    error RoleExecutionRejected();
    error BalanceDeltaMismatch();

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override nonReentrant {
        (address acknowledgmentReceiver, uint8 protocolVersion) = _authenticate(message);
        SettlementMessageCodec.Command memory command;
        try this.decodeSettlementCommand(message.data) returns (SettlementMessageCodec.Command memory decoded) {
            command = decoded;
        } catch {
            revert MalformedSettlementCommand();
        }
        if (command.version != protocolVersion) revert UnsupportedMessageVersion();
        if (
            command.disbursementKind != _CONTRIBUTOR_CONSIDERATION && command.disbursementKind != _FUNDING
                && command.disbursementKind != _LOAN_PRINCIPAL && command.disbursementKind != _GARDEN_BENEFICIARY
                && command.disbursementKind != _REFUND
        ) revert MalformedSettlementCommand();

        bytes32 executionKey = keccak256(
            abi.encode(
                message.sourceChainSelector, acknowledgmentReceiver, command.isBatch, command.settlementId, command.attempt
            )
        );
        ExecutionResult storage result = _executionResults[executionKey];
        if (result.status != ResultStatus.None) {
            emit DuplicateSettlementMessage(executionKey, message.messageId);
            if (!result.acknowledgmentSent) _trySendAcknowledgment(executionKey, result, true);
            return;
        }

        result.commandMessageId = message.messageId;
        result.acknowledgmentReceiver = acknowledgmentReceiver;
        result.protocolVersion = command.version;
        result.status = ResultStatus.Failed;

        FailureCode failureCode = _processCommand(executionKey, command);
        result.failureCode = failureCode;
        result.status = failureCode == FailureCode.None ? ResultStatus.Success : ResultStatus.Failed;
        emit SettlementExecutionStored(
            executionKey,
            message.messageId,
            command.executorGarden,
            acknowledgmentReceiver,
            command.version,
            command.isBatch,
            command.settlementId,
            command.attempt,
            result.status,
            failureCode
        );
        _trySendAcknowledgment(executionKey, result, true);
    }

    /// @notice ABI decoder boundary used so malformed dynamic command tuples fail with the frozen error.
    /// @dev Pure and authority-free; settlement execution remains reachable only through CCIPReceiver.
    function decodeSettlementCommand(bytes calldata data) external pure returns (SettlementMessageCodec.Command memory) {
        return SettlementMessageCodec.decodeCommand(data);
    }

    function _authenticate(Client.Any2EVMMessage memory message)
        internal
        view
        returns (address sender, uint8 protocolVersion)
    {
        if (paused) revert ExecutorMustBePaused();
        if (message.destTokenAmounts.length != 0) revert CcipTokensNotAllowed();
        SourcePeer memory peer = _sourcePeer;
        if (message.sourceChainSelector != peer.sourceChainSelector) revert InvalidCcipSource();
        sender = abi.decode(message.sender, (address));
        bool current = sender == peer.sourceSettlementModule;
        bool previous = sender == peer.previousSourceSettlementModule && peer.previousPeerExpiresAt != 0
            && block.timestamp <= peer.previousPeerExpiresAt;
        if (!current && !previous) revert InvalidCcipSender();
        protocolVersion = peer.protocolVersion;
    }

    function _processCommand(
        bytes32 executionKey,
        SettlementMessageCodec.Command memory command
    )
        internal
        returns (FailureCode)
    {
        GardenRoute memory route = _gardenRoutes[command.executorGarden];
        if (!route.active || route.safe == address(0)) return FailureCode.GardenRouteUnavailable;

        (FailureCode preflightFailure, uint256[] memory recipientBalances, uint256 sourceBalance, uint256 totalGrossDebit) =
            _preflight(command, route);
        if (preflightFailure != FailureCode.None) return preflightFailure;

        try this.executeGdollarSettlementBatch(
            route, command.recipients, command.amounts, recipientBalances, sourceBalance, totalGrossDebit
        ) {
            _recordPeriodSpend(command.executorGarden, totalGrossDebit);
            executionKey;
            return FailureCode.None;
        } catch (bytes memory reason) {
            if (reason.length >= 4) {
                bytes4 selector;
                assembly {
                    selector := mload(add(reason, 32))
                }
                if (selector == _ROLE_REJECTED_SELECTOR) return FailureCode.RouteRejected;
                if (selector == _BALANCE_DELTA_SELECTOR) return FailureCode.BalanceDeltaMismatch;
            }
            return FailureCode.RouteReverted;
        }
    }

    /// @dev This is the executor's single fail-closed validation boundary before any Safe call.
    // solhint-disable-next-line code-complexity
    function _preflight(
        SettlementMessageCodec.Command memory command,
        GardenRoute memory route
    )
        internal
        view
        returns (
            FailureCode failureCode,
            uint256[] memory recipientBalances,
            uint256 sourceBalance,
            uint256 totalGrossDebit
        )
    {
        uint256 length = command.recipients.length;
        if (length != command.amounts.length || length == 0) {
            return (FailureCode.BatchSizeExceeded, recipientBalances, 0, 0);
        }
        if ((!command.isBatch && length != 1) || (command.isBatch && (maxBatchSize == 0 || length > maxBatchSize))) {
            return (FailureCode.BatchSizeExceeded, recipientBalances, 0, 0);
        }

        recipientBalances = new uint256[](length);
        (bool sourceBalanceOk, uint256 sourceBalance_) = _tokenBalance(route.safe);
        if (!sourceBalanceOk) return (FailureCode.RouteReverted, recipientBalances, 0, 0);
        sourceBalance = sourceBalance_;

        for (uint256 index; index < length; ++index) {
            address recipient = command.recipients[index];
            uint256 amount = command.amounts[index];
            if (recipient == address(0) || recipient == route.safe) {
                return (FailureCode.InvalidRecipient, recipientBalances, sourceBalance, 0);
            }
            for (uint256 prior; prior < index; ++prior) {
                if (command.recipients[prior] == recipient) {
                    return (FailureCode.InvalidRecipient, recipientBalances, sourceBalance, 0);
                }
            }
            if (command.disbursementKind == _FUNDING || command.disbursementKind == _GARDEN_BENEFICIARY) {
                address recipientGarden = safeToGarden[recipient];
                if (recipientGarden == address(0) || !_gardenRoutes[recipientGarden].active) {
                    return (FailureCode.InvalidRecipient, recipientBalances, sourceBalance, 0);
                }
            }
            if (amount == 0) {
                return (FailureCode.TransferAmountExceeded, recipientBalances, sourceBalance, 0);
            }

            (bool feeOk, uint256 fee, bool senderPays) = _feeQuote(amount, route.safe, recipient);
            if (!feeOk) return (FailureCode.RouteReverted, recipientBalances, sourceBalance, 0);
            if (fee != 0 && !senderPays) {
                return (FailureCode.UnsupportedReceiverPaysFee, recipientBalances, sourceBalance, 0);
            }
            if (
                fee != 0
                    && (maxFeeBps == 0
                        || maxFeeAmount == 0
                        || fee > maxFeeAmount
                        || fee > Math.mulDiv(amount, maxFeeBps, _BPS_DENOMINATOR))
            ) return (FailureCode.FeeQuoteExceeded, recipientBalances, sourceBalance, 0);

            uint256 grossDebit = amount + fee;
            if (maxTransferAmount == 0 || grossDebit > maxTransferAmount) {
                return (FailureCode.TransferAmountExceeded, recipientBalances, sourceBalance, 0);
            }
            totalGrossDebit += grossDebit;
            if (maxBatchAmount == 0 || totalGrossDebit > maxBatchAmount) {
                return (FailureCode.BatchAmountExceeded, recipientBalances, sourceBalance, 0);
            }
            (bool recipientBalanceOk, uint256 recipientBalance) = _tokenBalance(recipient);
            if (!recipientBalanceOk) {
                return (FailureCode.RouteReverted, recipientBalances, sourceBalance, 0);
            }
            recipientBalances[index] = recipientBalance;
        }

        if (!_withinPeriodicCap(command.executorGarden, totalGrossDebit)) {
            return (FailureCode.PeriodCapExceeded, recipientBalances, sourceBalance, totalGrossDebit);
        }
        return (FailureCode.None, recipientBalances, sourceBalance, totalGrossDebit);
    }

    /// @notice Atomic, self-only Roles execution boundary for a fully preflighted command.
    function executeGdollarSettlementBatch(
        GardenRoute calldata route,
        address[] calldata recipients,
        uint256[] calldata amounts,
        uint256[] calldata recipientBalances,
        uint256 sourceBalance,
        uint256 totalGrossDebit
    )
        external
    {
        if (msg.sender != address(this)) revert InvalidCcipSender();
        for (uint256 index; index < recipients.length; ++index) {
            _executeTransfer(route, recipients[index], amounts[index], recipientBalances[index]);
        }
        (bool sourceBalanceOk, uint256 sourceBalanceAfter) = _tokenBalance(route.safe);
        if (!sourceBalanceOk || sourceBalance < totalGrossDebit || sourceBalanceAfter != sourceBalance - totalGrossDebit) {
            revert BalanceDeltaMismatch();
        }
    }

    function _executeTransfer(
        GardenRoute calldata route,
        address recipient,
        uint256 amount,
        uint256 recipientBalanceBefore
    )
        internal
    {
        (bool success, bytes memory returnData) = IZodiacRoles(route.rolesModifier)
            .execTransactionWithRoleReturnData(
                G_DOLLAR_TOKEN,
                0,
                abi.encodeWithSignature("transfer(address,uint256)", recipient, amount),
                SafeOperation.Call,
                route.roleKey,
                true
            );
        if (!success || returnData.length != 32 || !abi.decode(returnData, (bool))) {
            revert RoleExecutionRejected();
        }
        (bool balanceOk, uint256 afterBalance) = _tokenBalance(recipient);
        if (!balanceOk || afterBalance != recipientBalanceBefore + amount) {
            revert BalanceDeltaMismatch();
        }
    }
}
