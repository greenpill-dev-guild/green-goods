// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { VoucherServiceCodec as Codec } from "../../libraries/VoucherServiceCodec.sol";

/// @notice Source-only immutable setup outboxes and independently reconciled result lanes.
library VoucherServiceSourceStorage {
    struct SourceSetup {
        bytes32 authorizationHash;
        bytes32 depositReceiptHash;
        bytes32 decisionId;
        bytes32 lastPrepareMessageId;
        bytes32 lastDecisionMessageId;
        bytes32 latestResultHash;
        uint64 latestResultSequence;
        uint64 decisionAt;
        Codec.SetupDecision decision;
        Codec.SetupPhase latestDestinationPhase;
        uint256 depositedUnits;
        uint256 setupRefundedUnits;
    }

    /// @custom:storage-location erc7201:green.goods.voucher.service-setup.source.v2
    struct State {
        mapping(bytes32 => SourceSetup) setups;
        mapping(bytes32 => bytes) authorizations;
        mapping(uint256 => mapping(bytes32 => bytes32)) setupOfClaim;
        mapping(bytes32 => bytes32) receivedTransportPayload;
        mapping(bytes32 => bytes) decisionCommands;
        mapping(bytes32 => Codec.SetupResult) latestSetupResults;
        mapping(bytes32 => Codec.FinalResultV2) latestFinalResults;
        mapping(bytes32 => mapping(uint64 => bytes32)) setupSequenceHashes;
        mapping(bytes32 => mapping(uint64 => bytes32)) finalSequenceHashes;
    }

    bytes32 private constant _STATE_SLOT = 0x18442dc581f1c0fc106d2b09718fbfbae7a35cba9b1341fae03490a7b8ef3200;

    function state() internal pure returns (State storage result) {
        bytes32 slot = _STATE_SLOT;
        assembly ("memory-safe") { result.slot := slot }
    }
}
