// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

// Local EAS interfaces for development

struct Attestation {
    bytes32 uid;
    bytes32 schema;
    uint64 time;
    uint64 expirationTime;
    uint64 revocationTime;
    bytes32 refUID;
    address recipient;
    address attester;
    bool revocable;
    bytes data;
}

interface IEAS {
    function attest(
        address recipient,
        bytes32 schema,
        bytes memory data,
        address resolver
    ) external returns (bytes32);
    
    function revoke(bytes32 uid) external;
    
    function getAttestation(bytes32 uid) external view returns (Attestation memory);
    
    function isAttestationValid(bytes32 uid) external view returns (bool);
} 