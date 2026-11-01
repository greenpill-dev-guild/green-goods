// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title ICookieJar
/// @notice Minimal interface for the jars Greenpill Dev Guild's CookieJarFactory deploys (sibling repo)
interface ICookieJar {
    /// @notice Pulls tokens from the caller and books them on the ledger that claims are paid from
    /// @param amount The ERC-20 amount to deposit, which the caller must have approved
    function deposit(uint256 amount) external payable;
}
