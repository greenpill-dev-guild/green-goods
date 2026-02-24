// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { Capital, Domain } from "../../src/registries/Action.sol";
import {
    ActionRegistry,
    NotActionOwner,
    EndTimeBeforeStartTime,
    StartTimeAfterEndTime,
    NotGardenOperator,
    InvalidDomainMask,
    NotGardenToken,
    ZeroAddress
} from "../../src/registries/Action.sol";
import { MockHatsModule } from "../helpers/MockHatsModule.sol";

contract ActionRegistryTest is Test {
    ActionRegistry private actionRegistry;
    MockHatsModule private mockHatsModule;
    address private multisig = address(0x123);
    address private gardenTokenAddr = address(0x456);
    address private garden = address(0x789);
    address private operator = address(0xABC);

    // Events (mirrored from ActionRegistry for vm.expectEmit)
    event ActionRegistered(
        address owner,
        uint256 indexed actionUID,
        uint256 indexed startTime,
        uint256 indexed endTime,
        string title,
        string slug,
        string instructions,
        Capital[] capitals,
        string[] media,
        Domain domain
    );
    event ActionStartTimeUpdated(address indexed owner, uint256 indexed actionUID, uint256 indexed startTime);
    event ActionEndTimeUpdated(address indexed owner, uint256 indexed actionUID, uint256 indexed endTime);
    event ActionTitleUpdated(address indexed owner, uint256 indexed actionUID, string title);
    event ActionInstructionsUpdated(address indexed owner, uint256 indexed actionUID, string instructions);
    event ActionMediaUpdated(address indexed owner, uint256 indexed actionUID, string[] media);
    event GardenDomainsUpdated(address indexed garden, uint8 indexed domainMask);
    event HatsModuleUpdated(address indexed oldModule, address indexed newModule);
    event GardenTokenUpdated(address indexed oldToken, address indexed newToken);

    function setUp() public {
        ActionRegistry implementation = new ActionRegistry();
        bytes memory initData = abi.encodeWithSelector(ActionRegistry.initialize.selector, multisig);
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        actionRegistry = ActionRegistry(address(proxy));

        mockHatsModule = new MockHatsModule();

        // Wire hatsModule and gardenToken
        vm.startPrank(multisig);
        actionRegistry.setHatsModule(address(mockHatsModule));
        actionRegistry.setGardenToken(gardenTokenAddr);
        vm.stopPrank();

        // Set operator as an operator of the garden in the mock
        mockHatsModule.setOperator(garden, operator, true);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    function _registerAction() internal returns (uint256 actionUID) {
        return _registerActionWithDomain(Domain.AGRO, "agro.planting_event");
    }

    function _registerActionWithDomain(Domain _domain, string memory _slug) internal returns (uint256 actionUID) {
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.CULTURAL;

        string[] memory media = new string[](1);
        media[0] = "mediaCID1";

        vm.prank(multisig);
        actionRegistry.registerAction(
            block.timestamp, block.timestamp + 1 days, "Test Action", _slug, "instructionsCID", capitals, media, _domain
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
    // Registration Tests (with Domain + Slug)
    // =========================================================================

    function testRegisterAction() public {
        uint256 actionUID = _registerAction();

        ActionRegistry.Action memory action = actionRegistry.getAction(actionUID);
        assertEq(action.startTime, block.timestamp, "Start time should be the current time");
        assertEq(action.endTime, block.timestamp + 1 days, "End time should be one day later");
        assertEq(action.title, "Test Action", "Title should match");
        assertEq(action.slug, "agro.planting_event", "Slug should match");
        assertEq(action.instructions, "instructionsCID", "Instructions should match");
        assertEq(action.media[0], "mediaCID1", "Media should match");
        assertEq(uint8(action.domain), uint8(Domain.AGRO), "Domain should be AGRO");
    }

    function testRegisterAction_AllDomains() public {
        _registerActionWithDomain(Domain.SOLAR, "solar.site_setup");
        _registerActionWithDomain(Domain.AGRO, "agro.planting_event");
        _registerActionWithDomain(Domain.EDU, "edu.deliver_session");
        _registerActionWithDomain(Domain.WASTE, "waste.cleanup_event");

        assertEq(uint8(actionRegistry.getAction(0).domain), uint8(Domain.SOLAR));
        assertEq(uint8(actionRegistry.getAction(1).domain), uint8(Domain.AGRO));
        assertEq(uint8(actionRegistry.getAction(2).domain), uint8(Domain.EDU));
        assertEq(uint8(actionRegistry.getAction(3).domain), uint8(Domain.WASTE));

        assertEq(actionRegistry.getAction(0).slug, "solar.site_setup");
        assertEq(actionRegistry.getAction(1).slug, "agro.planting_event");
        assertEq(actionRegistry.getAction(2).slug, "edu.deliver_session");
        assertEq(actionRegistry.getAction(3).slug, "waste.cleanup_event");
    }

    function test_registerAction_emitsEvent() public {
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.CULTURAL;

        string[] memory media = new string[](1);
        media[0] = "mediaCID1";

        vm.expectEmit(true, true, true, true);
        emit ActionRegistered(
            multisig,
            0,
            block.timestamp,
            block.timestamp + 1 days,
            "Test Action",
            "agro.planting_event",
            "instructionsCID",
            capitals,
            media,
            Domain.AGRO
        );

        vm.prank(multisig);
        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 1 days,
            "Test Action",
            "agro.planting_event",
            "instructionsCID",
            capitals,
            media,
            Domain.AGRO
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
            block.timestamp,
            block.timestamp + 1 days,
            "Test Action 2",
            "test.slug",
            "instructionsCID",
            capitals,
            media,
            Domain.SOLAR
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
            block.timestamp + 2 days,
            block.timestamp + 1 days,
            "Invalid Action",
            "test.invalid",
            "instructionsCID",
            capitals,
            media,
            Domain.SOLAR
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
    // Garden Domains Tests
    // =========================================================================

    function test_setGardenDomains_operatorCanSet() public {
        vm.prank(operator);
        actionRegistry.setGardenDomains(garden, 0x0F); // all 4 domains

        assertEq(actionRegistry.gardenDomains(garden), 0x0F);
    }

    function test_setGardenDomains_emitsEvent() public {
        vm.expectEmit(true, true, false, false);
        emit GardenDomainsUpdated(garden, 0x05);

        vm.prank(operator);
        actionRegistry.setGardenDomains(garden, 0x05); // Solar + Edu
    }

    function test_setGardenDomains_revertsForNonOperator() public {
        vm.prank(address(0x999));
        vm.expectRevert(NotGardenOperator.selector);
        actionRegistry.setGardenDomains(garden, 0x01);
    }

    function test_setGardenDomains_revertsForInvalidMask() public {
        vm.prank(operator);
        vm.expectRevert(InvalidDomainMask.selector);
        actionRegistry.setGardenDomains(garden, 0x10); // bit 4 is invalid
    }

    function test_setGardenDomains_revertsForMaxUint8() public {
        vm.prank(operator);
        vm.expectRevert(InvalidDomainMask.selector);
        actionRegistry.setGardenDomains(garden, 0xFF);
    }

    function test_setGardenDomains_acceptsZero() public {
        // Set to non-zero first
        vm.prank(operator);
        actionRegistry.setGardenDomains(garden, 0x0F);

        // Then clear all domains
        vm.prank(operator);
        actionRegistry.setGardenDomains(garden, 0x00);

        assertEq(actionRegistry.gardenDomains(garden), 0x00);
    }

    function test_setGardenDomains_singleDomain() public {
        // Solar only (bit 0)
        vm.prank(operator);
        actionRegistry.setGardenDomains(garden, 0x01);
        assertEq(actionRegistry.gardenDomains(garden), 0x01);

        // Agro only (bit 1)
        vm.prank(operator);
        actionRegistry.setGardenDomains(garden, 0x02);
        assertEq(actionRegistry.gardenDomains(garden), 0x02);

        // Edu only (bit 2)
        vm.prank(operator);
        actionRegistry.setGardenDomains(garden, 0x04);
        assertEq(actionRegistry.gardenDomains(garden), 0x04);

        // Waste only (bit 3)
        vm.prank(operator);
        actionRegistry.setGardenDomains(garden, 0x08);
        assertEq(actionRegistry.gardenDomains(garden), 0x08);
    }

    function test_setGardenDomains_revertsWhenHatsModuleNotSet() public {
        // Deploy a fresh ActionRegistry without wiring hatsModule
        ActionRegistry freshImpl = new ActionRegistry();
        bytes memory initData = abi.encodeWithSelector(ActionRegistry.initialize.selector, multisig);
        ERC1967Proxy freshProxy = new ERC1967Proxy(address(freshImpl), initData);
        ActionRegistry freshRegistry = ActionRegistry(address(freshProxy));

        vm.prank(operator);
        vm.expectRevert(ZeroAddress.selector);
        freshRegistry.setGardenDomains(garden, 0x01);
    }

    // =========================================================================
    // gardenHasDomain Tests
    // =========================================================================

    function test_gardenHasDomain_returnsCorrectly() public {
        // Set Agro + Waste (0b1010 = 0x0A)
        vm.prank(operator);
        actionRegistry.setGardenDomains(garden, 0x0A);

        assertFalse(actionRegistry.gardenHasDomain(garden, Domain.SOLAR), "Should not have Solar");
        assertTrue(actionRegistry.gardenHasDomain(garden, Domain.AGRO), "Should have Agro");
        assertFalse(actionRegistry.gardenHasDomain(garden, Domain.EDU), "Should not have Edu");
        assertTrue(actionRegistry.gardenHasDomain(garden, Domain.WASTE), "Should have Waste");
    }

    function test_gardenHasDomain_allDomains() public {
        vm.prank(operator);
        actionRegistry.setGardenDomains(garden, 0x0F);

        assertTrue(actionRegistry.gardenHasDomain(garden, Domain.SOLAR));
        assertTrue(actionRegistry.gardenHasDomain(garden, Domain.AGRO));
        assertTrue(actionRegistry.gardenHasDomain(garden, Domain.EDU));
        assertTrue(actionRegistry.gardenHasDomain(garden, Domain.WASTE));
    }

    function test_gardenHasDomain_noDomains() public {
        // Default is 0 (no domains)
        assertFalse(actionRegistry.gardenHasDomain(garden, Domain.SOLAR));
        assertFalse(actionRegistry.gardenHasDomain(garden, Domain.AGRO));
        assertFalse(actionRegistry.gardenHasDomain(garden, Domain.EDU));
        assertFalse(actionRegistry.gardenHasDomain(garden, Domain.WASTE));
    }

    // =========================================================================
    // setGardenDomainsFromMint Tests
    // =========================================================================

    function test_setGardenDomainsFromMint_gardenTokenCanCall() public {
        vm.prank(gardenTokenAddr);
        actionRegistry.setGardenDomainsFromMint(garden, 0x05); // Solar + Edu

        assertEq(actionRegistry.gardenDomains(garden), 0x05);
        assertTrue(actionRegistry.gardenHasDomain(garden, Domain.SOLAR));
        assertTrue(actionRegistry.gardenHasDomain(garden, Domain.EDU));
    }

    function test_setGardenDomainsFromMint_emitsEvent() public {
        vm.expectEmit(true, true, false, false);
        emit GardenDomainsUpdated(garden, 0x0F);

        vm.prank(gardenTokenAddr);
        actionRegistry.setGardenDomainsFromMint(garden, 0x0F);
    }

    function test_setGardenDomainsFromMint_revertsForNonGardenToken() public {
        vm.prank(operator);
        vm.expectRevert(NotGardenToken.selector);
        actionRegistry.setGardenDomainsFromMint(garden, 0x01);
    }

    function test_setGardenDomainsFromMint_revertsForOwner() public {
        vm.prank(multisig);
        vm.expectRevert(NotGardenToken.selector);
        actionRegistry.setGardenDomainsFromMint(garden, 0x01);
    }

    function test_setGardenDomainsFromMint_revertsForInvalidMask() public {
        vm.prank(gardenTokenAddr);
        vm.expectRevert(InvalidDomainMask.selector);
        actionRegistry.setGardenDomainsFromMint(garden, 0x10);
    }

    // =========================================================================
    // HatsModule + GardenToken Setter Tests
    // =========================================================================

    function test_setHatsModule_emitsEvent() public {
        address newModule = address(0xBEEF);

        vm.expectEmit(true, true, false, false);
        emit HatsModuleUpdated(address(mockHatsModule), newModule);

        vm.prank(multisig);
        actionRegistry.setHatsModule(newModule);

        assertEq(actionRegistry.hatsModule(), newModule);
    }

    function test_setHatsModule_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        actionRegistry.setHatsModule(address(0xBEEF));
    }

    function test_setGardenToken_emitsEvent() public {
        address newToken = address(0xCAFE);

        vm.expectEmit(true, true, false, false);
        emit GardenTokenUpdated(gardenTokenAddr, newToken);

        vm.prank(multisig);
        actionRegistry.setGardenToken(newToken);

        assertEq(actionRegistry.gardenToken(), newToken);
    }

    function test_setGardenToken_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        actionRegistry.setGardenToken(address(0xCAFE));
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
