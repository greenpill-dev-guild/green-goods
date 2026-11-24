// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentVoucherAcceptance as Voucher } from "../../interfaces/ICommitmentVoucherAcceptance.sol";

/// @notice Only voucher acceptance configuration and permanent accepted facts, outside frozen linear storage.
library CommitmentPoolingVoucherAcceptanceStorageLib {
    /// @custom:storage-location erc7201:green.goods.commitment.voucher-acceptance.v1
    struct State {
        address earnedVoucherModule;
        address voucherServiceSetupModule;
        mapping(uint256 commitmentId => Voucher.EarnedVoucherBinding binding) earned;
        mapping(uint256 commitmentId => Voucher.VoucherServiceAcceptance acceptance) acceptedService;
    }

    bytes32 internal constant STORAGE_SLOT = 0x2a0cd18ddd2b7d150ef77dca59e4be43f0f695a2fe45d7eb95c5e91d734cdf00;

    function state() internal pure returns (State storage result) {
        bytes32 slot = STORAGE_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") {
            result.slot := slot
        }
    }
}
