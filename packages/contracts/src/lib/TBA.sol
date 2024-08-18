// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {TOKENBOUND_REGISTRY} from "../Constants.sol";
import {IERC6551Registry} from "../interfaces/IERC6551Registry.sol";

error InvalidChainId();

library TBALib {
    function createAccount(address implmentation, address tokenContract, uint256 tokenId) external returns (address) {
        address account;

        if (block.chainid == 42161) {
            account = IERC6551Registry(TOKENBOUND_REGISTRY).createAccount(
                implmentation,
                42161,
                tokenContract,
                tokenId,
                7,
                ""
            );

        } else if (block.chainid == 11155111) {
            account = IERC6551Registry(TOKENBOUND_REGISTRY).createAccount(
                implmentation,
                11155111,
                tokenContract,
                tokenId,
                7,
                ""
            );
        } else {
            revert InvalidChainId();
        }

        return account;
    }

    function getAccount(address implmentation, address tokenContract, uint256 tokenId) external view returns (address) {
        address account;

        if (block.chainid == 42161) {
            account = IERC6551Registry(TOKENBOUND_REGISTRY).account(
                implmentation,
                42161,
                tokenContract,
                tokenId,
                7
            );

        } else if (block.chainid == 11155111) {
            account = IERC6551Registry(TOKENBOUND_REGISTRY).account(
                implmentation,
                11155111,
                tokenContract,
                tokenId,
                7
            );
        } else {
            revert InvalidChainId();
        }

        return account;
    }
}
