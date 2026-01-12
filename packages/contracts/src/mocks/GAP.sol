// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { AttestationRequest, AttestationRequestData } from "@eas/IEAS.sol";
import { IGap, IProjectResolver } from "../interfaces/IKarma.sol";

/// @title MockGAP
/// @notice Enhanced mock implementation of Karma GAP protocol for testing
/// @dev Implements both IGap and IProjectResolver interfaces
contract MockGAP is IGap, IProjectResolver {
    // ═══════════════════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════════════════

    error NotProjectOwner();
    error NotProjectAdmin();
    error ProjectNotFound();
    error AlreadyAdmin();
    error NotAdmin();
    error ZeroAddress();

    // ═══════════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════════

    event AttestationCreated(bytes32 indexed uid, bytes32 indexed schema, address indexed recipient, bytes32 refUID);
    event ProjectCreated(bytes32 indexed projectUID, address indexed owner);
    event AdminAdded(bytes32 indexed projectUID, address indexed admin);
    event AdminRemoved(bytes32 indexed projectUID, address indexed admin);
    event OwnershipTransferred(bytes32 indexed projectUID, address indexed previousOwner, address indexed newOwner);

    // ═══════════════════════════════════════════════════════════════════════════
    // Storage
    // ═══════════════════════════════════════════════════════════════════════════

    struct Attestation {
        bytes32 schema;
        address recipient;
        bytes32 refUID;
        bytes data;
        bool exists;
        bool revocable;
        uint64 expirationTime;
    }

    struct Project {
        address owner;
        bool exists;
        mapping(address => bool) admins;
        address[] adminList;
    }

    /// @notice Attestation storage by UID
    mapping(bytes32 => Attestation) public attestations;

    /// @notice Project storage by UID
    mapping(bytes32 => Project) private projects;

    /// @notice Counter for generating unique UIDs
    uint256 public attestationCount;

    /// @notice Flag to simulate failures
    bool public shouldRevert;

    /// @notice Custom revert message
    string public revertMessage;

    // ═══════════════════════════════════════════════════════════════════════════
    // IGap Implementation
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IGap
    function attest(AttestationRequest calldata request) external payable returns (bytes32) {
        if (shouldRevert) {
            if (bytes(revertMessage).length > 0) {
                revert(revertMessage);
            }
            revert("MockGAP: attestation failed");
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

        // If this is a project attestation (no refUID), create project entry
        if (request.data.refUID == bytes32(0)) {
            projects[uid].owner = msg.sender;
            projects[uid].exists = true;
            projects[uid].admins[msg.sender] = true;
            projects[uid].adminList.push(msg.sender);
            emit ProjectCreated(uid, msg.sender);
        }

        emit AttestationCreated(uid, request.schema, request.data.recipient, request.data.refUID);

        return uid;
    }

    /// @inheritdoc IGap
    function multiSequentialAttest(AttestationRequestNode[] calldata requestNodes) external payable {
        if (shouldRevert) {
            if (bytes(revertMessage).length > 0) {
                revert(revertMessage);
            }
            revert("MockGAP: multi attestation failed");
        }

        bytes32[] memory createdUIDs = new bytes32[](requestNodes.length);

        for (uint256 i = 0; i < requestNodes.length; i++) {
            AttestationRequestNode calldata node = requestNodes[i];

            // Generate UID
            attestationCount++;
            bytes32 uid = keccak256(
                abi.encodePacked(block.timestamp, msg.sender, attestationCount, node.multiRequest.schema)
            );
            createdUIDs[i] = uid;

            // Resolve reference
            bytes32 refUID = node.uid;
            if (node.refIdx < i) {
                refUID = createdUIDs[node.refIdx];
            }

            // Process each attestation in the multi request
            for (uint256 j = 0; j < node.multiRequest.data.length; j++) {
                AttestationRequestData calldata data = node.multiRequest.data[j];

                attestations[uid] = Attestation({
                    schema: node.multiRequest.schema,
                    recipient: data.recipient,
                    refUID: refUID,
                    data: data.data,
                    exists: true,
                    revocable: data.revocable,
                    expirationTime: data.expirationTime
                });

                emit AttestationCreated(uid, node.multiRequest.schema, data.recipient, refUID);
            }
        }
    }

    /// @inheritdoc IGap
    function addProjectAdmin(bytes32 projectUid, address addr) external {
        if (shouldRevert) revert("MockGAP: add admin failed");
        if (addr == address(0)) revert ZeroAddress();

        Project storage project = projects[projectUid];
        if (!project.exists) revert ProjectNotFound();
        if (!project.admins[msg.sender] && project.owner != msg.sender) revert NotProjectAdmin();
        if (project.admins[addr]) revert AlreadyAdmin();

        project.admins[addr] = true;
        project.adminList.push(addr);

        emit AdminAdded(projectUid, addr);
    }

    /// @inheritdoc IGap
    function removeProjectAdmin(bytes32 projectUid, address addr) external {
        if (shouldRevert) revert("MockGAP: remove admin failed");

        Project storage project = projects[projectUid];
        if (!project.exists) revert ProjectNotFound();
        if (!project.admins[msg.sender] && project.owner != msg.sender) revert NotProjectAdmin();
        if (!project.admins[addr]) revert NotAdmin();
        if (addr == project.owner) revert("Cannot remove owner as admin");

        project.admins[addr] = false;

        // Remove from adminList
        for (uint256 i = 0; i < project.adminList.length; i++) {
            if (project.adminList[i] == addr) {
                project.adminList[i] = project.adminList[project.adminList.length - 1];
                project.adminList.pop();
                break;
            }
        }

        emit AdminRemoved(projectUid, addr);
    }

    /// @inheritdoc IGap
    function transferProjectOwnership(bytes32 projectUid, address newOwner) external override(IGap, IProjectResolver) {
        if (shouldRevert) revert("MockGAP: transfer ownership failed");
        if (newOwner == address(0)) revert ZeroAddress();

        Project storage project = projects[projectUid];
        if (!project.exists) revert ProjectNotFound();
        if (project.owner != msg.sender) revert NotProjectOwner();

        address previousOwner = project.owner;

        // Add new owner as admin if not already
        if (!project.admins[newOwner]) {
            project.admins[newOwner] = true;
            project.adminList.push(newOwner);
        }

        project.owner = newOwner;

        emit OwnershipTransferred(projectUid, previousOwner, newOwner);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // IProjectResolver Implementation
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IProjectResolver
    function addAdmin(bytes32 projectUid, address addr) external {
        // Delegate to addProjectAdmin
        this.addProjectAdmin(projectUid, addr);
    }

    /// @inheritdoc IProjectResolver
    function removeAdmin(bytes32 projectUid, address addr) external {
        // Delegate to removeProjectAdmin
        this.removeProjectAdmin(projectUid, addr);
    }

    /// @inheritdoc IProjectResolver
    function isAdmin(bytes32 projectId, address addr) external view returns (bool) {
        Project storage project = projects[projectId];
        if (!project.exists) return false;
        return project.admins[addr] || project.owner == addr;
    }

    /// @inheritdoc IProjectResolver
    function isOwner(bytes32 projectId, address addr) external view returns (bool) {
        Project storage project = projects[projectId];
        if (!project.exists) return false;
        return project.owner == addr;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Set whether calls should revert
    /// @param _shouldRevert Whether to revert
    function setShouldRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }

    /// @notice Set custom revert message
    /// @param _message The revert message
    function setRevertMessage(string calldata _message) external {
        revertMessage = _message;
    }

    /// @notice Get attestation data by UID
    /// @param uid The attestation UID
    /// @return schema The schema UID
    /// @return recipient The recipient address
    /// @return refUID The reference UID
    /// @return data The attestation data
    /// @return exists Whether the attestation exists
    function getAttestation(bytes32 uid)
        external
        view
        returns (bytes32 schema, address recipient, bytes32 refUID, bytes memory data, bool exists)
    {
        Attestation storage att = attestations[uid];
        return (att.schema, att.recipient, att.refUID, att.data, att.exists);
    }

    /// @notice Check if attestation exists
    /// @param uid The attestation UID
    /// @return True if attestation exists
    function attestationExists(bytes32 uid) external view returns (bool) {
        return attestations[uid].exists;
    }

    /// @notice Get project owner
    /// @param projectUid The project UID
    /// @return The owner address
    function getProjectOwner(bytes32 projectUid) external view returns (address) {
        return projects[projectUid].owner;
    }

    /// @notice Check if project exists
    /// @param projectUid The project UID
    /// @return True if project exists
    function projectExists(bytes32 projectUid) external view returns (bool) {
        return projects[projectUid].exists;
    }

    /// @notice Get all admins for a project
    /// @param projectUid The project UID
    /// @return Array of admin addresses
    function getProjectAdmins(bytes32 projectUid) external view returns (address[] memory) {
        return projects[projectUid].adminList;
    }

    /// @notice Manually create a project for testing
    /// @param projectUid The project UID to create
    /// @param owner The owner address
    function createProject(bytes32 projectUid, address owner) external {
        if (owner == address(0)) revert ZeroAddress();
        projects[projectUid].owner = owner;
        projects[projectUid].exists = true;
        projects[projectUid].admins[owner] = true;
        projects[projectUid].adminList.push(owner);
        emit ProjectCreated(projectUid, owner);
    }

    /// @notice Manually set admin status for testing
    /// @param projectUid The project UID
    /// @param admin The admin address
    /// @param isAdminStatus Whether the address is an admin
    function setAdmin(bytes32 projectUid, address admin, bool isAdminStatus) external {
        Project storage project = projects[projectUid];
        if (!project.exists) revert ProjectNotFound();

        if (isAdminStatus && !project.admins[admin]) {
            project.admins[admin] = true;
            project.adminList.push(admin);
            emit AdminAdded(projectUid, admin);
        } else if (!isAdminStatus && project.admins[admin]) {
            project.admins[admin] = false;
            // Remove from adminList
            for (uint256 i = 0; i < project.adminList.length; i++) {
                if (project.adminList[i] == admin) {
                    project.adminList[i] = project.adminList[project.adminList.length - 1];
                    project.adminList.pop();
                    break;
                }
            }
            emit AdminRemoved(projectUid, admin);
        }
    }

    /// @notice Get decoded attestation data as string (for JSON attestations)
    /// @param uid The attestation UID
    /// @return The decoded string data
    function getAttestationDataAsString(bytes32 uid) external view returns (string memory) {
        Attestation storage att = attestations[uid];
        if (!att.exists) return "";
        return abi.decode(att.data, (string));
    }

    /// @notice Count attestations referencing a specific UID
    /// @dev Useful for counting impacts/milestones under a project
    /// @param refUID The reference UID to count
    /// @return count The number of attestations referencing this UID
    function countAttestationsWithRef(bytes32 refUID) external view returns (uint256 count) {
        // Note: This is inefficient but acceptable for testing
        // In production, you'd want an index
        for (uint256 i = 1; i <= attestationCount; i++) {
            bytes32 uid = keccak256(abi.encodePacked(block.timestamp, msg.sender, i));
            if (attestations[uid].refUID == refUID) {
                count++;
            }
        }
    }
}
