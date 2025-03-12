// SPDX-License-Identifier: UNLICENSED
/* solhint-disable max-line-length */
/* solhint-disable quotes */
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";

import { GardenToken } from "../src/tokens/Garden.sol";
import { CommunityTokenLib } from "../src/lib/CommunityToken.sol";

import { GARDEN_TOKEN } from "../src/Constants.sol";

/// @title DeployGarden
/// @notice Script for deploying the GardenToken contract and minting a garden for Rio Claro, São Paulo.
contract DeployGarden is Script {
    function run() external {
        address gardenAccount;

        // Deploy GardenToken
        vm.startBroadcast();
        GardenToken gardenToken = GardenToken(GARDEN_TOKEN);

        address communityToken = CommunityTokenLib.getCommunityToken();
        // console.log("GardenToken deployed at:", token);

        // Mint a garden for Rio Claro, São Paulo
        address[] memory gardeners = new address[](5);
        address[] memory gardenOperators = new address[](5);

        gardeners[0] = 0x2aa64E6d80390F5C017F0313cB908051BE2FD35e; // afo-wefa.eth
        gardeners[1] = 0xAcD59e854adf632d2322404198624F757C868C97; // groweco.eth
        gardeners[2] = 0x29e6cbF2450F86006292D10A3cF791955600a457; // marcin
        gardeners[3] = 0x742fa58340df9Ad7c691De4Ed999CF7f71079A8F; // afo@greenpill.builders
        gardeners[4] = 0x9aBb9dFfEedd44EEeDD44Eeedd44eEeDd44eEeDd; // deployer
        gardenOperators[0] = 0x2aa64E6d80390F5C017F0313cB908051BE2FD35e; // afo-wefa.eth
        gardenOperators[1] = 0xAcD59e854adf632d2322404198624F757C868C97; // groweco.eth
        gardenOperators[2] = 0x29e6cbF2450F86006292D10A3cF791955600a457; // marcin
        gardenOperators[3] = 0x742fa58340df9Ad7c691De4Ed999CF7f71079A8F; // afo@greenpill.builders
        gardenOperators[4] = 0x9aBb9dFfEedd44EEeDD44Eeedd44eEeDd44eEeDd; // deployer

        gardenAccount = gardenToken.mintGarden(
            communityToken,
            "Greenway",
            "Observing invasive and native species as part of the river cleanup",
            "Denver, Colorado",
            "bafkreiawzgcovqilf424ymleybzcwkzb4wrkipsmrfelmsvodlhzqogske",
            gardeners,
            gardenOperators
        );

        vm.stopBroadcast();
        console.log("Greenway Garden for Denver, Colarado minted.", gardenAccount);
    }
}
