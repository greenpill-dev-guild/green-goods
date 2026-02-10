// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IHatsModuleFactory
/// @notice Minimal interface for HatsModuleFactory clone deployments
interface IHatsModuleFactory {
    function createHatsModule(
        address implementation,
        uint256 hatId,
        bytes calldata otherImmutableArgs,
        bytes calldata initData,
        uint256 saltNonce
    )
        external
        returns (address);
}
