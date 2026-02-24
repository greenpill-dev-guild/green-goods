// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;
/* solhint-disable no-console */

import { Script, console2 } from "forge-std/Script.sol";
import { stdJson } from "forge-std/StdJson.sol";
import { MultistrategyVault } from "@octant/core/MultistrategyVault.sol";
import { MultistrategyVaultFactory } from "@octant/factories/MultistrategyVaultFactory.sol";

/// @title DeployOctantFactory
/// @notice Deploys the Octant vault factory for Green Goods
/// @dev Invoked via CLI: bun deploy.ts octant-factory --network <chain> --broadcast
///      Saves deployment result to deployments/{chainId}-octant-factory.json
contract DeployOctantFactory is Script {
    using stdJson for string;

    function run() external {
        vm.startBroadcast();

        // 1. Deploy vault implementation (constructor poisons `asset` to prevent direct init)
        MultistrategyVault implementation = new MultistrategyVault();
        console2.log("Vault implementation:", address(implementation));

        // 2. Deploy factory — governance = deployer (transferred to multisig post-deploy)
        MultistrategyVaultFactory factory =
            new MultistrategyVaultFactory("Green Goods Vault Factory", address(implementation), msg.sender);
        console2.log("Vault factory:", address(factory));
        console2.log("Factory name:", factory.name());
        console2.log("Factory governance:", factory.governance());

        vm.stopBroadcast();

        // 3. Save deployment result for CLI to pick up
        _saveResult(address(factory), address(implementation));
    }

    /// @notice Write factory + implementation addresses to JSON for the TS wrapper
    function _saveResult(address factory, address implementation) internal {
        string memory obj = "octantFactory";
        vm.serializeAddress(obj, "factory", factory);
        vm.serializeAddress(obj, "implementation", implementation);
        string memory finalJson = vm.serializeAddress(obj, "governance", msg.sender);

        string memory chainIdStr = vm.toString(block.chainid);
        string memory outPath = string.concat(vm.projectRoot(), "/deployments/", chainIdStr, "-octant-factory.json");
        vm.writeJson(finalJson, outPath);
        console2.log("Saved to:", outPath);
    }
}
