// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";

import { GardenAccount, NotGardenOperator } from "../src/accounts/Garden.sol";

contract GardenAccountTest is Test {
    GardenAccount private gardenAccount;
    address private owner = address(this);
    address private multisig = address(0x123);

    function setUp() public {
        // Deploy mock contracts with code to prevent revert
        // Use non-precompile addresses (above 0x09)
        vm.etch(address(0x1001), hex"00"); // erc4337EntryPoint
        vm.etch(address(0x1002), hex"00"); // multicallForwarder  
        vm.etch(address(0x1003), hex"00"); // erc6551Registry
        vm.etch(address(0x1004), hex"00"); // guardian
        
        // Deploy the GardenAccount contract
        gardenAccount = new GardenAccount(
            address(0x1001), // erc4337EntryPoint
            address(0x1002), // multicallForwarder
            address(0x1003), // erc6551Registry
            address(0x1004) // guardian
        );

        // Initialize the contract
        address[] memory gardeners = new address[](1);
        address[] memory gardenOperators = new address[](1);

        gardeners[0] = address(0x100);
        gardenOperators[0] = address(0x200);

        gardenAccount.initialize(
            address(0x555), "Test Garden", "Test Description", "Test Location", "", gardeners, gardenOperators
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

    // ============================================
    // Invitation System Tests
    // ============================================

    function testCreateInviteCode() public {
        bytes32 inviteCode = keccak256(abi.encodePacked("test-invite-1"));
        uint256 expiry = block.timestamp + 7 days;

        // Operator should be able to create invite
        vm.prank(address(0x200)); // Garden operator
        vm.expectEmit(true, true, true, true);
        emit GardenAccount.InviteCreated(inviteCode, address(gardenAccount), address(0x200), expiry);

        gardenAccount.createInviteCode(inviteCode, expiry);

        // Verify invite was created
        assertTrue(gardenAccount.gardenInvites(inviteCode), "Invite should be valid");
        assertEq(gardenAccount.inviteExpiry(inviteCode), expiry, "Expiry should match");
        assertFalse(gardenAccount.inviteUsed(inviteCode), "Invite should not be used yet");
    }

    function testCreateInviteCodeRevertsIfNotOperator() public {
        bytes32 inviteCode = keccak256(abi.encodePacked("test-invite-2"));
        uint256 expiry = block.timestamp + 7 days;

        // Non-operator should not be able to create invite
        vm.prank(address(0x999)); // Not an operator
        vm.expectRevert(NotGardenOperator.selector);
        gardenAccount.createInviteCode(inviteCode, expiry);
    }

    function testCreateInviteCodeRevertsIfExpired() public {
        bytes32 inviteCode = keccak256(abi.encodePacked("test-invite-3"));
        uint256 expiry = block.timestamp - 1; // Already expired

        vm.prank(address(0x200)); // Garden operator
        vm.expectRevert("Invalid expiry");
        gardenAccount.createInviteCode(inviteCode, expiry);
    }

    function testCreateInviteCodeRevertsIfDuplicate() public {
        bytes32 inviteCode = keccak256(abi.encodePacked("test-invite-4"));
        uint256 expiry = block.timestamp + 7 days;

        // Create invite first time
        vm.prank(address(0x200));
        gardenAccount.createInviteCode(inviteCode, expiry);

        // Try to create same invite again
        vm.prank(address(0x200));
        vm.expectRevert("Invite already exists");
        gardenAccount.createInviteCode(inviteCode, expiry);
    }

    function testJoinGardenWithInvite() public {
        bytes32 inviteCode = keccak256(abi.encodePacked("test-invite-5"));
        uint256 expiry = block.timestamp + 7 days;
        address newMember = address(0x500);

        // Create invite
        vm.prank(address(0x200));
        gardenAccount.createInviteCode(inviteCode, expiry);

        // Join garden with invite
        vm.prank(newMember);
        vm.expectEmit(true, true, true, true);
        emit GardenAccount.InviteUsed(inviteCode, address(gardenAccount), newMember);

        gardenAccount.joinGardenWithInvite(inviteCode);

        // Verify member was added
        assertTrue(gardenAccount.gardeners(newMember), "New member should be a gardener");
        assertTrue(gardenAccount.inviteUsed(inviteCode), "Invite should be marked as used");
    }

    function testJoinGardenWithInviteRevertsIfInvalid() public {
        bytes32 inviteCode = keccak256(abi.encodePacked("invalid-invite"));

        vm.prank(address(0x500));
        vm.expectRevert("Invalid invite");
        gardenAccount.joinGardenWithInvite(inviteCode);
    }

    function testJoinGardenWithInviteRevertsIfExpired() public {
        bytes32 inviteCode = keccak256(abi.encodePacked("test-invite-6"));
        uint256 expiry = block.timestamp + 1 hours;

        // Create invite
        vm.prank(address(0x200));
        gardenAccount.createInviteCode(inviteCode, expiry);

        // Warp time to after expiry
        vm.warp(block.timestamp + 2 hours);

        // Try to join with expired invite
        vm.prank(address(0x500));
        vm.expectRevert("Invite expired");
        gardenAccount.joinGardenWithInvite(inviteCode);
    }

    function testJoinGardenWithInviteRevertsIfAlreadyUsed() public {
        bytes32 inviteCode = keccak256(abi.encodePacked("test-invite-7"));
        uint256 expiry = block.timestamp + 7 days;

        // Create invite
        vm.prank(address(0x200));
        gardenAccount.createInviteCode(inviteCode, expiry);

        // First member joins
        vm.prank(address(0x500));
        gardenAccount.joinGardenWithInvite(inviteCode);

        // Second member tries to use same invite
        vm.prank(address(0x600));
        vm.expectRevert("Invite already used");
        gardenAccount.joinGardenWithInvite(inviteCode);
    }

    function testJoinGardenWithInviteRevertsIfAlreadyGardener() public {
        bytes32 inviteCode = keccak256(abi.encodePacked("test-invite-8"));
        uint256 expiry = block.timestamp + 7 days;

        // Create invite
        vm.prank(address(0x200));
        gardenAccount.createInviteCode(inviteCode, expiry);

        // Try to join when already a gardener
        vm.prank(address(0x100)); // Already a gardener from initialization
        vm.expectRevert("Already a gardener");
        gardenAccount.joinGardenWithInvite(inviteCode);
    }

    function testRevokeInvite() public {
        bytes32 inviteCode = keccak256(abi.encodePacked("test-invite-9"));
        uint256 expiry = block.timestamp + 7 days;

        // Create invite
        vm.prank(address(0x200));
        gardenAccount.createInviteCode(inviteCode, expiry);

        // Revoke invite
        vm.prank(address(0x200));
        vm.expectEmit(true, true, true, true);
        emit GardenAccount.InviteRevoked(inviteCode, address(gardenAccount));

        gardenAccount.revokeInvite(inviteCode);

        // Verify invite was revoked
        assertFalse(gardenAccount.gardenInvites(inviteCode), "Invite should be invalid after revocation");
    }

    function testRevokeInviteRevertsIfNotOperator() public {
        bytes32 inviteCode = keccak256(abi.encodePacked("test-invite-10"));
        uint256 expiry = block.timestamp + 7 days;

        // Create invite
        vm.prank(address(0x200));
        gardenAccount.createInviteCode(inviteCode, expiry);

        // Non-operator tries to revoke
        vm.prank(address(0x999));
        vm.expectRevert(NotGardenOperator.selector);
        gardenAccount.revokeInvite(inviteCode);
    }

    function testRevokeInviteRevertsIfInvalid() public {
        bytes32 inviteCode = keccak256(abi.encodePacked("invalid-invite"));

        vm.prank(address(0x200));
        vm.expectRevert("Invalid invite");
        gardenAccount.revokeInvite(inviteCode);
    }

    function testRevokeInviteRevertsIfAlreadyUsed() public {
        bytes32 inviteCode = keccak256(abi.encodePacked("test-invite-11"));
        uint256 expiry = block.timestamp + 7 days;

        // Create invite
        vm.prank(address(0x200));
        gardenAccount.createInviteCode(inviteCode, expiry);

        // Use invite
        vm.prank(address(0x500));
        gardenAccount.joinGardenWithInvite(inviteCode);

        // Try to revoke used invite
        vm.prank(address(0x200));
        vm.expectRevert("Invite already used");
        gardenAccount.revokeInvite(inviteCode);
    }

    function testMultipleInvites() public {
        bytes32 invite1 = keccak256(abi.encodePacked("invite-1"));
        bytes32 invite2 = keccak256(abi.encodePacked("invite-2"));
        uint256 expiry = block.timestamp + 7 days;

        // Create multiple invites
        vm.prank(address(0x200));
        gardenAccount.createInviteCode(invite1, expiry);

        vm.prank(address(0x200));
        gardenAccount.createInviteCode(invite2, expiry);

        // Multiple members can join with different invites
        vm.prank(address(0x501));
        gardenAccount.joinGardenWithInvite(invite1);

        vm.prank(address(0x502));
        gardenAccount.joinGardenWithInvite(invite2);

        // Verify both members were added
        assertTrue(gardenAccount.gardeners(address(0x501)), "First member should be added");
        assertTrue(gardenAccount.gardeners(address(0x502)), "Second member should be added");
    }

    function testInviteExpiryBoundary() public {
        bytes32 inviteCode = keccak256(abi.encodePacked("boundary-test"));
        uint256 expiry = block.timestamp + 1 hours;

        // Create invite
        vm.prank(address(0x200));
        gardenAccount.createInviteCode(inviteCode, expiry);

        // Warp to exactly expiry time
        vm.warp(expiry);

        // Should work at exact expiry time
        vm.prank(address(0x500));
        gardenAccount.joinGardenWithInvite(inviteCode);

        assertTrue(gardenAccount.gardeners(address(0x500)), "Should be able to join at exact expiry");
    }
}
