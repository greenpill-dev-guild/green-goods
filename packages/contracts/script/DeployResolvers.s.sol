// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.25;

import { IEAS } from "eas-contracts/IEAS.sol";

import { Script } from "forge-std/Script.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";

import { EAS_ARB } from "../src/Constants.sol";

// import { ActionResolver } from "../src/resolvers/Action.sol";

contract Deploy is Script {
    //ActionRegistry public gpnft;

    function run() public {
    
  
    // Load the private key from the `PRIVATE_KEY` environment variable (in .env)
    uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

    vm.startBroadcast(deployerPrivateKey);


    vm.stopBroadcast();
  }
}
