// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25;

import {
    IEAS,
    Attestation,
    AttestationRequest,
    ISchemaRegistry,
    DelegatedAttestationRequest,
    MultiAttestationRequest,
    MultiDelegatedAttestationRequest,
    RevocationRequest,
    DelegatedRevocationRequest,
    MultiRevocationRequest,
    MultiDelegatedRevocationRequest
} from "@eas/IEAS.sol";

// Custom errors for mock implementation
error NotImplemented(string functionName);

/// @title MockEAS
/// @notice Mock implementation of IEAS for testing
/// @dev Implements only the methods needed for E2E workflow tests
contract MockEAS is IEAS {
    mapping(bytes32 uid => Attestation attestation) private attestations;
    uint256 private nonce = 1;

    /// @notice Returns the version of the contract
    function version() external pure override returns (string memory) {
        return "1.0.0";
    }

    /// @notice Returns the schema registry (not implemented in mock)
    function getSchemaRegistry() external pure override returns (ISchemaRegistry) {
        revert NotImplemented("getSchemaRegistry");
    }

    /// @notice Create a new attestation
    /// @param request The attestation request data
    /// @return The UID of the new attestation
    function attest(AttestationRequest calldata request) external payable override returns (bytes32) {
        // Generate unique UID
        bytes32 uid = keccak256(abi.encodePacked(nonce++, msg.sender, block.timestamp, request.schema));

        // Store attestation
        attestations[uid] = Attestation({
            uid: uid,
            schema: request.schema,
            time: uint64(block.timestamp),
            expirationTime: request.data.expirationTime,
            revocationTime: 0,
            refUID: request.data.refUID,
            recipient: request.data.recipient,
            attester: msg.sender,
            revocable: request.data.revocable,
            data: request.data.data
        });

        emit Attested(request.data.recipient, msg.sender, uid, request.schema);

        return uid;
    }

    /// @notice Get an attestation by UID
    /// @param uid The UID of the attestation
    /// @return The attestation data
    function getAttestation(bytes32 uid) external view override returns (Attestation memory) {
        return attestations[uid];
    }

    /// @notice Check if an attestation is valid (exists and not revoked)
    /// @param uid The UID of the attestation
    /// @return Whether the attestation is valid
    function isAttestationValid(bytes32 uid) external view override returns (bool) {
        Attestation memory attestation = attestations[uid];
        return attestation.uid != bytes32(0) && attestation.revocationTime == 0;
    }

    // =============================================================
    // NOT IMPLEMENTED - These methods are not needed for our tests
    // =============================================================

    function attestByDelegation(DelegatedAttestationRequest calldata) external payable override returns (bytes32) {
        revert NotImplemented("attestByDelegation");
    }

    function multiAttest(MultiAttestationRequest[] calldata) external payable override returns (bytes32[] memory) {
        revert NotImplemented("multiAttest");
    }

    function multiAttestByDelegation(MultiDelegatedAttestationRequest[] calldata)
        external
        payable
        override
        returns (bytes32[] memory)
    {
        revert NotImplemented("multiAttestByDelegation");
    }

    function revoke(RevocationRequest calldata) external payable override {
        revert NotImplemented("revoke");
    }

    function revokeByDelegation(DelegatedRevocationRequest calldata) external payable override {
        revert NotImplemented("revokeByDelegation");
    }

    function multiRevoke(MultiRevocationRequest[] calldata) external payable override {
        revert NotImplemented("multiRevoke");
    }

    function multiRevokeByDelegation(MultiDelegatedRevocationRequest[] calldata) external payable override {
        revert NotImplemented("multiRevokeByDelegation");
    }

    function timestamp(bytes32) external pure override returns (uint64) {
        revert NotImplemented("timestamp");
    }

    function multiTimestamp(bytes32[] calldata) external pure override returns (uint64) {
        revert NotImplemented("multiTimestamp");
    }

    function revokeOffchain(bytes32) external pure override returns (uint64) {
        revert NotImplemented("revokeOffchain");
    }

    function multiRevokeOffchain(bytes32[] calldata) external pure override returns (uint64) {
        revert NotImplemented("multiRevokeOffchain");
    }

    function getTimestamp(bytes32) external pure override returns (uint64) {
        revert NotImplemented("getTimestamp");
    }

    function getRevokeOffchain(address, bytes32) external pure override returns (uint64) {
        revert NotImplemented("getRevokeOffchain");
    }

    // =============================================================
    // TEST HELPERS - For backward compatibility with existing tests
    // =============================================================

    /// @notice Legacy test helper - manually set an attestation by UID
    /// @dev This is for backward compatibility with E2EWorkflow.t.sol tests
    /// @param uid The UID to use for the attestation
    /// @param attestation The attestation data
    function setAttestationByUID(bytes32 uid, Attestation memory attestation) public {
        attestations[uid] = attestation;
    }
}
