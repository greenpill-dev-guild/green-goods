// SPDX-License-Identifier: UNLICENSED
/* solhint-disable max-line-length */
/* solhint-disable quotes */
/* solhint-disable no-console */
pragma solidity ^0.8.25;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {GardenToken} from "../src/tokens/Garden.sol";

/// @title DeployGarden
/// @notice Script for deploying the GardenToken contract and minting a garden.
contract DeployGarden is Script {
    function run() external {
        console.log("\n=== Deploying Garden ===");

        // Read configuration from environment variables
        string memory name = vm.envString("GARDEN_NAME");
        string memory description = vm.envString("GARDEN_DESCRIPTION");
        string memory location = vm.envString("GARDEN_LOCATION");
        string memory bannerImage = vm.envString("GARDEN_BANNER");
        string memory gardenersJson = vm.envString("GARDENERS");
        string memory operatorsJson = vm.envString("OPERATORS");

        console.log("\nGarden Configuration:");
        console.log("  Name:", name);
        console.log("  Description:", description);
        console.log("  Location:", location);

        // Get contract addresses from environment
        address gardenTokenAddress = vm.envAddress("GARDEN_TOKEN");
        address communityTokenAddress = vm.envAddress("COMMUNITY_TOKEN");

        console.log("\nContract Addresses:");
        console.log("  GardenToken:", gardenTokenAddress);
        console.log("  CommunityToken:", communityTokenAddress);

        // Parse JSON arrays
        address[] memory gardeners = abi.decode(vm.parseJson(gardenersJson), (address[]));
        address[] memory operators = abi.decode(vm.parseJson(operatorsJson), (address[]));

        console.log("\nRoles:");
        console.log("  Gardeners:", gardeners.length);
        for (uint256 i = 0; i < gardeners.length; i++) {
            console.log("    -", gardeners[i]);
        }
        console.log("  Operators:", operators.length);
        for (uint256 i = 0; i < operators.length; i++) {
            console.log("    -", operators[i]);
        }

        // Start broadcasting transactions
        vm.startBroadcast();

        // Deploy garden contract
        GardenToken gardenToken = GardenToken(gardenTokenAddress);

        console.log("\nMinting garden...");
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            communityToken: communityTokenAddress,
            name: name,
            description: description,
            location: location,
            bannerImage: bannerImage,
            metadata: "",
            openJoining: false,
            gardeners: gardeners,
            gardenOperators: operators
        });
        gardenToken.mintGarden(config);

        vm.stopBroadcast();

        console.log("Garden deployed successfully\n");
    }
}

struct GardenConfig {
    string name;
    string description;
    string location;
    string bannerImage;
}
