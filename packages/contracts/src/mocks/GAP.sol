// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { AttestationRequest } from "@eas/IEAS.sol";

/// @notice Selector-faithful attestation recorder for real KarmaModule unit tests.
/// @dev Other GAP operations intentionally remain unsupported; reconciliation owns its faithful fixture.
contract MockGAP {
    event AttestationCreated(bytes32 indexed uid, bytes32 indexed schema, address indexed recipient, bytes32 refUID);

    struct Attestation {
        bytes32 schema;
        address recipient;
        bytes32 refUID;
        bytes data;
        bool exists;
        bool revocable;
        uint64 expirationTime;
    }

    mapping(bytes32 => Attestation) public attestations;
    uint256 public attestationCount;
    bool public shouldRevert;
    uint256 public revertAfterCallsThreshold;
    uint256 public revertAfterCallsCount;

    function attest(AttestationRequest calldata request) external payable returns (bytes32) {
        if (shouldRevert) revert("MockGAP: attestation failed");
        if (revertAfterCallsThreshold > 0) {
            revertAfterCallsCount++;
            if (revertAfterCallsCount > revertAfterCallsThreshold) revert("MockGAP: attestation failed");
        }

        attestationCount++;
        bytes32 uid = keccak256(abi.encodePacked(block.timestamp, msg.sender, attestationCount, request.schema));
        attestations[uid] = Attestation({
            schema: request.schema,
            recipient: request.data.recipient,
            refUID: request.data.refUID,
            data: request.data.data,
            exists: true,
            revocable: request.data.revocable,
            expirationTime: request.data.expirationTime
        });
        emit AttestationCreated(uid, request.schema, request.data.recipient, request.data.refUID);
        return uid;
    }

    function setShouldRevert(bool value) external {
        shouldRevert = value;
    }

    /// @notice Allow this many successful attest calls, then fail; zero disables the limit.
    function setRevertAfterCalls(uint256 calls) external {
        revertAfterCallsThreshold = calls;
        revertAfterCallsCount = 0;
    }

    function getAttestation(bytes32 uid)
        external
        view
        returns (bytes32 schema, address recipient, bytes32 refUID, bytes memory data, bool exists)
    {
        Attestation storage att = attestations[uid];
        return (att.schema, att.recipient, att.refUID, att.data, att.exists);
    }
}
