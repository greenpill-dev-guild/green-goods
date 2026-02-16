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
}
