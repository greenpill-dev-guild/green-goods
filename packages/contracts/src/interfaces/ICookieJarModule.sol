// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title ICookieJarModule
/// @notice Interface for the CookieJarModule that creates per-asset jars for gardens
/// @dev Called by GardenToken during mintGarden() to create Cookie Jar vaults
interface ICookieJarModule {
    // ═══════════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Emitted when a new Cookie Jar vault is created for a garden
    event JarCreated(address indexed garden, address indexed asset, address indexed jar);

    // ═══════════════════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════════════════

    error UnauthorizedCaller(address caller);
    error ZeroAddress();
    error AssetNotFound(address asset);

    // ═══════════════════════════════════════════════════════════════════════════
    // Garden Mint Callback
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Called by GardenToken during mint. Creates one jar per supported asset.
    /// @param garden The garden account address
    /// @return jars Array of created jar addresses (one per supported asset)
    function onGardenMinted(address garden) external returns (address[] memory jars);

    // ═══════════════════════════════════════════════════════════════════════════
    // View Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Get all jar addresses for a garden
    function getGardenJars(address garden) external view returns (address[] memory);

    /// @notice Get the jar address for a specific garden + asset pair
    function getGardenJar(address garden, address asset) external view returns (address);
}
