// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ICommitmentVoucherAcceptance as Voucher } from "../../interfaces/ICommitmentVoucherAcceptance.sol";
import { CommitmentPoolingTermsLib } from "../../lib/CommitmentPooling/TermsLib.sol";
import { CommitmentPoolingViewsLib } from "../../lib/CommitmentPooling/ViewsLib.sol";
import {
    CommitmentPoolingVoucherAcceptanceStorageLib as Store
} from "../../lib/CommitmentPooling/VoucherAcceptanceStorageLib.sol";
import { CommitmentPoolingServiceOffers } from "./ServiceOffers.sol";

/// @notice Named voucher acceptance configuration and permanent facts; no shell storage.
abstract contract CommitmentPoolingVoucherAcceptance is CommitmentPoolingServiceOffers {
    function voucherAcceptanceProtocolVersion() external pure returns (uint16) {
        return 1;
    }

    function voucherServiceSetupModule() external view returns (address) {
        return Store.state().voucherServiceSetupModule;
    }

    function pinEarnedVoucherModule(address peer) external onlyOwner onlyWhilePaused nonReentrant {
        CommitmentPoolingTermsLib.pinVoucherAcceptancePeer(peer, true);
    }

    function pinVoucherServiceSetupModule(address peer) external onlyOwner onlyWhilePaused nonReentrant {
        CommitmentPoolingTermsLib.pinVoucherAcceptancePeer(peer, false);
    }

    function bindEarnedVoucherTerms(uint256 commitmentId, uint64 revision, bytes32 termsHash) external nonReentrant {
        CommitmentPoolingTermsLib.bindEarnedVoucherTerms(commitments, commitmentId, revision, termsHash);
    }

    function getEarnedVoucherBinding(uint256 commitmentId) external view returns (Voucher.EarnedVoucherBinding memory) {
        _forwardView(abi.encodeWithSelector(CommitmentPoolingViewsLib.getEarnedVoucherBinding.selector, commitmentId));
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") { revert(0, 0) }
    }

    function getVoucherServiceAcceptance(uint256 commitmentId)
        external
        view
        returns (Voucher.VoucherServiceAcceptance memory)
    {
        _forwardView(abi.encodeWithSelector(CommitmentPoolingViewsLib.getVoucherServiceAcceptance.selector, commitmentId));
        // solhint-disable-next-line no-inline-assembly
        assembly ("memory-safe") { revert(0, 0) }
    }
}
