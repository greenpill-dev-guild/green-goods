// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";

import {
    GreenGoodsENS,
    InvalidSlug,
    NameTaken,
    AlreadyHasName,
    NotAuthorizedCaller,
    NotProtocolMember
} from "../../src/registries/ENS.sol";
import { GreenGoodsENSReceiver } from "../../src/registries/ENSReceiver.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { IRouterClient } from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import { IENS, IENSResolver } from "../../src/interfaces/IENS.sol";

/// @title CrossChainENSForkTest
/// @notice Dual-fork tests simulating L2 (Arbitrum) → L1 (Ethereum) ENS registration via CCIP.
/// @dev Uses vm.createFork() + vm.selectFork() to alternate between Arbitrum and Ethereum forks.
///      ABI-encodes the CCIP message payload on the L2 side, then delivers it to the L1 receiver.
///      Gracefully skips when either ARBITRUM_RPC_URL or ETHEREUM_RPC_URL is not set.
contract CrossChainENSForkTest is Test {
    /// @notice Real Hats Protocol canonical address (same on all EVM chains)
    address internal constant HATS_PROTOCOL = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;

    /// @notice Real Chainlink CCIP Router on Arbitrum
    address internal constant ARB_CCIP_ROUTER = 0x141fa059441E0ca23ce184B6A78bafD2A517DdE8;

    /// @notice Ethereum mainnet CCIP chain selector
    uint64 internal constant ETH_CHAIN_SELECTOR = 5_009_297_550_715_157_269;

    /// @notice Arbitrum CCIP chain selector
    uint64 internal constant ARB_CHAIN_SELECTOR = 4_949_039_107_694_359_620;

    /// @notice Real ENS Registry on Ethereum mainnet
    address internal constant ENS_REGISTRY = 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e;

    /// @notice Real ENS Public Resolver on Ethereum mainnet
    address internal constant ENS_PUBLIC_RESOLVER = 0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63;

    /// @notice namehash("greengoods.eth")
    bytes32 internal constant BASE_NODE = 0x0854ba3d72dfe3022a4d5a14f037c0d42e0be5f7eb16a4e0f4ceef06a16ef614;

    // Fork IDs
    uint256 internal arbForkId;
    uint256 internal ethForkId;

    // L2 (Arbitrum) contracts and actors
    GreenGoodsENS public l2Ens;
    address public l2Owner;
    address public l2GardenToken;
    address public l2Member;
    address public l2NonMember;
    uint256 public protocolHatId;

    // L1 (Ethereum) contracts and actors
    GreenGoodsENSReceiver public l1Receiver;
    address public l1CcipRouter;
    address public l1Owner;

    // ═══════════════════════════════════════════════════════════════════════════
    // Fork Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    function _tryDualFork() internal returns (bool) {
        // Resolve Arbitrum RPC
        string memory arbRpc;
        try vm.envString("ARBITRUM_RPC_URL") returns (string memory value) {
            arbRpc = value;
        } catch {
            try vm.envString("ARBITRUM_RPC") returns (string memory fallback_) {
                arbRpc = fallback_;
            } catch {
                return false;
            }
        }
        if (bytes(arbRpc).length == 0) return false;

        // Resolve Ethereum RPC
        string memory ethRpc;
        try vm.envString("ETHEREUM_RPC_URL") returns (string memory value) {
            ethRpc = value;
        } catch {
            try vm.envString("ETHEREUM_RPC") returns (string memory fallback_) {
                ethRpc = fallback_;
            } catch {
                return false;
            }
        }
        if (bytes(ethRpc).length == 0) return false;

        arbForkId = vm.createFork(arbRpc);
        ethForkId = vm.createFork(ethRpc);
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // L2 Setup (Arbitrum)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Deploy GreenGoodsENS on Arbitrum fork with real Hats Protocol
    function _setupL2() internal {
        vm.selectFork(arbForkId);

        l2Owner = address(this);
        l2GardenToken = makeAddr("gardenToken");
        l2Member = makeAddr("member");
        l2NonMember = makeAddr("nonMember");

        // Create a protocol hat using real Hats Protocol
        (bool ok, bytes memory data) =
            HATS_PROTOCOL.call(abi.encodeWithSignature("mintTopHat(address,string,string)", l2Owner, "CrossChain Test", ""));
        require(ok, "mintTopHat failed");
        uint256 topHat = abi.decode(data, (uint256));

        (ok, data) = HATS_PROTOCOL.call(
            abi.encodeWithSignature(
                "createHat(uint256,string,uint32,address,address,bool,string)",
                topHat,
                "Protocol Members",
                uint32(100),
                address(0xdead),
                address(0xdead),
                true,
                ""
            )
        );
        require(ok, "createHat failed");
        protocolHatId = abi.decode(data, (uint256));

        // Mint hat to member
        (ok,) = HATS_PROTOCOL.call(abi.encodeWithSignature("mintHat(uint256,address)", protocolHatId, l2Member));
        require(ok, "mintHat failed");

        // Deploy GreenGoodsENS — l1Receiver address will be set after L1 setup
        // Use a placeholder first, then update after L1 receiver is deployed
        l2Ens =
            new GreenGoodsENS(ARB_CCIP_ROUTER, ETH_CHAIN_SELECTOR, address(0xdead), HATS_PROTOCOL, protocolHatId, l2Owner);

        // Authorize gardenToken as caller
        l2Ens.setAuthorizedCaller(l2GardenToken, true);

        // Mock ccipSend on the real router (test contract not allowlisted)
        vm.mockCall(
            ARB_CCIP_ROUTER, abi.encodeWithSelector(IRouterClient.ccipSend.selector), abi.encode(bytes32("mock-msg"))
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // L1 Setup (Ethereum)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Deploy GreenGoodsENSReceiver on Ethereum fork against real ENS
    function _setupL1() internal {
        vm.selectFork(ethForkId);

        l1CcipRouter = makeAddr("ccipRouter");
        l1Owner = makeAddr("l1Owner");

        l1Receiver = new GreenGoodsENSReceiver(
            l1CcipRouter,
            ARB_CHAIN_SELECTOR,
            address(l2Ens), // L2 sender address (from Arbitrum deployment)
            ENS_REGISTRY,
            ENS_PUBLIC_RESOLVER,
            BASE_NODE,
            l1Owner
        );

        // Grant the receiver permission to manage subnodes under BASE_NODE
        // ENS Registry stores node owners in mapping(bytes32 => Record) at slot 0
        bytes32 nodeSlot = keccak256(abi.encode(BASE_NODE, uint256(0)));
        vm.store(ENS_REGISTRY, nodeSlot, bytes32(uint256(uint160(address(l1Receiver)))));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CCIP Message Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Build a CCIP message as the L1 receiver would receive it
    function _buildL1Message(
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
            messageId: keccak256(abi.encodePacked("cross-chain-msg", slug, _owner)),
            sourceChainSelector: ARB_CHAIN_SELECTOR,
            sender: abi.encode(address(l2Ens)),
            data: abi.encode(action, slug, _owner, nameType),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });
    }

    /// @notice Deliver a CCIP message to the L1 receiver (must be on Ethereum fork)
    function _deliverToL1(Client.Any2EVMMessage memory message) internal {
        vm.prank(l1CcipRouter);
        l1Receiver.ccipReceive(message);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Garden Slug Registration L2 → L1
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Full cross-chain flow: register garden slug on Arbitrum → deliver to Ethereum → verify ENS
    function test_forkCrossChain_gardenSlugRegistration_L2toL1() public {
        if (!_tryDualFork()) {
            emit log("SKIPPED: Both ARBITRUM_RPC_URL and ETHEREUM_RPC_URL required");
            return;
        }

        // Phase 1: L2 — Register garden slug on Arbitrum
        _setupL2();

        string memory slug = "miyawaki-park";
        address gardenAccount = makeAddr("gardenAccount");

        // Get fee from real router, register garden (mock ccipSend)
        uint256 fee = l2Ens.getRegistrationFee(slug, gardenAccount, GreenGoodsENS.NameType.Garden);
        vm.deal(l2GardenToken, fee);
        vm.prank(l2GardenToken);
        l2Ens.registerGarden{ value: fee }(slug, gardenAccount);

        // Verify L2 cache state
        assertFalse(l2Ens.available(slug), "slug should not be available on L2 after registration");
        bytes32 slugHash = keccak256(bytes(slug));
        assertEq(l2Ens.slugOwner(slugHash), gardenAccount, "L2 slug owner should be garden account");

        // Phase 2: L1 — Deploy receiver and deliver CCIP message
        _setupL1();

        Client.Any2EVMMessage memory message =
            _buildL1Message(0, slug, gardenAccount, GreenGoodsENSReceiver.NameType.Garden);
        _deliverToL1(message);

        // Verify L1 internal state
        assertFalse(l1Receiver.available(slug), "slug should not be available on L1");
        assertEq(l1Receiver.resolve(slug), gardenAccount, "L1 should resolve slug to garden account");

        GreenGoodsENSReceiver.Registration memory reg = l1Receiver.getRegistration(slug);
        assertEq(uint8(reg.nameType), uint8(GreenGoodsENSReceiver.NameType.Garden), "name type should be Garden");
        assertEq(reg.owner, gardenAccount, "registration owner should match");

        // Verify real ENS resolver was updated
        bytes32 label = keccak256(bytes(slug));
        bytes32 node = keccak256(abi.encodePacked(BASE_NODE, label));
        address resolvedAddr = IENSResolver(ENS_PUBLIC_RESOLVER).addr(node);
        assertEq(resolvedAddr, gardenAccount, "ENS resolver should resolve subdomain to garden account");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Member Name Claim L2 → L1
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Member claims personal name on Arbitrum → delivered to Ethereum → verified in ENS
    function test_forkCrossChain_memberNameClaim_L2toL1() public {
        if (!_tryDualFork()) {
            emit log("SKIPPED: Both ARBITRUM_RPC_URL and ETHEREUM_RPC_URL required");
            return;
        }

        // Phase 1: L2 — Member claims name on Arbitrum
        _setupL2();

        string memory slug = "alice-gardener";

        uint256 fee = l2Ens.getRegistrationFee(slug, l2Member, GreenGoodsENS.NameType.Gardener);
        vm.deal(l2Member, fee);
        vm.prank(l2Member);
        l2Ens.claimName{ value: fee }(slug);

        // Verify L2 state
        bytes32 slugHash = keccak256(bytes(slug));
        assertEq(l2Ens.slugOwner(slugHash), l2Member, "L2 slug owner should be member");
        assertEq(
            keccak256(bytes(l2Ens.ownerToSlug(l2Member))),
            keccak256(bytes(slug)),
            "L2 ownerToSlug should map member to slug"
        );

        // Phase 2: L1 — Deliver and verify
        _setupL1();

        Client.Any2EVMMessage memory message = _buildL1Message(0, slug, l2Member, GreenGoodsENSReceiver.NameType.Gardener);
        _deliverToL1(message);

        // Verify L1 state
        assertEq(l1Receiver.resolve(slug), l2Member, "L1 should resolve slug to member");
        GreenGoodsENSReceiver.Registration memory reg = l1Receiver.getRegistration(slug);
        assertEq(uint8(reg.nameType), uint8(GreenGoodsENSReceiver.NameType.Gardener), "name type should be Gardener");

        // Verify real ENS resolver
        bytes32 label = keccak256(bytes(slug));
        bytes32 node = keccak256(abi.encodePacked(BASE_NODE, label));
        address resolvedAddr = IENSResolver(ENS_PUBLIC_RESOLVER).addr(node);
        assertEq(resolvedAddr, l2Member, "ENS resolver should resolve member subdomain");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Duplicate Slug L1 Skips
    // ═══════════════════════════════════════════════════════════════════════════

    event NameRegistrationSkipped(string slug, address attemptedOwner, address existingOwner, bytes32 indexed messageId);

    /// @notice Delivering the same slug twice to L1 — second should emit NameRegistrationSkipped
    function test_forkCrossChain_duplicateSlug_L1skips() public {
        if (!_tryDualFork()) {
            emit log("SKIPPED: Both ARBITRUM_RPC_URL and ETHEREUM_RPC_URL required");
            return;
        }

        // Setup both sides
        _setupL2();
        _setupL1();

        string memory slug = "shared-garden";
        address user1 = makeAddr("user1");
        address user2 = makeAddr("user2");

        // First delivery succeeds
        Client.Any2EVMMessage memory msg1 = _buildL1Message(0, slug, user1, GreenGoodsENSReceiver.NameType.Garden);
        _deliverToL1(msg1);
        assertEq(l1Receiver.resolve(slug), user1, "first registration should succeed");

        // Second delivery with same slug — should emit NameRegistrationSkipped
        Client.Any2EVMMessage memory msg2 = Client.Any2EVMMessage({
            messageId: keccak256(abi.encodePacked("cross-chain-msg-dup", slug, user2)),
            sourceChainSelector: ARB_CHAIN_SELECTOR,
            sender: abi.encode(address(l2Ens)),
            data: abi.encode(uint8(0), slug, user2, GreenGoodsENSReceiver.NameType.Garden),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        vm.expectEmit(false, false, true, true);
        emit NameRegistrationSkipped(slug, user2, user1, msg2.messageId);

        _deliverToL1(msg2);

        // Original registration preserved
        assertEq(l1Receiver.resolve(slug), user1, "original registration should be preserved");

        // ENS should still point to user1
        bytes32 label = keccak256(bytes(slug));
        bytes32 node = keccak256(abi.encodePacked(BASE_NODE, label));
        address resolvedAddr = IENSResolver(ENS_PUBLIC_RESOLVER).addr(node);
        assertEq(resolvedAddr, user1, "ENS should still resolve to original owner");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Invalid Sender L1 Reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice L1 receiver should revert when CCIP message comes from wrong sender
    function test_forkCrossChain_invalidSender_L1reverts() public {
        if (!_tryDualFork()) {
            emit log("SKIPPED: Both ARBITRUM_RPC_URL and ETHEREUM_RPC_URL required");
            return;
        }

        // Setup both sides
        _setupL2();
        _setupL1();

        // Build message with wrong sender (not l2Ens)
        Client.Any2EVMMessage memory badSenderMsg = Client.Any2EVMMessage({
            messageId: keccak256("bad-sender"),
            sourceChainSelector: ARB_CHAIN_SELECTOR,
            sender: abi.encode(address(0xBEEF)), // Wrong sender
            data: abi.encode(uint8(0), "hacker-garden", makeAddr("hacker"), GreenGoodsENSReceiver.NameType.Garden),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        vm.prank(l1CcipRouter);
        vm.expectRevert(abi.encodeWithSignature("UnauthorizedSender()"));
        l1Receiver.ccipReceive(badSenderMsg);

        // Also test wrong source chain
        Client.Any2EVMMessage memory badChainMsg = Client.Any2EVMMessage({
            messageId: keccak256("bad-chain"),
            sourceChainSelector: 999, // Wrong chain selector
            sender: abi.encode(address(l2Ens)),
            data: abi.encode(uint8(0), "hacker-garden", makeAddr("hacker"), GreenGoodsENSReceiver.NameType.Garden),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        vm.prank(l1CcipRouter);
        vm.expectRevert(abi.encodeWithSignature("UnauthorizedSourceChain()"));
        l1Receiver.ccipReceive(badChainMsg);
    }
}
