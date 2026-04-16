// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

import { IUnlockFactory, IPublicLock } from "../interfaces/IUnlock.sol";
import { ZeroAddress, UnauthorizedCaller } from "../errors/CommonErrors.sol";

/// @title GreenWillUnlockModule
/// @notice Registry-owned mint adapter for GreenWill Unlock badge keys
contract GreenWillUnlockModule is OwnableUpgradeable, UUPSUpgradeable {
    error FactoryNotConfigured();
    error InvalidLockAddress();

    event RegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event FactoryUpdated(address indexed oldFactory, address indexed newFactory);
    event DefaultDurationUpdated(uint256 oldDuration, uint256 newDuration);
    event LockCreated(address indexed lock);
    event BadgeMinted(address indexed lock, address indexed recipient, uint256 tokenId);

    address public registry;
    IUnlockFactory public unlockFactory;
    uint256 public defaultDuration;

    uint256[47] private __gap;

    modifier onlyRegistry() {
        if (msg.sender != registry) revert UnauthorizedCaller(msg.sender);
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _owner,
        address _registry,
        address _unlockFactory,
        uint256 _defaultDuration
    )
        external
        initializer
    {
        if (_owner == address(0)) revert ZeroAddress();
        if (_registry == address(0)) revert ZeroAddress();

        __Ownable_init();
        _transferOwnership(_owner);

        registry = _registry;
        unlockFactory = IUnlockFactory(_unlockFactory);
        defaultDuration = _defaultDuration;

        emit RegistryUpdated(address(0), _registry);
        if (_unlockFactory != address(0)) {
            emit FactoryUpdated(address(0), _unlockFactory);
        }
        emit DefaultDurationUpdated(0, _defaultDuration);
    }

    function setRegistry(address _registry) external onlyOwner {
        if (_registry == address(0)) revert ZeroAddress();

        address oldRegistry = registry;
        registry = _registry;
        emit RegistryUpdated(oldRegistry, _registry);
    }

    function setUnlockFactory(address _unlockFactory) external onlyOwner {
        address oldFactory = address(unlockFactory);
        unlockFactory = IUnlockFactory(_unlockFactory);
        emit FactoryUpdated(oldFactory, _unlockFactory);
    }

    function setDefaultDuration(uint256 _defaultDuration) external onlyOwner {
        uint256 oldDuration = defaultDuration;
        defaultDuration = _defaultDuration;
        emit DefaultDurationUpdated(oldDuration, _defaultDuration);
    }

    function createLock(bytes calldata lockData) external onlyOwner returns (address lock) {
        if (address(unlockFactory) == address(0)) revert FactoryNotConfigured();

        uint16 lockVersion = unlockFactory.publicLockLatestVersion();
        lock = unlockFactory.createLock(lockData, lockVersion);

        emit LockCreated(lock);
    }

    function mintBadge(address lock, address recipient) external onlyRegistry returns (uint256 tokenId) {
        if (lock == address(0)) revert InvalidLockAddress();
        if (recipient == address(0)) revert ZeroAddress();

        address[] memory recipients = new address[](1);
        recipients[0] = recipient;

        uint256[] memory expirationTimestamps = new uint256[](1);
        expirationTimestamps[0] = _getExpirationTimestamp();

        address[] memory keyManagers = new address[](1);
        keyManagers[0] = recipient;

        uint256[] memory tokenIds = IPublicLock(lock).grantKeys(recipients, expirationTimestamps, keyManagers);
        tokenId = tokenIds[0];

        emit BadgeMinted(lock, recipient, tokenId);
    }

    function _getExpirationTimestamp() internal view returns (uint256) {
        if (defaultDuration == 0) {
            return type(uint256).max;
        }

        return block.timestamp + defaultDuration;
    }

    function _authorizeUpgrade(address) internal override onlyOwner { }
}
