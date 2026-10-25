// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice Only these two named protocols may participate in core voucher acceptance.
interface IVoucherAcceptancePeer {
    function voucherAcceptanceProtocolVersion() external pure returns (uint16);
    function commitmentPooling() external view returns (address);
    function LOCAL_CHAIN_ID() external view returns (uint256);
}

interface IEarnedVoucherAcceptancePeer is IVoucherAcceptancePeer {
    function validateEarnedVoucherAcceptance(
        uint256 commitmentId,
        uint64 expectedRevision,
        bytes32 expectedTermsHash,
        address creator,
        address counterparty
    )
        external
        view
        returns (bytes4 magic);
}

interface IVoucherServiceAcceptancePeer is IVoucherAcceptancePeer {
    function validateVoucherServiceAcceptance(
        uint256 commitmentId,
        address buyer,
        uint64 revision,
        bytes32 termsHash,
        bytes32 claimHash,
        uint64 requestNonce,
        address holder
    )
        external
        view
        returns (bytes32 setupId, bytes32 authorizationHash, bytes32 depositReceiptHash);
}
