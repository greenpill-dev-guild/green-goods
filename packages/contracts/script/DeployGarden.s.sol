// SPDX-License-Identifier: UNLICENSED
/* solhint-disable max-line-length */
/* solhint-disable quotes */
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";
import { stdJson } from "forge-std/StdJson.sol";

import { GardenToken } from "../src/tokens/Garden.sol";
import { CommunityTokenLib } from "../src/lib/CommunityToken.sol";

import { GARDEN_TOKEN } from "../src/Constants.sol";

/// @title DeployGarden
/// @notice Script for deploying the GardenToken contract and minting a garden.
contract DeployGarden is Script {
    function run() external {
        // Read configuration from JSON file
        string memory configPath = vm.readFile("./garden-config.json");
        GardenConfig memory config = abi.decode(
            stdJson.parseRaw(configPath, ".gardenInfo"),
            (GardenConfig)
        );
        address[] memory gardeners = abi.decode(
            stdJson.parseRaw(configPath, ".gardeners"),
            (address[])
        );
        address[] memory operators = abi.decode(
            stdJson.parseRaw(configPath, ".operators"),
            (address[])
        );

        // Deploy GardenToken
        vm.startBroadcast();
        GardenToken gardenToken = GardenToken(GARDEN_TOKEN);

        address communityToken = CommunityTokenLib.getCommunityToken();

        address gardenAccount = gardenToken.mintGarden(
            communityToken,
            config.name,
            config.description,
            config.location,
            config.bannerImage,
            gardeners,
            operators
        );

        vm.stopBroadcast();
        console.log("Garden minted at:", gardenAccount);
    }
}

struct GardenConfig {
    string name;
    string description;
    string location;
    string bannerImage;
}
