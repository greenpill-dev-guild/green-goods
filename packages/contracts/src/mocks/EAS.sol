// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25;

import { Attestation } from "../interfaces/IEAS.sol";

contract EAS {
    mapping(bytes32 => Attestation) private attestations;
    uint256 private attestationCount;
    
    // Events to match real EAS
    event Attested(
        address indexed recipient,
        address indexed attester,
        bytes32 uid,
        bytes32 indexed schema
    );
    
    event Revoked(
        address indexed recipient,
        address indexed attester,
        bytes32 uid,
        bytes32 indexed schema
    );
    
    constructor() {
        // Initialize mock
    }
    
    function attest(
        address recipient,
        bytes32 schema,
        bytes memory data,
        address resolver
    ) public returns (bytes32) {
        attestationCount++;
        bytes32 uid = bytes32(attestationCount);
        
        Attestation memory attestation = Attestation({
            uid: uid,
            schema: schema,
            time: uint64(block.timestamp),
            expirationTime: 0,
            revocationTime: 0,
            refUID: bytes32(0),
            recipient: recipient,
            attester: msg.sender,
            revocable: true,
            data: data
        });
        
        attestations[uid] = attestation;
        
        emit Attested(recipient, msg.sender, uid, schema);
        
        return uid;
    }
    
    function revoke(bytes32 uid) public {
        Attestation storage attestation = attestations[uid];
        require(attestation.uid != bytes32(0), "Attestation does not exist");
        require(attestation.revocationTime == 0, "Already revoked");
        
        attestation.revocationTime = uint64(block.timestamp);
        
        emit Revoked(attestation.recipient, attestation.attester, uid, attestation.schema);
    }
    
    function getAttestation(bytes32 uid) public view returns (Attestation memory) {
        return attestations[uid];
    }
    
    function isAttestationValid(bytes32 uid) public view returns (bool) {
        Attestation memory attestation = attestations[uid];
        
        return attestation.uid != bytes32(0) &&
               attestation.revocationTime == 0 &&
               (attestation.expirationTime == 0 || attestation.expirationTime > block.timestamp);
    }
}
