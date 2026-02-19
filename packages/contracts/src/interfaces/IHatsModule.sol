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

    /// @notice Emitted when conviction strategies are configured for a garden
    event ConvictionStrategiesUpdated(address indexed garden, address[] strategies);

    /// @notice Emitted when a conviction power sync is triggered
    event ConvictionSyncTriggered(address indexed garden, address indexed account, address indexed strategy);

    /// @notice Emitted when a conviction power sync fails (best-effort, does not revert)
    event ConvictionSyncFailed(address indexed garden, address indexed account, address indexed strategy, string reason);

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
    // Conviction Strategy Sync (Owner or Operator)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Configure conviction voting strategies for a garden
    /// @dev Role revocations will trigger best-effort power sync on these strategies.
    ///      Reverts if array exceeds MAX_CONVICTION_STRATEGIES or contains non-contract addresses.
    function setConvictionStrategies(address garden, address[] calldata strategies) external;

    /// @notice Get conviction strategies configured for a garden
    function getConvictionStrategies(address garden) external view returns (address[] memory);

    // ═══════════════════════════════════════════════════════════════════════════
    // Role Queries (View)
    // ═══════════════════════════════════════════════════════════════════════════

    function isGardenerOf(address garden, address account) external view returns (bool);
    function isEvaluatorOf(address garden, address account) external view returns (bool);
    function isOperatorOf(address garden, address account) external view returns (bool);
    function isOwnerOf(address garden, address account) external view returns (bool);
    function isFunderOf(address garden, address account) external view returns (bool);
    function isCommunityOf(address garden, address account) external view returns (bool);

    /// @notice Get the hat IDs configured for a garden
    /// @dev Returns all 8 fields of the GardenHats struct. Added to provide type-safe access
    ///      from GardensModule (avoids raw staticcall to gardenHats mapping which is fragile
    ///      across struct layout changes).
    /// @param garden The garden address
    /// @return ownerHatId The owner role hat ID
    /// @return operatorHatId The operator role hat ID
    /// @return evaluatorHatId The evaluator role hat ID
    /// @return gardenerHatId The gardener role hat ID
    /// @return funderHatId The funder role hat ID
    /// @return communityHatId The community role hat ID
    /// @return adminHatId The admin hat ID (parent of all role hats)
    /// @return configured Whether the garden has been configured
    function getGardenHatIds(address garden)
        external
        view
        returns (
            uint256 ownerHatId,
            uint256 operatorHatId,
            uint256 evaluatorHatId,
            uint256 gardenerHatId,
            uint256 funderHatId,
            uint256 communityHatId,
            uint256 adminHatId,
            bool configured
        );
}
