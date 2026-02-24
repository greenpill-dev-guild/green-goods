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

/// @title SepoliaENSForkTest
/// @notice Fork tests for GreenGoodsENS against real CCIP Router and Hats Protocol on Sepolia.
contract SepoliaENSForkTest is Test {
    address internal constant HATS_PROTOCOL = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;
    address internal constant CCIP_ROUTER = 0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59;
    uint64 internal constant SEPOLIA_CHAIN_SELECTOR = 16_015_286_601_757_825_753;

    GreenGoodsENS public ens;

    address public owner;
    address public l1Receiver;
    address public gardenToken;
    address public member;
    address public nonMember;

    uint256 public protocolHatId;

    function _tryFork() internal returns (bool) {
        string memory rpc;
        try vm.envString("SEPOLIA_RPC_URL") returns (string memory value) {
            rpc = value;
        } catch {
            try vm.envString("SEPOLIA_RPC") returns (string memory fallback_) {
                rpc = fallback_;
            } catch {
                return false;
            }
        }
        if (bytes(rpc).length == 0) return false;

        vm.createSelectFork(rpc);
        return true;
    }

    function _deployENSOnFork() internal {
        owner = address(this);
        l1Receiver = makeAddr("l1Receiver");
        gardenToken = makeAddr("gardenToken");
        member = makeAddr("member");
        nonMember = makeAddr("nonMember");

        (bool ok, bytes memory data) =
            HATS_PROTOCOL.call(abi.encodeWithSignature("mintTopHat(address,string,string)", owner, "ENS Test", ""));
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

        (ok,) = HATS_PROTOCOL.call(abi.encodeWithSignature("mintHat(uint256,address)", protocolHatId, member));
        require(ok, "mintHat failed");

        ens = new GreenGoodsENS(CCIP_ROUTER, SEPOLIA_CHAIN_SELECTOR, l1Receiver, HATS_PROTOCOL, protocolHatId, owner);
        ens.setAuthorizedCaller(gardenToken, true);
    }

    function _mockCcipSend() internal {
        vm.mockCall(
            CCIP_ROUTER, abi.encodeWithSelector(IRouterClient.ccipSend.selector), abi.encode(bytes32("mock-message-id"))
        );
    }

    function test_forkDeploy_ccipRouterIsDeployed() public {
        if (!_tryFork()) {
            emit log("SKIPPED: SEPOLIA_RPC_URL not set");
            return;
        }
        assertGt(CCIP_ROUTER.code.length, 0, "CCIP Router should be deployed on Sepolia");
    }

    function test_forkDeploy_hatsProtocolIsDeployed() public {
        if (!_tryFork()) {
            emit log("SKIPPED: SEPOLIA_RPC_URL not set");
            return;
        }
        assertGt(HATS_PROTOCOL.code.length, 0, "Hats Protocol should be deployed on Sepolia");
    }

    function test_forkDeploy_ensInitializesWithRealInfra() public {
        if (!_tryFork()) {
            emit log("SKIPPED: SEPOLIA_RPC_URL not set");
            return;
        }

        _deployENSOnFork();

        assertEq(address(ens.CCIP_ROUTER()), CCIP_ROUTER);
        assertEq(ens.ETHEREUM_CHAIN_SELECTOR(), SEPOLIA_CHAIN_SELECTOR);
        assertEq(address(ens.HATS()), HATS_PROTOCOL);
        assertEq(ens.protocolHatId(), protocolHatId);
        assertEq(ens.l1Receiver(), l1Receiver);
        assertEq(ens.owner(), owner);
        assertTrue(ens.authorizedCallers(gardenToken));
    }

    function test_forkDeploy_feeEstimationReturnsNonZero() public {
        if (!_tryFork()) {
            emit log("SKIPPED: SEPOLIA_RPC_URL not set");
            return;
        }

        _deployENSOnFork();

        uint256 fee = ens.getRegistrationFee("test-garden", member, GreenGoodsENS.NameType.Gardener);
        assertGt(fee, 0, "CCIP fee should be non-zero from real router");
    }

    function test_forkSlug_validSlugCachesCorrectly() public {
        if (!_tryFork()) {
            emit log("SKIPPED: SEPOLIA_RPC_URL not set");
            return;
        }

        _deployENSOnFork();
        _mockCcipSend();

        string memory slug = "sepolia-garden";
        address gardenAccount = makeAddr("gardenAccount");
        uint256 fee = ens.getRegistrationFee(slug, gardenAccount, GreenGoodsENS.NameType.Garden);

        vm.prank(gardenToken);
        ens.registerGarden{ value: fee }(slug, gardenAccount);

        bytes32 slugHash = keccak256(bytes(slug));
        assertEq(ens.slugOwner(slugHash), gardenAccount);
        assertEq(keccak256(bytes(ens.ownerToSlug(gardenAccount))), keccak256(bytes(slug)));
        assertFalse(ens.available(slug));
    }

    function test_forkSlug_invalidSlugReverts() public {
        if (!_tryFork()) {
            emit log("SKIPPED: SEPOLIA_RPC_URL not set");
            return;
        }

        _deployENSOnFork();
        _mockCcipSend();

        uint256 fee = 0.1 ether;

        vm.prank(gardenToken);
        vm.expectRevert(InvalidSlug.selector);
        ens.registerGarden{ value: fee }("ab", makeAddr("g1"));

        vm.prank(gardenToken);
        vm.expectRevert(InvalidSlug.selector);
        ens.registerGarden{ value: fee }("MyGarden", makeAddr("g2"));

        vm.prank(gardenToken);
        vm.expectRevert(InvalidSlug.selector);
        ens.registerGarden{ value: fee }("my--garden", makeAddr("g3"));
    }

    function test_forkSlug_duplicateSlugReverts() public {
        if (!_tryFork()) {
            emit log("SKIPPED: SEPOLIA_RPC_URL not set");
            return;
        }

        _deployENSOnFork();
        _mockCcipSend();

        string memory slug = "unique-garden";
        uint256 fee = ens.getRegistrationFee(slug, makeAddr("g1"), GreenGoodsENS.NameType.Garden);

        vm.prank(gardenToken);
        ens.registerGarden{ value: fee }(slug, makeAddr("g1"));

        vm.prank(gardenToken);
        vm.expectRevert(NameTaken.selector);
        ens.registerGarden{ value: fee }(slug, makeAddr("g2"));
    }

    function test_forkSlug_ownerAlreadyHasNameReverts() public {
        if (!_tryFork()) {
            emit log("SKIPPED: SEPOLIA_RPC_URL not set");
            return;
        }

        _deployENSOnFork();
        _mockCcipSend();

        address sameOwner = makeAddr("sameOwner");
        string memory slug1 = "first-name";
        uint256 fee1 = ens.getRegistrationFee(slug1, sameOwner, GreenGoodsENS.NameType.Garden);

        vm.prank(gardenToken);
        ens.registerGarden{ value: fee1 }(slug1, sameOwner);

        string memory slug2 = "second-name";
        uint256 fee2 = ens.getRegistrationFee(slug2, sameOwner, GreenGoodsENS.NameType.Garden);

        vm.prank(gardenToken);
        vm.expectRevert(AlreadyHasName.selector);
        ens.registerGarden{ value: fee2 }(slug2, sameOwner);
    }

    function test_forkAccess_nonAuthorizedCallerReverts() public {
        if (!_tryFork()) {
            emit log("SKIPPED: SEPOLIA_RPC_URL not set");
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

    function test_forkAccess_nonMemberClaimNameReverts() public {
        if (!_tryFork()) {
            emit log("SKIPPED: SEPOLIA_RPC_URL not set");
            return;
        }

        _deployENSOnFork();
        _mockCcipSend();

        vm.deal(nonMember, 1 ether);
        vm.prank(nonMember);
        vm.expectRevert(NotProtocolMember.selector);
        ens.claimName{ value: 0.1 ether }("my-name");
    }

    function test_forkSlug_releaseFeeEstimationWorks() public {
        if (!_tryFork()) {
            emit log("SKIPPED: SEPOLIA_RPC_URL not set");
            return;
        }

        _deployENSOnFork();

        uint256 fee = ens.getReleaseFee("test-slug");
        assertGt(fee, 0, "CCIP release fee should be non-zero from real router");
    }
}
