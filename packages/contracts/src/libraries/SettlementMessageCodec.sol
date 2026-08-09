// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice Frozen version-one, data-only CCIP payload codec for split-state settlement.
library SettlementMessageCodec {
    uint8 internal constant COMMAND_VERSION = 1;
    uint8 internal constant ACKNOWLEDGMENT_VERSION = 1;

    struct Command {
        uint8 version;
        uint256 settlementId;
        bool isBatch;
        uint32 attempt;
        address executorGarden;
        uint8 disbursementKind;
        address[] recipients;
        uint256[] amounts;
    }

    struct Acknowledgment {
        uint8 version;
        bytes32 executionKey;
        bytes32 originatingCommandMessageId;
        bool success;
        uint8 failureCode;
    }

    function encodeCommand(
        uint8 version,
        uint256 settlementId,
        bool isBatch,
        uint32 attempt,
        address executorGarden,
        uint8 disbursementKind,
        address[] memory recipients,
        uint256[] memory amounts
    )
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(version, settlementId, isBatch, attempt, executorGarden, disbursementKind, recipients, amounts);
    }

    function decodeCommand(bytes memory data) internal pure returns (Command memory command) {
        // `encodeCommand` writes the tuple body directly. Prefixing the tuple's outer offset lets
        // Solidity decode one memory struct instead of assigning eight decoded values at once,
        // avoiding the coverage compiler's minimum-IR stack limit without changing the wire bytes.
        bytes memory tupleEncoding = bytes.concat(bytes32(uint256(32)), data);
        command = abi.decode(tupleEncoding, (Command));
    }

    function encodeAcknowledgment(
        uint8 version,
        bytes32 executionKey,
        bytes32 originatingCommandMessageId,
        bool success,
        uint8 failureCode
    )
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(version, executionKey, originatingCommandMessageId, success, failureCode);
    }

    function decodeAcknowledgment(bytes memory data) internal pure returns (Acknowledgment memory acknowledgment) {
        (
            acknowledgment.version,
            acknowledgment.executionKey,
            acknowledgment.originatingCommandMessageId,
            acknowledgment.success,
            acknowledgment.failureCode
        ) = abi.decode(data, (uint8, bytes32, bytes32, bool, uint8));
    }
}
