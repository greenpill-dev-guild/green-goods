// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
/* solhint-disable no-console */

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";

import { OctantModule } from "../src/modules/Octant.sol";
import { AaveV3ERC4626 } from "../src/strategies/AaveV3ERC4626.sol";

/// @title RepairOctantAssets
/// @notice Replaces incompatible Octant supported-asset templates with ERC4626 Aave V3 templates.
contract RepairOctantAssets is Script {
    error UnsupportedChain(uint256 chainId);
    error MissingContract(string name);

    uint256 private constant ARBITRUM_CHAIN_ID = 42_161;
    address private constant ARBITRUM_AAVE_V3_POOL = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
    address private constant ARBITRUM_WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address private constant ARBITRUM_DAI = 0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1;
    address private constant ARBITRUM_AWETH = 0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8;
    address private constant ARBITRUM_ADAI = 0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE;
    address private constant ARBITRUM_AAVE_V3_DATA_PROVIDER = 0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654;

    function loadProxyAddress(string memory contractName) internal view returns (address) {
        string memory chainIdStr = vm.toString(block.chainid);
        string memory deploymentPath = string.concat(vm.projectRoot(), "/deployments/", chainIdStr, "-latest.json");
        string memory json = vm.readFile(deploymentPath);
        string memory path = string.concat(".", contractName);
        return abi.decode(vm.parseJson(json, path), (address));
    }

    function repairArbitrumAssets() public {
        if (block.chainid != ARBITRUM_CHAIN_ID) revert UnsupportedChain(block.chainid);

        address proxy = loadProxyAddress("octantModule");
        if (proxy == address(0) || proxy.code.length == 0) revert MissingContract("octantModule");

        OctantModule octantModule = OctantModule(proxy);
        console.log("Repairing Octant templates for proxy:", proxy);

        vm.startBroadcast();

        AaveV3ERC4626 wethTemplate = new AaveV3ERC4626(
            ARBITRUM_WETH,
            "GG Aave WETH",
            "ggaWETH",
            ARBITRUM_AAVE_V3_POOL,
            ARBITRUM_AWETH,
            ARBITRUM_AAVE_V3_DATA_PROVIDER,
            proxy
        );
        AaveV3ERC4626 daiTemplate = new AaveV3ERC4626(
            ARBITRUM_DAI,
            "GG Aave DAI",
            "ggaDAI",
            ARBITRUM_AAVE_V3_POOL,
            ARBITRUM_ADAI,
            ARBITRUM_AAVE_V3_DATA_PROVIDER,
            proxy
        );

        octantModule.setSupportedAsset(ARBITRUM_WETH, address(wethTemplate));
        octantModule.setSupportedAsset(ARBITRUM_DAI, address(daiTemplate));

        vm.stopBroadcast();

        console.log("WETH template:", address(wethTemplate));
        console.log("DAI template:", address(daiTemplate));
        console.log("Octant supported assets repaired successfully");
    }
}
