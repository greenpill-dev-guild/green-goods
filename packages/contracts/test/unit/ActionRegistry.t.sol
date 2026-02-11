// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { Capital } from "../../src/registries/Action.sol";
import {
    ActionRegistry, NotActionOwner, EndTimeBeforeStartTime, StartTimeAfterEndTime
} from "../../src/registries/Action.sol";

contract ActionRegistryTest is Test {
    ActionRegistry private actionRegistry;
    address private multisig = address(0x123);

    // Events (mirrored from ActionRegistry for vm.expectEmit)
    event ActionRegistered(
        address owner,
        uint256 indexed actionUID,
        uint256 indexed startTime,
        uint256 indexed endTime,
        string title,
        string instructions,
        Capital[] capitals,
        string[] media
    );
    event ActionStartTimeUpdated(address indexed owner, uint256 indexed actionUID, uint256 indexed startTime);
    event ActionEndTimeUpdated(address indexed owner, uint256 indexed actionUID, uint256 indexed endTime);
    event ActionTitleUpdated(address indexed owner, uint256 indexed actionUID, string indexed title);
    event ActionInstructionsUpdated(address indexed owner, uint256 indexed actionUID, string indexed instructions);
    event ActionMediaUpdated(address indexed owner, uint256 indexed actionUID, string[] indexed media);

    function setUp() public {
        ActionRegistry implementation = new ActionRegistry();
        bytes memory initData = abi.encodeWithSelector(ActionRegistry.initialize.selector, multisig);
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        actionRegistry = ActionRegistry(address(proxy));
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    function _registerAction() internal returns (uint256 actionUID) {
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.CULTURAL;

        string[] memory media = new string[](1);
        media[0] = "mediaCID1";

        vm.prank(multisig);
        actionRegistry.registerAction(
            block.timestamp, block.timestamp + 1 days, "Test Action", "instructionsCID", capitals, media
        );
        return 0;
    }

    // =========================================================================
    // Initialization Tests
    // =========================================================================

    function testInitialize() public {
        assertEq(actionRegistry.owner(), multisig, "Owner should be the multisig address");
    }

    function test_initialize_revertsOnDoubleInit() public {
        vm.expectRevert("Initializable: contract is already initialized");
        actionRegistry.initialize(address(0x999));
    }

    // =========================================================================
    // Registration Tests
    // =========================================================================

    function testRegisterAction() public {
        uint256 actionUID = _registerAction();

        ActionRegistry.Action memory action = actionRegistry.getAction(actionUID);
        assertEq(action.startTime, block.timestamp, "Start time should be the current time");
        assertEq(action.endTime, block.timestamp + 1 days, "End time should be one day later");
        assertEq(action.instructions, "instructionsCID", "Instructions should match");
        assertEq(action.media[0], "mediaCID1", "Media should match");
    }

    function test_registerAction_emitsEvent() public {
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.CULTURAL;

        string[] memory media = new string[](1);
        media[0] = "mediaCID1";

        vm.expectEmit(true, true, true, true);
        emit ActionRegistered(
            multisig, 0, block.timestamp, block.timestamp + 1 days, "Test Action", "instructionsCID", capitals, media
        );

        vm.prank(multisig);
        actionRegistry.registerAction(
            block.timestamp, block.timestamp + 1 days, "Test Action", "instructionsCID", capitals, media
        );
    }

    // =========================================================================
    // Update Tests with Event Emissions
    // =========================================================================

    function testUpdateActionStartTime() public {
        _registerAction();

        vm.expectEmit(true, true, true, true);
        emit ActionStartTimeUpdated(multisig, 0, block.timestamp + 1 hours);

        vm.prank(multisig);
        actionRegistry.updateActionStartTime(0, block.timestamp + 1 hours);

        ActionRegistry.Action memory action = actionRegistry.getAction(0);
        assertEq(action.startTime, block.timestamp + 1 hours, "Start time should be updated");
    }

    function testUpdateActionEndTime() public {
        _registerAction();

        vm.expectEmit(true, true, true, true);
        emit ActionEndTimeUpdated(multisig, 0, block.timestamp + 2 days);

        vm.prank(multisig);
        actionRegistry.updateActionEndTime(0, block.timestamp + 2 days);

        ActionRegistry.Action memory action = actionRegistry.getAction(0);
        assertEq(action.endTime, block.timestamp + 2 days, "End time should be updated");
    }

    function testUpdateActionTitle() public {
        _registerAction();

        vm.expectEmit(true, true, false, false);
        emit ActionTitleUpdated(multisig, 0, "New Title");

        vm.prank(multisig);
        actionRegistry.updateActionTitle(0, "New Title");

        ActionRegistry.Action memory action = actionRegistry.getAction(0);
        assertEq(action.title, "New Title", "Title should be updated");
    }

    function testUpdateActionInstructions() public {
        _registerAction();

        vm.expectEmit(true, true, false, false);
        emit ActionInstructionsUpdated(multisig, 0, "newInstructionsCID");

        vm.prank(multisig);
        actionRegistry.updateActionInstructions(0, "newInstructionsCID");

        ActionRegistry.Action memory action = actionRegistry.getAction(0);
        assertEq(action.instructions, "newInstructionsCID", "Instructions should be updated");
    }

    function testUpdateActionMedia() public {
        _registerAction();

        string[] memory newMedia = new string[](1);
        newMedia[0] = "newMediaCID";

        vm.prank(multisig);
        actionRegistry.updateActionMedia(0, newMedia);

        ActionRegistry.Action memory action = actionRegistry.getAction(0);
        assertEq(action.media[0], "newMediaCID", "Media should be updated");
    }

    // =========================================================================
    // Access Control Tests
    // =========================================================================

    function testOnlyOwnerCanRegister() public {
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
        _registerAction();

        vm.prank(address(0x999));
        vm.expectRevert(NotActionOwner.selector);
        actionRegistry.updateActionStartTime(0, block.timestamp + 1 hours);
    }

    // =========================================================================
    // Validation Tests
    // =========================================================================

    function testRegisterActionRevertsWithInvalidTimeRange() public {
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.CULTURAL;

        string[] memory media = new string[](1);
        media[0] = "mediaCID1";

        vm.prank(multisig);
        vm.expectRevert(EndTimeBeforeStartTime.selector);
        actionRegistry.registerAction(
            block.timestamp + 2 days, block.timestamp + 1 days, "Invalid Action", "instructionsCID", capitals, media
        );
    }

    function testUpdateActionStartTimeRevertsWithInvalidTime() public {
        _registerAction();

        vm.prank(multisig);
        vm.expectRevert(StartTimeAfterEndTime.selector);
        actionRegistry.updateActionStartTime(0, block.timestamp + 2 days);
    }

    function testUpdateActionEndTimeRevertsWithInvalidTime() public {
        _registerAction();

        vm.prank(multisig);
        vm.expectRevert(EndTimeBeforeStartTime.selector);
        actionRegistry.updateActionEndTime(0, block.timestamp - 1 hours);
    }

    // =========================================================================
    // UUPS Upgrade Tests
    // =========================================================================

    function test_authorizeUpgrade_ownerCanUpgrade() public {
        ActionRegistry newImpl = new ActionRegistry();

        vm.prank(multisig);
        actionRegistry.upgradeTo(address(newImpl));
    }

    function test_authorizeUpgrade_nonOwnerCannotUpgrade() public {
        ActionRegistry newImpl = new ActionRegistry();

        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        actionRegistry.upgradeTo(address(newImpl));
    }
}
