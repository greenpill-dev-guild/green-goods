// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IUnlockFactory, IPublicLock } from "../interfaces/IUnlock.sol";

/// @title MockUnlockFactory
/// @notice Mock implementation of Unlock factory for testing
contract MockUnlockFactory is IUnlockFactory {
    uint16 public constant LATEST_VERSION = 14;
    uint256 public lockCount;

    /// @notice Creates a mock lock
    function createLock(bytes calldata, uint16) external override returns (address lock) {
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
    mapping(address => uint256) public keyExpiration;
    mapping(address => bool) public lockManagers;
    uint256 public nextTokenId = 1;
    uint256 public _totalSupply;

    string private _name = "Test Badge";
    string private _symbol = "TBADGE";
    uint256 private _maxKeys = type(uint256).max;
    uint256 private _expirationDuration = 365 days;

    constructor() {
        lockManagers[msg.sender] = true;
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
