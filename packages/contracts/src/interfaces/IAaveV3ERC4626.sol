// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice Read-only interface for AaveV3ERC4626 template introspection inside OctantModule.
interface IAaveV3ERC4626 {
    function aavePool() external view returns (address);
    function aToken() external view returns (address);
    function dataProvider() external view returns (address);
    function setVault(address vault_) external;
}
