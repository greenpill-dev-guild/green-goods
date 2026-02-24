// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v5.0.0) (interfaces/IERC4626.sol)

pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title IERC4626Payable
 * @author OpenZeppelin; modified by [Golem Foundation](https://golem.foundation)
 * @custom:security-contact security@golem.foundation
 * @custom:origin https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.0/contracts/interfaces/IERC4626.sol
 * @notice ERC4626 interface with payable deposit/mint functions
 * @dev Modified from standard ERC4626 to make deposit() and mint() payable
 *      Enables ETH-based vault operations
 */
interface IERC4626Payable is IERC20, IERC20Metadata {
    /// @notice Emitted when assets are deposited into vault
    /// @param sender Address executing the deposit
    /// @param owner Address receiving the shares
    /// @param assets Amount of assets deposited in asset base units
    /// @param shares Amount of shares minted in share base units
    event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);

    /// @notice Emitted when assets are withdrawn from vault
    /// @param sender Address executing the withdrawal
    /// @param receiver Address receiving the assets
    /// @param owner Address whose shares are being burned
    /// @param assets Amount of assets withdrawn in asset base units
    /// @param shares Amount of shares burned in share base units
    event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);

    /**
     * @notice Deposits assets into vault and mints shares to receiver
     * @dev Mints Vault shares to receiver by depositing exact amount of underlying tokens.
     *
     * - MUST emit the Deposit event.
     * - MAY support an additional flow in which the underlying tokens are owned by the Vault contract before the
     *   deposit execution, and are accounted for during deposit.
     * - MUST revert if all of assets cannot be deposited (due to deposit limit being reached, slippage, the user not
     *   approving enough underlying tokens to the Vault contract, etc).
     *
     * NOTE: most implementations will require pre-approval of the Vault with the Vault's underlying asset token.
     * NOTE: differs from standard ERC4626 by making this function payable.
     * @param assets Amount of underlying assets to deposit in asset base units
     * @param receiver Address to receive the minted shares
     * @return shares Amount of shares minted in share base units
     */
    function deposit(uint256 assets, address receiver) external payable returns (uint256 shares);

    /**
     * @notice Mints exact amount of shares to receiver by depositing required assets
     * @dev Mints exact number of Vault shares to receiver by depositing required amount of underlying tokens.
     *
     * - MUST emit the Deposit event.
     * - MAY support an additional flow in which the underlying tokens are owned by the Vault contract before the mint
     *   execution, and are accounted for during mint.
     * - MUST revert if all of shares cannot be minted (due to deposit limit being reached, slippage, the user not
     *   approving enough underlying tokens to the Vault contract, etc).
     *
     * NOTE: most implementations will require pre-approval of the Vault with the Vault's underlying asset token.
     * NOTE: differs from standard ERC4626 by making this function payable.
     * @param shares Exact amount of shares to mint in share base units
     * @param receiver Address to receive the minted shares
     * @return assets Amount of assets deposited in asset base units
     */
    function mint(uint256 shares, address receiver) external payable returns (uint256 assets);

    /**
     * @notice Withdraws exact amount of assets from vault by burning owner's shares
     * @dev Burns shares from owner and sends exact amount of underlying assets to receiver.
     *
     * - MUST emit the Withdraw event.
     * - MAY support an additional flow in which the underlying tokens are owned by the Vault contract before the
     *   withdraw execution, and are accounted for during withdraw.
     * - MUST revert if all of assets cannot be withdrawn (due to withdrawal limit being reached, slippage, the owner
     *   not having enough shares, etc).
     *
     * Note that some implementations will require pre-requesting to the Vault before a withdrawal may be performed.
     * Those methods should be performed separately.
     * @param assets Exact amount of assets to withdraw in asset base units
     * @param receiver Address to receive the withdrawn assets
     * @param owner Address whose shares will be burned
     * @return shares Amount of shares burned in share base units
     */
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);

    /**
     * @notice Redeems exact amount of shares from owner and sends assets to receiver
     * @dev Burns exact number of shares from owner and sends underlying assets to receiver.
     *
     * - MUST emit the Withdraw event.
     * - MAY support an additional flow in which the underlying tokens are owned by the Vault contract before the
     *   redeem execution, and are accounted for during redeem.
     * - MUST revert if all of shares cannot be redeemed (due to withdrawal limit being reached, slippage, the owner
     *   not having enough shares, etc).
     *
     * NOTE: some implementations will require pre-requesting to the Vault before a withdrawal may be performed.
     * Those methods should be performed separately.
     * @param shares Exact amount of shares to redeem in share base units
     * @param receiver Address to receive the withdrawn assets
     * @param owner Address whose shares will be burned
     * @return assets Amount of assets withdrawn in asset base units
     */
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);

    /**
     * @notice Returns the underlying asset token address
     * @dev Returns the address of the underlying token used for the Vault for accounting, depositing, and withdrawing.
     *
     * - MUST be an ERC-20 token contract.
     * - MUST NOT revert.
     * @return assetTokenAddress Address of the underlying ERC-20 asset
     */
    function asset() external view returns (address assetTokenAddress);

    /**
     * @notice Returns total assets managed by vault including yield and fees
     * @dev Returns the total amount of the underlying asset that is "managed" by Vault.
     *
     * - SHOULD include any compounding that occurs from yield.
     * - MUST be inclusive of any fees that are charged against assets in the Vault.
     * - MUST NOT revert.
     * @return totalManagedAssets Total amount of assets in asset base units
     */
    function totalAssets() external view returns (uint256 totalManagedAssets);

    /**
     * @notice Converts asset amount to equivalent share amount
     * @dev Returns the amount of shares that the Vault would exchange for the amount of assets provided, in an ideal
     * scenario where all the conditions are met.
     *
     * - MUST NOT be inclusive of any fees that are charged against assets in the Vault.
     * - MUST NOT show any variations depending on the caller.
     * - MUST NOT reflect slippage or other on-chain conditions, when performing the actual exchange.
     * - MUST NOT revert.
     *
     * NOTE: This calculation MAY NOT reflect the "per-user" price-per-share, and instead should reflect the
     * "average-user's" price-per-share, meaning what the average user should expect to see when exchanging to and
     * from.
     * @param assets Amount of assets in asset base units
     * @return shares Equivalent amount of shares in share base units
     */
    function convertToShares(uint256 assets) external view returns (uint256 shares);

    /**
     * @notice Converts share amount to equivalent asset amount
     * @dev Returns the amount of assets that the Vault would exchange for the amount of shares provided, in an ideal
     * scenario where all the conditions are met.
     *
     * - MUST NOT be inclusive of any fees that are charged against assets in the Vault.
     * - MUST NOT show any variations depending on the caller.
     * - MUST NOT reflect slippage or other on-chain conditions, when performing the actual exchange.
     * - MUST NOT revert.
     *
     * NOTE: This calculation MAY NOT reflect the "per-user" price-per-share, and instead should reflect the
     * "average-user's" price-per-share, meaning what the average user should expect to see when exchanging to and
     * from.
     * @param shares Amount of shares in share base units
     * @return assets Equivalent amount of assets in asset base units
     */
    function convertToAssets(uint256 shares) external view returns (uint256 assets);

    /**
     * @notice Returns maximum asset amount that receiver can deposit
     * @dev Returns the maximum amount of the underlying asset that can be deposited into the Vault for the receiver,
     * through a deposit call.
     *
     * - MUST return a limited value if receiver is subject to some deposit limit.
     * - MUST return 2 ** 256 - 1 if there is no limit on the maximum amount of assets that may be deposited.
     * - MUST NOT revert.
     * @param receiver Address that would receive the shares
     * @return maxAssets Maximum assets that can be deposited in asset base units
     */
    function maxDeposit(address receiver) external view returns (uint256 maxAssets);

    /**
     * @notice Simulates shares returned for depositing given assets
     * @dev Allows an on-chain or off-chain user to simulate the effects of their deposit at the current block, given
     * current on-chain conditions.
     *
     * - MUST return as close to and no more than the exact amount of Vault shares that would be minted in a deposit
     *   call in the same transaction. I.e. deposit should return the same or more shares as previewDeposit if called
     *   in the same transaction.
     * - MUST NOT account for deposit limits like those returned from maxDeposit and should always act as though the
     *   deposit would be accepted, regardless if the user has enough tokens approved, etc.
     * - MUST be inclusive of deposit fees. Integrators should be aware of the existence of deposit fees.
     * - MUST NOT revert.
     *
     * NOTE: any unfavorable discrepancy between convertToShares and previewDeposit SHOULD be considered slippage in
     * share price or some other type of condition, meaning the depositor will lose assets by depositing.
     * @param assets Amount of assets to simulate depositing in asset base units
     * @return shares Expected shares to be minted in share base units
     */
    function previewDeposit(uint256 assets) external view returns (uint256 shares);

    /**
     * @notice Returns maximum share amount that receiver can mint
     * @dev Returns the maximum amount of the Vault shares that can be minted for the receiver, through a mint call.
     * - MUST return a limited value if receiver is subject to some mint limit.
     * - MUST return 2 ** 256 - 1 if there is no limit on the maximum amount of shares that may be minted.
     * - MUST NOT revert.
     * @param receiver Address that would receive the shares
     * @return maxShares Maximum shares that can be minted in share base units
     */
    function maxMint(address receiver) external view returns (uint256 maxShares);

    /**
     * @notice Simulates assets required for minting given shares
     * @dev Allows an on-chain or off-chain user to simulate the effects of their mint at the current block, given
     * current on-chain conditions.
     *
     * - MUST return as close to and no fewer than the exact amount of assets that would be deposited in a mint call
     *   in the same transaction. I.e. mint should return the same or fewer assets as previewMint if called in the
     *   same transaction.
     * - MUST NOT account for mint limits like those returned from maxMint and should always act as though the mint
     *   would be accepted, regardless if the user has enough tokens approved, etc.
     * - MUST be inclusive of deposit fees. Integrators should be aware of the existence of deposit fees.
     * - MUST NOT revert.
     *
     * NOTE: any unfavorable discrepancy between convertToAssets and previewMint SHOULD be considered slippage in
     * share price or some other type of condition, meaning the depositor will lose assets by minting.
     * @param shares Amount of shares to simulate minting in share base units
     * @return assets Expected assets required in asset base units
     */
    function previewMint(uint256 shares) external view returns (uint256 assets);

    /**
     * @notice Returns maximum asset amount that owner can withdraw
     * @dev Returns the maximum amount of the underlying asset that can be withdrawn from the owner balance in the
     * Vault, through a withdraw call.
     *
     * - MUST return a limited value if owner is subject to some withdrawal limit or timelock.
     * - MUST NOT revert.
     * @param owner Address whose assets are being queried
     * @return maxAssets Maximum assets that can be withdrawn in asset base units
     */
    function maxWithdraw(address owner) external view returns (uint256 maxAssets);

    /**
     * @notice Simulates shares required for withdrawing given assets
     * @dev Allows an on-chain or off-chain user to simulate the effects of their withdrawal at the current block,
     * given current on-chain conditions.
     *
     * - MUST return as close to and no fewer than the exact amount of Vault shares that would be burned in a withdraw
     *   call in the same transaction. I.e. withdraw should return the same or fewer shares as previewWithdraw if
     *   called
     *   in the same transaction.
     * - MUST NOT account for withdrawal limits like those returned from maxWithdraw and should always act as though
     *   the withdrawal would be accepted, regardless if the user has enough shares, etc.
     * - MUST be inclusive of withdrawal fees. Integrators should be aware of the existence of withdrawal fees.
     * - MUST NOT revert.
     *
     * NOTE: any unfavorable discrepancy between convertToShares and previewWithdraw SHOULD be considered slippage in
     * share price or some other type of condition, meaning the depositor will lose assets by depositing.
     * @param assets Amount of assets to simulate withdrawing in asset base units
     * @return shares Expected shares to be burned in share base units
     */
    function previewWithdraw(uint256 assets) external view returns (uint256 shares);

    /**
     * @notice Returns maximum share amount that owner can redeem
     * @dev Returns the maximum amount of Vault shares that can be redeemed from the owner balance in the Vault,
     * through a redeem call.
     *
     * - MUST return a limited value if owner is subject to some withdrawal limit or timelock.
     * - MUST return balanceOf(owner) if owner is not subject to any withdrawal limit or timelock.
     * - MUST NOT revert.
     * @param owner Address whose shares are being queried
     * @return maxShares Maximum shares that can be redeemed in share base units
     */
    function maxRedeem(address owner) external view returns (uint256 maxShares);

    /**
     * @notice Simulates assets returned for redeeming given shares
     * @dev Allows an on-chain or off-chain user to simulate the effects of their redeemption at the current block,
     * given current on-chain conditions.
     *
     * - MUST return as close to and no more than the exact amount of assets that would be withdrawn in a redeem call
     *   in the same transaction. I.e. redeem should return the same or more assets as previewRedeem if called in the
     *   same transaction.
     * - MUST NOT account for redemption limits like those returned from maxRedeem and should always act as though the
     *   redemption would be accepted, regardless if the user has enough shares, etc.
     * - MUST be inclusive of withdrawal fees. Integrators should be aware of the existence of withdrawal fees.
     * - MUST NOT revert.
     *
     * NOTE: any unfavorable discrepancy between convertToAssets and previewRedeem SHOULD be considered slippage in
     * share price or some other type of condition, meaning the depositor will lose assets by redeeming.
     * @param shares Amount of shares to simulate redeeming in share base units
     * @return assets Expected assets to be withdrawn in asset base units
     */
    function previewRedeem(uint256 shares) external view returns (uint256 assets);
}
