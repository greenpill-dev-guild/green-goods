// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IHypercertMarketplace
/// @notice Minimal interface for purchasing Hypercert fractions on the marketplace
/// @dev The actual Hypercerts marketplace may use different function signatures;
///      this interface abstracts the purchase mechanism for Green Goods integration.
interface IHypercertMarketplace {
    /// @notice Purchase a fraction of a hypercert
    /// @param hypercertId The hypercert token ID to purchase a fraction of
    /// @param amount The amount of the payment asset to spend
    /// @param asset The ERC-20 payment asset (WETH/DAI)
    /// @param recipient The address to receive the fraction (garden treasury)
    /// @return fractionId The ID of the purchased fraction
    function buyFraction(
        uint256 hypercertId,
        uint256 amount,
        address asset,
        address recipient
    )
        external
        returns (uint256 fractionId);

    /// @notice Preview how many units would be purchased for a given amount
    /// @param hypercertId The hypercert token ID
    /// @param amount The payment amount
    /// @param asset The payment asset
    /// @return units The number of units that would be purchased
    function previewPurchase(uint256 hypercertId, uint256 amount, address asset) external view returns (uint256 units);

    /// @notice Get the minimum price per unit for a hypercert+asset pair
    /// @param hypercertId The hypercert token ID
    /// @param asset The payment asset
    /// @return pricePerUnit The price per unit (0 if no active order)
    function getMinPrice(uint256 hypercertId, address asset) external view returns (uint256 pricePerUnit);
}
