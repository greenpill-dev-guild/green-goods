// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { IUnlockFactory, IPublicLock } from "../interfaces/IUnlock.sol";

/// @title UnlockModule
/// @notice Integration module for granting work badges via Unlock Protocol
/// @dev Called by GreenGoodsResolver; grants NFT keys as work badges
///
/// **Purpose:**
/// - Grants "work badges" (Unlock keys) to gardeners when their work is approved
/// - Each garden can have its own badge contract (PublicLock)
/// - Badges serve as verifiable credentials for completed work
///
/// **Execution Flow:**
/// 1. Resolver calls `onWorkApproved()` after work approval
/// 2. Module checks if garden has a badge contract configured
/// 3. If configured, grants a key to the worker
/// 4. Keys can have custom duration (permanent, time-limited, etc.)
///
/// **Architecture:**
/// - Upgradeable via UUPS pattern
/// - Isolated from resolver — failures don't block attestations
/// - Per-garden badge configuration (different locks per garden)
/// - Supports both auto-created and manually configured locks
contract UnlockModule is OwnableUpgradeable, UUPSUpgradeable {
    // ═══════════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Emitted when a badge is granted to a worker
    event BadgeGranted(
        address indexed garden, address indexed worker, address indexed lock, uint256 tokenId, bytes32 workUID
    );

    /// @notice Emitted when a badge lock is configured for a garden
    event GardenLockConfigured(address indexed garden, address indexed lock);

    /// @notice Emitted when a badge lock is removed from a garden
    event GardenLockRemoved(address indexed garden, address indexed oldLock);

    /// @notice Emitted when a new lock is created for a garden
    event LockCreated(address indexed garden, address indexed lock);

    /// @notice Emitted when the Unlock factory address is updated
    event FactoryUpdated(address indexed oldFactory, address indexed newFactory);

    /// @notice Emitted when the router is updated
    event RouterUpdated(address indexed oldRouter, address indexed newRouter);

    /// @notice Emitted when default badge duration is updated
    event DefaultDurationUpdated(uint256 oldDuration, uint256 newDuration);

    // ═══════════════════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════════════════

    error UnauthorizedCaller(address caller);
    error ZeroAddress();
    error FactoryNotConfigured();
    error LockNotConfigured(address garden);
    error LockAlreadyConfigured(address garden);
    error InvalidLockAddress();
    error BadgeGrantFailed(address garden, address worker);
    error LockCreationFailed(address garden);

    // ═══════════════════════════════════════════════════════════════════════════
    // Storage
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice The Unlock factory contract
    IUnlockFactory public unlockFactory;

    /// @notice The integration router that can call this module
    address public router;

    /// @notice Mapping of garden address to badge lock address
    mapping(address garden => address lock) public gardenLocks;

    /// @notice Default badge duration in seconds (0 = permanent)
    uint256 public defaultBadgeDuration;

    /// @notice Storage gap for future upgrades
    uint256[46] private __gap;

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
    /// @param _unlockFactory The Unlock factory address (can be zero if not yet deployed)
    /// @param _defaultDuration Default badge duration in seconds (0 = permanent)
    function initialize(
        address _owner,
        address _router,
        address _unlockFactory,
        uint256 _defaultDuration
    )
        external
        initializer
    {
        if (_owner == address(0)) revert ZeroAddress();
        if (_router == address(0)) revert ZeroAddress();

        __Ownable_init();
        _transferOwnership(_owner);

        router = _router;
        unlockFactory = IUnlockFactory(_unlockFactory);
        defaultBadgeDuration = _defaultDuration;

        emit RouterUpdated(address(0), _router);
        if (_unlockFactory != address(0)) {
            emit FactoryUpdated(address(0), _unlockFactory);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Module Entry Points
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Called when work is approved — grants badge to worker
    /// @dev Called by router; silently skips if no lock configured for garden
    /// @param garden The garden account address
    /// @param worker The worker who submitted the work
    /// @param workUID The UID of the work attestation
    /// @return tokenId The badge token ID (0 if not granted)
    function onWorkApproved(
        address garden,
        address worker,
        bytes32 workUID
    )
        external
        onlyRouter
        returns (uint256 tokenId)
    {
        // Get configured lock for garden
        address lock = gardenLocks[garden];
        if (lock == address(0)) return 0; // No lock configured, skip silently

        // Grant badge to worker
        tokenId = _grantBadge(garden, lock, worker, workUID);
        return tokenId;
    }

    /// @notice Checks if a garden has a badge lock configured
    /// @param garden The garden address
    /// @return True if the garden has a lock configured
    function hasLock(address garden) external view returns (bool) {
        return gardenLocks[garden] != address(0);
    }

    /// @notice Gets the badge lock for a garden
    /// @param garden The garden address
    /// @return The lock address (or zero if none)
    function getLock(address garden) external view returns (address) {
        return gardenLocks[garden];
    }

    /// @notice Checks if a worker has a valid badge from a garden
    /// @param garden The garden address
    /// @param worker The worker address
    /// @return True if worker has a valid (non-expired) badge
    function hasValidBadge(address garden, address worker) external view returns (bool) {
        address lock = gardenLocks[garden];
        if (lock == address(0)) return false;

        return IPublicLock(lock).getHasValidKey(worker);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Admin Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Configures a badge lock for a garden
    /// @dev Lock must already exist; use createLockForGarden to create new
    /// @param garden The garden address
    /// @param lock The lock address to configure
    function configureLockForGarden(address garden, address lock) external onlyOwner {
        if (garden == address(0)) revert ZeroAddress();
        if (lock == address(0)) revert InvalidLockAddress();
        if (gardenLocks[garden] != address(0)) revert LockAlreadyConfigured(garden);

        gardenLocks[garden] = lock;
        emit GardenLockConfigured(garden, lock);
    }

    /// @notice Removes the badge lock configuration for a garden
    /// @param garden The garden address
    function removeLockForGarden(address garden) external onlyOwner {
        address oldLock = gardenLocks[garden];
        if (oldLock == address(0)) revert LockNotConfigured(garden);

        delete gardenLocks[garden];
        emit GardenLockRemoved(garden, oldLock);
    }

    /// @notice Updates the Unlock factory address
    /// @param _factory The new factory address
    function setUnlockFactory(address _factory) external onlyOwner {
        address oldFactory = address(unlockFactory);
        unlockFactory = IUnlockFactory(_factory);
        emit FactoryUpdated(oldFactory, _factory);
    }

    /// @notice Updates the router address
    /// @param _router The new router address
    function setRouter(address _router) external onlyOwner {
        if (_router == address(0)) revert ZeroAddress();
        address oldRouter = router;
        router = _router;
        emit RouterUpdated(oldRouter, _router);
    }

    /// @notice Updates the default badge duration
    /// @param _duration The new duration in seconds (0 = permanent)
    function setDefaultBadgeDuration(uint256 _duration) external onlyOwner {
        uint256 oldDuration = defaultBadgeDuration;
        defaultBadgeDuration = _duration;
        emit DefaultDurationUpdated(oldDuration, _duration);
    }

    /// @notice Creates a new lock for a garden using Unlock factory
    /// @dev Requires factory to be configured
    /// @param garden The garden address
    /// @param lockData Encoded lock initialization data (see Unlock docs)
    /// @return lock The created lock address
    function createLockForGarden(address garden, bytes calldata lockData) external onlyOwner returns (address lock) {
        if (address(unlockFactory) == address(0)) revert FactoryNotConfigured();
        if (gardenLocks[garden] != address(0)) revert LockAlreadyConfigured(garden);

        // Get latest lock version
        uint16 lockVersion = unlockFactory.publicLockLatestVersion();

        // Create lock
        try unlockFactory.createLock(lockData, lockVersion) returns (address newLock) {
            gardenLocks[garden] = newLock;
            emit LockCreated(garden, newLock);
            emit GardenLockConfigured(garden, newLock);
            return newLock;
        } catch {
            revert LockCreationFailed(garden);
        }
    }

    /// @notice Grants a badge manually (admin only)
    /// @param garden The garden address
    /// @param worker The worker to grant badge to
    /// @param workUID The work UID for tracking
    /// @return tokenId The badge token ID
    function grantBadgeManually(
        address garden,
        address worker,
        bytes32 workUID
    )
        external
        onlyOwner
        returns (uint256 tokenId)
    {
        address lock = gardenLocks[garden];
        if (lock == address(0)) revert LockNotConfigured(garden);

        return _grantBadge(garden, lock, worker, workUID);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Grants a badge to a worker
    /// @param garden The garden address
    /// @param lock The lock address
    /// @param worker The worker address
    /// @param workUID The work UID
    /// @return tokenId The granted token ID
    function _grantBadge(address garden, address lock, address worker, bytes32 workUID) private returns (uint256 tokenId) {
        // Build arrays for grantKeys
        address[] memory recipients = new address[](1);
        recipients[0] = worker;

        uint256[] memory expirations = new uint256[](1);
        // Use default duration; 0 means permanent (type(uint256).max)
        expirations[0] = defaultBadgeDuration == 0 ? type(uint256).max : block.timestamp + defaultBadgeDuration;

        address[] memory keyManagers = new address[](1);
        keyManagers[0] = address(0); // No key manager

        // Grant key
        try IPublicLock(lock).grantKeys(recipients, expirations, keyManagers) returns (uint256[] memory tokenIds) {
            tokenId = tokenIds[0];
            emit BadgeGranted(garden, worker, lock, tokenId, workUID);
            return tokenId;
        } catch {
            // Non-blocking: module failures shouldn't block attestations
            revert BadgeGrantFailed(garden, worker);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UUPS Upgrade
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Authorizes an upgrade to a new implementation
    /// @param newImplementation The address of the new implementation
    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner { }
}
