// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import {IOctantFactory} from "../interfaces/IOctantFactory.sol";

/// @title OctantModule
/// @notice Integration module for creating and managing Octant vaults for gardens
/// @dev Called by GreenGoodsResolver; creates per-garden yield vaults
///
/// **Purpose:**
/// - Creates yield-generating vaults for gardens using Octant's Multi-Strategy system
/// - Vaults accumulate yield that can fund garden activities
/// - Each garden gets one vault, created lazily on first approved work
///
/// **Execution Flow:**
/// 1. Resolver calls `onWorkApproved()` after work approval
/// 2. Module checks if garden already has a vault
/// 3. If no vault, creates one via Octant factory
/// 4. Emits events for observability
///
/// **Architecture:**
/// - Upgradeable via UUPS pattern
/// - Isolated from resolver — failures don't block attestations
/// - Gardens own their vaults (TBA is role manager)
contract OctantModule is OwnableUpgradeable, UUPSUpgradeable {
    // ═══════════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Emitted when a vault is created for a garden
    event VaultCreated(address indexed garden, address indexed vault, address asset);

    /// @notice Emitted when the Octant factory address is updated
    event FactoryUpdated(address indexed oldFactory, address indexed newFactory);

    /// @notice Emitted when the default asset is updated
    event DefaultAssetUpdated(address indexed oldAsset, address indexed newAsset);

    /// @notice Emitted when the router is updated
    event RouterUpdated(address indexed oldRouter, address indexed newRouter);

    // ═══════════════════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════════════════

    error UnauthorizedCaller(address caller);
    error ZeroAddress();
    error FactoryNotConfigured();
    error AssetNotConfigured();
    error VaultAlreadyExists(address garden);
    error VaultCreationFailed(address garden);

    // ═══════════════════════════════════════════════════════════════════════════
    // Storage
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice The Octant factory contract
    IOctantFactory public octantFactory;

    /// @notice Default asset for new vaults (e.g., USDC)
    address public defaultAsset;

    /// @notice The integration router that can call this module
    address public router;

    /// @notice Mapping of garden address to vault address
    mapping(address garden => address vault) public gardenVaults;

    /// @notice Default profit unlock time for new vaults (in seconds)
    uint256 public defaultProfitUnlockTime;

    /// @notice Storage gap for future upgrades
    uint256[45] private __gap;

    // ═══════════════════════════════════════════════════════════════════════════
    // Modifiers
    // ═══════════════════════════════════════════════════════════════════════════

    modifier onlyRouter() {
        if (msg.sender != router && msg.sender != owner()) {
            revert UnauthorizedCaller(msg.sender);
        }
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Constructor & Initializer
    // ═══════════════════════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializes the module
    /// @param _owner The address that will own the module
    /// @param _router The integration router address
    /// @param _octantFactory The Octant factory address (can be zero if not yet deployed)
    /// @param _defaultAsset The default asset for vaults (e.g., USDC)
    /// @param _profitUnlockTime Default profit unlock time in seconds
    function initialize(
        address _owner,
        address _router,
        address _octantFactory,
        address _defaultAsset,
        uint256 _profitUnlockTime
    ) external initializer {
        if (_owner == address(0)) revert ZeroAddress();
        if (_router == address(0)) revert ZeroAddress();

        __Ownable_init();
        _transferOwnership(_owner);

        router = _router;
        octantFactory = IOctantFactory(_octantFactory);
        defaultAsset = _defaultAsset;
        defaultProfitUnlockTime = _profitUnlockTime;

        emit RouterUpdated(address(0), _router);
        if (_octantFactory != address(0)) {
            emit FactoryUpdated(address(0), _octantFactory);
        }
        if (_defaultAsset != address(0)) {
            emit DefaultAssetUpdated(address(0), _defaultAsset);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Module Entry Points
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Called when work is approved — creates vault if needed
    /// @dev Called by router; silently skips if factory not configured
    /// @param garden The garden account address
    /// @param gardenName The garden name (for vault naming)
    /// @return vault The vault address (existing or newly created)
    function onWorkApproved(address garden, string calldata gardenName) external onlyRouter returns (address vault) {
        // Skip if factory not configured (non-blocking)
        if (address(octantFactory) == address(0)) return address(0);
        if (defaultAsset == address(0)) return address(0);

        // Return existing vault if already created
        vault = gardenVaults[garden];
        if (vault != address(0)) return vault;

        // Create new vault for garden
        vault = _createVaultForGarden(garden, gardenName);
        return vault;
    }

    /// @notice Checks if a garden has a vault
    /// @param garden The garden address
    /// @return True if the garden has a vault
    function hasVault(address garden) external view returns (bool) {
        return gardenVaults[garden] != address(0);
    }

    /// @notice Gets the vault for a garden
    /// @param garden The garden address
    /// @return The vault address (or zero if none)
    function getVault(address garden) external view returns (address) {
        return gardenVaults[garden];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Admin Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Updates the Octant factory address
    /// @param _factory The new factory address
    function setOctantFactory(address _factory) external onlyOwner {
        address oldFactory = address(octantFactory);
        octantFactory = IOctantFactory(_factory);
        emit FactoryUpdated(oldFactory, _factory);
    }

    /// @notice Updates the default asset for new vaults
    /// @param _asset The new default asset address
    function setDefaultAsset(address _asset) external onlyOwner {
        address oldAsset = defaultAsset;
        defaultAsset = _asset;
        emit DefaultAssetUpdated(oldAsset, _asset);
    }

    /// @notice Updates the router address
    /// @param _router The new router address
    function setRouter(address _router) external onlyOwner {
        if (_router == address(0)) revert ZeroAddress();
        address oldRouter = router;
        router = _router;
        emit RouterUpdated(oldRouter, _router);
    }

    /// @notice Updates the default profit unlock time
    /// @param _profitUnlockTime The new profit unlock time in seconds
    function setDefaultProfitUnlockTime(uint256 _profitUnlockTime) external onlyOwner {
        defaultProfitUnlockTime = _profitUnlockTime;
    }

    /// @notice Manually creates a vault for a garden (admin only)
    /// @param garden The garden address
    /// @param gardenName The garden name
    /// @return vault The created vault address
    function createVaultForGarden(address garden, string calldata gardenName)
        external
        onlyOwner
        returns (address vault)
    {
        if (address(octantFactory) == address(0)) revert FactoryNotConfigured();
        if (defaultAsset == address(0)) revert AssetNotConfigured();
        if (gardenVaults[garden] != address(0)) revert VaultAlreadyExists(garden);

        return _createVaultForGarden(garden, gardenName);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Creates a vault for a garden
    /// @param garden The garden address (TBA that will own the vault)
    /// @param gardenName The garden name for vault naming
    /// @return vault The created vault address
    function _createVaultForGarden(address garden, string calldata gardenName) private returns (address vault) {
        // Build vault name and symbol
        string memory vaultName = string(abi.encodePacked("Green Goods - ", gardenName));
        string memory vaultSymbol = string(abi.encodePacked("ggVAULT-", _truncate(gardenName, 8)));

        // Create vault with garden as role manager (owner)
        try octantFactory.deployNewVault(
            defaultAsset,
            vaultName,
            vaultSymbol,
            garden, // Garden TBA is the role manager
            defaultProfitUnlockTime
        ) returns (address newVault) {
            gardenVaults[garden] = newVault;
            emit VaultCreated(garden, newVault, defaultAsset);
            return newVault;
        } catch {
            // Non-blocking: emit event but don't revert
            // The router will catch this and continue
            revert VaultCreationFailed(garden);
        }
    }

    /// @notice Truncates a string to a maximum length
    /// @param str The string to truncate
    /// @param maxLen Maximum length
    /// @return The truncated string
    function _truncate(string calldata str, uint256 maxLen) private pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        if (strBytes.length <= maxLen) return str;

        bytes memory truncated = new bytes(maxLen);
        for (uint256 i = 0; i < maxLen; i++) {
            truncated[i] = strBytes[i];
        }
        return string(truncated);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UUPS Upgrade
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Authorizes an upgrade to a new implementation
    /// @param newImplementation The address of the new implementation
    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
