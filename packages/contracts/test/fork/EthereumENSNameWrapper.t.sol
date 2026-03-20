// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { GreenGoodsENSReceiver } from "../../src/registries/ENSReceiver.sol";
import { Client } from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import { IENSResolver, INameWrapper } from "../../src/interfaces/IENS.sol";

/// @title EthereumENSNameWrapperForkTest
/// @notice Fork tests for GreenGoodsENSReceiver using the real ENS NameWrapper on mainnet.
/// @dev Validates that the NameWrapper path works end-to-end:
///      1. Receiver deployed with NAME_WRAPPER set to real NameWrapper
///      2. Wrapped owner approves receiver via nameWrapper.setApprovalForAll()
///      3. CCIP message triggers setSubnodeRecord on NameWrapper
///      4. Resolver addr() correctly resolves the subdomain
///      Gracefully skips when ETHEREUM_RPC_URL is not set.
contract EthereumENSNameWrapperForkTest is Test {
    /// @notice Real ENS contracts on Ethereum mainnet
    address internal constant ENS_REGISTRY = 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e;
    address internal constant ENS_PUBLIC_RESOLVER = 0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63;
    address internal constant NAME_WRAPPER = 0xD4416b13d2b3a9aBae7AcD5D6C2BbDBE25686401;

    uint64 internal constant ARB_CHAIN_SELECTOR = 4_949_039_107_694_359_620;
    bytes32 internal constant BASE_NODE = 0x15ee556e39afd119101712c5ac4f1519d9f2f32780d4e1cf42b27fdfa73db841;

    GreenGoodsENSReceiver public receiver;

    address public ccipRouter;
    address public l2Sender;
    address public owner;
    address public user1;
    address public user2;

    /// @notice The real wrapped owner of greengoods.eth on mainnet
    /// @dev Read from nameWrapper.ownerOf(uint256(BASE_NODE)) — verified at 0xFBAf...
    address public wrappedOwner;

    // ═══════════════════════════════════════════════════════
    // Fork Helper
    // ═══════════════════════════════════════════════════════

    function _tryFork() internal returns (bool) {
        string memory rpc;
        try vm.envString("ETHEREUM_RPC_URL") returns (string memory value) {
            rpc = value;
        } catch {
            try vm.envString("MAINNET_RPC_URL") returns (string memory fallback_) {
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

    // ═══════════════════════════════════════════════════════
    // Deployment Helper
    // ═══════════════════════════════════════════════════════

    function _deployReceiverWithNameWrapper() internal {
        ccipRouter = makeAddr("ccipRouter");
        l2Sender = makeAddr("l2Sender");
        owner = makeAddr("owner");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");

        // Read the real wrapped owner of greengoods.eth
        wrappedOwner = INameWrapper(NAME_WRAPPER).ownerOf(uint256(BASE_NODE));
        require(wrappedOwner != address(0), "greengoods.eth not found in NameWrapper");

        // Deploy receiver with NameWrapper support (the fix)
        receiver = new GreenGoodsENSReceiver(
            ccipRouter,
            ARB_CHAIN_SELECTOR,
            l2Sender,
            ENS_REGISTRY,
            ENS_PUBLIC_RESOLVER,
            BASE_NODE,
            owner,
            NAME_WRAPPER // The key difference: wrapped path enabled
        );

        // Wrapped owner approves receiver as NameWrapper operator
        vm.prank(wrappedOwner);
        INameWrapper(NAME_WRAPPER).setApprovalForAll(address(receiver), true);
    }

    // ═══════════════════════════════════════════════════════
    // CCIP Helpers
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
            messageId: keccak256(abi.encodePacked("nw-fork-msg", slug, _owner)),
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
    // Test 1: NameWrapper path registers garden subdomain
    // ═══════════════════════════════════════════════════════

    /// @notice Register a garden subdomain via the NameWrapper path on a mainnet fork.
    ///         Validates: internal state, NameWrapper ownership, and real ENS resolution.
    function test_forkEthereum_nameWrapper_registersGardenSubdomain() public {
        if (!_tryFork()) return;

        assertGt(NAME_WRAPPER.code.length, 0, "NameWrapper should be deployed");
        _deployReceiverWithNameWrapper();

        string memory slug = "wrapped-garden";
        Client.Any2EVMMessage memory message = _buildCCIPMessage(0, slug, user1, GreenGoodsENSReceiver.NameType.Garden);

        _deliverCCIPMessage(message);

        // Verify internal state
        assertEq(receiver.resolve(slug), user1, "slug should resolve to user1");
        assertFalse(receiver.available(slug), "slug should not be available");

        GreenGoodsENSReceiver.Registration memory reg = receiver.getRegistration(slug);
        assertEq(uint8(reg.nameType), uint8(GreenGoodsENSReceiver.NameType.Garden));
        assertEq(reg.owner, user1);

        // Verify NameWrapper: receiver should be the wrapped owner of the subnode
        bytes32 label = keccak256(bytes(slug));
        bytes32 node = keccak256(abi.encodePacked(BASE_NODE, label));
        address subnodeOwner = INameWrapper(NAME_WRAPPER).ownerOf(uint256(node));
        assertEq(subnodeOwner, address(receiver), "Receiver should own the wrapped subnode");

        // Verify real ENS resolver resolves to user1
        address resolvedAddr = IENSResolver(ENS_PUBLIC_RESOLVER).addr(node);
        assertEq(resolvedAddr, user1, "ENS resolver should resolve subdomain to user1");
    }

    // ═══════════════════════════════════════════════════════
    // Test 2: NameWrapper path registers gardener subdomain
    // ═══════════════════════════════════════════════════════

    /// @notice Register a personal (Gardener) name via NameWrapper and verify resolution
    function test_forkEthereum_nameWrapper_registersGardenerSubdomain() public {
        if (!_tryFork()) return;
        _deployReceiverWithNameWrapper();

        string memory slug = "alice-green";
        Client.Any2EVMMessage memory message = _buildCCIPMessage(0, slug, user2, GreenGoodsENSReceiver.NameType.Gardener);

        _deliverCCIPMessage(message);

        // Verify internal state
        assertEq(receiver.resolve(slug), user2);
        assertEq(keccak256(bytes(receiver.ownerToSlug(user2))), keccak256(bytes(slug)));

        // Verify ENS resolution
        bytes32 label = keccak256(bytes(slug));
        bytes32 node = keccak256(abi.encodePacked(BASE_NODE, label));
        assertEq(IENSResolver(ENS_PUBLIC_RESOLVER).addr(node), user2, "Should resolve to user2");
    }

    // ═══════════════════════════════════════════════════════
    // Test 3: Release clears ENS records via NameWrapper
    // ═══════════════════════════════════════════════════════

    /// @notice Register then release a name — verify ENS records are cleared
    function test_forkEthereum_nameWrapper_releasesClearENS() public {
        if (!_tryFork()) return;
        _deployReceiverWithNameWrapper();

        string memory slug = "temp-garden";

        // Register
        _deliverCCIPMessage(_buildCCIPMessage(0, slug, user1, GreenGoodsENSReceiver.NameType.Gardener));
        assertEq(receiver.resolve(slug), user1);

        bytes32 label = keccak256(bytes(slug));
        bytes32 node = keccak256(abi.encodePacked(BASE_NODE, label));
        assertEq(IENSResolver(ENS_PUBLIC_RESOLVER).addr(node), user1, "Should resolve before release");

        // Release
        _deliverCCIPMessage(_buildCCIPMessage(1, slug, user1, GreenGoodsENSReceiver.NameType.Gardener));

        // Internal state cleared
        assertEq(receiver.resolve(slug), address(0), "Should be cleared after release");
        assertTrue(receiver.available(slug), "Should be available after release");

        // ENS addr record cleared
        assertEq(IENSResolver(ENS_PUBLIC_RESOLVER).addr(node), address(0), "ENS addr should be zero after release");
    }

    // ═══════════════════════════════════════════════════════
    // Test 4: Admin register works via NameWrapper
    // ═══════════════════════════════════════════════════════

    /// @notice adminRegister (used for migration) should work through the NameWrapper path
    function test_forkEthereum_nameWrapper_adminRegister() public {
        if (!_tryFork()) return;
        _deployReceiverWithNameWrapper();

        string memory slug = "community";

        vm.prank(owner);
        receiver.adminRegister(slug, user1, GreenGoodsENSReceiver.NameType.Garden);

        // Verify internal state
        assertEq(receiver.resolve(slug), user1);

        // Verify ENS resolution
        bytes32 label = keccak256(bytes(slug));
        bytes32 node = keccak256(abi.encodePacked(BASE_NODE, label));
        assertEq(IENSResolver(ENS_PUBLIC_RESOLVER).addr(node), user1, "adminRegister should set ENS addr");
    }

    // ═══════════════════════════════════════════════════════
    // Test 5: Without NameWrapper approval, ENS fails gracefully
    // ═══════════════════════════════════════════════════════

    /// @notice Without NameWrapper approval, ENS registration fails but internal state is set
    function test_forkEthereum_nameWrapper_noApproval_failsGracefully() public {
        if (!_tryFork()) return;

        ccipRouter = makeAddr("ccipRouter");
        l2Sender = makeAddr("l2Sender");
        owner = makeAddr("owner");
        user1 = makeAddr("user1");

        // Deploy WITHOUT approval (skip setApprovalForAll)
        GreenGoodsENSReceiver unapprovedReceiver = new GreenGoodsENSReceiver(
            ccipRouter, ARB_CHAIN_SELECTOR, l2Sender, ENS_REGISTRY, ENS_PUBLIC_RESOLVER, BASE_NODE, owner, NAME_WRAPPER
        );

        string memory slug = "no-approval";
        Client.Any2EVMMessage memory message = Client.Any2EVMMessage({
            messageId: keccak256("no-approval-msg"),
            sourceChainSelector: ARB_CHAIN_SELECTOR,
            sender: abi.encode(l2Sender),
            data: abi.encode(uint8(0), slug, user1, GreenGoodsENSReceiver.NameType.Garden),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        // Should NOT revert — ENS failure caught by try/catch
        vm.prank(ccipRouter);
        unapprovedReceiver.ccipReceive(message);

        // Internal state IS set (graceful degradation)
        assertEq(unapprovedReceiver.resolve(slug), user1, "Internal state should be set despite ENS failure");

        // ENS resolution should NOT be set (NameWrapper rejected the call)
        bytes32 label = keccak256(bytes(slug));
        bytes32 node = keccak256(abi.encodePacked(BASE_NODE, label));
        assertEq(IENSResolver(ENS_PUBLIC_RESOLVER).addr(node), address(0), "ENS should not be set without approval");
    }
}
