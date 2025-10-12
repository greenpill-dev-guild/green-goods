// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { AttestationRequest } from "@eas/IEAS.sol";

/// @title IKarmaGap
/// @notice Interface for the Karma GAP core contract
/// @dev Source: https://github.com/show-karma/gap-contracts
/// @dev The GAP contract manages project attestations and admin permissions
interface IKarmaGap {
    /// @notice Creates an attestation using the Karma GAP protocol
    /// @param request The attestation request containing schema, recipient, and data
    /// @return uid The unique identifier of the created attestation
    function attest(AttestationRequest calldata request) external payable returns (bytes32 uid);

    /// @notice Adds an admin to a project (delegates to ProjectResolver)
    /// @param projectUid The UID of the project
    /// @param addr The address to add as admin
    function addProjectAdmin(bytes32 projectUid, address addr) external;

    /// @notice Removes an admin from a project (delegates to ProjectResolver)
    /// @param projectUid The UID of the project
    /// @param addr The address to remove as admin
    function removeProjectAdmin(bytes32 projectUid, address addr) external;

    /// @notice Transfers ownership of a project (delegates to ProjectResolver)
    /// @param projectUid The UID of the project
    /// @param newOwner The new owner address
    function transferProjectOwnership(bytes32 projectUid, address newOwner) external;
}

/// @title IProjectResolver
/// @notice Interface for the Karma GAP Project Resolver contract
/// @dev Source: https://github.com/show-karma/gap-contracts
/// @dev The ProjectResolver manages project ownership and admin permissions
interface IProjectResolver {
    /// @notice Adds an admin to a project
    /// @param projectUid The UID of the project
    /// @param addr The address to add as admin
    function addAdmin(bytes32 projectUid, address addr) external;

    /// @notice Removes an admin from a project
    /// @param projectUid The UID of the project
    /// @param addr The address to remove as admin
    function removeAdmin(bytes32 projectUid, address addr) external;

    /// @notice Transfers ownership of a project
    /// @param projectUid The UID of the project
    /// @param newOwner The new owner address
    function transferProjectOwnership(bytes32 projectUid, address newOwner) external;

    /// @notice Checks if an address is a project admin
    /// @param projectUid The UID of the project
    /// @param addr The address to check
    /// @return True if the address is a project admin
    function isProjectAdmin(bytes32 projectUid, address addr) external view returns (bool);

    /// @notice Checks if an address is the project owner
    /// @param projectUid The UID of the project
    /// @param addr The address to check
    /// @return True if the address is the project owner
    function isProjectOwner(bytes32 projectUid, address addr) external view returns (bool);
}
