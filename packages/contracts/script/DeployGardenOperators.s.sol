// SPDX-License-Identifier: UNLICENSED
/* solhint-disable max-line-length */
/* solhint-disable quotes */
pragma solidity ^0.8.25;

import { Script, console } from "forge-std/Script.sol";

import { GardenAccount } from "../src/accounts/Garden.sol";

import { ROOT_PLANET_GARDEN } from "../src/Constants.sol";

/// @title DeployGardenOperators
/// @notice Script for deploying the GardenToken contract and minting a garden for Rio Claro, São Paulo.
contract DeployGardenOperators is Script {
    function run() external {
        // Deploy GardenOperators
        vm.startBroadcast();
        GardenAccount gardenAccount = GardenAccount(payable(ROOT_PLANET_GARDEN));

        gardenAccount.addGardener(0x742fa58340df9Ad7c691De4Ed999CF7f71079A8F);
        gardenAccount.addGardenOperator(0x742fa58340df9Ad7c691De4Ed999CF7f71079A8F);

        vm.stopBroadcast();

        console.log("Operator added to the garden");
    }
}
