// SPDX-License-Identifier: MIT
// solhint-disable one-contract-per-file
pragma solidity ^0.8.25;

import { IUnlockFactory, IPublicLock } from "../interfaces/IUnlock.sol";

/// @title MockUnlockFactory
/// @notice Mock implementation of Unlock factory for testing
contract MockUnlockFactory is IUnlockFactory {
    uint16 public constant LATEST_VERSION = 14;
    uint256 public lockCount;

    /// @notice Creates a mock lock
    function createUpgradeableLockAtVersion(bytes calldata, uint16) external override returns (address lock) {
        lockCount++;
        lock = address(new MockPublicLock());
        return lock;
    }

    /// @notice Returns latest lock version
    function publicLockLatestVersion() external pure override returns (uint16) {
        return LATEST_VERSION;
    }
}

/// @title MockPublicLock
/// @notice Mock implementation of Unlock PublicLock for testing
contract MockPublicLock is IPublicLock {
    bytes32 public constant LOCK_MANAGER_ROLE = keccak256("LOCK_MANAGER");
    bytes32 public constant KEY_GRANTER_ROLE = keccak256("KEY_GRANTER");

    mapping(address => uint256) public keyExpiration;
    mapping(address => bool) public lockManagers;
    mapping(bytes32 => mapping(address => bool)) private _roles;
    uint256 public nextTokenId = 1;
    uint256 public _totalSupply;
    uint256 public transferFeeBasisPoints;

    string private _name = "Test Badge";
    string private _symbol = "TBADGE";
    uint256 private _maxKeys = type(uint256).max;
    uint256 private _expirationDuration = 365 days;

    constructor() {
        lockManagers[msg.sender] = true;
        _roles[LOCK_MANAGER_ROLE][msg.sender] = true;
        _roles[KEY_GRANTER_ROLE][msg.sender] = true;
    }

    function initialize(
        address lockCreator,
        uint256 expirationDuration_,
        address,
        uint256,
        uint256 maxNumberOfKeys_,
        string calldata lockName
    )
        external
        override
    {
        lockManagers[lockCreator] = true;
        _roles[LOCK_MANAGER_ROLE][lockCreator] = true;
        _roles[KEY_GRANTER_ROLE][lockCreator] = true;
        _expirationDuration = expirationDuration_;
        _maxKeys = maxNumberOfKeys_;
        _name = lockName;
    }

    /// @notice Grants keys to recipients
    function grantKeys(
        address[] calldata _recipients,
        uint256[] calldata _expirationTimestamps,
        address[] calldata
    )
        external
        override
        returns (uint256[] memory tokenIds)
    {
        tokenIds = new uint256[](_recipients.length);

        for (uint256 i = 0; i < _recipients.length; i++) {
            tokenIds[i] = nextTokenId++;
            keyExpiration[_recipients[i]] = _expirationTimestamps[i];
            _totalSupply++;
        }

        return tokenIds;
    }

    /// @notice Checks if user has valid key
    function getHasValidKey(address _user) external view override returns (bool) {
        return keyExpiration[_user] > block.timestamp;
    }

    /// @notice Gets key expiration
    function keyExpirationTimestampFor(address _user) external view override returns (uint256) {
        return keyExpiration[_user];
    }

    /// @notice Adds lock manager
    function addLockManager(address account) external override {
        lockManagers[account] = true;
        _roles[LOCK_MANAGER_ROLE][account] = true;
    }

    function grantRole(bytes32 role, address account) external override {
        _roles[role][account] = true;
        if (role == LOCK_MANAGER_ROLE) {
            lockManagers[account] = true;
        }
    }

    function hasRole(bytes32 role, address account) external view override returns (bool) {
        return _roles[role][account];
    }

    function updateTransferFee(uint256 transferFeeBasisPoints_) external override {
        transferFeeBasisPoints = transferFeeBasisPoints_;
    }

    /// @notice Checks if account is lock manager
    function isLockManager(address account) external view override returns (bool) {
        return lockManagers[account];
    }

    /// @notice Renounces lock manager role
    function renounceLockManager() external override {
        lockManagers[msg.sender] = false;
    }

    function name() external view override returns (string memory) {
        return _name;
    }

    function symbol() external view override returns (string memory) {
        return _symbol;
    }

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function maxNumberOfKeys() external view override returns (uint256) {
        return _maxKeys;
    }

    function expirationDuration() external view override returns (uint256) {
        return _expirationDuration;
    }
}
