// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {COMMUNITY_TOKEN_ARBITRUM, COMMUNITY_TOKEN_SEPOLIA} from "../Constants.sol";

error InvalidChainId();

library CommunityTokenLib {
    function getCommunityToken() external view returns (address) {
        address token;

        if (block.chainid == 42161) {
           token = COMMUNITY_TOKEN_ARBITRUM;
        } else if (block.chainid == 11155111) {
           token = COMMUNITY_TOKEN_SEPOLIA;
        } else {
            revert InvalidChainId();
        }

        return token;
    }
}
