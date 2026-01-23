// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { IGardenAccessControl } from "../interfaces/IGardenAccessControl.sol";
import { IHats } from "../interfaces/IHats.sol";

/// @title HatsModule
/// @notice Adapts Hats Protocol for Green Goods access control
/// @dev Implements IGardenAccessControl using Hats Protocol hat IDs
///
/// **Architecture:**
/// - Each garden can configure three hat IDs: gardener, operator, owner
/// - Role checks query Hats Protocol instead of local mappings
/// - Gardens can opt-in to Hats by calling `configureGarden()`
/// - Unconfigured gardens fall through to their native access control
///
/// **Hat ID Structure:**
/// Hats uses hierarchical uint256 IDs. Gardens can use any structure, but recommended:
/// - Top hat: Protocol-wide admin
/// - Garden hat: Per-garden root
///   - Gardener hat: Child of garden hat
///   - Operator hat: Child of garden hat (inherits gardener)
///   - Owner hat: Child of garden hat (inherits operator)
///
/// **Usage:**
/// 1. Deploy HatsModule (singleton)
/// 2. Garden admin calls `configureGarden(gardenAddress, gardenerHatId, operatorHatId, ownerHatId)`
/// 3. Resolvers call `isGardener()` / `isOperator()` via the adapter
contract HatsModule is IGardenAccessControl, OwnableUpgradeable, UUPSUpgradeable {
    // ═══════════════════════════════════════════════════════════════════════════
    // Types
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Hat configuration for a garden
    struct GardenHats {
        uint256 gardenerHatId; // Hat ID for gardener role
        uint256 operatorHatId; // Hat ID for operator role
        uint256 ownerHatId; // Hat ID for owner role
        bool configured; // True if garden has been configured
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Emitted when a garden's hat configuration is set
    event GardenConfigured(address indexed garden, uint256 gardenerHatId, uint256 operatorHatId, uint256 ownerHatId);

    /// @notice Emitted when a garden's hat configuration is removed
    event GardenDeconfigured(address indexed garden);

    /// @notice Emitted when the Hats contract address is updated
    event HatsContractUpdated(address indexed oldHats, address indexed newHats);

    // ═══════════════════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════════════════

    error ZeroAddress();
    error GardenNotConfigured(address garden);
    error InvalidHatId();
    error NotGardenAdmin(address caller, address garden);

    // ═══════════════════════════════════════════════════════════════════════════
    // Storage
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice The Hats Protocol contract
    IHats public hats;

    /// @notice Hat configuration per garden
    mapping(address garden => GardenHats config) public gardenHats;

    /// @notice Addresses authorized to configure gardens (e.g., GardenToken, deployer)
    mapping(address => bool) public configAuthority;

    /// @notice Storage gap for future upgrades
    uint256[47] private __gap;

    // ═══════════════════════════════════════════════════════════════════════════
    // Constructor & Initializer
    // ═══════════════════════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the adapter
    /// @param _owner The owner address
    /// @param _hats The Hats Protocol contract address
    function initialize(address _owner, address _hats) external initializer {
        if (_owner == address(0)) revert ZeroAddress();
        if (_hats == address(0)) revert ZeroAddress();

        __Ownable_init();
        _transferOwnership(_owner);

        hats = IHats(_hats);
        emit HatsContractUpdated(address(0), _hats);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // IGardenAccessControl Implementation
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IGardenAccessControl
    /// @dev Checks if account wears the gardener hat for msg.sender (the garden)
    /// @param account The address to check
    /// @return True if account is a gardener
    function isGardener(address account) external view override returns (bool) {
        return _checkRole(msg.sender, account, _getGardenerHatId);
    }

    /// @inheritdoc IGardenAccessControl
    /// @dev Checks if account wears the operator hat for msg.sender (the garden)
    /// @param account The address to check
    /// @return True if account is an operator
    function isOperator(address account) external view override returns (bool) {
        return _checkRole(msg.sender, account, _getOperatorHatId);
    }

    /// @inheritdoc IGardenAccessControl
    /// @dev Checks if account wears the owner hat for msg.sender (the garden)
    /// @param account The address to check
    /// @return True if account is an owner
    function isOwner(address account) external view override returns (bool) {
        return _checkRole(msg.sender, account, _getOwnerHatId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Garden-Specific Queries (for external use)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Check if account is a gardener of a specific garden
    /// @param garden The garden address
    /// @param account The account to check
    /// @return True if account is a gardener
    function isGardenerOf(address garden, address account) external view returns (bool) {
        return _checkRole(garden, account, _getGardenerHatId);
    }

    /// @notice Check if account is an operator of a specific garden
    /// @param garden The garden address
    /// @param account The account to check
    /// @return True if account is an operator
    function isOperatorOf(address garden, address account) external view returns (bool) {
        return _checkRole(garden, account, _getOperatorHatId);
    }

    /// @notice Check if account is an owner of a specific garden
    /// @param garden The garden address
    /// @param account The account to check
    /// @return True if account is an owner
    function isOwnerOf(address garden, address account) external view returns (bool) {
        return _checkRole(garden, account, _getOwnerHatId);
    }

    /// @notice Check if a garden is configured with Hats
    /// @param garden The garden address
    /// @return True if garden has hat configuration
    function isConfigured(address garden) external view returns (bool) {
        return gardenHats[garden].configured;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Configuration
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Configure hat IDs for a garden
    /// @dev Can be called by owner, config authority, or garden owner
    /// @param garden The garden address
    /// @param gardenerHatId Hat ID for gardener role
    /// @param operatorHatId Hat ID for operator role
    /// @param ownerHatId Hat ID for owner role
    function configureGarden(address garden, uint256 gardenerHatId, uint256 operatorHatId, uint256 ownerHatId) external {
        // Authorization: owner, config authority, or garden itself
        if (msg.sender != owner() && !configAuthority[msg.sender] && msg.sender != garden) {
            revert NotGardenAdmin(msg.sender, garden);
        }

        if (garden == address(0)) revert ZeroAddress();
        if (gardenerHatId == 0 || operatorHatId == 0 || ownerHatId == 0) revert InvalidHatId();

        gardenHats[garden] = GardenHats({
            gardenerHatId: gardenerHatId,
            operatorHatId: operatorHatId,
            ownerHatId: ownerHatId,
            configured: true
        });

        emit GardenConfigured(garden, gardenerHatId, operatorHatId, ownerHatId);
    }

    /// @notice Remove hat configuration for a garden
    /// @dev Reverts garden to native access control
    /// @param garden The garden address
    function deconfigureGarden(address garden) external {
        // Authorization: owner, config authority, or garden itself
        if (msg.sender != owner() && !configAuthority[msg.sender] && msg.sender != garden) {
            revert NotGardenAdmin(msg.sender, garden);
        }

        delete gardenHats[garden];
        emit GardenDeconfigured(garden);
    }

    /// @notice Update the Hats Protocol contract address
    /// @param _hats New Hats contract address
    function setHatsContract(address _hats) external onlyOwner {
        if (_hats == address(0)) revert ZeroAddress();
        address oldHats = address(hats);
        hats = IHats(_hats);
        emit HatsContractUpdated(oldHats, _hats);
    }

    /// @notice Add or remove a config authority
    /// @param authority The address to authorize/deauthorize
    /// @param authorized True to authorize, false to deauthorize
    function setConfigAuthority(address authority, bool authorized) external onlyOwner {
        if (authority == address(0)) revert ZeroAddress();
        configAuthority[authority] = authorized;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev Check if account has a role in a garden
    /// @param garden The garden address
    /// @param account The account to check
    /// @param getHatId Function to get the hat ID for the role
    /// @return True if account has the role
    function _checkRole(
        address garden,
        address account,
        function(address) view returns (uint256) getHatId
    )
        internal
        view
        returns (bool)
    {
        GardenHats storage config = gardenHats[garden];

        // If garden not configured, revert (caller should use native access control)
        if (!config.configured) {
            revert GardenNotConfigured(garden);
        }

        uint256 hatId = getHatId(garden);
        return hats.isWearerOfHat(account, hatId);
    }

    function _getGardenerHatId(address garden) internal view returns (uint256) {
        return gardenHats[garden].gardenerHatId;
    }

    function _getOperatorHatId(address garden) internal view returns (uint256) {
        return gardenHats[garden].operatorHatId;
    }

    function _getOwnerHatId(address garden) internal view returns (uint256) {
        return gardenHats[garden].ownerHatId;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UUPS Upgrade
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Authorizes an upgrade to a new implementation
    /// @param newImplementation The address of the new implementation
    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner { }
}
