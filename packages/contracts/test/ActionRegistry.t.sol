// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";

import { Capital } from "../src/Constants.sol";
import { ActionRegistry, NotActionOwner } from "../src/registries/Action.sol";

contract ActionRegistryTest is Test {
    ActionRegistry private actionRegistry;
    address private multisig = address(0x123);
    address private owner = address(this);

    function setUp() public {
        // Deploy the ActionRegistry contract
        actionRegistry = new ActionRegistry();
        actionRegistry.initialize();
    }

    function testInitialize() public {
        // Test that the contract is properly initialized
        assertEq(actionRegistry.owner(), address(this), "Owner should be the multisig address");
    }

    function testRegisterAction() public {
        // Test registering a new action
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.CULTURAL;

        string[] memory media = new string[](1);
        media[0] = "mediaCID1";

        // vm.prank(multisig);
        actionRegistry.registerAction(
            block.timestamp, block.timestamp + 1 days, "Test Action", "instructionsCID", capitals, media
        );

        ActionRegistry.Action memory action = actionRegistry.getAction(0);
        assertEq(action.startTime, block.timestamp, "Start time should be the current time");
        assertEq(action.endTime, block.timestamp + 1 days, "End time should be one day later");
        assertEq(action.instructions, "instructionsCID", "Instructions should match");
        assertEq(action.media[0], "mediaCID1", "Media should match");
    }

    function testUpdateActionStartTime() public {
        // Test updating the start time of an action
        testRegisterAction();

        // vm.prank(multisig);
        actionRegistry.updateActionStartTime(0, block.timestamp + 1 hours);

        ActionRegistry.Action memory action = actionRegistry.getAction(0);
        assertEq(action.startTime, block.timestamp + 1 hours, "Start time should be updated");
    }

    function testUpdateActionEndTime() public {
        // Test updating the end time of an action
        testRegisterAction();

        // vm.prank(multisig);
        actionRegistry.updateActionEndTime(0, block.timestamp + 2 days);

        ActionRegistry.Action memory action = actionRegistry.getAction(0);
        assertEq(action.endTime, block.timestamp + 2 days, "End time should be updated");
    }

    function testUpdateActionInstructions() public {
        // Test updating the instructions of an action
        testRegisterAction();

        // vm.prank(multisig);
        actionRegistry.updateActionInstructions(0, "newInstructionsCID");

        ActionRegistry.Action memory action = actionRegistry.getAction(0);
        assertEq(action.instructions, "newInstructionsCID", "Instructions should be updated");
    }

    function testUpdateActionMedia() public {
        // Test updating the media of an action
        testRegisterAction();

        string[] memory newMedia = new string[](1);
        newMedia[0] = "newMediaCID";

        // vm.prank(multisig);
        actionRegistry.updateActionMedia(0, newMedia);

        ActionRegistry.Action memory action = actionRegistry.getAction(0);
        assertEq(action.media[0], "newMediaCID", "Media should be updated");
    }

    function testOnlyOwnerCanRegister() public {
        // Test that only the owner can register actions
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.CULTURAL;

        string[] memory media = new string[](1);
        media[0] = "mediaCID1";

        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        actionRegistry.registerAction(
            block.timestamp, block.timestamp + 1 days, "Test Action 2", "instructionsCID", capitals, media
        );
    }

    function testOnlyOwnerCanUpdate() public {
        // Test that only the action owner can update the action
        testRegisterAction();

        vm.prank(address(0x999));
        vm.expectRevert(NotActionOwner.selector);
        actionRegistry.updateActionStartTime(0, block.timestamp + 1 hours);
    }

    // function testAuthorizeUpgrade() public {
    //     // Test that only the owner can authorize an upgrade
    //     address newImplementation = address(0x456);

    //     vm.prank(multisig);
    //     actionRegistry.upgradeTo(newImplementation);
    // }

    // function testNonOwnerCannotUpgrade() public {
    //     // Test that non-owners cannot authorize an upgrade
    //     address newImplementation = address(0x456);

    //     vm.prank(address(0x999));
    //     vm.expectRevert("Ownable: caller is not the owner");
    //     actionRegistry.upgradeTo(newImplementation);
    // }
}
