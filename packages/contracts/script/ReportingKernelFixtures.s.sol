// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ReportingPackedUserOperation } from "../src/modules/SingleAttestationPolicy.sol";

/// @dev Isolated-fork fixture only. It deliberately has no production resolver or garden roles.
contract ReportingFixtureEAS {
    struct Data {
        address recipient;
        uint64 expirationTime;
        bool revocable;
        bytes32 refUID;
        bytes data;
        uint256 value;
    }

    struct Request {
        bytes32 schema;
        Data data;
    }

    uint256 public count;
    address public lastAttester;
    address public lastRecipient;
    bytes32 public lastSchema;
    bytes32 public lastUID;
    event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schema);

    function attest(Request calldata request) external payable returns (bytes32 uid) {
        count++;
        lastAttester = msg.sender;
        lastRecipient = request.data.recipient;
        lastSchema = request.schema;
        uid = keccak256(abi.encode(msg.sender, count, request));
        lastUID = uid;
        emit Attested(request.data.recipient, msg.sender, uid, request.schema);
    }
}

/// @dev Deposited fixture sponsorship, never a claim that production Pimlico is configured.
contract ReportingFixturePaymaster {
    error OnlyEntryPoint();
    address private immutable entryPoint;

    constructor(address entry) {
        entryPoint = entry;
    }

    function validatePaymasterUserOp(
        ReportingPackedUserOperation calldata,
        bytes32,
        uint256
    )
        external
        view
        returns (bytes memory context, uint256 validationData)
    {
        if (msg.sender != entryPoint) revert OnlyEntryPoint();
        return ("", 0);
    }

    function postOp(uint8, bytes calldata, uint256, uint256) external view {
        if (msg.sender != entryPoint) revert OnlyEntryPoint();
    }
}
