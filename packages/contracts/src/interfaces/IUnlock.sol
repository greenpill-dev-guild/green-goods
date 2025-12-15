// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IUnlockFactory
/// @notice Minimal interface for Unlock Protocol's lock factory
/// @dev Used to deploy new PublicLock contracts (badge/membership contracts)
/// @custom:see https://docs.unlock-protocol.com/core-protocol/smart-contracts-api/Unlock
interface IUnlockFactory {
    /// @notice Creates a new lock (membership/badge contract)
    /// @param data Encoded lock initialization data
    /// @param lockVersion Version of the lock template to use
    /// @return lock Address of the newly created lock
    function createLock(bytes calldata data, uint16 lockVersion) external returns (address lock);

    /// @notice Gets the latest lock template version
    /// @return The latest version number
    function publicLockLatestVersion() external view returns (uint16);
}

/// @title IPublicLock
/// @notice Minimal interface for Unlock Protocol's PublicLock contract
/// @dev A "Lock" is a membership contract; "Keys" are the NFT memberships
/// @custom:see https://docs.unlock-protocol.com/core-protocol/smart-contracts-api/PublicLock
interface IPublicLock {
    /// @notice Grants keys (badges/memberships) to recipients without payment
    /// @dev Only lock managers can call this function
    /// @param _recipients Array of addresses to receive keys
    /// @param _expirationTimestamps Array of expiration timestamps for each key
    /// @param _keyManagers Array of addresses to manage each key
    /// @return tokenIds Array of token IDs for the granted keys
    function grantKeys(
        address[] calldata _recipients,
        uint256[] calldata _expirationTimestamps,
        address[] calldata _keyManagers
    ) external returns (uint256[] memory tokenIds);

    /// @notice Checks if an address has a valid (non-expired) key
    /// @param _user The address to check
    /// @return hasKey True if the user has a valid key
    function getHasValidKey(address _user) external view returns (bool hasKey);

    /// @notice Gets the expiration timestamp for a user's key
    /// @param _user The address to check
    /// @return timestamp The expiration timestamp (0 if no key)
    function keyExpirationTimestampFor(address _user) external view returns (uint256 timestamp);

    /// @notice Adds a lock manager
    /// @param account Address to add as manager
    function addLockManager(address account) external;

    /// @notice Checks if an address is a lock manager
    /// @param account Address to check
    /// @return True if the account is a lock manager
    function isLockManager(address account) external view returns (bool);

    /// @notice Renounces the lock manager role for the caller
    function renounceLockManager() external;

    /// @notice Returns the name of the lock
    /// @return The lock name
    function name() external view returns (string memory);

    /// @notice Returns the lock's symbol
    /// @return The lock symbol
    function symbol() external view returns (string memory);

    /// @notice Returns the total number of keys issued
    /// @return Total supply
    function totalSupply() external view returns (uint256);

    /// @notice Returns the maximum number of keys that can be sold
    /// @return Max number of keys
    function maxNumberOfKeys() external view returns (uint256);

    /// @notice Returns the duration of each key
    /// @return Duration in seconds
    function expirationDuration() external view returns (uint256);
}
