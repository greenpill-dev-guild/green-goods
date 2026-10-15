// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { KarmaGAPModule } from "../../src/modules/Karma.sol";

/// @title KarmaGAPModuleResetProjectTest
/// @notice Tests for the KarmaGAPModule.resetProject() recovery function
contract KarmaGAPModuleResetProjectTest is Test {
    KarmaGAPModule public module;
    address public moduleOwner = address(0xA001);
    address public gardenTokenAddr = address(0xB001);
    address public garden1 = address(0xC001);
    address public nonOwner = address(0xD001);

    event GAPProjectReset(address indexed garden, bytes32 indexed previousUID);

    function setUp() public {
        KarmaGAPModule impl = new KarmaGAPModule();
        bytes memory initData = abi.encodeWithSelector(
            KarmaGAPModule.initialize.selector, moduleOwner, gardenTokenAddr, address(0), address(0)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        module = KarmaGAPModule(address(proxy));
    }

    function test_resetProject_clearsMapping() public {
        // Manually set a project mapping via storage slot manipulation
        bytes32 fakeUID = bytes32(uint256(0x1234));
        _setGardenProject(garden1, fakeUID);
        assertEq(module.gardenProjects(garden1), fakeUID, "Project should be set");

        vm.prank(moduleOwner);
        module.resetProject(garden1);

        assertEq(module.gardenProjects(garden1), bytes32(0), "Project should be cleared");
    }

    function test_resetProject_emitsEvent() public {
        bytes32 fakeUID = bytes32(uint256(0x5678));
        _setGardenProject(garden1, fakeUID);

        vm.expectEmit(true, true, false, false);
        emit GAPProjectReset(garden1, fakeUID);

        vm.prank(moduleOwner);
        module.resetProject(garden1);
    }

    function test_resetProject_onlyOwner() public {
        bytes32 fakeUID = bytes32(uint256(0xABCD));
        _setGardenProject(garden1, fakeUID);

        vm.prank(nonOwner);
        vm.expectRevert("Ownable: caller is not the owner");
        module.resetProject(garden1);
    }

    function test_resetProject_noopIfNoProject() public {
        // Should not revert for garden with no project
        vm.prank(moduleOwner);
        module.resetProject(garden1);
        assertEq(module.gardenProjects(garden1), bytes32(0), "Should still be zero");
    }

    /// @dev Helper to set gardenProjects[garden] = uid via storage write
    /// gardenProjects mapping is at storage slot 105 (after OZ upgradeable internals + 4 address vars)
    function _setGardenProject(address garden, bytes32 uid) internal {
        bytes32 slot = keccak256(abi.encode(garden, uint256(105)));
        vm.store(address(module), slot, uid);
    }
}
