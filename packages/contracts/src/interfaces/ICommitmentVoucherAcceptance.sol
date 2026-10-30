// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice Narrow voucher consent and funded-service acceptance facts; legacy pooling ABI is unchanged.
interface ICommitmentVoucherAcceptance {
    struct EarnedVoucherBinding {
        address module;
        uint64 revision;
        bytes32 termsHash;
        uint64 acceptedRevision;
        bytes32 acceptedTermsHash;
        address acceptedCounterparty;
    }

    struct VoucherServiceAcceptance {
        address setupModule;
        bytes32 claimHash;
        uint64 termsRevision;
        uint64 requestNonce;
        bytes32 setupId;
        bytes32 authorizationHash;
        bytes32 depositReceiptHash;
    }

    function voucherAcceptanceProtocolVersion() external pure returns (uint16);
    function voucherServiceSetupModule() external view returns (address);
    function pinEarnedVoucherModule(address module) external;
    function pinVoucherServiceSetupModule(address module) external;
    function bindEarnedVoucherTerms(uint256 commitmentId, uint64 revision, bytes32 termsHash) external;
    function getEarnedVoucherBinding(uint256 commitmentId) external view returns (EarnedVoucherBinding memory);
    function getVoucherServiceAcceptance(uint256 commitmentId) external view returns (VoucherServiceAcceptance memory);

    event EarnedVoucherModulePinned(address indexed module);
    event VoucherServiceSetupModulePinned(address indexed module);
    event EarnedVoucherTermsBound(
        uint256 indexed commitmentId, address indexed module, uint64 indexed revision, bytes32 termsHash
    );
    event EarnedVoucherAcceptanceRecorded(
        uint256 indexed commitmentId,
        address indexed module,
        uint64 indexed revision,
        bytes32 termsHash,
        address creator,
        address counterparty
    );
    event VoucherServiceAcceptanceRecorded(
        uint256 indexed commitmentId,
        bytes32 indexed claimHash,
        bytes32 indexed setupId,
        address setupModule,
        uint64 revision,
        uint64 requestNonce,
        bytes32 authorizationHash,
        bytes32 depositReceiptHash
    );

    error InvalidVoucherAcceptancePeer();
    error VoucherAcceptancePeerAlreadyPinned();
    error UnregisteredEarnedVoucherModule();
    error EarnedVoucherBindingMismatch(uint256 commitmentId);
    error InvalidVoucherServiceAcceptance(uint256 commitmentId);
}
