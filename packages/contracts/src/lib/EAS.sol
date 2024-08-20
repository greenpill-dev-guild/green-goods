// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { EAS_ARBITRUM, EAS_SEPOLIA, EAS_SCHEMA_REGISTRY_ARBITRUM, EAS_SCHEMA_REGISTRY_SEPOLIA } from "../Constants.sol";

error InvalidChainId();

/// @title EASLib
/// @notice A library to retrieve the EAS address based on the current chain ID.
/// @dev This library uses the block's chain ID to determine the appropriate EAS address.
library EASLib {
    /// @notice Returns the EAS address based on the current chain ID.
    /// @dev Reverts with `InvalidChainId` if the chain ID is not recognized.
    /// @return The address of the EAS.
    function getEAS() internal view returns (address) {
        if (block.chainid == 42161) {
            return EAS_ARBITRUM;
        } else if (block.chainid == 11155111) {
            return EAS_SEPOLIA;
        } else {
            revert InvalidChainId();
        }
    }

    function getSchemaRegistry() internal view returns (address) {
        if (block.chainid == 42161) {
            return EAS_SCHEMA_REGISTRY_ARBITRUM;
        } else if (block.chainid == 11155111) {
            return EAS_SCHEMA_REGISTRY_SEPOLIA;
        } else {
            revert InvalidChainId();
        }
    }
}
