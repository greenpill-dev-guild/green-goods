// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IEAS, Attestation } from "@eas/IEAS.sol";

import { IGreenWillValidator } from "../interfaces/IGreenWillValidator.sol";
import { ZeroAddress } from "../errors/CommonErrors.sol";

/// @title WorkAttestationValidator
/// @notice Validates first-work badge claims against a specific EAS work schema
contract WorkAttestationValidator is IGreenWillValidator {
    error InvalidClaimData();
    error AttestationNotFound(bytes32 uid);
    error AttestationRevoked(bytes32 uid);
    error InvalidAttestationSchema(bytes32 uid, bytes32 expectedSchema, bytes32 actualSchema);
    error InvalidAttester(bytes32 uid, address expectedAttester, address actualAttester);

    IEAS public immutable eas;
    bytes32 public immutable schemaUID;

    constructor(address _eas, bytes32 _schemaUID) {
        if (_eas == address(0)) revert ZeroAddress();
        eas = IEAS(_eas);
        schemaUID = _schemaUID;
    }

    function validate(address account, bytes calldata claimData) external view returns (bytes32 sourceRef) {
        if (claimData.length != 32) revert InvalidClaimData();

        bytes32 uid = abi.decode(claimData, (bytes32));
        Attestation memory attestation = eas.getAttestation(uid);

        if (attestation.uid == bytes32(0)) revert AttestationNotFound(uid);
        if (attestation.revocationTime != 0) revert AttestationRevoked(uid);
        if (attestation.schema != schemaUID) {
            revert InvalidAttestationSchema(uid, schemaUID, attestation.schema);
        }
        if (attestation.attester != account) {
            revert InvalidAttester(uid, account, attestation.attester);
        }

        return uid;
    }
}
