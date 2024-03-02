// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import {TOKENBOUND_REGISTRY} from "../Constants.sol";
import {IERC6551Registry} from "../interfaces/IERC6551Registry.sol";

error InvalidChainId();

library TBALib {
    function createAccount(address implmentation, address tokenContract, uint256 tokenId) internal returns (address) {
        address account;

        if (block.chainid == 8453) {
            account =
                IERC6551Registry(TOKENBOUND_REGISTRY).createAccount(
                    implmentation, 
                "",
                8453, 
                tokenContract, 
                tokenId
                );
        } else if (block.chainid == 84532) {
            account =
                IERC6551Registry(TOKENBOUND_REGISTRY).createAccount(
                    implmentation, 
                "",
                84532, 
                tokenContract, 
                tokenId
            );
        } else if (block.chainid == 11155111) {
            account = IERC6551Registry(TOKENBOUND_REGISTRY).createAccount(
                implmentation, 
                "",
                11155111, 
                tokenContract, 
                tokenId
            );
        } else {
            revert InvalidChainId();
        }

        return account;
    }

    function getAccount(address implmentation, address tokenContract, uint256 tokenId)
        internal
        view
        returns (address)
    {
        address account;

        if (block.chainid == 8453) {
            account = IERC6551Registry(TOKENBOUND_REGISTRY).account(
                    implmentation, 
                "",
                8453, 
                tokenContract, 
                tokenId
                );
        } else if (block.chainid == 84532) {
            account = IERC6551Registry(TOKENBOUND_REGISTRY).account(
                    implmentation, 
                "",
                84532, 
                tokenContract, 
                tokenId
                );
        } else if (block.chainid == 11155111) {
            account = IERC6551Registry(TOKENBOUND_REGISTRY).account(
                    implmentation, 
                "",
                11155111, 
                tokenContract, 
                tokenId
                );
        } else {
            revert InvalidChainId();
        }

        return account;
    }
}
