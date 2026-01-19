// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IOctantFactory
/// @notice Minimal interface for Octant's Multi-Strategy Vault Factory
/// @dev Based on Octant V2 Multi-Strategy Vault system
/// @custom:see https://docs.v2.octant.build/docs/integration_guides_and_tutorials/multi-strategy-vaults/
interface IOctantFactory {
    /// @notice Deploys a new multi-strategy vault
    /// @param asset The underlying asset for the vault (e.g., USDC)
    /// @param _name The name for the vault token
    /// @param symbol The symbol for the vault token
    /// @param roleManager The address that will manage vault roles
    /// @param profitMaxUnlockTime Time in seconds over which profits unlock
    /// @return vault The address of the newly deployed vault
    function deployNewVault(
        address asset,
        string memory _name,
        string memory symbol,
        address roleManager,
        uint256 profitMaxUnlockTime
    )
        external
        returns (address vault);
}

/// @title IOctantVault
/// @notice Minimal interface for interacting with an Octant vault
interface IOctantVault {
    /// @notice Deposits assets into the vault
    /// @param assets Amount of assets to deposit
    /// @param receiver Address to receive vault shares
    /// @return shares Amount of shares minted
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);

    /// @notice Withdraws assets from the vault
    /// @param assets Amount of assets to withdraw
    /// @param receiver Address to receive assets
    /// @param owner Address that owns the shares
    /// @return shares Amount of shares burned
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);

    /// @notice Returns the total assets in the vault
    /// @return Total assets
    function totalAssets() external view returns (uint256);

    /// @notice Returns the vault's underlying asset
    /// @return The asset address
    function asset() external view returns (address);
}
