// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase } from "./helpers/ForkTestBase.sol";
import { GardenAccount } from "../../src/accounts/Garden.sol";

/// @title SepoliaGardenAccountCoreForkTest
/// @notice Fork tests for GardenAccount execution against Sepolia.
contract SepoliaGardenAccountCoreForkTest is ForkTestBase {
    /// @notice Garden owner can call execute() on the TBA to transfer native ETH.
    function testForkSepolia_execute_ownerCanCallExternalContract() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();

        address garden = _mintTestGarden("Sepolia Execute Test Garden", 0x0F);
        vm.deal(garden, 1 ether);

        GardenAccount(payable(garden)).execute(forkOperator, 0.5 ether, "", 0);

        assertEq(forkOperator.balance, 0.5 ether, "operator should receive ETH");
        assertEq(garden.balance, 0.5 ether, "garden should retain remaining ETH");
    }
}
