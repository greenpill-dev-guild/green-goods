// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { GreenGoodsENSReceiver } from "../../src/registries/ENSReceiver.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

/// @dev Mock ENS Registry
contract MockENSRegistry {
    mapping(bytes32 => address) public nodeOwner;
    mapping(bytes32 => address) public nodeResolver;

    function setSubnodeOwner(bytes32 node, bytes32 label, address _owner) external returns (bytes32) {
        bytes32 subnode = keccak256(abi.encodePacked(node, label));
        nodeOwner[subnode] = _owner;
        return subnode;
    }

    function setResolver(bytes32 node, address _resolver) external {
        nodeResolver[node] = _resolver;
    }
}

/// @dev Mock ENS Resolver
contract MockENSResolver {
    mapping(bytes32 => address) public addresses;

    function setAddr(bytes32 node, address _addr) external {
        addresses[node] = _addr;
    }

    function addr(bytes32 node) external view returns (address payable) {
        return payable(addresses[node]);
    }
}

contract GreenGoodsENSReceiverTest is Test {
    GreenGoodsENSReceiver public receiver;
    MockENSRegistry public ensRegistry;
    MockENSResolver public ensResolver;

    address public ccipRouter = address(0x10);
    address public l2Sender = address(0x20);
    address public owner = address(0x30);
    address public user1 = address(0x40);
    address public user2 = address(0x50);

    uint64 public constant ARB_CHAIN_SELECTOR = 4_949_039_107_694_359_620;
    /// @dev namehash("greengoods.eth") = keccak256(abi.encodePacked(namehash("eth"), keccak256("greengoods")))
    bytes32 public constant BASE_NODE = 0x15ee556e39afd119101712c5ac4f1519d9f2f32780d4e1cf42b27fdfa73db841;

    event NameRegistered(
        string slug, address indexed owner, GreenGoodsENSReceiver.NameType nameType, bytes32 indexed messageId
    );
    event NameReleased(string slug, address indexed previousOwner, bytes32 indexed messageId);

    function setUp() public {
        ensRegistry = new MockENSRegistry();
        ensResolver = new MockENSResolver();

        receiver = new GreenGoodsENSReceiver(
            ccipRouter,
            ARB_CHAIN_SELECTOR,
            l2Sender,
            address(ensRegistry),
            address(ensResolver),
            BASE_NODE,
            owner,
            address(0) // nameWrapper: unwrapped in unit tests
        );
    }

    // ═══════════════════════════════════════════════════════
    // Helper: Simulate CCIP message delivery
    // ═══════════════════════════════════════════════════════

    function _buildCCIPMessage(
        uint8 action,
        string memory slug,
        address _owner,
        GreenGoodsENSReceiver.NameType nameType
    )
        internal
        view
        returns (Client.Any2EVMMessage memory)
    {
        return Client.Any2EVMMessage({
            messageId: keccak256(abi.encodePacked("msg", slug)),
            sourceChainSelector: ARB_CHAIN_SELECTOR,
            sender: abi.encode(l2Sender),
            data: abi.encode(action, slug, _owner, nameType),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });
    }

    function _deliverCCIPMessage(Client.Any2EVMMessage memory message) internal {
        vm.prank(ccipRouter);
        receiver.ccipReceive(message);
    }

    // ═══════════════════════════════════════════════════════
    // Registration via CCIP
    // ═══════════════════════════════════════════════════════

    function test_Register_Success() public {
        Client.Any2EVMMessage memory message = _buildCCIPMessage(0, "alice", user1, GreenGoodsENSReceiver.NameType.Gardener);

        _deliverCCIPMessage(message);

        assertEq(receiver.available("alice"), false);
        assertEq(receiver.resolve("alice"), user1);
    }

    function test_Register_EmitsEvent() public {
        Client.Any2EVMMessage memory message = _buildCCIPMessage(0, "alice", user1, GreenGoodsENSReceiver.NameType.Gardener);

        vm.expectEmit(true, true, false, true);
        emit NameRegistered("alice", user1, GreenGoodsENSReceiver.NameType.Gardener, message.messageId);

        _deliverCCIPMessage(message);
    }

    function test_Register_SetsENSRecords() public {
        Client.Any2EVMMessage memory message = _buildCCIPMessage(0, "alice", user1, GreenGoodsENSReceiver.NameType.Gardener);

        _deliverCCIPMessage(message);

        // Verify ENS resolver was called with correct address
        bytes32 label = keccak256(bytes("alice"));
        bytes32 node = keccak256(abi.encodePacked(BASE_NODE, label));
        assertEq(ensResolver.addr(node), user1);
    }

    function test_Register_GardenType() public {
        Client.Any2EVMMessage memory message =
            _buildCCIPMessage(0, "my-garden", user1, GreenGoodsENSReceiver.NameType.Garden);

        _deliverCCIPMessage(message);

        GreenGoodsENSReceiver.Registration memory reg = receiver.getRegistration("my-garden");
        assertEq(uint8(reg.nameType), uint8(GreenGoodsENSReceiver.NameType.Garden));
        assertEq(reg.owner, user1);
    }

    function test_Register_Idempotent_SkipsDuplicate() public {
        Client.Any2EVMMessage memory message1 =
            _buildCCIPMessage(0, "alice", user1, GreenGoodsENSReceiver.NameType.Gardener);

        _deliverCCIPMessage(message1);

        // Second message with same slug but different owner — should be silently skipped
        Client.Any2EVMMessage memory message2 =
            _buildCCIPMessage(0, "alice", user2, GreenGoodsENSReceiver.NameType.Gardener);

        _deliverCCIPMessage(message2);

        // First registration should still hold
        assertEq(receiver.resolve("alice"), user1);
    }

    // ═══════════════════════════════════════════════════════
    // Source Chain / Sender Verification
    // ═══════════════════════════════════════════════════════

    function test_RevertUnauthorizedSourceChain() public {
        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: keccak256("test"),
            sourceChainSelector: 999, // Wrong chain
            sender: abi.encode(l2Sender),
            data: abi.encode(uint8(0), "alice", user1, GreenGoodsENSReceiver.NameType.Gardener),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        vm.prank(ccipRouter);
        vm.expectRevert(abi.encodeWithSignature("UnauthorizedSourceChain()"));
        receiver.ccipReceive(message);
    }

    function test_RevertUnauthorizedSender() public {
        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: keccak256("test"),
            sourceChainSelector: ARB_CHAIN_SELECTOR,
            sender: abi.encode(address(0xBEEF)), // Wrong sender
            data: abi.encode(uint8(0), "alice", user1, GreenGoodsENSReceiver.NameType.Gardener),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        vm.prank(ccipRouter);
        vm.expectRevert(abi.encodeWithSignature("UnauthorizedSender()"));
        receiver.ccipReceive(message);
    }

    function test_RevertNotRouter() public {
        Client.Any2EVMMessage memory message = _buildCCIPMessage(0, "alice", user1, GreenGoodsENSReceiver.NameType.Gardener);

        vm.prank(user1); // Not the router
        vm.expectRevert();
        receiver.ccipReceive(message);
    }

    // ═══════════════════════════════════════════════════════
    // Release via CCIP
    // ═══════════════════════════════════════════════════════

    function test_Release_Success() public {
        // First register
        _deliverCCIPMessage(_buildCCIPMessage(0, "alice", user1, GreenGoodsENSReceiver.NameType.Gardener));
        assertEq(receiver.resolve("alice"), user1);

        // Then release
        _deliverCCIPMessage(_buildCCIPMessage(1, "alice", user1, GreenGoodsENSReceiver.NameType.Gardener));
        assertEq(receiver.resolve("alice"), address(0));
        assertTrue(receiver.available("alice"));
    }

    function test_Release_SkipsWrongOwner() public {
        // Register as user1
        _deliverCCIPMessage(_buildCCIPMessage(0, "alice", user1, GreenGoodsENSReceiver.NameType.Gardener));

        // Try to release as user2 — should be silently skipped
        _deliverCCIPMessage(_buildCCIPMessage(1, "alice", user2, GreenGoodsENSReceiver.NameType.Gardener));

        // Still registered to user1
        assertEq(receiver.resolve("alice"), user1);
    }

    // ═══════════════════════════════════════════════════════
    // Admin Functions
    // ═══════════════════════════════════════════════════════

    function test_AdminReleaseName() public {
        _deliverCCIPMessage(_buildCCIPMessage(0, "squatter", user1, GreenGoodsENSReceiver.NameType.Gardener));

        vm.prank(owner);
        receiver.adminReleaseName("squatter");
        assertTrue(receiver.available("squatter"));
    }

    function test_AdminReleaseName_NoopIfEmpty() public {
        vm.prank(owner);
        receiver.adminReleaseName("nonexistent"); // Should not revert
    }

    function test_AdminRegister() public {
        vm.prank(owner);
        receiver.adminRegister("admin-name", user1, GreenGoodsENSReceiver.NameType.Gardener);
        assertEq(receiver.resolve("admin-name"), user1);
    }

    function test_AdminRegister_RevertNameTaken() public {
        _deliverCCIPMessage(_buildCCIPMessage(0, "alice", user1, GreenGoodsENSReceiver.NameType.Gardener));

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("NameTaken()"));
        receiver.adminRegister("alice", user2, GreenGoodsENSReceiver.NameType.Gardener);
    }

    function test_SetL2Sender() public {
        address newSender = address(0x999);
        vm.prank(owner);
        receiver.setL2Sender(newSender);
        assertEq(receiver.l2Sender(), newSender);
    }

    function test_AdminFunctions_RevertNonOwner() public {
        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        receiver.setL2Sender(address(0x999));

        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        receiver.adminReleaseName("test");

        vm.prank(user1);
        vm.expectRevert("Ownable: caller is not the owner");
        receiver.adminRegister("test", user1, GreenGoodsENSReceiver.NameType.Gardener);
    }

    // ═══════════════════════════════════════════════════════
    // View Functions
    // ═══════════════════════════════════════════════════════

    function test_Available_Unregistered() public {
        assertTrue(receiver.available("unclaimed"));
    }

    function test_GetRegistration_Full() public {
        _deliverCCIPMessage(_buildCCIPMessage(0, "alice", user1, GreenGoodsENSReceiver.NameType.Gardener));

        GreenGoodsENSReceiver.Registration memory reg = receiver.getRegistration("alice");
        assertEq(reg.owner, user1);
        assertEq(uint8(reg.nameType), uint8(GreenGoodsENSReceiver.NameType.Gardener));
        assertGt(reg.registeredAt, 0);
    }

    function test_OwnerToSlug() public {
        _deliverCCIPMessage(_buildCCIPMessage(0, "alice", user1, GreenGoodsENSReceiver.NameType.Gardener));
        assertEq(receiver.ownerToSlug(user1), "alice");
    }

    // ═══════════════════════════════════════════════════════
    // Release — ENS Subnode Reclaim
    // ═══════════════════════════════════════════════════════

    function test_Release_ReclainsSubnodeOwnership() public {
        // Register
        _deliverCCIPMessage(_buildCCIPMessage(0, "alice", user1, GreenGoodsENSReceiver.NameType.Gardener));

        // Verify ENS records were set
        bytes32 label = keccak256(bytes("alice"));
        bytes32 node = keccak256(abi.encodePacked(BASE_NODE, label));
        assertEq(ensResolver.addr(node), user1);

        // Release
        _deliverCCIPMessage(_buildCCIPMessage(1, "alice", user1, GreenGoodsENSReceiver.NameType.Gardener));

        // ENS address should be cleared
        assertEq(ensResolver.addr(node), address(0));
        // Subnode should be reclaimed by receiver (setSubnodeOwner called)
        assertEq(ensRegistry.nodeOwner(node), address(receiver));
    }

    function test_AdminRelease_ReclainsSubnodeOwnership() public {
        _deliverCCIPMessage(_buildCCIPMessage(0, "squatter", user1, GreenGoodsENSReceiver.NameType.Gardener));

        bytes32 label = keccak256(bytes("squatter"));
        bytes32 node = keccak256(abi.encodePacked(BASE_NODE, label));

        vm.prank(owner);
        receiver.adminReleaseName("squatter");

        assertEq(ensResolver.addr(node), address(0));
        assertEq(ensRegistry.nodeOwner(node), address(receiver));
    }

    // ═══════════════════════════════════════════════════════
    // Zero-Address Admin Validation
    // ═══════════════════════════════════════════════════════

    function test_SetL2Sender_RevertZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("ZeroAddress()"));
        receiver.setL2Sender(address(0));
    }

    // ═══════════════════════════════════════════════════════
    // Security: Invalid Action (CRIT-2)
    // ═══════════════════════════════════════════════════════

    function test_CcipReceive_InvalidAction_Reverts() public {
        // Send action=2 (invalid)
        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: keccak256("invalid-action"),
            sourceChainSelector: ARB_CHAIN_SELECTOR,
            sender: abi.encode(l2Sender),
            data: abi.encode(uint8(2), "alice", user1, GreenGoodsENSReceiver.NameType.Gardener),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        vm.prank(ccipRouter);
        vm.expectRevert(abi.encodeWithSignature("InvalidAction()"));
        receiver.ccipReceive(message);
    }

    // ═══════════════════════════════════════════════════════
    // Security: Duplicate Registration Emits Event (HIGH-1)
    // ═══════════════════════════════════════════════════════

    event NameRegistrationSkipped(string slug, address attemptedOwner, address existingOwner, bytes32 indexed messageId);

    function test_Register_Duplicate_EmitsSkippedEvent() public {
        // First registration
        _deliverCCIPMessage(_buildCCIPMessage(0, "alice", user1, GreenGoodsENSReceiver.NameType.Gardener));

        // Second registration should emit NameRegistrationSkipped
        Client.Any2EVMMessage memory message2 =
            _buildCCIPMessage(0, "alice", user2, GreenGoodsENSReceiver.NameType.Gardener);

        vm.expectEmit(false, false, true, true);
        emit NameRegistrationSkipped("alice", user2, user1, message2.messageId);

        _deliverCCIPMessage(message2);

        // Original registration unchanged
        assertEq(receiver.resolve("alice"), user1);
    }

    // ═══════════════════════════════════════════════════════
    // Security: Single-Name-Per-Owner (HIGH-3)
    // ═══════════════════════════════════════════════════════

    function test_Register_OwnerAlreadyHasName_SkipsGracefully() public {
        // Register first name for user1
        _deliverCCIPMessage(_buildCCIPMessage(0, "alice", user1, GreenGoodsENSReceiver.NameType.Gardener));

        // Try to register a second name for user1 — should skip gracefully (not revert)
        // CCIP receivers must never revert on data validation to avoid permanent message failures
        Client.Any2EVMMessage memory message2 = _buildCCIPMessage(0, "bob", user1, GreenGoodsENSReceiver.NameType.Gardener);

        vm.expectEmit(false, false, true, true);
        emit NameRegistrationSkipped("bob", user1, user1, message2.messageId);

        _deliverCCIPMessage(message2);

        // Original registration unchanged, second name NOT registered
        assertEq(receiver.resolve("alice"), user1);
        assertEq(receiver.resolve("bob"), address(0));
    }

    // ═══════════════════════════════════════════════════════
    // Security: L1 Slug Validation — Graceful Skip in CCIP Path (MED-1)
    // ═══════════════════════════════════════════════════════

    function test_Register_InvalidSlug_SkipsGracefully() public {
        // Invalid slug via CCIP should emit NameRegistrationSkipped (not revert)
        // to prevent permanent CCIP message failure
        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: keccak256("bad-slug"),
            sourceChainSelector: ARB_CHAIN_SELECTOR,
            sender: abi.encode(l2Sender),
            data: abi.encode(uint8(0), "ab", user1, GreenGoodsENSReceiver.NameType.Gardener),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        vm.expectEmit(false, false, true, true);
        emit NameRegistrationSkipped("ab", user1, address(0), message.messageId);

        vm.prank(ccipRouter);
        receiver.ccipReceive(message);

        // Name should NOT be registered
        assertTrue(receiver.available("ab"));
    }

    function test_Register_InvalidSlug_Uppercase_SkipsGracefully() public {
        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: keccak256("bad-slug-upper"),
            sourceChainSelector: ARB_CHAIN_SELECTOR,
            sender: abi.encode(l2Sender),
            data: abi.encode(uint8(0), "Alice", user1, GreenGoodsENSReceiver.NameType.Gardener),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        vm.prank(ccipRouter);
        receiver.ccipReceive(message); // Should not revert

        assertTrue(receiver.available("Alice"));
    }

    function test_Register_InvalidSlug_LeadingHyphen_SkipsGracefully() public {
        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: keccak256("bad-slug-hyphen"),
            sourceChainSelector: ARB_CHAIN_SELECTOR,
            sender: abi.encode(l2Sender),
            data: abi.encode(uint8(0), "-bad", user1, GreenGoodsENSReceiver.NameType.Gardener),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        vm.prank(ccipRouter);
        receiver.ccipReceive(message); // Should not revert

        assertTrue(receiver.available("-bad"));
    }

    function test_Register_InvalidSlug_ConsecutiveHyphens_SkipsGracefully() public {
        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: keccak256("bad-slug-double"),
            sourceChainSelector: ARB_CHAIN_SELECTOR,
            sender: abi.encode(l2Sender),
            data: abi.encode(uint8(0), "al--ice", user1, GreenGoodsENSReceiver.NameType.Gardener),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        vm.prank(ccipRouter);
        receiver.ccipReceive(message); // Should not revert

        assertTrue(receiver.available("al--ice"));
    }

    function test_CcipReceive_InvalidAction_HighValue_Reverts() public {
        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: keccak256("invalid-action-255"),
            sourceChainSelector: ARB_CHAIN_SELECTOR,
            sender: abi.encode(l2Sender),
            data: abi.encode(uint8(255), "alice", user1, GreenGoodsENSReceiver.NameType.Gardener),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        vm.prank(ccipRouter);
        vm.expectRevert(abi.encodeWithSignature("InvalidAction()"));
        receiver.ccipReceive(message);
    }

    // ═══════════════════════════════════════════════════════
    // Security: ENS Failure Handling (MED-4)
    // ═══════════════════════════════════════════════════════

    event ENSRegistrationFailed(string slug, address owner);

    function test_Register_ENSFailure_EmitsEvent() public {
        // Deploy a receiver with a broken ENS registry (address that will revert)
        GreenGoodsENSReceiver brokenReceiver = new GreenGoodsENSReceiver(
            ccipRouter,
            ARB_CHAIN_SELECTOR,
            l2Sender,
            address(new RevertingContract()), // Mock that reverts on any call
            address(ensResolver),
            BASE_NODE,
            owner,
            address(0)
        );

        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: keccak256("ens-fail"),
            sourceChainSelector: ARB_CHAIN_SELECTOR,
            sender: abi.encode(l2Sender),
            data: abi.encode(uint8(0), "alice", user1, GreenGoodsENSReceiver.NameType.Gardener),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        // Should emit ENSRegistrationFailed but still complete the registration
        vm.expectEmit(false, false, false, true);
        emit ENSRegistrationFailed("alice", user1);

        vm.prank(ccipRouter);
        brokenReceiver.ccipReceive(message);

        // Registration should still be stored even though ENS failed
        assertEq(brokenReceiver.resolve("alice"), user1);
    }

    event ENSReleaseFailed(string slug, address previousOwner);

    function test_Release_ENSFailure_EmitsEventAndCompletes() public {
        // Deploy a receiver with a broken ENS registry (reverts on any call)
        GreenGoodsENSReceiver brokenReceiver = new GreenGoodsENSReceiver(
            ccipRouter,
            ARB_CHAIN_SELECTOR,
            l2Sender,
            address(new RevertingContract()),
            address(ensResolver),
            BASE_NODE,
            owner,
            address(0)
        );

        // First register — ENS ops fail but registration stored (existing behavior)
        Client.Any2EVMMessage memory regMessage = Client.Any2EVMMessage({
            messageId: keccak256("reg-ens-fail"),
            sourceChainSelector: ARB_CHAIN_SELECTOR,
            sender: abi.encode(l2Sender),
            data: abi.encode(uint8(0), "alice", user1, GreenGoodsENSReceiver.NameType.Gardener),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });
        vm.prank(ccipRouter);
        brokenReceiver.ccipReceive(regMessage);
        assertEq(brokenReceiver.resolve("alice"), user1);

        // Now release — ENS ops fail but release should still complete (the fix)
        Client.Any2EVMMessage memory relMessage = Client.Any2EVMMessage({
            messageId: keccak256("rel-ens-fail"),
            sourceChainSelector: ARB_CHAIN_SELECTOR,
            sender: abi.encode(l2Sender),
            data: abi.encode(uint8(1), "alice", user1, GreenGoodsENSReceiver.NameType.Gardener),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        vm.expectEmit(false, false, false, true);
        emit ENSReleaseFailed("alice", user1);

        vm.prank(ccipRouter);
        brokenReceiver.ccipReceive(relMessage); // Must not revert

        // Internal state should be cleared even though ENS cleanup failed
        assertEq(brokenReceiver.resolve("alice"), address(0));
        assertTrue(brokenReceiver.available("alice"));
    }

    function test_Release_ENSFailure_BrokenResolver() public {
        // Deploy with working registry but broken resolver
        GreenGoodsENSReceiver brokenResolverReceiver = new GreenGoodsENSReceiver(
            ccipRouter,
            ARB_CHAIN_SELECTOR,
            l2Sender,
            address(ensRegistry),
            address(new RevertingContract()), // resolver reverts
            BASE_NODE,
            owner,
            address(0)
        );

        // Register (ENS registration will fail on setAddr, caught by try/catch)
        Client.Any2EVMMessage memory regMessage = Client.Any2EVMMessage({
            messageId: keccak256("reg-resolver-fail"),
            sourceChainSelector: ARB_CHAIN_SELECTOR,
            sender: abi.encode(l2Sender),
            data: abi.encode(uint8(0), "alice", user1, GreenGoodsENSReceiver.NameType.Gardener),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });
        vm.prank(ccipRouter);
        brokenResolverReceiver.ccipReceive(regMessage);

        // Release — resolver reverts on setAddr(node, address(0)), caught by try/catch
        Client.Any2EVMMessage memory relMessage = Client.Any2EVMMessage({
            messageId: keccak256("rel-resolver-fail"),
            sourceChainSelector: ARB_CHAIN_SELECTOR,
            sender: abi.encode(l2Sender),
            data: abi.encode(uint8(1), "alice", user1, GreenGoodsENSReceiver.NameType.Gardener),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        vm.prank(ccipRouter);
        brokenResolverReceiver.ccipReceive(relMessage); // Must not revert

        // Internal state cleared
        assertEq(brokenResolverReceiver.resolve("alice"), address(0));
    }

    // ═══════════════════════════════════════════════════════
    // Security: Admin Bypasses Owner Check (HIGH-3 exception)
    // ═══════════════════════════════════════════════════════

    function test_AdminRegister_BypassesOwnerCheck() public {
        // Admin registers "alice" for user1
        vm.prank(owner);
        receiver.adminRegister("alice", user1, GreenGoodsENSReceiver.NameType.Gardener);
        assertEq(receiver.resolve("alice"), user1);

        // Admin registers "bob" for the SAME user1 — bypasses OwnerAlreadyHasName
        // This is allowed for admin (migration/recovery), but would be skipped via CCIP
        vm.prank(owner);
        receiver.adminRegister("bob", user1, GreenGoodsENSReceiver.NameType.Gardener);
        assertEq(receiver.resolve("bob"), user1);

        // Both registrations exist (ownerToSlug points to latest)
        assertEq(receiver.resolve("alice"), user1);
        assertEq(receiver.resolve("bob"), user1);
    }

    function test_AdminRegister_RevertInvalidSlug() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("InvalidSlug()"));
        receiver.adminRegister("AB", user1, GreenGoodsENSReceiver.NameType.Gardener);
    }

    function test_AdminRegister_RevertInvalidSlugConsecutiveHyphens() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("InvalidSlug()"));
        receiver.adminRegister("my--name", user1, GreenGoodsENSReceiver.NameType.Gardener);
    }
}

/// @dev Contract that reverts on any call (simulates broken ENS registry)
contract RevertingContract {
    fallback() external payable {
        revert("Broken ENS");
    }
}
