// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IENSRegistrar
/// @notice Interface for Green Goods ENS Subdomain Registrar
/// @dev Manages greengoods.eth subdomains for Gardener accounts
interface IENSRegistrar {
    /// @notice Emitted when a subdomain is registered
    /// @param name Subdomain name (without .greengoods.eth)
    /// @param owner The Gardener account address that owns this subdomain
    /// @param timestamp Registration timestamp
    event SubdomainRegistered(string indexed name, address indexed owner, uint256 timestamp);

    /// @notice Check if a subdomain name is available
    /// @param name The subdomain name to check (e.g., "alice")
    /// @return True if available, false if already taken
    function available(string calldata name) external view returns (bool);

    /// @notice Register a subdomain for a Gardener account
    /// @dev Only callable by the Gardener account itself (msg.sender == owner)
    /// @param name The subdomain name (e.g., "alice" for alice.greengoods.eth)
    /// @param owner The Gardener account address
    function register(string calldata name, address owner) external;

    /// @notice Get the owner of a subdomain
    /// @param name The subdomain name
    /// @return The Gardener account address that owns this subdomain
    function ownerOf(string calldata name) external view returns (address);

    /// @notice Resolve a subdomain name to an address
    /// @param name The subdomain name
    /// @return The Gardener account address
    function resolve(string calldata name) external view returns (address);
}

