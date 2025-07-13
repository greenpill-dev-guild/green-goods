// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {
    COMMUNITY_TOKEN_ARBITRUM,
    COMMUNITY_TOKEN_SEPOLIA,
    COMMUNITY_TOKEN_BASE,
    COMMUNITY_TOKEN_OPTIMISM,
    COMMUNITY_TOKEN_CELO
} from "../Constants.sol";

error InvalidChainId();

/// @title CommunityTokenLib
/// @notice A library to retrieve the community token address based on the current chain ID.
/// @dev This library uses the block's chain ID to determine the appropriate community token.
library CommunityTokenLib {
    /// @notice Returns the community token address based on the current chain ID.
    /// @dev Reverts with `InvalidChainId` if the chain ID is not recognized.
    /// @return The address of the community token.
    function getCommunityToken() internal view returns (address) {
        if (block.chainid == 42_161) {
            return COMMUNITY_TOKEN_ARBITRUM;
        } else if (block.chainid == 11_155_111) {
            return COMMUNITY_TOKEN_SEPOLIA;
        } else if (block.chainid == 8453) {
            return COMMUNITY_TOKEN_BASE;
        } else if (block.chainid == 84_532) {
            return COMMUNITY_TOKEN_SEPOLIA; // Base Sepolia uses Sepolia community token
        } else if (block.chainid == 10) {
            return COMMUNITY_TOKEN_OPTIMISM;
        } else if (block.chainid == 42_220) {
            return COMMUNITY_TOKEN_CELO;
        } else if (block.chainid == 31_337) {
            return COMMUNITY_TOKEN_CELO; // Use Celo token for localhost fork testing
        } else {
            revert InvalidChainId();
        }
    }
}
