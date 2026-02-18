// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { GreenGoodsENSReceiver } from "../../src/registries/ENSReceiver.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { IENS, IENSResolver } from "../../src/interfaces/IENS.sol";

/// @title EthereumENSReceiverForkTest
/// @notice Fork tests for GreenGoodsENSReceiver against real ENS Registry on Ethereum mainnet.
/// @dev Standalone test (like ArbitrumYieldSplitter.t.sol). Deploys receiver wired to the
/// real ENS Registry and Public Resolver. Tests CCIP receive paths (registration, member
/// subdomain, invalid sender, duplicate slug) against live ENS infrastructure.
/// Gracefully skips when ETHEREUM_RPC_URL is not set.
contract EthereumENSReceiverForkTest is Test {
    /// @notice Real ENS Registry on Ethereum mainnet
    address internal constant ENS_REGISTRY = 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e;

    /// @notice Real ENS Public Resolver on Ethereum mainnet
    address internal constant ENS_PUBLIC_RESOLVER = 0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63;

    /// @notice Chainlink CCIP chain selector for Arbitrum One
    uint64 internal constant ARB_CHAIN_SELECTOR = 4_949_039_107_694_359_620;

    /// @notice namehash("greengoods.eth") — used as the base node for subdomain registration
    /// @dev keccak256(abi.encodePacked(namehash("eth"), keccak256("greengoods")))
    bytes32 internal constant BASE_NODE = 0x0854ba3d72dfe3022a4d5a14f037c0d42e0be5f7eb16a4e0f4ceef06a16ef614;

    GreenGoodsENSReceiver public receiver;

    address public ccipRouter;
    address public l2Sender;
    address public owner;
    address public user1;
    address public user2;

    // ═══════════════════════════════════════════════════════════════════════════
    // Fork Helper
    // ═══════════════════════════════════════════════════════════════════════════

    function _tryFork() internal returns (bool) {
        string memory rpc;
        try vm.envString("ETHEREUM_RPC_URL") returns (string memory value) {
            rpc = value;
        } catch {
            try vm.envString("ETHEREUM_RPC") returns (string memory fallback_) {
                rpc = fallback_;
            } catch {
                return false;
            }
        }
        if (bytes(rpc).length == 0) return false;

        uint256 forkId = vm.createFork(rpc);
        vm.selectFork(forkId);
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Deployment Helper
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Deploy GreenGoodsENSReceiver against real ENS on Ethereum mainnet fork
    /// @dev Uses a custom ccipRouter (makeAddr) so we can prank it for CCIP message delivery.
    ///      The real ENS Registry and Public Resolver are used for actual subdomain operations.
    ///      We impersonate the ENS Registry owner to grant our receiver subdomain control.
    function _deployReceiverOnFork() internal {
        ccipRouter = makeAddr("ccipRouter");
        l2Sender = makeAddr("l2Sender");
        owner = makeAddr("owner");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");

        receiver = new GreenGoodsENSReceiver(
            ccipRouter, ARB_CHAIN_SELECTOR, l2Sender, ENS_REGISTRY, ENS_PUBLIC_RESOLVER, BASE_NODE, owner
        );

        // Grant the receiver permission to manage subnodes under BASE_NODE.
        // On mainnet, greengoods.eth must be owned by the receiver contract.
        // On fork, we use vm.store to set the owner of greengoods.eth to our receiver.
        // ENS Registry stores node owners in mapping(bytes32 => Record) at slot 0.
        // Record struct layout: address owner (slot 0), address resolver (slot 1), uint64 ttl (slot 2)
        bytes32 nodeSlot = keccak256(abi.encode(BASE_NODE, uint256(0)));
        vm.store(ENS_REGISTRY, nodeSlot, bytes32(uint256(uint160(address(receiver)))));

        // Also grant the receiver permission on the Public Resolver.
        // The resolver's isAuthorised check looks at ENS Registry ownership,
        // so setting the registry owner above should suffice. But we also need
        // the resolver to allow our receiver to call setAddr.
        // Public Resolver checks: ENS.owner(node) == msg.sender || isApprovedForAll(owner, msg.sender)
        // Since we set the ENS owner to the receiver, the receiver's _setENSRecordsExternal
        // (called via this._setENSRecordsExternal which sends msg.sender=receiver) should work.
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CCIP Message Helpers
    // ═══════════════════════════════════════════════════════════════════════════

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
            messageId: keccak256(abi.encodePacked("fork-msg", slug, _owner)),
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

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Register Garden Subdomain via CCIP
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Register a garden subdomain against real ENS Registry on Ethereum mainnet fork.
    ///         Verifies internal state (registrations, ownerToSlug) and real ENS resolver addr().
    function test_forkEthereum_ccipReceive_registersGardenSubdomain() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ETHEREUM_RPC_URL not set");
            return;
        }

        // Verify real ENS Registry is deployed
        assertGt(ENS_REGISTRY.code.length, 0, "ENS Registry should be deployed on Ethereum mainnet");
        assertGt(ENS_PUBLIC_RESOLVER.code.length, 0, "ENS Public Resolver should be deployed");

        _deployReceiverOnFork();

        string memory slug = "miyawaki-park";
        Client.Any2EVMMessage memory message = _buildCCIPMessage(0, slug, user1, GreenGoodsENSReceiver.NameType.Garden);

        _deliverCCIPMessage(message);

        // Verify internal state
        assertFalse(receiver.available(slug), "slug should not be available after registration");
        assertEq(receiver.resolve(slug), user1, "slug should resolve to user1");

        GreenGoodsENSReceiver.Registration memory reg = receiver.getRegistration(slug);
        assertEq(uint8(reg.nameType), uint8(GreenGoodsENSReceiver.NameType.Garden), "name type should be Garden");
        assertEq(reg.owner, user1, "registration owner should be user1");
        assertGt(reg.registeredAt, 0, "registeredAt should be non-zero");

        // Verify real ENS resolver was updated
        bytes32 label = keccak256(bytes(slug));
        bytes32 node = keccak256(abi.encodePacked(BASE_NODE, label));
        address resolvedAddr = IENSResolver(ENS_PUBLIC_RESOLVER).addr(node);
        assertEq(resolvedAddr, user1, "ENS resolver should resolve subdomain to user1");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Register Member Subdomain via CCIP
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Register a member (Gardener) subdomain and verify ENS resolution
    function test_forkEthereum_ccipReceive_registersMemberSubdomain() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ETHEREUM_RPC_URL not set");
            return;
        }

        _deployReceiverOnFork();

        string memory slug = "alice-gardener";
        Client.Any2EVMMessage memory message = _buildCCIPMessage(0, slug, user2, GreenGoodsENSReceiver.NameType.Gardener);

        _deliverCCIPMessage(message);

        // Verify internal state
        assertEq(receiver.resolve(slug), user2, "slug should resolve to user2");

        GreenGoodsENSReceiver.Registration memory reg = receiver.getRegistration(slug);
        assertEq(uint8(reg.nameType), uint8(GreenGoodsENSReceiver.NameType.Gardener), "name type should be Gardener");

        // Verify ownerToSlug reverse mapping
        assertEq(
            keccak256(bytes(receiver.ownerToSlug(user2))), keccak256(bytes(slug)), "ownerToSlug should map user2 to slug"
        );

        // Verify real ENS resolver
        bytes32 label = keccak256(bytes(slug));
        bytes32 node = keccak256(abi.encodePacked(BASE_NODE, label));
        address resolvedAddr = IENSResolver(ENS_PUBLIC_RESOLVER).addr(node);
        assertEq(resolvedAddr, user2, "ENS resolver should resolve member subdomain to user2");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Invalid Sender Reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice CCIP message from unauthorized sender should revert
    function test_forkEthereum_ccipReceive_invalidSender_reverts() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ETHEREUM_RPC_URL not set");
            return;
        }

        _deployReceiverOnFork();

        // Build message with wrong sender address
        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: keccak256("bad-sender"),
            sourceChainSelector: ARB_CHAIN_SELECTOR,
            sender: abi.encode(address(0xBEEF)), // Wrong sender — not l2Sender
            data: abi.encode(uint8(0), "hacker-garden", user1, GreenGoodsENSReceiver.NameType.Garden),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        vm.prank(ccipRouter);
        vm.expectRevert(abi.encodeWithSignature("UnauthorizedSender()"));
        receiver.ccipReceive(message);

        // Also test wrong source chain
        Client.Any2EVMMessage memory wrongChainMsg = Client.Any2EVMMessage({
            messageId: keccak256("bad-chain"),
            sourceChainSelector: 999, // Wrong chain selector
            sender: abi.encode(l2Sender),
            data: abi.encode(uint8(0), "hacker-garden", user1, GreenGoodsENSReceiver.NameType.Garden),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        vm.prank(ccipRouter);
        vm.expectRevert(abi.encodeWithSignature("UnauthorizedSourceChain()"));
        receiver.ccipReceive(wrongChainMsg);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Duplicate Slug Emits NameRegistrationSkipped
    // ═══════════════════════════════════════════════════════════════════════════

    event NameRegistrationSkipped(string slug, address attemptedOwner, address existingOwner, bytes32 indexed messageId);

    /// @notice Second registration of the same slug should emit skip event (not revert)
    ///         and leave the original registration intact in both internal state and ENS.
    function test_forkEthereum_ccipReceive_duplicateSlug_emitsFailure() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ETHEREUM_RPC_URL not set");
            return;
        }

        _deployReceiverOnFork();

        string memory slug = "shared-garden";

        // First registration succeeds
        Client.Any2EVMMessage memory msg1 = _buildCCIPMessage(0, slug, user1, GreenGoodsENSReceiver.NameType.Garden);
        _deliverCCIPMessage(msg1);
        assertEq(receiver.resolve(slug), user1, "first registration should succeed");

        // Second registration with same slug but different owner — should emit NameRegistrationSkipped
        Client.Any2EVMMessage memory msg2 = _buildCCIPMessage(0, slug, user2, GreenGoodsENSReceiver.NameType.Garden);

        vm.expectEmit(false, false, true, true);
        emit NameRegistrationSkipped(slug, user2, user1, msg2.messageId);

        _deliverCCIPMessage(msg2);

        // Original registration should be unchanged
        assertEq(receiver.resolve(slug), user1, "original registration should be preserved");

        // ENS should still point to user1
        bytes32 label = keccak256(bytes(slug));
        bytes32 node = keccak256(abi.encodePacked(BASE_NODE, label));
        address resolvedAddr = IENSResolver(ENS_PUBLIC_RESOLVER).addr(node);
        assertEq(resolvedAddr, user1, "ENS should still resolve to original owner");
    }
}
