// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IHats
/// @notice Interface for the Green Goods Hats Module that manages Hats Protocol integration
/// @dev Creates and manages per-garden hat trees with role-based access control
interface IHats {
    // ═══════════════════════════════════════════════════════════════════════════
    // Types
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Role types in a garden's hat tree
    /// @dev Each role corresponds to a specific hat in the garden's hierarchy
    enum GardenRole {
        Operator, // Can manage gardeners, assessments (role ID 1)
        Gardener, // Can submit work (role ID 2)
        Evaluator, // Can approve/reject work (role ID 3)
        Funder, // Eligibility-based via external module (role ID 4)
        Community // ERC-20 holder via eligibility module (role ID 5)

    }

    /// @notice Hat tree structure for a garden
    struct GardenHatTree {
        uint256 rootHatId; // Garden's root hat (admin of all role hats)
        uint256 operatorHatId; // Operator role hat
        uint256 gardenerHatId; // Gardener role hat
        uint256 evaluatorHatId; // Evaluator role hat
        uint256 funderHatId; // Funder role hat (eligibility-based)
        uint256 communityHatId; // Community role hat (token-gated)
        bool exists; // True if tree has been created
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Emitted when a garden's hat tree is created
    event GardenHatTreeCreated(
        address indexed garden, uint256 rootHatId, uint256 operatorHatId, uint256 gardenerHatId, uint256 evaluatorHatId
    );

    /// @notice Emitted when a role is assigned to an account
    event RoleAssigned(address indexed garden, address indexed account, GardenRole role, uint256 hatId);

    /// @notice Emitted when a role is revoked from an account
    event RoleRevoked(address indexed garden, address indexed account, GardenRole role, uint256 hatId);

    /// @notice Emitted when an eligibility module is set for a role
    event EligibilityModuleSet(address indexed garden, GardenRole role, address module);

    /// @notice Emitted when the Hats contract is updated
    event HatsContractUpdated(address indexed oldHats, address indexed newHats);

    // ═══════════════════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════════════════

    error ZeroAddress();
    error NotGardenToken();
    error NotGardenOperator();
    error NotGardenOwner();
    error NotAuthorizedCaller();
    error GardenTreeAlreadyExists(address garden);
    error GardenTreeNotFound(address garden);
    error InvalidRole();
    error RoleAlreadyAssigned(address account, GardenRole role);
    error RoleNotAssigned(address account, GardenRole role);
    error HatsOperationFailed(string reason);
    error OpenJoiningNotEnabled();
    error AlreadyGardener();

    // ═══════════════════════════════════════════════════════════════════════════
    // Hat Tree Management
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Creates a hat tree for a new garden
    /// @dev Called by GardenToken during garden minting
    /// @param garden The garden address
    /// @param operator The primary operator address
    /// @param gardenName The garden name (used for hat details)
    /// @return rootHatId The created root hat ID
    function createGardenHatTree(
        address garden,
        address operator,
        string calldata gardenName
    )
        external
        returns (uint256 rootHatId);

    // ═══════════════════════════════════════════════════════════════════════════
    // Role Management
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Grants a role to an account
    /// @dev For Operator: only garden owner can grant
    /// @dev For Gardener/Evaluator: only operator can grant
    /// @param garden The garden address
    /// @param account The account to grant the role to
    /// @param role The role to grant
    function grantRole(address garden, address account, GardenRole role) external;

    /// @notice Revokes a role from an account
    /// @param garden The garden address
    /// @param account The account to revoke the role from
    /// @param role The role to revoke
    function revokeRole(address garden, address account, GardenRole role) external;

    /// @notice Batch grants roles to multiple accounts
    /// @param garden The garden address
    /// @param accounts The accounts to grant roles to
    /// @param roles The roles to grant (parallel array with accounts)
    function batchGrantRoles(address garden, address[] calldata accounts, GardenRole[] calldata roles) external;

    /// @notice Batch revokes roles from multiple accounts
    /// @param garden The garden address
    /// @param accounts The accounts to revoke roles from
    /// @param roles The roles to revoke (parallel array with accounts)
    function batchRevokeRoles(address garden, address[] calldata accounts, GardenRole[] calldata roles) external;

    /// @notice Allows anyone to join a garden as a gardener if open joining is enabled
    /// @dev Checks IGardenAccount(garden).openJoining() and grants gardener hat
    /// @param garden The garden address to join
    function joinGarden(address garden) external;

    // ═══════════════════════════════════════════════════════════════════════════
    // Eligibility Module Management
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Sets the eligibility module for a role
    /// @dev Used for Funder (Octant/Hypercerts) and Community (token-gating) roles
    /// @param garden The garden address
    /// @param role The role to configure
    /// @param module The eligibility module address
    function setEligibilityModule(address garden, GardenRole role, address module) external;

    // ═══════════════════════════════════════════════════════════════════════════
    // View Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Checks if an account has a specific role in a garden
    /// @param garden The garden address
    /// @param account The account to check
    /// @param role The role to check
    /// @return True if the account has the role
    function hasRole(address garden, address account, GardenRole role) external view returns (bool);

    /// @notice Gets the hat ID for a specific role in a garden
    /// @param garden The garden address
    /// @param role The role to get the hat ID for
    /// @return The hat ID for the role
    function getRoleHatId(address garden, GardenRole role) external view returns (uint256);

    /// @notice Gets the complete hat tree for a garden
    /// @param garden The garden address
    /// @return The garden's hat tree structure
    function getGardenHatTree(address garden) external view returns (GardenHatTree memory);

    /// @notice Checks if a garden has a hat tree
    /// @param garden The garden address
    /// @return True if the garden has a hat tree
    function hasHatTree(address garden) external view returns (bool);

    /// @notice Checks if an account is an operator of a garden
    /// @param garden The garden address
    /// @param account The account to check
    /// @return True if the account is an operator
    function isOperator(address garden, address account) external view returns (bool);

    /// @notice Checks if an account is a gardener of a garden
    /// @param garden The garden address
    /// @param account The account to check
    /// @return True if the account is a gardener
    function isGardener(address garden, address account) external view returns (bool);

    /// @notice Checks if an account is an evaluator of a garden
    /// @param garden The garden address
    /// @param account The account to check
    /// @return True if the account is an evaluator
    function isEvaluator(address garden, address account) external view returns (bool);
}
