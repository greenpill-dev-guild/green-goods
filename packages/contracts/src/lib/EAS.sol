// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {
    EAS_ARBITRUM,
    EAS_SEPOLIA,
    EAS_BASE,
    EAS_OPTIMISM,
    EAS_CELO,
    EAS_SCHEMA_REGISTRY_ARBITRUM,
    EAS_SCHEMA_REGISTRY_SEPOLIA,
    EAS_SCHEMA_REGISTRY_BASE,
    EAS_SCHEMA_REGISTRY_OPTIMISM,
    EAS_SCHEMA_REGISTRY_CELO
} from "../Constants.sol";

error InvalidChainId();

/// @title EASLib
/// @notice A library to retrieve the EAS address based on the current chain ID.
/// @dev This library uses the block's chain ID to determine the appropriate EAS address.
library EASLib {
    /// @notice Returns the EAS address based on the current chain ID.
    /// @dev Reverts with `InvalidChainId` if the chain ID is not recognized.
    /// @return The address of the EAS.
    function getEAS() internal view returns (address) {
        if (block.chainid == 42_161) {
            return EAS_ARBITRUM;
        } else if (block.chainid == 11_155_111) {
            return EAS_SEPOLIA;
        } else if (block.chainid == 8453) {
            return EAS_BASE;
        } else if (block.chainid == 84_532) {
            return EAS_BASE; // Base Sepolia uses same EAS address as Base
        } else if (block.chainid == 10) {
            return EAS_OPTIMISM;
        } else if (block.chainid == 42_220) {
            return EAS_CELO;
        } else if (block.chainid == 31_337) {
            return EAS_CELO; // Use Celo EAS for localhost fork testing
        } else {
            revert InvalidChainId();
        }
    }

    function getSchemaRegistry() internal view returns (address) {
        if (block.chainid == 42_161) {
            return EAS_SCHEMA_REGISTRY_ARBITRUM;
        } else if (block.chainid == 11_155_111) {
            return EAS_SCHEMA_REGISTRY_SEPOLIA;
        } else if (block.chainid == 8453) {
            return EAS_SCHEMA_REGISTRY_BASE;
        } else if (block.chainid == 84_532) {
            return EAS_SCHEMA_REGISTRY_BASE; // Base Sepolia uses same schema registry as Base
        } else if (block.chainid == 10) {
            return EAS_SCHEMA_REGISTRY_OPTIMISM;
        } else if (block.chainid == 42_220) {
            return EAS_SCHEMA_REGISTRY_CELO;
        } else if (block.chainid == 31_337) {
            return EAS_SCHEMA_REGISTRY_CELO; // Use Celo schema registry for localhost fork testing
        } else {
            revert InvalidChainId();
        }
    }
}
