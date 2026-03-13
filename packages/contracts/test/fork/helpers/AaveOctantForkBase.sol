// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IOctantVault } from "../../../src/interfaces/IOctantFactory.sol";
import { AaveV3ERC4626 } from "../../../src/strategies/AaveV3ERC4626.sol";
import { MultistrategyVault } from "../../../src/vendor/octant/core/MultistrategyVault.sol";
import { MultistrategyVaultFactory } from "../../../src/vendor/octant/factories/MultistrategyVaultFactory.sol";
import { ForkTestBase } from "./ForkTestBase.sol";

interface IWETH9 {
    function deposit() external payable;
}

/// @notice Shared Arbitrum Aave-backed Octant vault helpers for fork suites.
abstract contract AaveOctantForkBase is ForkTestBase {
    address internal constant AAVE_V3_POOL = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
    address internal constant AAVE_V3_DATA_PROVIDER = 0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654;
    address internal constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address internal constant AWETH = 0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8;

    function _deployVaultFactory(string memory label) internal returns (address factory) {
        MultistrategyVault vaultImpl = new MultistrategyVault();
        factory = address(new MultistrategyVaultFactory(label, address(vaultImpl), address(this)));
    }

    function _deployAaveTemplate(string memory name, string memory symbol) internal returns (address template) {
        template = address(
            new AaveV3ERC4626(WETH, name, symbol, AAVE_V3_POOL, AWETH, AAVE_V3_DATA_PROVIDER, address(octantModule))
        );
    }

    function _configureAaveVaultSupport(string memory label, string memory name, string memory symbol) internal {
        octantModule.setOctantFactory(_deployVaultFactory(label));
        octantModule.setSupportedAsset(WETH, _deployAaveTemplate(name, symbol));
    }

    function _setupOctantVaultWithAave(
        address garden,
        string memory label,
        string memory name,
        string memory symbol
    )
        internal
        returns (address vault)
    {
        _configureAaveVaultSupport(label, name, symbol);
        vault = octantModule.createVaultForAsset(garden, WETH);
        assertTrue(vault != address(0), "vault should be created");
        assertTrue(octantModule.vaultStrategies(vault) != address(0), "vault should have a live strategy");
    }

    function _depositWethIntoVault(address vault, uint256 amount) internal {
        vm.deal(address(this), amount);
        IWETH9(WETH).deposit{ value: amount }();
        IERC20(WETH).approve(vault, amount);
        IOctantVault(vault).deposit(amount, address(this));
        assertGt(IOctantVault(vault).balanceOf(address(this)), 0, "deposit should mint shares");
    }

    function _warpForHarvestWindow() internal {
        vm.warp(block.timestamp + 30 days);
        vm.roll(block.number + 216_000);
    }
}
