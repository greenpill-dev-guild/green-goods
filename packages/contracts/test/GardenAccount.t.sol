// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";

import { GardenAccount } from "../src/accounts/Garden.sol";

contract GardenAccountTest is Test {
    GardenAccount private gardenAccount;
    address private owner = address(this);
    address private multisig = address(0x123);

    function setUp() public {
        // Deploy the GardenAccount contract
        gardenAccount = new GardenAccount(
            address(0x001), // erc4337EntryPoint
            address(0x002), // multicallForwarder
            address(0x003), // erc6551Registry
            address(0x004) // guardian
        );

        // Initialize the contract
        address[] memory gardeners = new address[](1);
        address[] memory gardenOperators = new address[](1);

        gardeners[0] = address(0x100);
        gardenOperators[0] = address(0x200);

        gardenAccount.initialize(
            address(0x555),
            "Test Garden",
            "Test Description",
            "Test Location",
            "",
            gardeners,
            gardenOperators
        );
    }

    function testInitialize() public {
        // Check initial state
        assertEq(gardenAccount.communityToken(), address(0x555), "Community token should match");
        assertEq(gardenAccount.name(), "Test Garden", "Name should match");
        assertTrue(gardenAccount.gardeners(address(0x100)), "Gardener should be added");
        assertTrue(gardenAccount.gardenOperators(address(0x200)), "Garden operator should be added");
    }

    // function testUpdateName() public {
    //     vm.prank(owner);
    //     vm.expectEmit(true, true, true, true);
    //     emit GardenAccount.NameUpdated(owner, "New Garden Name");

    //     gardenAccount.updateName("New Garden Name");
    //     assertEq(gardenAccount.name(), "New Garden Name", "Name should be updated");
    // }

    // function testAddGardener() public {
    //     vm.prank(owner);
    //     vm.expectEmit(true, true, true, true);
    //     emit GardenAccount.GardenerAdded(owner, address(0x300));

    //     gardenAccount.addGardener(address(0x300));
    //     assertTrue(gardenAccount.gardeners(address(0x300)), "New gardener should be added");
    // }

    // function testRemoveGardener() public {
    //     vm.prank(owner);
    //     vm.expectEmit(true, true, true, true);
    //     emit GardenAccount.GardenerRemoved(owner, address(0x100));

    //     gardenAccount.removeGardener(address(0x100));
    //     assertFalse(gardenAccount.gardeners(address(0x100)), "Gardener should be removed");
    // }

    // function testAddGardenOperator() public {
    //     vm.prank(owner);
    //     vm.expectEmit(true, true, true, true);
    //     emit GardenAccount.GardenOperatorAdded(owner, address(0x400));

    //     gardenAccount.addGardenOperator(address(0x400));
    //     assertTrue(gardenAccount.gardenOperators(address(0x400)), "New garden operator should be added");
    // }

    // function testRemoveGardenOperator() public {
    //     vm.prank(owner);
    //     vm.expectEmit(true, true, true, true);
    //     emit GardenAccount.GardenOperatorRemoved(owner, address(0x200));

    //     gardenAccount.removeGardenOperator(address(0x200));
    //     assertFalse(gardenAccount.gardenOperators(address(0x200)), "Garden operator should be removed");
    // }

    // function testNotGardenOwnerReverts() public {
    //     vm.prank(address(0x999)); // Not the owner
    //     vm.expectRevert(NotGardenOwner.selector);
    //     gardenAccount.updateName("Invalid Update");

    //     vm.prank(address(0x999)); // Not the owner
    //     vm.expectRevert(NotGardenOwner.selector);
    //     gardenAccount.addGardener(address(0x888));

    //     vm.prank(address(0x999)); // Not the owner
    //     vm.expectRevert(NotGardenOwner.selector);
    //     gardenAccount.removeGardener(address(0x100));

    //     vm.prank(address(0x999)); // Not the owner
    //     vm.expectRevert(NotGardenOwner.selector);
    //     gardenAccount.addGardenOperator(address(0x777));

    //     vm.prank(address(0x999)); // Not the owner
    //     vm.expectRevert(NotGardenOwner.selector);
    //     gardenAccount.removeGardenOperator(address(0x200));
    // }
}
