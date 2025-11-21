// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IENSRegistrar
/// @notice Interface for Green Goods ENS Subdomain Registrar
/// @dev Manages greengoods.eth subdomains for Gardener accounts with passkey recovery
interface IENSRegistrar {
    /// @notice Emitted when a subdomain is registered with recovery data
    /// @param name Subdomain name (without .greengoods.eth)
    /// @param owner The Gardener account address that owns this subdomain
    /// @param credentialId WebAuthn credential ID for passkey recovery
    /// @param timestamp Registration timestamp
    event SubdomainRegistered(string indexed name, address indexed owner, bytes32 indexed credentialId, uint256 timestamp);

    /// @notice Check if a subdomain name is available
    /// @param name The subdomain name to check (e.g., "alice")
    /// @return True if available, false if already taken
    function available(string calldata name) external view returns (bool);

    /// @notice Register a subdomain for a Gardener account with passkey recovery data
    /// @dev Only callable by the Gardener account itself (msg.sender == owner)
    /// @param name The subdomain name (e.g., "alice" for alice.greengoods.eth)
    /// @param owner The Gardener account address
    /// @param credentialId WebAuthn credential ID for passkey recovery
    function register(string calldata name, address owner, bytes32 credentialId) external;

    /// @notice Get the owner of a subdomain
    /// @param name The subdomain name
    /// @return The Gardener account address that owns this subdomain
    function ownerOf(string calldata name) external view returns (address);

    /// @notice Resolve a subdomain name to an address
    /// @param name The subdomain name
    /// @return The Gardener account address
    function resolve(string calldata name) external view returns (address);

    /// @notice Get recovery data for a subdomain
    /// @param name The subdomain name
    /// @return owner The Gardener account address
    /// @return credentialId The passkey credential ID for recovery
    /// @return claimedAt The timestamp when the subdomain was claimed
    function getRecoveryData(string calldata name)
        external
        view
        returns (address owner, bytes32 credentialId, uint256 claimedAt);
}
