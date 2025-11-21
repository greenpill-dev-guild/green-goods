// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";

import { GardenToken } from "../src/tokens/Garden.sol";
import { GardenAccount } from "../src/accounts/Garden.sol";

/**
 * @title Deploy Additional Gardens
 * @notice Script for deploying additional gardens from gardens.json config
 * @dev Reads garden configurations from JSON and mints them with openJoining settings
 *
 * Usage:
 *   forge script script/DeployAdditionalGardens.s.sol:DeployAdditionalGardens \
 *     --rpc-url arbitrum \
 *     --account green-goods-deployer \
 *     --broadcast
 */
contract DeployAdditionalGardens is Script {
    error InvalidGardenIndex();
    error MissingDeploymentData();

    function run() external {
        console.log("\n=== Deploying Additional Gardens ===");

        // Load deployment data
        string memory chainIdStr = vm.toString(block.chainid);
        string memory deploymentPath = string.concat(vm.projectRoot(), "/deployments/", chainIdStr, "-latest.json");
        string memory deploymentJson = vm.readFile(deploymentPath);

        address gardenTokenAddress = abi.decode(vm.parseJson(deploymentJson, ".gardenToken"), (address));
        address communityToken = abi.decode(vm.parseJson(deploymentJson, ".communityToken"), (address));

        if (gardenTokenAddress == address(0)) revert MissingDeploymentData();

        console.log("GardenToken:", gardenTokenAddress);
        console.log("CommunityToken:", communityToken);

        // Load gardens config
        string memory configPath = string.concat(vm.projectRoot(), "/config/gardens.json");
        string memory json = vm.readFile(configPath);

        GardenToken gardenToken = GardenToken(gardenTokenAddress);

        vm.startBroadcast();

        // Start from index 2 (skip root garden at index 0 and open garden at index 1 if already deployed)
        // You can adjust the starting index based on what's already deployed
        uint256 startIndex = 2;
        try vm.envUint("START_INDEX") returns (uint256 val) {
            startIndex = val;
        } catch {} // solhint-disable-line no-empty-blocks

        uint256 maxGardens = 10;
        try vm.envUint("MAX_GARDENS") returns (uint256 val) {
            maxGardens = val;
        } catch {} // solhint-disable-line no-empty-blocks

        for (uint256 i = startIndex; i < maxGardens; i++) {
            string memory basePath = string.concat(".gardens[", vm.toString(i), "]");

            // Try to read garden name - if it fails, we've reached the end
            try vm.parseJson(json, string.concat(basePath, ".name")) returns (bytes memory nameBytes) {
                if (nameBytes.length == 0) break;

                _deployGarden(gardenToken, communityToken, json, basePath, i);
            } catch {
                console.log("Reached end of gardens at index:", i);
                break;
            }
        }

        vm.stopBroadcast();

        console.log("\n=== Gardens Deployed Successfully ===\n");
    }

    function _deployGarden(
        GardenToken gardenToken,
        address communityToken,
        string memory json,
        string memory basePath,
        uint256 index
    )
        internal
    {
        console.log("\n--- Deploying Garden", index, "---");

        // Parse garden config
        string memory name = abi.decode(vm.parseJson(json, string.concat(basePath, ".name")), (string));
        string memory description = abi.decode(vm.parseJson(json, string.concat(basePath, ".description")), (string));
        string memory location = abi.decode(vm.parseJson(json, string.concat(basePath, ".location")), (string));
        string memory bannerImage = abi.decode(vm.parseJson(json, string.concat(basePath, ".bannerImage")), (string));

        string memory metadata = "";
        try vm.parseJson(json, string.concat(basePath, ".metadata")) returns (bytes memory metadataBytes) {
            metadata = abi.decode(metadataBytes, (string));
            // solhint-disable-next-line no-empty-blocks
        } catch {
            // Default to empty if not specified
        }

        bool openJoining = false;
        try vm.parseJson(json, string.concat(basePath, ".openJoining")) returns (bytes memory openJoiningBytes) {
            openJoining = abi.decode(openJoiningBytes, (bool));
            // solhint-disable-next-line no-empty-blocks
        } catch {
            // Default to false if not specified
        }

        address[] memory gardeners = abi.decode(vm.parseJson(json, string.concat(basePath, ".gardeners")), (address[]));
        address[] memory operators = abi.decode(vm.parseJson(json, string.concat(basePath, ".operators")), (address[]));

        console.log("Name:", name);
        console.log("Location:", location);
        console.log("Open Joining:", openJoining);
        console.log("Gardeners:", gardeners.length);
        console.log("Operators:", operators.length);

        // Mint the garden
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            communityToken: communityToken,
            name: name,
            description: description,
            location: location,
            bannerImage: bannerImage,
            metadata: metadata,
            gardeners: gardeners,
            gardenOperators: operators
        });
        address gardenAddress = gardenToken.mintGarden(config);

        console.log("Garden Address:", gardenAddress);

        // Set openJoining if specified in config
        if (openJoining) {
            GardenAccount garden = GardenAccount(payable(gardenAddress));
            // Check if caller is operator before trying to set
            if (garden.gardenOperators(msg.sender)) {
                garden.setOpenJoining(true);
                console.log("Open joining enabled");
            } else {
                console.log("WARNING: Cannot enable open joining - caller not an operator");
            }
        }
    }
}
