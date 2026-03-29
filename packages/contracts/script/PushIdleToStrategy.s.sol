// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
/* solhint-disable no-console */

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { OctantModule } from "../src/modules/Octant.sol";
import { IOctantVault } from "../src/interfaces/IOctantFactory.sol";

interface IWETH9 {
    function deposit() external payable;
}

/// @title PushIdleToStrategy
/// @notice One-off script to push idle vault funds into their Aave strategies.
///
///         The trick: since autoAllocate=true and strategies are wired, depositing
///         even 1 wei of WETH triggers `_update_debt(strategy, max)` which pushes
///         ALL idle funds (old + new) into Aave. No contract upgrade needed.
///
///         Fixes 3 gardens where deposits arrived (Feb 25 – Mar 6) before strategies
///         were attached on Mar 18 via enableAutoAllocate.
contract PushIdleToStrategy is Script {
    error UnsupportedChain(uint256 chainId);
    error MissingContract(string name);

    uint256 private constant ARBITRUM_CHAIN_ID = 42_161;
    address private constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;

    // The 3 gardens with idle WETH (deposits before strategy attachment)
    address private constant GARDEN_1 = 0xF7b892886998DAe960D64a9db488336684F137A0; // 0.27 WETH idle
    address private constant GARDEN_2 = 0xD1F8e787a325F91F5d4Be2D30ea1E67B19e28b30; // 0.80 WETH idle
    address private constant GARDEN_3 = 0xFDa72CE1D75b735d6595E5814DDF23b97516caEf; // 0.75 WETH idle

    /// @dev Minimum deposit to trigger auto-allocate. 1 wei is enough but use a
    ///      small round amount for readability in block explorers.
    uint256 private constant NUDGE_AMOUNT = 1000; // 1000 wei (~0.000000000000001 ETH)

    function loadProxyAddress(string memory contractName) internal view returns (address) {
        string memory chainIdStr = vm.toString(block.chainid);
        string memory deploymentPath = string.concat(vm.projectRoot(), "/deployments/", chainIdStr, "-latest.json");
        string memory json = vm.readFile(deploymentPath);
        string memory path = string.concat(".", contractName);
        return abi.decode(vm.parseJson(json, path), (address));
    }

    function run() public {
        if (block.chainid != ARBITRUM_CHAIN_ID) revert UnsupportedChain(block.chainid);

        address proxy = loadProxyAddress("octantModule");
        if (proxy == address(0) || proxy.code.length == 0) revert MissingContract("octantModule");

        OctantModule octantModule = OctantModule(proxy);
        address[3] memory gardens = [GARDEN_1, GARDEN_2, GARDEN_3];

        console.log("=== Push Idle WETH to Aave Strategies ===");
        console.log("OctantModule:", proxy);
        console.log("Nudge amount:", NUDGE_AMOUNT, "wei per vault\n");

        // Count how many vaults need a nudge
        uint256 nudgeCount;
        for (uint256 i = 0; i < gardens.length; i++) {
            address vault = octantModule.getVaultForAsset(gardens[i], WETH);
            address strategy = octantModule.vaultStrategies(vault);
            uint256 idle = IERC20(WETH).balanceOf(vault);
            uint256 debt = IOctantVault(vault).totalAssets() - idle;

            console.log("Garden:", gardens[i]);
            console.log("  Vault:", vault);
            console.log("  Strategy:", strategy);
            console.log("  Idle WETH:", idle);
            console.log("  Deployed:", debt);

            if (idle == 0) {
                console.log("  => Already deployed, skipping\n");
            } else if (strategy == address(0)) {
                console.log("  => No strategy, skipping\n");
            } else if (!IOctantVault(vault).autoAllocate()) {
                console.log("  => autoAllocate disabled, skipping\n");
            } else {
                console.log("  => Will nudge deposit to trigger auto-allocate\n");
                nudgeCount++;
            }
        }

        if (nudgeCount == 0) {
            console.log("Nothing to do -- all vaults already deployed.");
            return;
        }

        // Total ETH needed: NUDGE_AMOUNT * nudgeCount (negligible)
        uint256 totalNeeded = NUDGE_AMOUNT * nudgeCount;
        console.log("Total ETH needed for nudge deposits:", totalNeeded, "wei");
        console.log("Broadcasting", nudgeCount, "deposit transactions...\n");

        vm.startBroadcast();

        // Wrap ETH -> WETH for the nudge deposits
        IWETH9(WETH).deposit{ value: totalNeeded }();

        for (uint256 i = 0; i < gardens.length; i++) {
            address vault = octantModule.getVaultForAsset(gardens[i], WETH);
            address strategy = octantModule.vaultStrategies(vault);
            uint256 idle = IERC20(WETH).balanceOf(vault);

            if (idle == 0 || strategy == address(0) || !IOctantVault(vault).autoAllocate()) continue;

            // Approve + deposit triggers auto-allocate which pushes ALL idle to strategy
            IERC20(WETH).approve(vault, NUDGE_AMOUNT);
            IOctantVault(vault).deposit(NUDGE_AMOUNT, msg.sender);
            console.log("Nudged garden:", gardens[i]);
        }

        vm.stopBroadcast();

        // Post-flight: verify idle is now ~0
        console.log("\n=== Verification ===\n");
        for (uint256 i = 0; i < gardens.length; i++) {
            address vault = octantModule.getVaultForAsset(gardens[i], WETH);
            uint256 idle = IERC20(WETH).balanceOf(vault);
            uint256 total = IOctantVault(vault).totalAssets();

            console.log("Garden:", gardens[i]);
            console.log("  Remaining idle:", idle);
            console.log("  Total assets:", total);
            console.log("");
        }
    }
}
