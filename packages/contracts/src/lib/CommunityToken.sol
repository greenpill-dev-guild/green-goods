// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { COMMUNITY_TOKEN_ARBITRUM, COMMUNITY_TOKEN_SEPOLIA } from "../Constants.sol";

error InvalidChainId();

/// @title CommunityTokenLib
/// @notice A library to retrieve the community token address based on the current chain ID.
/// @dev This library uses the block's chain ID to determine the appropriate community token.
library CommunityTokenLib {
    /// @notice Returns the community token address based on the current chain ID.
    /// @dev Reverts with `InvalidChainId` if the chain ID is not recognized.
    /// @return The address of the community token.
    function getCommunityToken() internal view returns (address) {
        if (block.chainid == 42161) {
            return COMMUNITY_TOKEN_ARBITRUM;
        } else if (block.chainid == 11155111) {
            return COMMUNITY_TOKEN_SEPOLIA;
        } else {
            revert InvalidChainId();
        }
    }
}
