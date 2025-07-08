// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.25;

import { Script } from "forge-std/Script.sol";

contract CounterScript is Script {
    function setUp() public { }

    function run() public {
        vm.broadcast();
    }
}
