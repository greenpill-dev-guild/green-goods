// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IERC6551Account
/// @notice Minimal ERC-6551 account interface for token metadata lookups
interface IERC6551Account {
    /// @notice Returns the token bound to this account
    /// @return chainId The chain ID of the token
    /// @return tokenContract The ERC-721 contract address
    /// @return tokenId The token ID
    function token() external view returns (uint256 chainId, address tokenContract, uint256 tokenId);
}
