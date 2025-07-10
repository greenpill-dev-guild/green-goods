// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { TOKENBOUND_REGISTRY, SALT } from "../Constants.sol";
import { IERC6551Registry } from "../interfaces/IERC6551Registry.sol";

error InvalidChainId();

/// @title TBALib
/// @notice A library for interacting with Token Bound Accounts (TBA) on different chains.
/// @dev This library handles the creation and retrieval of TBA accounts based on the current chain ID.
library TBALib {
    /// @notice Creates a TBA account based on the current chain ID.
    /// @dev Reverts with `InvalidChainId` if the chain ID is not recognized.
    /// @param implementation The address of the TBA implementation contract.
    /// @param tokenContract The address of the token contract associated with the TBA.
    /// @param tokenId The ID of the token associated with the TBA.
    /// @return The address of the created TBA account.
    function createAccount(address implementation, address tokenContract, uint256 tokenId) external returns (address) {
        if (
            block.chainid == 42_161 || block.chainid == 11_155_111 || block.chainid == 8453 || block.chainid == 10
                || block.chainid == 42_220 || block.chainid == 31_337
        ) {
            return IERC6551Registry(TOKENBOUND_REGISTRY).createAccount(
                implementation, SALT, block.chainid, tokenContract, tokenId
            );
        } else {
            revert InvalidChainId();
        }
    }

    /// @notice Retrieves a TBA account based on the current chain ID.
    /// @dev Reverts with `InvalidChainId` if the chain ID is not recognized.
    /// @param implementation The address of the TBA implementation contract.
    /// @param tokenContract The address of the token contract associated with the TBA.
    /// @param tokenId The ID of the token associated with the TBA.
    /// @return The address of the TBA account.
    function getAccount(
        address implementation,
        address tokenContract,
        uint256 tokenId
    )
        external
        view
        returns (address)
    {
        if (
            block.chainid == 42_161 || block.chainid == 11_155_111 || block.chainid == 8453 || block.chainid == 10
                || block.chainid == 42_220 || block.chainid == 31_337
        ) {
            return IERC6551Registry(TOKENBOUND_REGISTRY).account(
                implementation, SALT, block.chainid, tokenContract, tokenId
            );
        } else {
            revert InvalidChainId();
        }
    }
}
