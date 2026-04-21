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
import { LocalCCIPRouter } from "../../src/registries/LocalCCIPRouter.sol";
import { ForkTestEligibilityToggle } from "./helpers/ForkTestBase.sol";

/// @title SepoliaENSForkTest
/// @notice Fork tests for GreenGoodsENS against real Hats Protocol on Sepolia and the same-chain relay used by deployment.
contract SepoliaENSForkTest is Test {
    address internal constant HATS_PROTOCOL = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;
    address internal constant ENS_REGISTRY = 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e;
    address internal constant ENS_RESOLVER = 0x8FADE66B79cC9f707aB26799354482EB93a5B7dD;
    uint64 internal constant SEPOLIA_CHAIN_SELECTOR = 16_015_286_601_757_825_753;
    bytes32 internal constant BASE_NODE = 0x15ee556e39afd119101712c5ac4f1519d9f2f32780d4e1cf42b27fdfa73db841;

    GreenGoodsENS public ens;
    GreenGoodsENSReceiver public receiver;
    LocalCCIPRouter public localRouter;
    ForkTestEligibilityToggle public eligibilityToggle;
    address public ccipRouter;

    address public owner;
    address public l1Receiver;
    address public gardenToken;
    address public member;
    address public nonMember;

    uint256 public protocolHatId;

    function _tryFork() internal returns (bool) {
        string memory rpc;
        try vm.envString("SEPOLIA_FORK_RPC_URL") returns (string memory value) {
            rpc = value;
        } catch {
            try vm.envString("SEPOLIA_FORK_RPC") returns (string memory forkRpc) {
                rpc = forkRpc;
            } catch {
                try vm.envString("SEPOLIA_RPC_URL") returns (string memory rpcUrl) {
                    rpc = rpcUrl;
                } catch {
                    try vm.envString("SEPOLIA_RPC") returns (string memory legacyRpc) {
                        rpc = legacyRpc;
                    } catch {
                        return false;
                    }
                }
            }
        }
        if (bytes(rpc).length == 0) return false;

        uint256 forkBlock;
        try vm.envUint("SEPOLIA_FORK_BLOCK_NUMBER") returns (uint256 value) {
            forkBlock = value;
        } catch {
            try vm.envUint("SEPOLIA_BLOCK_NUMBER") returns (uint256 legacyBlock) {
                forkBlock = legacyBlock;
            } catch { }
        }

        if (forkBlock == 0) {
            vm.createSelectFork(rpc);
        } else {
            vm.createSelectFork(rpc, forkBlock);
        }
        return true;
    }

    function _deployENSOnFork() internal {
        owner = address(this);
        gardenToken = makeAddr("gardenToken");
        member = makeAddr("member");
        nonMember = makeAddr("nonMember");
        localRouter = new LocalCCIPRouter(SEPOLIA_CHAIN_SELECTOR);
        ccipRouter = address(localRouter);
        eligibilityToggle = new ForkTestEligibilityToggle(owner);

        (bool ok, bytes memory data) =
            HATS_PROTOCOL.call(abi.encodeWithSignature("mintTopHat(address,string,string)", owner, "ENS Test", ""));
        require(ok, "mintTopHat failed");
        uint256 topHat = abi.decode(data, (uint256));

        address module = address(eligibilityToggle);
        (ok, data) = HATS_PROTOCOL.call(
            abi.encodeWithSignature(
                "createHat(uint256,string,uint32,address,address,bool,string)",
                topHat,
                "Protocol Members",
                uint32(100),
                module,
                module,
                true,
                ""
            )
        );
        require(ok, "createHat failed");
        protocolHatId = abi.decode(data, (uint256));
        eligibilityToggle.setHatActive(protocolHatId, true);
        eligibilityToggle.setWearerStatus(protocolHatId, member, true, true);

        (ok,) = HATS_PROTOCOL.call(abi.encodeWithSignature("mintHat(uint256,address)", protocolHatId, member));
        require(ok, "mintHat failed");

        receiver = new GreenGoodsENSReceiver(
            ccipRouter, SEPOLIA_CHAIN_SELECTOR, address(0), ENS_REGISTRY, ENS_RESOLVER, BASE_NODE, owner, address(0)
        );
        l1Receiver = address(receiver);

        ens = new GreenGoodsENS(ccipRouter, SEPOLIA_CHAIN_SELECTOR, l1Receiver, HATS_PROTOCOL, protocolHatId, owner);
        receiver.setL2Sender(address(ens));
        ens.setAuthorizedCaller(gardenToken, true);
    }

    function test_forkDeploy_ccipRouterIsDeployed() public {
        if (!_tryFork()) {
            return;
        }

        _deployENSOnFork();
        assertGt(ccipRouter.code.length, 0, "Local CCIP router should be deployed for Sepolia");
    }

    function test_forkDeploy_hatsProtocolIsDeployed() public {
        if (!_tryFork()) {
            return;
        }
        assertGt(HATS_PROTOCOL.code.length, 0, "Hats Protocol should be deployed on Sepolia");
    }

    function test_forkDeploy_ensInitializesWithRealInfra() public {
        if (!_tryFork()) {
            return;
        }

        _deployENSOnFork();

        assertEq(address(ens.CCIP_ROUTER()), ccipRouter);
        assertEq(ens.ETHEREUM_CHAIN_SELECTOR(), SEPOLIA_CHAIN_SELECTOR);
        assertEq(address(ens.HATS()), HATS_PROTOCOL);
        assertEq(ens.protocolHatId(), protocolHatId);
        assertEq(ens.l1Receiver(), l1Receiver);
        assertEq(ens.owner(), owner);
        assertTrue(ens.authorizedCallers(gardenToken));
    }

    function test_forkDeploy_feeEstimationUsesZeroCostLocalRelay() public {
        if (!_tryFork()) {
            return;
        }

        _deployENSOnFork();

        uint256 fee = ens.getRegistrationFee("test-garden", member, GreenGoodsENS.NameType.Gardener);
        assertEq(fee, 0, "Sepolia local relay should return zero registration fee");
    }

    function test_forkSlug_validSlugCachesCorrectly() public {
        if (!_tryFork()) {
            return;
        }

        _deployENSOnFork();

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
            return;
        }

        _deployENSOnFork();

        uint256 fee = 0;

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
            return;
        }

        _deployENSOnFork();

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
            return;
        }

        _deployENSOnFork();

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
            return;
        }

        _deployENSOnFork();

        address unauthorized = makeAddr("unauthorized");
        vm.deal(unauthorized, 1 ether);

        vm.prank(unauthorized);
        vm.expectRevert(NotAuthorizedCaller.selector);
        ens.registerGarden{ value: 0.1 ether }("my-garden", makeAddr("garden"));
    }

    function test_forkAccess_nonMemberClaimNameReverts() public {
        if (!_tryFork()) {
            return;
        }

        _deployENSOnFork();

        vm.deal(nonMember, 1 ether);
        vm.prank(nonMember);
        vm.expectRevert(NotProtocolMember.selector);
        ens.claimName{ value: 0.1 ether }("my-name");
    }

    function test_forkSlug_releaseFeeEstimationWorks() public {
        if (!_tryFork()) {
            return;
        }

        _deployENSOnFork();

        uint256 fee = ens.getReleaseFee("test-slug");
        assertEq(fee, 0, "Sepolia local relay should return zero release fee");
    }
}
