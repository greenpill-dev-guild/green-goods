// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IHatsModule
/// @notice Interface for managing garden roles via Hats Protocol
/// @dev Used by GardenToken and resolvers to create hat trees and manage roles
interface IHatsModule {
    // ═══════════════════════════════════════════════════════════════════════════
    // Types
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Canonical garden roles mapped to Hats
    enum GardenRole {
        Gardener,
        Evaluator,
        Operator,
        Owner,
        Funder,
        Community
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Emitted when a garden hat tree is created
    event GardenHatTreeCreated(address indexed garden, uint256 adminHatId);

    /// @notice Emitted when a role is granted
    event RoleGranted(address indexed garden, address indexed account, GardenRole role);

    /// @notice Emitted when a role is revoked
    event RoleRevoked(address indexed garden, address indexed account, GardenRole role);

    /// @notice Emitted when a best-effort sub-grant fails
    event PartialGrantFailed(address indexed garden, address indexed account, GardenRole role, string reason);

    /// @notice Emitted when eligibility module creation or configuration fails
    event EligibilityModuleCreationFailed(uint256 indexed hatId, string moduleType);

    // ═══════════════════════════════════════════════════════════════════════════
    // Garden Hat Tree Lifecycle (GardenToken only)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Creates the full hat tree for a garden with all 6 roles
    /// @dev Only callable by GardenToken during mintGarden().
    ///      Role assignments (Owner, Operators, Gardeners) are handled by the caller.
    function createGardenHatTree(
        address garden,
        string calldata name,
        address communityToken
    )
        external
        returns (uint256 adminHatId);

    // ═══════════════════════════════════════════════════════════════════════════
    // Role Management (Owner or Operator)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Grant a role to an account
    function grantRole(address garden, address account, GardenRole role) external;

    /// @notice Revoke a role from an account
    function revokeRole(address garden, address account, GardenRole role) external;

    /// @notice Batch grant roles
    function grantRoles(address garden, address[] calldata accounts, GardenRole[] calldata roles) external;

    /// @notice Batch revoke roles
    function revokeRoles(address garden, address[] calldata accounts, GardenRole[] calldata roles) external;

    // ═══════════════════════════════════════════════════════════════════════════
    // Role Queries (View)
    // ═══════════════════════════════════════════════════════════════════════════

    function isGardenerOf(address garden, address account) external view returns (bool);
    function isEvaluatorOf(address garden, address account) external view returns (bool);
    function isOperatorOf(address garden, address account) external view returns (bool);
    function isOwnerOf(address garden, address account) external view returns (bool);
    function isFunderOf(address garden, address account) external view returns (bool);
    function isCommunityOf(address garden, address account) external view returns (bool);
}
