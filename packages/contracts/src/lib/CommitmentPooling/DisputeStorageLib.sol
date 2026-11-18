// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice Dispute actors live outside the frozen commitment tuple and module layout.
library CommitmentPoolingDisputeStorageLib {
    /// @custom:storage-location erc7201:green.goods.commitment.disputes.v1
    struct State {
        mapping(uint256 commitmentId => address raiser) raiser;
    }

    /// @dev ERC-7201 namespace, derived as in ServiceOfferStorageLib.
    bytes32 internal constant STORAGE_SLOT = 0x00db7e1233ad7c733085b036698b86167ca9dcdb9d823e12d31c5fe3ff1f6a00;

    function state() internal pure returns (State storage result) {
        bytes32 slot = STORAGE_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            result.slot := slot
        }
    }
}
