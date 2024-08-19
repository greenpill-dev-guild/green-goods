// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { EAS_ARBITRUM, EAS_SEPOLIA } from "../Constants.sol";

error InvalidChainId();

library EASLib {
    function getEAS() external view returns (address) {
        address token;

        if (block.chainid == 42161) {
            token = EAS_ARBITRUM;
        } else if (block.chainid == 11155111) {
            token = EAS_SEPOLIA;
        } else {
            revert InvalidChainId();
        }

        return token;
    }
}
