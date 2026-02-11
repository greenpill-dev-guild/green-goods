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
    uint256 public override totalSupply;
    address public override strategy;

    mapping(address account => uint256 balance) public balances;

    error InsufficientShares();
    error UnauthorizedRoleManager();

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

    function deposit(uint256 assets, address receiver) external override returns (uint256 shares) {
        shares = convertToShares(assets);
        _totalAssets += assets;
        totalSupply += shares;
        balances[receiver] += shares;
    }

    function withdraw(uint256 assets, address, address owner) external override returns (uint256 shares) {
        shares = convertToShares(assets);
        if (balances[owner] < shares) revert InsufficientShares();
        _totalAssets -= assets;
        totalSupply -= shares;
        balances[owner] -= shares;
    }

    function totalAssets() external view override returns (uint256) {
        return _totalAssets;
    }

    function redeem(uint256 shares, address, address owner) external override returns (uint256 assets) {
        if (balances[owner] < shares) revert InsufficientShares();

        assets = convertToAssets(shares);
        if (_totalAssets < assets) revert InsufficientShares();

        _totalAssets -= assets;
        totalSupply -= shares;
        balances[owner] -= shares;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return balances[account];
    }

    function convertToAssets(uint256 shares) public pure override returns (uint256 assets) {
        return shares;
    }

    function convertToShares(uint256 assets) public pure override returns (uint256 shares) {
        return assets;
    }

    function previewDeposit(uint256 assets) external pure override returns (uint256 shares) {
        return assets;
    }

    function previewWithdraw(uint256 assets) external pure override returns (uint256 shares) {
        return assets;
    }

    function maxDeposit(address) external pure override returns (uint256 assets) {
        return type(uint256).max;
    }

    function maxWithdraw(address account) external view override returns (uint256 assets) {
        return balances[account];
    }

    function addStrategy(address _strategy) external override {
        if (msg.sender != roleManager) revert UnauthorizedRoleManager();
        strategy = _strategy;
    }
}
