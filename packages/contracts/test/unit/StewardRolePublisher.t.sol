// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { StewardRoleFixture, StewardRouterFixture } from "../helpers/StewardRoleFixtures.sol";
import { StewardRolePublisher } from "../../src/accounts/StewardRolePublisher.sol";

contract StewardRolePublisherTest is Test {
    StewardRoleFixture private roles;
    StewardRouterFixture private router;
    StewardRolePublisher private publisher;
    address private constant GARDEN = address(0x123);
    address private constant MEMBER = address(0x456);
    address private constant RECEIVER = address(0x789);

    function setUp() public {
        vm.chainId(42_161);
        roles = new StewardRoleFixture();
        router = new StewardRouterFixture();
        publisher = new StewardRolePublisher(address(router), address(roles), GARDEN, 2, RECEIVER);
        vm.deal(address(this), 100);
    }

    function testCanonicalRoleChangesAreOrderedAndRefreshIsIdempotent() public {
        publisher.syncSteward(MEMBER);
        (uint64 revision, bool eligible) = publisher.states(MEMBER);
        assertEq(revision, 1);
        assertFalse(eligible);
        roles.set(MEMBER, true);
        publisher.syncSteward(MEMBER);
        publisher.syncSteward(MEMBER);
        (revision, eligible) = publisher.states(MEMBER);
        assertEq(revision, 2);
        assertTrue(eligible);
        roles.set(MEMBER, false);
        publisher.syncSteward(MEMBER);
        (revision, eligible) = publisher.states(MEMBER);
        assertEq(revision, 3);
        assertFalse(eligible);
    }

    function testDispatchReadsCurrentAuthorityAndUsesExactFee() public {
        roles.set(MEMBER, true);
        publisher.syncSteward(MEMBER);
        roles.set(MEMBER, false);
        assertEq(publisher.quoteSteward(MEMBER), 10);
        publisher.dispatchSteward{ value: 10 }(MEMBER);
        assertEq(router.lastReceiver(), abi.encode(RECEIVER));
        (bytes32 domain, uint256 source, uint256 dest, address garden, address member, uint64 revision, bool eligible) =
            abi.decode(router.lastData(), (bytes32, uint256, uint256, address, address, uint64, bool));
        assertEq(domain, keccak256("GREEN_GOODS_STEWARD_SAFE_V1"));
        assertEq(source, 42_161);
        assertEq(dest, 100);
        assertEq(garden, GARDEN);
        assertEq(member, MEMBER);
        assertEq(revision, 2);
        assertFalse(eligible);
        vm.expectRevert(StewardRolePublisher.IncorrectFee.selector);
        publisher.dispatchSteward{ value: 11 }(MEMBER);
    }

    function testSendFailureDoesNotUndoQueuedRevocationAndCanRetry() public {
        roles.set(MEMBER, true);
        publisher.syncSteward(MEMBER);
        roles.set(MEMBER, false);
        publisher.syncSteward(MEMBER);
        router.setBroken(true);
        vm.expectRevert("transport down");
        publisher.dispatchSteward{ value: 10 }(MEMBER);
        (uint64 revision, bool eligible) = publisher.states(MEMBER);
        assertEq(revision, 2);
        assertFalse(eligible);
        router.setBroken(false);
        publisher.dispatchSteward{ value: 10 }(MEMBER);
        assertEq(router.sends(), 1);
    }

    function testDeconfigurationQueuesRevocation() public {
        roles.set(MEMBER, true);
        publisher.syncSteward(MEMBER);
        roles.deconfigure();
        publisher.syncSteward(MEMBER);
        (uint64 revision, bool eligible) = publisher.states(MEMBER);
        assertEq(revision, 2);
        assertFalse(eligible);
    }

    function testSourceHatRotationCannotSilentlyAdoptAnotherRoster() public {
        roles.set(MEMBER, true);
        publisher.syncSteward(MEMBER);
        roles.changeHat(99);
        publisher.syncSteward(MEMBER);
        (uint64 revision, bool eligible) = publisher.states(MEMBER);
        assertEq(revision, 2);
        assertFalse(eligible);
    }

    function testUnavailableAuthorityRejectsRefreshWithoutInventingARevocation() public {
        roles.set(MEMBER, true);
        publisher.syncSteward(MEMBER);
        roles.setUnavailable(true);
        vm.expectRevert("authority unavailable");
        publisher.syncSteward(MEMBER);
        (uint64 revision, bool eligible) = publisher.states(MEMBER);
        assertEq(revision, 1);
        assertTrue(eligible);
    }

    function testFundedHookAutomaticallyDispatchesGrantsAndRevocationsOnce() public {
        vm.deal(address(publisher), 100);
        roles.set(MEMBER, true);
        publisher.syncSteward(MEMBER);
        assertEq(router.sends(), 1);
        publisher.syncSteward(MEMBER);
        assertEq(router.sends(), 1);
        roles.set(MEMBER, false);
        publisher.syncSteward(MEMBER);
        assertEq(router.sends(), 2);
        assertEq(address(publisher).balance, 80);
    }

    function testUnknownNonStewardsCannotDrainTransportFunding() public {
        vm.deal(address(publisher), 100);
        for (uint256 i = 2; i < 20; ++i) {
            publisher.syncSteward(address(uint160(i)));
        }
        assertEq(router.sends(), 0);
        assertEq(address(publisher).balance, 100);
    }

    function testTransportFailurePreservesRevocationAndRefreshRetriesFundedDispatch() public {
        vm.deal(address(publisher), 100);
        roles.set(MEMBER, true);
        publisher.syncSteward(MEMBER);
        router.setBroken(true);
        roles.set(MEMBER, false);
        publisher.syncSteward(MEMBER);
        (uint64 revision, bool eligible) = publisher.states(MEMBER);
        assertEq(revision, 2);
        assertFalse(eligible);
        assertEq(router.sends(), 1);
        router.setBroken(false);
        publisher.syncSteward(MEMBER);
        assertEq(router.sends(), 2);
        assertEq(address(publisher).balance, 80);
    }

    function testInsufficientFuelQueuesAndCallerPaidDispatchPreservesTheFeeBalance() public {
        vm.deal(address(publisher), 9);
        roles.set(MEMBER, true);
        publisher.syncSteward(MEMBER);
        assertEq(router.sends(), 0);
        (uint64 revision, bool eligible) = publisher.states(MEMBER);
        assertEq(revision, 1);
        assertTrue(eligible);
        publisher.dispatchSteward{ value: 10 }(MEMBER);
        assertEq(router.sends(), 1);
        assertEq(address(publisher).balance, 9);
        vm.expectRevert(StewardRolePublisher.OnlySelf.selector);
        publisher.dispatchFromBalance(MEMBER);
    }
}
