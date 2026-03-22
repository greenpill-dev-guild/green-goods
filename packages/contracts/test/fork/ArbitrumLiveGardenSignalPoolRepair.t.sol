// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IGardensModule } from "../../src/interfaces/IGardensModule.sol";
import {
    IRegistryCommunity,
    CVStrategyInitializeParamsV0_3,
    CVParams,
    PointSystem,
    ProposalType,
    PointSystemConfig,
    ArbitrableConfig,
    Metadata
} from "../../src/interfaces/IGardensV2.sol";

interface ILiveRegistryCommunity is IRegistryCommunity {
    function owner() external view returns (address);
    function proxyOwner() external view returns (address);
    function transferOwnership(address newOwner) external;
    function getBasisStakedAmount() external view returns (uint256);
    function isMember(address member) external view returns (bool);
}

interface IOwnableLike {
    function owner() external view returns (address);
}

/// @title ArbitrumLiveGardenSignalPoolRepairForkTest
/// @notice Reproduces the live Arbitrum pool-creation failure against an existing garden/community pair.
/// @dev Uses a non-root garden to avoid the known root-garden identity split from confounding the diagnosis.
contract ArbitrumLiveGardenSignalPoolRepairForkTest is Test {
    address internal constant GARDENS_MODULE = 0x9d9F913eEeBAC1142E38E5276dE7c8bc9Cf7a183;
    address internal constant POWER_REGISTRY = 0xD36004307c136FFed0Fe425f699FB1569BFabCBa;
    address internal constant LIVE_GARDEN = 0xA2DF8Eb73444A3f3cf9b8E3749313C7471d7D5E3;
    address internal constant LIVE_COMMUNITY = 0xD6C828E18114683208d24be26494B038357A829e;
    address internal constant MODULE_OWNER_SAFE = 0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6;
    address internal constant COMMUNITY_OWNER_SAFE = 0x9a17De1f0caD0c592F656410997E4B685d339029;
    address internal constant RANDOM_NON_MEMBER = 0x000000000000000000000000000000000000dEaD;

    bytes4 internal constant COMMUNITY_FUNCTION_DOES_NOT_EXIST_SELECTOR =
        bytes4(keccak256("CommunityFunctionDoesNotExist(bytes4)"));

    function testForkArbitrum_liveCommunityBlocksModulePoolCreation() public {
        if (!_forkArbitrum()) {
            return;
        }

        assertEq(
            ILiveRegistryCommunity(LIVE_COMMUNITY).owner(),
            COMMUNITY_OWNER_SAFE,
            "live community owner should match production Safe"
        );

        vm.prank(MODULE_OWNER_SAFE);
        address[] memory pools = IGardensModule(GARDENS_MODULE).createGardenPools(LIVE_GARDEN);
        assertEq(pools.length, 0, "live createGardenPools should return an empty array");

        vm.prank(COMMUNITY_OWNER_SAFE);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        ILiveRegistryCommunity(LIVE_COMMUNITY).createPool(
            address(0), _buildPoolParams(PointSystem.Custom), _poolMetadata("live-owner-safe")
        );
    }

    function testForkArbitrum_liveCommunityUsesStringMembershipPath() public {
        if (!_forkArbitrum()) {
            return;
        }

        uint256 stakeAmount = ILiveRegistryCommunity(LIVE_COMMUNITY).getBasisStakedAmount();
        IERC20 goodsToken = IERC20(ILiveRegistryCommunity(LIVE_COMMUNITY).gardenToken());

        vm.prank(LIVE_GARDEN);
        goodsToken.approve(LIVE_COMMUNITY, stakeAmount);

        vm.prank(LIVE_GARDEN);
        (bool legacyOk, bytes memory legacyData) =
            LIVE_COMMUNITY.call(abi.encodeWithSignature("stakeAndRegisterMember(address)", LIVE_GARDEN));
        assertFalse(legacyOk, "legacy address-based membership path should be unavailable");
        assertEq(
            bytes4(legacyData),
            COMMUNITY_FUNCTION_DOES_NOT_EXIST_SELECTOR,
            "legacy call should fail because the function is not deployed on live communities"
        );

        vm.prank(LIVE_GARDEN);
        (bool stringOk,) = LIVE_COMMUNITY.call(abi.encodeWithSignature("stakeAndRegisterMember(string)", ""));
        assertTrue(stringOk, "string-based membership join should succeed for the garden");
        assertTrue(
            ILiveRegistryCommunity(LIVE_COMMUNITY).isMember(LIVE_GARDEN),
            "garden should be a registered member after string-based join"
        );
    }

    function testForkArbitrum_liveCommunityJoinIsNotSufficientForPoolCreation() public {
        if (!_forkArbitrum()) {
            return;
        }

        vm.prank(RANDOM_NON_MEMBER);
        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        ILiveRegistryCommunity(LIVE_COMMUNITY).createPool(
            address(0), _buildPoolParams(PointSystem.Custom), _poolMetadata("live-random-non-member")
        );

        _joinGardenIntoLiveCommunity();

        vm.startPrank(LIVE_GARDEN);

        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        ILiveRegistryCommunity(LIVE_COMMUNITY).createPool(
            address(0), _buildPoolParams(PointSystem.Unlimited), _poolMetadata("live-garden-unlimited")
        );

        vm.expectRevert(bytes("Ownable: caller is not the owner"));
        ILiveRegistryCommunity(LIVE_COMMUNITY).createPool(
            address(0), _buildPoolParams(PointSystem.Custom), _poolMetadata("live-garden-custom")
        );

        vm.stopPrank();
    }

    function testForkArbitrum_liveCommunityProxyOwnerResolvesToIntermediateOwnerContract() public {
        if (!_forkArbitrum()) {
            return;
        }

        address proxyOwner = ILiveRegistryCommunity(LIVE_COMMUNITY).proxyOwner();
        address resolvedOwner = ILiveRegistryCommunity(LIVE_COMMUNITY).owner();

        assertTrue(proxyOwner != address(0), "proxy owner should exist");
        assertTrue(proxyOwner != resolvedOwner, "proxy owner should differ from resolved owner");
        assertEq(IOwnableLike(proxyOwner).owner(), resolvedOwner, "intermediate proxy owner should resolve to Safe");
    }

    function testForkArbitrum_selfOwningCommunityStillDoesNotRepairCreatePool() public {
        if (!_forkArbitrum()) {
            return;
        }

        vm.prank(COMMUNITY_OWNER_SAFE);
        ILiveRegistryCommunity(LIVE_COMMUNITY).transferOwnership(LIVE_COMMUNITY);

        assertEq(ILiveRegistryCommunity(LIVE_COMMUNITY).owner(), LIVE_COMMUNITY, "community should now self-own");

        vm.startPrank(LIVE_COMMUNITY);

        vm.expectRevert();
        ILiveRegistryCommunity(LIVE_COMMUNITY).createPool(
            address(0), _buildPoolParams(PointSystem.Unlimited), _poolMetadata("live-community-unlimited")
        );

        vm.expectRevert();
        ILiveRegistryCommunity(LIVE_COMMUNITY).createPool(
            address(0), _buildPoolParams(PointSystem.Custom), _poolMetadata("live-community-custom")
        );

        vm.stopPrank();
    }

    function _joinGardenIntoLiveCommunity() internal {
        uint256 stakeAmount = ILiveRegistryCommunity(LIVE_COMMUNITY).getBasisStakedAmount();
        IERC20 goodsToken = IERC20(ILiveRegistryCommunity(LIVE_COMMUNITY).gardenToken());

        vm.prank(LIVE_GARDEN);
        goodsToken.approve(LIVE_COMMUNITY, stakeAmount);

        vm.prank(LIVE_GARDEN);
        (bool ok,) = LIVE_COMMUNITY.call(abi.encodeWithSignature("stakeAndRegisterMember(string)", ""));
        assertTrue(ok, "string-based membership join should succeed");
        assertTrue(
            ILiveRegistryCommunity(LIVE_COMMUNITY).isMember(LIVE_GARDEN),
            "garden should be registered as a community member"
        );
    }

    function _buildPoolParams(PointSystem pointSystem) internal pure returns (CVStrategyInitializeParamsV0_3 memory) {
        return CVStrategyInitializeParamsV0_3({
            cvParams: CVParams({ maxRatio: 2_000_000, weight: 10_000, decay: 9_999_799, minThresholdPoints: 2_500_000 }),
            proposalType: ProposalType.Signaling,
            pointSystem: pointSystem,
            pointConfig: PointSystemConfig({ maxAmount: 0 }),
            arbitrableConfig: ArbitrableConfig({
                arbitrator: address(0),
                tribunalSafe: address(0),
                submitterCollateralAmount: 0,
                challengerCollateralAmount: 0,
                defaultRuling: 0,
                defaultRulingTimeout: 0
            }),
            registryCommunity: LIVE_COMMUNITY,
            votingPowerRegistry: pointSystem == PointSystem.Custom ? POWER_REGISTRY : address(0),
            sybilScorer: address(0),
            sybilScorerThreshold: 0,
            initialAllowlist: new address[](0),
            superfluidToken: address(0),
            streamingRatePerSecond: 0
        });
    }

    function _poolMetadata(string memory pointer) internal pure returns (Metadata memory) {
        return Metadata({ protocol: 1, pointer: pointer });
    }

    function _forkArbitrum() internal returns (bool) {
        string memory rpcUrl;

        try vm.envString("ARBITRUM_RPC_URL") returns (string memory value) {
            rpcUrl = value;
        } catch {
            try vm.envString("ARBITRUM_RPC") returns (string memory value) {
                rpcUrl = value;
            } catch {
                return false;
            }
        }

        if (bytes(rpcUrl).length == 0) {
            return false;
        }

        vm.createSelectFork(rpcUrl);
        return true;
    }
}
