// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25;

import { Attestation } from "@eas/IEAS.sol";

contract MockEAS {
    mapping(uint256 id => Attestation attestation) private attestations;

    function setAttestation(uint256 id, Attestation memory attestation) public {
        attestations[id] = attestation;
    }

    function getAttestation(uint256 id) public view returns (Attestation memory) {
        return attestations[id];
    }
}
