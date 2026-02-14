// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title ICookieJar
/// @notice Minimal interface for Cookie Jar ERC-20 deposits
/// @dev Cookie Jar holds ERC-20 tokens (WETH/DAI) that gardeners/operators
///      withdraw via Hats-gated rules. This interface abstracts the deposit mechanism.
interface ICookieJar {
    /// @notice Deposit ERC-20 tokens into the Cookie Jar for a garden
    /// @param garden The garden account that owns the jar
    /// @param asset The ERC-20 token being deposited
    /// @param amount The amount to deposit (must be pre-approved)
    function deposit(address garden, address asset, uint256 amount) external;

    /// @notice Get the balance of a specific asset for a garden
    /// @param garden The garden account
    /// @param asset The ERC-20 token
    /// @return The balance
    function balanceOf(address garden, address asset) external view returns (uint256);
}
