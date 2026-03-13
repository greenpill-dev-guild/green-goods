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
import { IRouterClient } from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";

/// @title ArbitrumENSForkTest
/// @notice Fork tests for GreenGoodsENS against real CCIP Router and Hats Protocol on Arbitrum.
/// @dev Standalone test (like ArbitrumYieldSplitter.t.sol). Deploys GreenGoodsENS wired to the
/// real CCIP Router and Hats Protocol. Uses vm.mockCall for ccipSend (test contract not
/// allowlisted on real router), but getFee hits the real router for actual fee estimation.
contract ArbitrumENSForkTest is Test {
    /// @notice Real Hats Protocol canonical address (same on all EVM chains)
    address internal constant HATS_PROTOCOL = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;

    /// @notice Real Chainlink CCIP Router on Arbitrum
    address internal constant CCIP_ROUTER = 0x141fa059441E0ca23ce184B6A78bafD2A517DdE8;

    /// @notice Ethereum mainnet CCIP chain selector
    uint64 internal constant ETH_CHAIN_SELECTOR = 5_009_297_550_715_157_269;

    GreenGoodsENS public ens;

    address public owner;
    address public l1Receiver;
    address public gardenToken; // authorized caller
    address public member; // hat wearer
    address public nonMember; // no hat

    uint256 public protocolHatId;

    // ═══════════════════════════════════════════════════════════════════════════
    // Fork Helper
    // ═══════════════════════════════════════════════════════════════════════════

    function _tryFork() internal returns (bool) {
        string memory rpc;
        try vm.envString("ARBITRUM_RPC_URL") returns (string memory value) {
            rpc = value;
        } catch {
            try vm.envString("ARBITRUM_RPC") returns (string memory fallback_) {
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

    /// @notice Deploy GreenGoodsENS with real CCIP Router and a mock hat setup
    function _deployENSOnFork() internal {
        owner = address(this);
        l1Receiver = makeAddr("l1Receiver");
        gardenToken = makeAddr("gardenToken");
        member = makeAddr("member");
        nonMember = makeAddr("nonMember");

        // Create a protocol hat using real Hats Protocol
        // mintTopHat gives us admin over the tree
        (bool ok, bytes memory data) =
            HATS_PROTOCOL.call(abi.encodeWithSignature("mintTopHat(address,string,string)", owner, "ENS Test", ""));
        require(ok, "mintTopHat failed");
        uint256 topHat = abi.decode(data, (uint256));

        // Create a child hat under top hat for protocol members
        (ok, data) = HATS_PROTOCOL.call(
            abi.encodeWithSignature(
                "createHat(uint256,string,uint32,address,address,bool,string)",
                topHat,
                "Protocol Members",
                uint32(100),
                address(0xdead), // permissive eligibility
                address(0xdead), // permissive toggle
                true,
                ""
            )
        );
        require(ok, "createHat failed");
        protocolHatId = abi.decode(data, (uint256));

        // Mint hat to member
        (ok,) = HATS_PROTOCOL.call(abi.encodeWithSignature("mintHat(uint256,address)", protocolHatId, member));
        require(ok, "mintHat failed");

        // Deploy GreenGoodsENS
        ens = new GreenGoodsENS(CCIP_ROUTER, ETH_CHAIN_SELECTOR, l1Receiver, HATS_PROTOCOL, protocolHatId, owner);

        // Authorize gardenToken as caller
        ens.setAuthorizedCaller(gardenToken, true);
    }

    /// @notice Mock ccipSend on the real router (test contract not allowlisted)
    /// @dev getFee is NOT mocked — it hits the real router for actual fee estimation
    function _mockCcipSend() internal {
        vm.mockCall(
            CCIP_ROUTER, abi.encodeWithSelector(IRouterClient.ccipSend.selector), abi.encode(bytes32("mock-message-id"))
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: CCIP Router Is Deployed
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_ccipRouterIsDeployed() public {
        if (!_tryFork()) {
            return;
        }

        assertGt(CCIP_ROUTER.code.length, 0, "CCIP Router should be deployed on Arbitrum");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Hats Protocol Is Deployed
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_hatsProtocolIsDeployed() public {
        if (!_tryFork()) {
            return;
        }

        assertGt(HATS_PROTOCOL.code.length, 0, "Hats Protocol should be deployed on Arbitrum");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: ENS Initializes With Real Infra
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_ensInitializesWithRealInfra() public {
        if (!_tryFork()) {
            return;
        }

        _deployENSOnFork();

        assertEq(address(ens.CCIP_ROUTER()), CCIP_ROUTER, "CCIP_ROUTER should be real router");
        assertEq(ens.ETHEREUM_CHAIN_SELECTOR(), ETH_CHAIN_SELECTOR, "chain selector should match Ethereum");
        assertEq(address(ens.HATS()), HATS_PROTOCOL, "HATS should be real Hats Protocol");
        assertEq(ens.protocolHatId(), protocolHatId, "protocolHatId should be set");
        assertEq(ens.l1Receiver(), l1Receiver, "l1Receiver should be set");
        assertEq(ens.owner(), owner, "owner should be set");
        assertTrue(ens.authorizedCallers(gardenToken), "gardenToken should be authorized");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Fee Estimation Returns Non-Zero
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice getRegistrationFee against real router should return non-zero
    function test_forkDeploy_feeEstimationReturnsNonZero() public {
        if (!_tryFork()) {
            return;
        }

        _deployENSOnFork();

        uint256 fee = ens.getRegistrationFee("test-garden", member, GreenGoodsENS.NameType.Gardener);
        assertGt(fee, 0, "CCIP fee should be non-zero from real router");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 5: Valid Slug Caches Correctly
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Register garden slug (mock ccipSend), verify L2 cache state
    function test_forkSlug_validSlugCachesCorrectly() public {
        if (!_tryFork()) {
            return;
        }

        _deployENSOnFork();
        _mockCcipSend();

        string memory slug = "miyawaki-park";
        address gardenAccount = makeAddr("gardenAccount");

        // Get fee estimate from real router, then register with sufficient value
        uint256 fee = ens.getRegistrationFee(slug, gardenAccount, GreenGoodsENS.NameType.Garden);

        vm.prank(gardenToken);
        ens.registerGarden{ value: fee }(slug, gardenAccount);

        // Verify L2 cache state
        bytes32 slugHash = keccak256(bytes(slug));
        assertEq(ens.slugOwner(slugHash), gardenAccount, "slug owner should be garden account");
        assertEq(keccak256(bytes(ens.ownerToSlug(gardenAccount))), keccak256(bytes(slug)), "ownerToSlug should map back");
        assertFalse(ens.available(slug), "slug should no longer be available");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 6: Invalid Slug Reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Short, uppercase, and consecutive-hyphen slugs should revert
    function test_forkSlug_invalidSlugReverts() public {
        if (!_tryFork()) {
            return;
        }

        _deployENSOnFork();
        _mockCcipSend();

        uint256 fee = 0.1 ether;
        vm.deal(gardenToken, 1 ether);

        // Too short (< 3 chars)
        vm.prank(gardenToken);
        vm.expectRevert(InvalidSlug.selector);
        ens.registerGarden{ value: fee }("ab", makeAddr("g1"));

        // Uppercase letters
        vm.prank(gardenToken);
        vm.expectRevert(InvalidSlug.selector);
        ens.registerGarden{ value: fee }("MyGarden", makeAddr("g2"));

        // Consecutive hyphens
        vm.prank(gardenToken);
        vm.expectRevert(InvalidSlug.selector);
        ens.registerGarden{ value: fee }("my--garden", makeAddr("g3"));

        // Leading hyphen
        vm.prank(gardenToken);
        vm.expectRevert(InvalidSlug.selector);
        ens.registerGarden{ value: fee }("-garden", makeAddr("g4"));

        // Trailing hyphen
        vm.prank(gardenToken);
        vm.expectRevert(InvalidSlug.selector);
        ens.registerGarden{ value: fee }("garden-", makeAddr("g5"));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 7: Duplicate Slug Reverts
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkSlug_duplicateSlugReverts() public {
        if (!_tryFork()) {
            return;
        }

        _deployENSOnFork();
        _mockCcipSend();

        string memory slug = "unique-garden";
        uint256 fee = ens.getRegistrationFee(slug, makeAddr("g1"), GreenGoodsENS.NameType.Garden);

        // First registration succeeds
        vm.prank(gardenToken);
        ens.registerGarden{ value: fee }(slug, makeAddr("g1"));

        // Second registration with same slug should revert
        vm.prank(gardenToken);
        vm.expectRevert(NameTaken.selector);
        ens.registerGarden{ value: fee }(slug, makeAddr("g2"));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 8: Owner Already Has Name Reverts
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkSlug_ownerAlreadyHasNameReverts() public {
        if (!_tryFork()) {
            return;
        }

        _deployENSOnFork();
        _mockCcipSend();

        address sameOwner = makeAddr("sameOwner");

        string memory slug1 = "first-name";
        uint256 fee1 = ens.getRegistrationFee(slug1, sameOwner, GreenGoodsENS.NameType.Garden);

        vm.prank(gardenToken);
        ens.registerGarden{ value: fee1 }(slug1, sameOwner);

        // Second name for same owner should revert
        string memory slug2 = "second-name";
        uint256 fee2 = ens.getRegistrationFee(slug2, sameOwner, GreenGoodsENS.NameType.Garden);

        vm.prank(gardenToken);
        vm.expectRevert(AlreadyHasName.selector);
        ens.registerGarden{ value: fee2 }(slug2, sameOwner);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 9: Non-Authorized Caller Reverts
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkAccess_nonAuthorizedCallerReverts() public {
        if (!_tryFork()) {
            return;
        }

        _deployENSOnFork();
        _mockCcipSend();

        address unauthorized = makeAddr("unauthorized");
        vm.deal(unauthorized, 1 ether);

        vm.prank(unauthorized);
        vm.expectRevert(NotAuthorizedCaller.selector);
        ens.registerGarden{ value: 0.1 ether }("my-garden", makeAddr("garden"));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 10: Non-Member Claim Name Reverts
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Non-hat-wearer calling claimName should revert
    function test_forkAccess_nonMemberClaimNameReverts() public {
        if (!_tryFork()) {
            return;
        }

        _deployENSOnFork();
        _mockCcipSend();

        vm.deal(nonMember, 1 ether);

        vm.prank(nonMember);
        vm.expectRevert(NotProtocolMember.selector);
        ens.claimName{ value: 0.1 ether }("my-name");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 11: Release Fee Estimation Works
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice getReleaseFee against real router should return non-zero
    function test_forkSlug_releaseFeeEstimationWorks() public {
        if (!_tryFork()) {
            return;
        }

        _deployENSOnFork();

        uint256 fee = ens.getReleaseFee("test-slug");
        assertGt(fee, 0, "CCIP release fee should be non-zero from real router");
    }
}
