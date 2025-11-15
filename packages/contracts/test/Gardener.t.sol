// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { IEntryPoint } from "account-abstraction/interfaces/IEntryPoint.sol";
import { Gardener } from "../src/accounts/Gardener.sol";

/// @title GardenerTest
/// @notice Tests for Gardener Kernel v3 smart account
contract GardenerTest is Test {
    Gardener private account;
    IEntryPoint private entryPoint;
    address private owner = address(0x100);
    address private unauthorized = address(0x999);

    function setUp() public {
        // Deploy mock EntryPoint
        entryPoint = IEntryPoint(address(0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789));
        
        // Deploy Gardener logic contract (same for all chains)
        account = new Gardener(entryPoint);
        
        // Initialize with owner
        account.initialize(owner);
        
        // Initialize Gardener-specific logic (prank as owner)
        vm.prank(owner);
        account.initializeGardener();
    }

    // ============================================================================
    // INITIALIZATION TESTS
    // ============================================================================

    function testAccountDeployment() public {
        assertEq(account.owner(), owner, "Owner should be set correctly");
        assertGt(account.deployedAt(), 0, "deployedAt should be set after initialization");
    }

    function testAccountDeployedEventEmitted() public {
        // Deploy new account
        Gardener newAccount = new Gardener(entryPoint);
        newAccount.initialize(owner);
        
        vm.startPrank(owner);
        vm.expectEmit(true, true, true, true);
        emit Gardener.AccountDeployed(address(newAccount), owner, block.timestamp);

        newAccount.initializeGardener();
        vm.stopPrank();
    }

    function testCannotReinitialize() public {
        vm.prank(owner);
        vm.expectRevert(Gardener.AlreadyInitialized.selector);
        account.initializeGardener();
    }

    function testCannotInitializeBeforeKernelInitialize() public {
        // Deploy new account without Kernel initialization
        Gardener uninitializedAccount = new Gardener(entryPoint);
        
        vm.expectRevert(Gardener.NotInitialized.selector);
        uninitializedAccount.initializeGardener();
    }

    // ============================================================================
    // OWNER TESTS
    // ============================================================================

    function testOwnerGetter() public {
        assertEq(account.owner(), owner, "Owner getter should return correct owner");
    }

    // ============================================================================
    // ERC-165 TESTS
    // ============================================================================

    function testSupportsERC165Interface() public {
        assertTrue(account.supportsInterface(type(IERC165).interfaceId), "Should support ERC-165");
    }
}

