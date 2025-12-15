// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

error InvalidChainId();

/// @title EASLib
/// @notice A library to retrieve the EAS address based on the current chain ID.
/// @dev This library uses the block's chain ID to determine the appropriate EAS address.
library EASLib {
    // EAS (ETHEREUM ATTESTATION SERVICE)
    address internal constant EAS_ARBITRUM = 0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458;
    address internal constant EAS_BASE_SEPOLIA = 0x4200000000000000000000000000000000000021;
    address internal constant EAS_CELO = 0x72E1d8ccf5299fb36fEfD8CC4394B8ef7e98Af92;

    address internal constant EAS_SCHEMA_REGISTRY_ARBITRUM = 0xA310da9c5B885E7fb3fbA9D66E9Ba6Df512b78eB;
    address internal constant EAS_SCHEMA_REGISTRY_BASE_SEPOLIA = 0x4200000000000000000000000000000000000020;
    address internal constant EAS_SCHEMA_REGISTRY_CELO = 0x5ece93bE4BDCF293Ed61FA78698B594F2135AF34;
    /// @notice Returns the EAS address based on the current chain ID.
    /// @dev Reverts with `InvalidChainId` if the chain ID is not recognized.
    /// @return The address of the EAS.

    function getEAS() internal view returns (address) {
        if (block.chainid == 42_161) {
            return EAS_ARBITRUM;
        } else if (block.chainid == 84_532) {
            return EAS_BASE_SEPOLIA;
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
        } else if (block.chainid == 84_532) {
            return EAS_SCHEMA_REGISTRY_BASE_SEPOLIA;
        } else if (block.chainid == 42_220) {
            return EAS_SCHEMA_REGISTRY_CELO;
        } else if (block.chainid == 31_337) {
            return EAS_SCHEMA_REGISTRY_CELO; // Use Celo schema registry for localhost fork testing
        } else {
            revert InvalidChainId();
        }
    }
}
