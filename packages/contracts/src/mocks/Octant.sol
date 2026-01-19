// SPDX-License-Identifier: MIT
// solhint-disable one-contract-per-file
pragma solidity ^0.8.25;

import { IOctantFactory, IOctantVault } from "../interfaces/IOctantFactory.sol";

/// @title MockOctantFactory
/// @notice Mock implementation of Octant factory for testing
contract MockOctantFactory is IOctantFactory {
    mapping(address => address) public deployedVaults;
    uint256 public vaultCount;

    /// @notice Deploys a mock vault
    function deployNewVault(
        address asset,
        string memory _name,
        string memory symbol,
        address roleManager,
        uint256 profitMaxUnlockTime
    )
        external
        override
        returns (address vault)
    {
        vaultCount++;
        vault = address(new MockOctantVault(asset, _name, symbol, roleManager, profitMaxUnlockTime));
        deployedVaults[roleManager] = vault;
        return vault;
    }
}

/// @title MockOctantVault
/// @notice Mock implementation of Octant vault for testing
contract MockOctantVault is IOctantVault {
    address public override asset;
    string public name;
    string public symbol;
    address public roleManager;
    uint256 public profitUnlockTime;
    uint256 public _totalAssets;

    constructor(
        address _asset,
        string memory _name,
        string memory _symbol,
        address _roleManager,
        uint256 _profitUnlockTime
    ) {
        asset = _asset;
        name = _name;
        symbol = _symbol;
        roleManager = _roleManager;
        profitUnlockTime = _profitUnlockTime;
    }

    function deposit(uint256 assets, address) external override returns (uint256 shares) {
        _totalAssets += assets;
        return assets; // 1:1 for mock
    }

    function withdraw(uint256 assets, address, address) external override returns (uint256 shares) {
        _totalAssets -= assets;
        return assets; // 1:1 for mock
    }

    function totalAssets() external view override returns (uint256) {
        return _totalAssets;
    }
}
