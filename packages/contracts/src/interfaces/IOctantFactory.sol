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
/// @notice Interface for interacting with an Octant MultistrategyVault
/// @dev Uses snake_case function names matching the real Yearn V3 convention
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
    /// @param maxLoss Maximum acceptable loss in basis points (0 = no loss tolerated)
    /// @param strategies_ Ordered list of strategies to withdraw from (empty = use default queue)
    /// @return shares Amount of shares burned
    function withdraw(
        uint256 assets,
        address receiver,
        address owner,
        uint256 maxLoss,
        address[] calldata strategies_
    )
        external
        returns (uint256 shares);

    /// @notice Redeems shares for underlying assets
    /// @param shares Amount of vault shares to redeem
    /// @param receiver Address to receive assets
    /// @param owner Address that owns the shares
    /// @param maxLoss Maximum acceptable loss in basis points (0 = no loss tolerated)
    /// @param strategies_ Ordered list of strategies to redeem from (empty = use default queue)
    /// @return assets Amount of assets returned
    function redeem(
        uint256 shares,
        address receiver,
        address owner,
        uint256 maxLoss,
        address[] calldata strategies_
    )
        external
        returns (uint256 assets);

    /// @notice Returns the total assets in the vault
    /// @return Total assets
    function totalAssets() external view returns (uint256);

    /// @notice Returns the vault's underlying asset
    /// @return The asset address
    function asset() external view returns (address);

    /// @notice Returns share balance for account
    /// @param account Account to query
    /// @return Share balance
    function balanceOf(address account) external view returns (uint256);

    /// @notice Returns total shares outstanding
    /// @return Total share supply
    function totalSupply() external view returns (uint256);

    /// @notice Converts shares to assets
    /// @param shares Share amount
    /// @return assets Asset amount
    function convertToAssets(uint256 shares) external view returns (uint256 assets);

    /// @notice Converts assets to shares
    /// @param assets Asset amount
    /// @return shares Share amount
    function convertToShares(uint256 assets) external view returns (uint256 shares);

    /// @notice Previews shares minted for a deposit
    /// @param assets Asset amount
    /// @return shares Share amount
    function previewDeposit(uint256 assets) external view returns (uint256 shares);

    /// @notice Previews shares burned for a withdrawal
    /// @param assets Asset amount
    /// @return shares Share amount
    function previewWithdraw(uint256 assets) external view returns (uint256 shares);

    /// @notice Maximum assets an account can deposit
    /// @param account Account to query
    /// @return assets Maximum deposit amount
    function maxDeposit(address account) external view returns (uint256 assets);

    /// @notice Maximum assets an account can withdraw
    /// @param account Account to query
    /// @return assets Maximum withdraw amount
    function maxWithdraw(address account) external view returns (uint256 assets);

    /// @notice Adds a new strategy to the vault
    /// @param newStrategy Strategy address to add
    /// @param addToQueue Whether to add the strategy to the default withdrawal queue
    function add_strategy(address newStrategy, bool addToQueue) external;

    /// @notice Revokes an existing strategy from the vault
    /// @param strategy Strategy address to revoke
    function revoke_strategy(address strategy) external;

    /// @notice Updates the maximum debt for a strategy
    /// @param strategy Strategy address
    /// @param newMaxDebt New maximum debt value
    function update_max_debt_for_strategy(address strategy, uint256 newMaxDebt) external;

    /// @notice Updates the debt of a strategy (triggers deposit/withdraw to strategy)
    /// @param strategy Strategy address
    /// @param targetDebt Target debt amount
    /// @param maxLoss Maximum acceptable loss in basis points during debt reduction
    /// @return newDebt Actual new debt after update
    function update_debt(address strategy, uint256 targetDebt, uint256 maxLoss) external returns (uint256 newDebt);

    /// @notice Processes a strategy report (profit/loss accounting)
    /// @param strategy Strategy address
    /// @return gain Profit amount
    /// @return loss Loss amount
    function process_report(address strategy) external returns (uint256 gain, uint256 loss);
}

/// @title IOctantStrategy
/// @notice Minimal interface for strategies attached to Octant vaults
interface IOctantStrategy {
    /// @notice Triggers a harvest and report cycle
    /// @return totalAssets Reported total assets
    function report() external returns (uint256 totalAssets);

    /// @notice Updates donation recipient used by strategy yield routing
    /// @param donationAddress Recipient address
    function setDonationAddress(address donationAddress) external;

    /// @notice Optional strategy shutdown hook for emergency scenarios
    function shutdown() external;
}
