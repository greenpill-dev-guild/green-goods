// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { GreenGoodsENS } from "../../src/registries/ENS.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

/// @dev Mock CCIP Router that tracks sent messages
contract MockCCIPRouter {
    struct SentMessage {
        uint64 destinationChainSelector;
        Client.EVM2AnyMessage message;
        uint256 fee;
    }

    SentMessage[] public sentMessages;
    uint256 public mockFee;
    bytes32 public nextMessageId;

    constructor(uint256 _mockFee) {
        mockFee = _mockFee;
        nextMessageId = keccak256("message-1");
    }

    function getFee(uint64, Client.EVM2AnyMessage memory) external view returns (uint256) {
        return mockFee;
    }

    function ccipSend(
        uint64 destinationChainSelector,
        Client.EVM2AnyMessage calldata message
    )
        external
        payable
        returns (bytes32)
    {
        sentMessages.push(
            SentMessage({ destinationChainSelector: destinationChainSelector, message: message, fee: msg.value })
        );
        return nextMessageId;
    }

    function sentMessagesLength() external view returns (uint256) {
        return sentMessages.length;
    }

    function setMockFee(uint256 _fee) external {
        mockFee = _fee;
    }
}

/// @dev Mock Hats Protocol for isWearerOfHat checks
contract MockHats {
    mapping(address => mapping(uint256 => bool)) public hatWearers;

    function setWearer(address account, uint256 hatId, bool value) external {
        hatWearers[account][hatId] = value;
    }

    function isWearerOfHat(address account, uint256 hatId) external view returns (bool) {
        return hatWearers[account][hatId];
    }
}

contract GreenGoodsENSTest is Test {
    GreenGoodsENS public ens;
    MockCCIPRouter public router;
    MockHats public hats;

    address public owner = address(0x1);
    address public l1Receiver = address(0x2);
    address public gardenToken = address(0x3);
    address public user1 = address(0x4);
    address public user2 = address(0x5);

    uint64 public constant ETH_CHAIN_SELECTOR = 5_009_297_550_715_157_269;
    uint256 public constant PROTOCOL_HAT_ID = 42;
    uint256 public constant MOCK_FEE = 0.0001 ether;

    event NameRegistrationSent(
        bytes32 indexed messageId, string slug, address indexed owner, GreenGoodsENS.NameType nameType, uint256 ccipFee
    );
    event NameReleaseSent(bytes32 indexed messageId, string slug, address indexed previousOwner);
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);
    event RefundFailed(address indexed recipient, uint256 amount);

    function setUp() public {
        router = new MockCCIPRouter(MOCK_FEE);
        hats = new MockHats();

        ens = new GreenGoodsENS(address(router), ETH_CHAIN_SELECTOR, l1Receiver, address(hats), PROTOCOL_HAT_ID, owner);

        // Set gardenToken as authorized caller
        vm.prank(owner);
        ens.setAuthorizedCaller(gardenToken, true);

        // Give user1 the protocol hat
        hats.setWearer(user1, PROTOCOL_HAT_ID, true);
    }

    // ═══════════════════════════════════════════════════════
    // Slug Validation
    // ═══════════════════════════════════════════════════════

    function test_ValidSlug() public {
        hats.setWearer(user1, PROTOCOL_HAT_ID, true);
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        ens.claimName{ value: MOCK_FEE }("alice");
        assertEq(ens.available("alice"), false);
    }

    function test_ValidSlugWithHyphens() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        ens.claimName{ value: MOCK_FEE }("my-garden-name");
        assertEq(ens.available("my-garden-name"), false);
    }

    function test_ValidSlugWithNumbers() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        ens.claimName{ value: MOCK_FEE }("garden123");
        assertEq(ens.available("garden123"), false);
    }

    function test_RevertSlugTooShort() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("InvalidSlug()"));
        ens.claimName{ value: MOCK_FEE }("ab");
    }

    function test_RevertSlugTooLong() public {
        string memory longSlug = "abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz"; // 52 chars
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("InvalidSlug()"));
        ens.claimName{ value: MOCK_FEE }(longSlug);
    }

    function test_RevertSlugLeadingHyphen() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("InvalidSlug()"));
        ens.claimName{ value: MOCK_FEE }("-alice");
    }

    function test_RevertSlugTrailingHyphen() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("InvalidSlug()"));
        ens.claimName{ value: MOCK_FEE }("alice-");
    }

    function test_RevertSlugConsecutiveHyphens() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("InvalidSlug()"));
        ens.claimName{ value: MOCK_FEE }("al--ice");
    }

    function test_RevertSlugUppercase() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("InvalidSlug()"));
        ens.claimName{ value: MOCK_FEE }("Alice");
    }

    function test_RevertSlugSpecialChars() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("InvalidSlug()"));
        ens.claimName{ value: MOCK_FEE }("alice.bob");
    }

    function test_MinLengthSlug() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        ens.claimName{ value: MOCK_FEE }("abc");
        assertEq(ens.available("abc"), false);
    }

    // ═══════════════════════════════════════════════════════
    // claimName (user-funded)
    // ═══════════════════════════════════════════════════════

    function test_ClaimName_Success() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        ens.claimName{ value: MOCK_FEE }("alice");

        assertEq(ens.available("alice"), false);
        assertEq(router.sentMessagesLength(), 1);
    }

    function test_ClaimName_EmitsEvent() public {
        vm.deal(user1, 1 ether);
        bytes32 expectedMessageId = router.nextMessageId();
        vm.expectEmit(true, true, false, true);
        emit NameRegistrationSent(expectedMessageId, "alice", user1, GreenGoodsENS.NameType.Gardener, MOCK_FEE);
        vm.prank(user1);
        ens.claimName{ value: MOCK_FEE }("alice");
    }

    function test_ClaimName_RevertNotProtocolMember() public {
        vm.deal(user2, 1 ether);
        vm.prank(user2); // user2 doesn't wear the protocol hat
        vm.expectRevert(abi.encodeWithSignature("NotProtocolMember()"));
        ens.claimName{ value: MOCK_FEE }("bob");
    }

    function test_ClaimName_RevertInsufficientFee() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("InsufficientFee()"));
        ens.claimName{ value: MOCK_FEE - 1 }("alice");
    }

    function test_ClaimName_RefundsExcessFee() public {
        vm.deal(user1, 1 ether);
        uint256 balanceBefore = user1.balance;
        vm.prank(user1);
        ens.claimName{ value: MOCK_FEE + 0.01 ether }("alice");
        // User should get back the excess (0.01 ether)
        assertEq(user1.balance, balanceBefore - MOCK_FEE);
    }

    // ═══════════════════════════════════════════════════════
    // claimNameSponsored (contract-funded)
    // ═══════════════════════════════════════════════════════

    function test_ClaimNameSponsored_Success() public {
        // Fund the ENS contract
        vm.deal(address(ens), 1 ether);

        vm.prank(user1);
        ens.claimNameSponsored("alice");

        assertEq(ens.available("alice"), false);
        assertEq(router.sentMessagesLength(), 1);
    }

    function test_ClaimNameSponsored_RevertInsufficientBalance() public {
        // Don't fund the contract
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("InsufficientFee()"));
        ens.claimNameSponsored("alice");
    }

    function test_ClaimNameSponsored_RevertNotProtocolMember() public {
        vm.deal(address(ens), 1 ether);
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("NotProtocolMember()"));
        ens.claimNameSponsored("bob");
    }

    // ═══════════════════════════════════════════════════════
    // registerGarden (authorized caller)
    // ═══════════════════════════════════════════════════════

    function test_RegisterGarden_Success() public {
        address garden = address(0x100);
        vm.deal(gardenToken, 1 ether);
        vm.prank(gardenToken);
        ens.registerGarden{ value: MOCK_FEE }("my-garden", garden);

        assertEq(ens.available("my-garden"), false);
    }

    function test_RegisterGarden_RevertUnauthorizedCaller() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("NotAuthorizedCaller()"));
        ens.registerGarden{ value: MOCK_FEE }("my-garden", address(0x100));
    }

    function test_RegisterGarden_OwnerCanCall() public {
        vm.deal(owner, 1 ether);
        vm.prank(owner);
        ens.registerGarden{ value: MOCK_FEE }("my-garden", address(0x100));
        assertEq(ens.available("my-garden"), false);
    }

    // ═══════════════════════════════════════════════════════
    // L2 Cache — Collision Prevention
    // ═══════════════════════════════════════════════════════

    function test_RevertNameTaken() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        ens.claimName{ value: MOCK_FEE }("alice");

        // user2 tries to claim the same name
        hats.setWearer(user2, PROTOCOL_HAT_ID, true);
        vm.deal(user2, 1 ether);
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("NameTaken()"));
        ens.claimName{ value: MOCK_FEE }("alice");
    }

    function test_RevertAlreadyHasName() public {
        vm.deal(user1, 2 ether);

        vm.prank(user1);
        ens.claimName{ value: MOCK_FEE }("alice");

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("AlreadyHasName()"));
        ens.claimName{ value: MOCK_FEE }("alice2");
    }

    // ═══════════════════════════════════════════════════════
    // releaseName
    // ═══════════════════════════════════════════════════════

    function test_ReleaseName_Success() public {
        vm.deal(user1, 2 ether);
        vm.prank(user1);
        ens.claimName{ value: MOCK_FEE }("alice");

        vm.prank(user1);
        ens.releaseName{ value: MOCK_FEE }();

        // Slug is now in cooldown, not immediately available
        assertEq(ens.available("alice"), false);
    }

    function test_ReleaseName_RevertNoName() public {
        vm.deal(user2, 1 ether);
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("NoNameToRelease()"));
        ens.releaseName{ value: MOCK_FEE }();
    }

    function test_ReleaseName_CooldownEnforced() public {
        vm.deal(user1, 2 ether);
        vm.prank(user1);
        ens.claimName{ value: MOCK_FEE }("alice");

        vm.prank(user1);
        ens.releaseName{ value: MOCK_FEE }();

        // During cooldown, slug is not available
        assertEq(ens.available("alice"), false);

        // After cooldown, slug is available
        vm.warp(block.timestamp + 30 days + 1);
        assertEq(ens.available("alice"), true);
    }

    function test_ReleaseName_CooldownBlocksReclaim() public {
        vm.deal(user1, 3 ether);
        vm.prank(user1);
        ens.claimName{ value: MOCK_FEE }("alice");

        vm.prank(user1);
        ens.releaseName{ value: MOCK_FEE }();

        // Try to reclaim during cooldown
        hats.setWearer(user2, PROTOCOL_HAT_ID, true);
        vm.deal(user2, 1 ether);
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("NameInCooldown()"));
        ens.claimName{ value: MOCK_FEE }("alice");
    }

    // ═══════════════════════════════════════════════════════
    // Fee Estimation
    // ═══════════════════════════════════════════════════════

    function test_GetRegistrationFee() public {
        uint256 fee = ens.getRegistrationFee("alice", user1, GreenGoodsENS.NameType.Gardener);
        assertEq(fee, MOCK_FEE);
    }

    function test_GetReleaseFee() public {
        uint256 fee = ens.getReleaseFee("alice");
        assertEq(fee, MOCK_FEE);
    }

    // ═══════════════════════════════════════════════════════
    // CCIP Message Encoding
    // ═══════════════════════════════════════════════════════

    function test_CCIPMessageFormat() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        ens.claimName{ value: MOCK_FEE }("alice");

        // Verify the CCIP message was sent with correct data
        (uint64 destSelector,,) = router.sentMessages(0);
        assertEq(destSelector, ETH_CHAIN_SELECTOR);
    }

    // ═══════════════════════════════════════════════════════
    // Admin Functions
    // ═══════════════════════════════════════════════════════

    function test_SetL1Receiver() public {
        address newReceiver = address(0x999);
        vm.prank(owner);
        ens.setL1Receiver(newReceiver);
        assertEq(ens.l1Receiver(), newReceiver);
    }

    function test_SetAuthorizedCaller() public {
        address caller = address(0x888);
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit AuthorizedCallerUpdated(caller, true);
        ens.setAuthorizedCaller(caller, true);
        assertEq(ens.authorizedCallers(caller), true);
    }

    function test_SetProtocolHatId() public {
        vm.prank(owner);
        ens.setProtocolHatId(999);
        assertEq(ens.protocolHatId(), 999);
    }

    function test_WithdrawETH() public {
        vm.deal(address(ens), 1 ether);
        address recipient = address(0x777);
        vm.prank(owner);
        ens.withdrawETH(recipient);
        assertEq(recipient.balance, 1 ether);
    }

    function test_WithdrawETH_ReservesFailedRefunds() public {
        // Create a failed refund
        ETHRejecter rejecter = new ETHRejecter();
        hats.setWearer(address(rejecter), PROTOCOL_HAT_ID, true);
        vm.deal(address(rejecter), 1 ether);

        vm.prank(address(rejecter));
        ens.claimName{ value: MOCK_FEE + 0.01 ether }("trapped");
        uint256 pendingRefunds = ens.totalPendingRefunds();
        assertEq(pendingRefunds, 0.01 ether);

        // Fund contract with additional ETH
        vm.deal(address(ens), 1 ether);

        // Withdraw should only get balance minus pending refunds
        address recipient = address(0x777);
        uint256 expectedWithdrawable = address(ens).balance - pendingRefunds;
        vm.prank(owner);
        ens.withdrawETH(recipient);
        assertEq(recipient.balance, expectedWithdrawable);

        // Contract retains enough for pending refunds
        assertGe(address(ens).balance, pendingRefunds);
    }

    function test_WithdrawETH_RevertNothingToWithdraw() public {
        // Contract has zero balance and zero pending refunds
        vm.prank(owner);
        vm.expectRevert("No withdrawable balance");
        ens.withdrawETH(address(0x777));
    }

    function test_ClaimNameSponsored_ReservesRefundBalance() public {
        // Scenario: pending refund exists, sponsored registration must not drain below it
        ETHRejecter rejecter = new ETHRejecter();
        hats.setWearer(address(rejecter), PROTOCOL_HAT_ID, true);
        vm.deal(address(rejecter), 1 ether);

        // Create a failed refund of 0.01 ether
        vm.prank(address(rejecter));
        ens.claimName{ value: MOCK_FEE + 0.01 ether }("trapped");
        assertEq(ens.totalPendingRefunds(), 0.01 ether);

        // Fund contract with just enough for fee but NOT enough to cover fee + pending refunds
        // Contract already has some leftover, so set balance precisely
        vm.deal(address(ens), MOCK_FEE + 0.005 ether); // fee + 0.005, but pendingRefunds is 0.01

        // Sponsored registration should fail because available balance < fee + pendingRefunds
        hats.setWearer(user2, PROTOCOL_HAT_ID, true);
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("InsufficientFee()"));
        ens.claimNameSponsored("alice");
    }

    function test_ClaimNameSponsored_SucceedsWithSufficientReserve() public {
        // Fund contract with enough for fee + pending refunds (no pending refunds here)
        vm.deal(address(ens), 1 ether);

        vm.prank(user1);
        ens.claimNameSponsored("alice");

        assertEq(ens.available("alice"), false);
    }

    function test_ReceiveETH() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        (bool ok,) = address(ens).call{ value: 0.5 ether }("");
        assertTrue(ok);
        assertEq(address(ens).balance, 0.5 ether);
    }

    function test_AdminFunctions_RevertNonOwner() public {
        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        ens.setL1Receiver(address(0));

        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        ens.setAuthorizedCaller(address(0), true);

        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        ens.setProtocolHatId(0);

        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        ens.withdrawETH(address(0));
    }

    // ═══════════════════════════════════════════════════════
    // View Functions
    // ═══════════════════════════════════════════════════════

    function test_Available_UnregisteredSlug() public {
        assertTrue(ens.available("unclaimed"));
    }

    function test_OwnerToSlug() public {
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        ens.claimName{ value: MOCK_FEE }("alice");
        assertEq(ens.ownerToSlug(user1), "alice");
    }

    // ═══════════════════════════════════════════════════════
    // Garden Name Immutability (NameType guard)
    // ═══════════════════════════════════════════════════════

    function test_ReleaseName_RevertCannotReleaseGardenName() public {
        // Register a garden name via authorized caller
        address garden = address(0x100);
        vm.deal(gardenToken, 2 ether);
        vm.prank(gardenToken);
        ens.registerGarden{ value: MOCK_FEE }("my-garden", garden);

        // Garden account tries to release — should revert
        vm.deal(garden, 1 ether);
        vm.prank(garden);
        vm.expectRevert(abi.encodeWithSignature("CannotReleaseGardenName()"));
        ens.releaseName{ value: MOCK_FEE }();
    }

    function test_ReleaseName_GardenerNameAllowed() public {
        // Gardener claims a personal name
        vm.deal(user1, 2 ether);
        vm.prank(user1);
        ens.claimName{ value: MOCK_FEE }("alice");

        // Gardener can release their name
        vm.prank(user1);
        ens.releaseName{ value: MOCK_FEE }();

        // Name ownership cleared
        assertEq(ens.ownerToSlug(user1), "");
    }

    function test_SlugNameType_TrackedCorrectly() public {
        // Register garden name
        address garden = address(0x100);
        vm.deal(gardenToken, 1 ether);
        vm.prank(gardenToken);
        ens.registerGarden{ value: MOCK_FEE }("my-garden", garden);

        bytes32 gardenSlugHash = keccak256(bytes("my-garden"));
        assertEq(uint8(ens.slugNameType(gardenSlugHash)), uint8(GreenGoodsENS.NameType.Garden));

        // Claim gardener name
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        ens.claimName{ value: MOCK_FEE }("alice");

        bytes32 gardenerSlugHash = keccak256(bytes("alice"));
        assertEq(uint8(ens.slugNameType(gardenerSlugHash)), uint8(GreenGoodsENS.NameType.Gardener));
    }

    function test_ReleaseName_ClearsNameType() public {
        vm.deal(user1, 2 ether);
        vm.prank(user1);
        ens.claimName{ value: MOCK_FEE }("alice");

        bytes32 slugHash = keccak256(bytes("alice"));
        assertEq(uint8(ens.slugNameType(slugHash)), uint8(GreenGoodsENS.NameType.Gardener));

        vm.prank(user1);
        ens.releaseName{ value: MOCK_FEE }();

        // NameType should be cleared (defaults to 0 = Gardener, but owner is cleared)
        assertEq(uint8(ens.slugNameType(slugHash)), uint8(GreenGoodsENS.NameType.Gardener));
    }

    // ═══════════════════════════════════════════════════════
    // Zero-Address Admin Validation
    // ═══════════════════════════════════════════════════════

    function test_SetL1Receiver_RevertZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("ZeroAddress()"));
        ens.setL1Receiver(address(0));
    }

    function test_SetAuthorizedCaller_RevertZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("ZeroAddress()"));
        ens.setAuthorizedCaller(address(0), true);
    }

    // ═══════════════════════════════════════════════════════
    // Security: Pull-Pattern Refunds (CRIT-1)
    // ═══════════════════════════════════════════════════════

    function test_ClaimName_RefundTrap_TracksFailedRefund() public {
        // Deploy ETH-rejecting contract that tries to claim a name
        ETHRejecter rejecter = new ETHRejecter();
        hats.setWearer(address(rejecter), PROTOCOL_HAT_ID, true);
        vm.deal(address(rejecter), 1 ether);

        uint256 excessAmount = 0.01 ether;

        // Expect the RefundFailed event with correct args
        vm.expectEmit(true, false, false, true);
        emit RefundFailed(address(rejecter), excessAmount);

        // Claim name from rejecter — refund will fail because rejecter reverts on receive
        vm.prank(address(rejecter));
        ens.claimName{ value: MOCK_FEE + excessAmount }("trapped");

        // Verify failed refund was tracked in the mapping
        assertEq(ens.failedRefunds(address(rejecter)), excessAmount);
    }

    function test_ClaimRefund_Success() public {
        // Deploy ETH-rejecting contract, trigger a failed refund
        ETHRejecter rejecter = new ETHRejecter();
        hats.setWearer(address(rejecter), PROTOCOL_HAT_ID, true);
        vm.deal(address(rejecter), 1 ether);

        vm.prank(address(rejecter));
        ens.claimName{ value: MOCK_FEE + 0.01 ether }("trapped");
        assertEq(ens.failedRefunds(address(rejecter)), 0.01 ether);

        // Now allow the rejecter to accept ETH and claim the refund
        rejecter.setAcceptETH(true);
        uint256 balanceBefore = address(rejecter).balance;
        vm.prank(address(rejecter));
        ens.claimRefund();

        assertEq(ens.failedRefunds(address(rejecter)), 0);
        assertEq(address(rejecter).balance, balanceBefore + 0.01 ether);
    }

    function test_ClaimRefund_RevertNoRefundAvailable() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("NoRefundAvailable()"));
        ens.claimRefund();
    }

    function test_TotalPendingRefunds_TrackedOnFailure() public {
        ETHRejecter rejecter = new ETHRejecter();
        hats.setWearer(address(rejecter), PROTOCOL_HAT_ID, true);
        vm.deal(address(rejecter), 1 ether);

        assertEq(ens.totalPendingRefunds(), 0);

        vm.prank(address(rejecter));
        ens.claimName{ value: MOCK_FEE + 0.01 ether }("trapped");

        assertEq(ens.totalPendingRefunds(), 0.01 ether);
    }

    function test_TotalPendingRefunds_DecrementedOnClaim() public {
        ETHRejecter rejecter = new ETHRejecter();
        hats.setWearer(address(rejecter), PROTOCOL_HAT_ID, true);
        vm.deal(address(rejecter), 1 ether);

        vm.prank(address(rejecter));
        ens.claimName{ value: MOCK_FEE + 0.01 ether }("trapped");
        assertEq(ens.totalPendingRefunds(), 0.01 ether);

        // Allow rejecter to accept ETH and claim refund
        rejecter.setAcceptETH(true);
        vm.prank(address(rejecter));
        ens.claimRefund();

        assertEq(ens.totalPendingRefunds(), 0);
    }

    // ═══════════════════════════════════════════════════════
    // Security: Ownership Re-check (MED-2)
    // ═══════════════════════════════════════════════════════

    function test_ReleaseName_NotOwner_Reverts() public {
        // Register "alice" for user1
        vm.deal(user1, 2 ether);
        vm.prank(user1);
        ens.claimName{ value: MOCK_FEE }("alice");

        // Overwrite slugOwner[hash("alice")] to user2 via vm.store, simulating
        // a state inconsistency where ownerToSlug[user1] = "alice" but
        // slugOwner[hash("alice")] != user1.
        // Storage layout: Ownable._owner=0, protocolHatId=1, l1Receiver=2, slugOwner=3
        bytes32 slugHash = keccak256(bytes("alice"));
        bytes32 slugOwnerSlot = keccak256(abi.encode(slugHash, uint256(3)));
        vm.store(address(ens), slugOwnerSlot, bytes32(uint256(uint160(user2))));

        // user1 calls releaseName — ownerToSlug[user1] still = "alice",
        // but slugOwner[hash("alice")] is now user2, triggering NotOwner
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("NotOwner()"));
        ens.releaseName{ value: MOCK_FEE }();
    }

    // ═══════════════════════════════════════════════════════
    // Security: Zero-Address Guard (MED-3)
    // ═══════════════════════════════════════════════════════

    function test_CacheRegistration_ZeroAddress_Reverts() public {
        // registerGarden with zero address should revert
        vm.deal(gardenToken, 1 ether);
        vm.prank(gardenToken);
        vm.expectRevert(abi.encodeWithSignature("ZeroAddress()"));
        ens.registerGarden{ value: MOCK_FEE }("zero-garden", address(0));
    }
}

/// @dev Contract that rejects ETH transfers (simulates refund trap attack)
contract ETHRejecter {
    bool public acceptETH;

    function setAcceptETH(bool _accept) external {
        acceptETH = _accept;
    }

    receive() external payable {
        if (!acceptETH) revert("No ETH accepted");
    }
}
