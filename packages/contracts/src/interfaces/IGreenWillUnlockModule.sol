// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IGreenWillUnlockModule
/// @notice Minimal interface for registry-driven Unlock badge minting
interface IGreenWillUnlockModule {
    /// @notice Grants a badge key on a specific Unlock lock
    /// @param lock The Unlock PublicLock address
    /// @param recipient The recipient of the key
    /// @return tokenId The minted key token id
    function mintBadge(address lock, address recipient) external returns (uint256 tokenId);
}
