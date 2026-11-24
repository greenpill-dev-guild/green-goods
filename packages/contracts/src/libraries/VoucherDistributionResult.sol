// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { VoucherMessageCodec } from "./VoucherMessageCodec.sol";

/// @notice Internal-only reconciliation checks for an earned distribution result.
library VoucherDistributionResult {
    error ConflictingVoucherResult();

    function validate(
        VoucherMessageCodec.Ack memory result,
        bytes32 payloadHash,
        uint64 resultSequence,
        bytes32 priorResultHash,
        bool delivered
    )
        internal
        pure
        returns (bytes32 resultHash)
    {
        if (
            result.payloadHash != payloadHash || result.resultSequence == 0
                || (result.success && result.failureHash != bytes32(0))
                || (!result.success && result.failureHash == bytes32(0))
        ) revert ConflictingVoucherResult();
        resultHash = keccak256(abi.encode(result));
        if (result.resultSequence == resultSequence && resultHash != priorResultHash) revert ConflictingVoucherResult();
        if (delivered && !result.success) revert ConflictingVoucherResult();
    }
}
