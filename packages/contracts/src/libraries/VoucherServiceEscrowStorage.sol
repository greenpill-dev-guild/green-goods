// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { VoucherServiceCodec as Codec } from "./VoucherServiceCodec.sol";

/// @notice Sole v2 destination state owner; the v1 receiver's linear layout is untouched.
library VoucherServiceEscrowStorage {
    // ERC-7201: green.goods.voucher.service-setup.destination.v2
    bytes32 internal constant SLOT = 0xaeb0057f8515f074fc3833f8f411699c5870ab18e632fdaef8eadaf75851ba00;

    struct Acknowledgment {
        uint64 sequence;
        bytes32 messageId;
        bytes32 failureHash;
    }

    struct Execution {
        bytes authorization;
        Codec.SetupResult result;
        Codec.SetupAction pendingAction;
        bytes decision;
        bytes failureReason;
        uint256 issuerReturnCeiling;
        bool holderAbortRequested;
        Acknowledgment setupAcknowledgment;
        Acknowledgment finalAcknowledgment;
        uint64 finalSequence;
        Codec.FinalAllocationRecord finalAllocation;
    }

    /// @custom:storage-location erc7201:green.goods.voucher.service-setup.destination.v2
    struct State {
        mapping(bytes32 setupId => Execution execution) executions;
        mapping(bytes32 messageId => bytes32 payloadHash) transportPayloads;
        mapping(address token => uint256 unspentUnits) liabilities;
    }

    function state() internal pure returns (State storage s) {
        bytes32 slot = SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") { s.slot := slot }
    }
}
