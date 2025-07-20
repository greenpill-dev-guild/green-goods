// SPDX-License-Identifier: UNLICENSED
/* solhint-disable max-line-length */
/* solhint-disable quotes */
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";

import { GardenToken } from "../src/tokens/Garden.sol";

/// @title DeployGarden
/// @notice Script for deploying the GardenToken contract and minting a garden.
contract DeployGarden is Script {
    function run() external {
        // Read configuration from environment variables
        string memory name = vm.envString("GARDEN_NAME");
        string memory description = vm.envString("GARDEN_DESCRIPTION");
        string memory location = vm.envString("GARDEN_LOCATION");
        string memory bannerImage = vm.envString("GARDEN_BANNER");
        string memory gardenersJson = vm.envString("GARDENERS");
        string memory operatorsJson = vm.envString("OPERATORS");

        // Get contract addresses from environment
        address gardenTokenAddress = vm.envAddress("GARDEN_TOKEN");
        address communityTokenAddress = vm.envAddress("COMMUNITY_TOKEN");

        // Parse JSON arrays
        address[] memory gardeners = abi.decode(vm.parseJson(gardenersJson), (address[]));
        address[] memory operators = abi.decode(vm.parseJson(operatorsJson), (address[]));

        // Start broadcasting transactions
        vm.startBroadcast();

        // Deploy garden contract
        GardenToken gardenToken = GardenToken(gardenTokenAddress);

        address gardenAccount = gardenToken.mintGarden(
            communityTokenAddress, name, description, location, bannerImage, gardeners, operators
        );

        vm.stopBroadcast();

        // Log deployment information
        console.log("Garden minted at:", gardenAccount);
        console.log("Name:", name);
        console.log("Description:", description);
        console.log("Location:", location);
        console.log("Banner Image:", bannerImage);
        console.log("Number of Gardeners:", gardeners.length);
        console.log("Number of Operators:", operators.length);
    }
}

struct GardenConfig {
    string name;
    string description;
    string location;
    string bannerImage;
}
