// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {AttestationRequest, MultiAttestationRequest} from "@eas/IEAS.sol";

/// @title IGap
/// @notice Interface for Karma GAP main contract
/// @dev Source: https://github.com/show-karma/gap-contracts
interface IGap {
    struct AttestationRequestNode {
        bytes32 uid;
        MultiAttestationRequest multiRequest;
        uint256 refIdx;
    }

    /// @notice Creates a single attestation
    /// @param request The attestation request
    /// @return The UID of the created attestation
    function attest(AttestationRequest calldata request) external payable returns (bytes32);

    /// @notice Creates multiple attestations with sequential references
    /// @param requestNodes Array of attestation nodes with reference indices
    function multiSequentialAttest(AttestationRequestNode[] calldata requestNodes) external payable;

    /// @notice Adds an admin to a GAP project
    /// @param projectUid The UID of the project
    /// @param addr The address to add as admin
    function addProjectAdmin(bytes32 projectUid, address addr) external;

    /// @notice Removes an admin from a GAP project
    /// @param projectUid The UID of the project
    /// @param addr The address to remove as admin
    function removeProjectAdmin(bytes32 projectUid, address addr) external;

    /// @notice Transfers ownership of a GAP project
    /// @param projectUid The UID of the project
    /// @param newOwner The address that will become the new owner
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

    /// @notice Checks if an address is a project admin or owner
    /// @dev In the real contract, this checks both ownership AND admin status
    /// @param projectId The UID of the project
    /// @param addr The address to check
    /// @return True if the address is a project admin or owner
    function isAdmin(bytes32 projectId, address addr) external view returns (bool);

    /// @notice Checks if an address is the project owner
    /// @param projectId The UID of the project
    /// @param addr The address to check
    /// @return True if the address is the project owner
    function isOwner(bytes32 projectId, address addr) external view returns (bool);
}
