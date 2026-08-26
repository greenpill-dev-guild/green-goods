// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { AttestationRequest } from "@eas/IEAS.sol";
import { IGap, IProjectResolver } from "../../src/interfaces/IKarma.sol";

/// @notice Minimal ProjectResolver fixture that preserves Karma's direct-caller ownership boundary.
contract FaithfulProjectResolver is IProjectResolver {
    address public gap;
    address public protocolOwner;
    mapping(bytes32 projectUID => address owner) public projectOwner;
    mapping(bytes32 projectUID => mapping(address account => bool admin)) public override projectAdmins;

    function initialize(address gap_, address protocolOwner_) external {
        require(gap == address(0), "already initialized");
        gap = gap_;
        protocolOwner = protocolOwner_;
    }

    function registerProject(bytes32 projectUID, address owner) external {
        require(msg.sender == gap, "not gap");
        projectOwner[projectUID] = owner;
    }

    function addAdmin(bytes32 projectUID, address account) external {
        require(isOwner(projectUID, msg.sender), "ProjectResolver: Not owner");
        projectAdmins[projectUID][account] = true;
    }

    function removeAdmin(bytes32 projectUID, address account) external {
        require(isOwner(projectUID, msg.sender), "ProjectResolver: Not owner");
        delete projectAdmins[projectUID][account];
    }

    function transferProjectOwnership(bytes32 projectUID, address newOwner) external {
        require(isOwner(projectUID, msg.sender), "ProjectResolver:Not owner");
        projectOwner[projectUID] = newOwner;
    }

    function isAdmin(bytes32 projectUID, address account) public view returns (bool) {
        return isOwner(projectUID, account) || projectAdmins[projectUID][account];
    }

    function isOwner(bytes32 projectUID, address account) public view returns (bool) {
        return projectOwner[projectUID] == account || protocolOwner == account || projectAdmins[projectUID][account];
    }
}

    /// @notice Minimal GAP facade fixture. Admin calls intentionally forward through the facade.
    contract FaithfulGap is IGap {
        FaithfulProjectResolver public resolver;
        bytes32 public projectSchema;
        uint256 public nonce;
        mapping(bytes32 schema => uint256 count) public attestationCount;
        mapping(bytes32 schema => bytes data) public lastData;
        mapping(bytes32 schema => bool shouldFail) public failSchema;
        address public callbackTarget;
        bytes public callbackData;
        bool public callbackUsed;
        bool public callbackSucceeded;

        function initialize(address resolver_, bytes32 projectSchema_) external {
            require(address(resolver) == address(0), "already initialized");
            resolver = FaithfulProjectResolver(resolver_);
            projectSchema = projectSchema_;
        }

        function setFailSchema(bytes32 schema, bool shouldFail) external {
            failSchema[schema] = shouldFail;
        }

        function setCallback(address target, bytes calldata data) external {
            callbackTarget = target;
            callbackData = data;
            callbackUsed = false;
            callbackSucceeded = false;
        }

        function attest(AttestationRequest calldata request) external payable returns (bytes32 uid) {
            require(!failSchema[request.schema], "attestation failed");
            if (callbackTarget != address(0) && !callbackUsed) {
                callbackUsed = true;
                (callbackSucceeded,) = callbackTarget.call(callbackData);
            }
            uid = keccak256(abi.encode(address(this), ++nonce, request.schema, request.data.recipient, request.data.refUID));
            attestationCount[request.schema]++;
            lastData[request.schema] = request.data.data;
            if (request.schema == projectSchema) resolver.registerProject(uid, request.data.recipient);
        }

        function multiSequentialAttest(AttestationRequestNode[] calldata) external payable { }

        function addProjectAdmin(bytes32 projectUID, address account) external {
            resolver.addAdmin(projectUID, account);
        }

        function removeProjectAdmin(bytes32 projectUID, address account) external {
            resolver.removeAdmin(projectUID, account);
        }

        function transferProjectOwnership(bytes32 projectUID, address newOwner) external {
            resolver.transferProjectOwnership(projectUID, newOwner);
        }
    }
