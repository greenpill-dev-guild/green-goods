// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25;

import { Attestation } from "@eas/IEAS.sol";

contract MockEAS {
    mapping(uint256 id => Attestation attestation) private attestations;
    mapping(bytes32 uid => bytes data) private attestationData;
    uint256 private nextId = 1;

    function setAttestation(uint256 id, Attestation memory attestation) public {
        attestations[id] = attestation;
    }

    function getAttestation(uint256 id) public view returns (Attestation memory) {
        return attestations[id];
    }

    /// @notice Store attestation data by UID for testing
    function setAttestationData(bytes32 uid, bytes memory data) public {
        attestationData[uid] = data;
    }

    /// @notice Get attestation data by UID for testing
    function getAttestationData(bytes32 uid) public view returns (bytes memory) {
        return attestationData[uid];
    }
}
