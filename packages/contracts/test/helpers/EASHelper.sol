// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { IEAS, Attestation } from "@eas/IEAS.sol";

/// @title EASHelper
/// @notice Helper library for querying and decoding EAS attestations
/// @dev Used in E2E tests to validate attestation data from real EAS contracts
library EASHelper {
    /// @notice Query and decode GAP project attestation
    /// @param easAddr The EAS contract address
    /// @param uid The attestation UID
    /// @return title The project title
    /// @return description The project description
    /// @return members The project members
    function getGAPProjectAttestation(
        address easAddr,
        bytes32 uid
    )
        internal
        view
        returns (string memory title, string memory description, address[] memory members)
    {
        IEAS eas = IEAS(easAddr);
        Attestation memory att = eas.getAttestation(uid);

        // Decode GAP project schema
        (title, description, members) = abi.decode(att.data, (string, string, address[]));
    }

    /// @notice Query and decode GAP impact attestation
    /// @param easAddr The EAS contract address
    /// @param uid The attestation UID
    /// @return title The impact title
    /// @return description The impact description
    /// @return proof The proof URL
    function getGAPImpactAttestation(
        address easAddr,
        bytes32 uid
    )
        internal
        view
        returns (string memory title, string memory description, string memory proof)
    {
        IEAS eas = IEAS(easAddr);
        Attestation memory att = eas.getAttestation(uid);

        (title, description, proof) = abi.decode(att.data, (string, string, string));
    }

    /// @notice Verify attestation exists and is not revoked
    /// @param easAddr The EAS contract address
    /// @param uid The attestation UID
    /// @return exists Whether the attestation exists
    function verifyAttestation(address easAddr, bytes32 uid) internal view returns (bool exists) {
        IEAS eas = IEAS(easAddr);
        Attestation memory att = eas.getAttestation(uid);

        // Attestation exists if it has a non-zero time and is not revoked
        exists = att.time > 0 && att.revocationTime == 0;
    }

    /// @notice Get attestation schema UID
    /// @param easAddr The EAS contract address
    /// @param uid The attestation UID
    /// @return schema The schema UID
    function getAttestationSchema(address easAddr, bytes32 uid) internal view returns (bytes32 schema) {
        IEAS eas = IEAS(easAddr);
        Attestation memory att = eas.getAttestation(uid);
        schema = att.schema;
    }

    /// @notice Get attestation attester
    /// @param easAddr The EAS contract address
    /// @param uid The attestation UID
    /// @return attester The attester address
    function getAttestationAttester(address easAddr, bytes32 uid) internal view returns (address attester) {
        IEAS eas = IEAS(easAddr);
        Attestation memory att = eas.getAttestation(uid);
        attester = att.attester;
    }
}
