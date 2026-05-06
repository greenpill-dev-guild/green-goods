// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { UnifiedPowerRegistry } from "../../src/registries/Power.sol";
import { ICVStrategy } from "../../src/interfaces/ICVStrategy.sol";
import { IHats } from "../../src/interfaces/IHats.sol";
import { NFTPowerSource, NFTType } from "../../src/interfaces/IGardensV2.sol";
import { ForkTestEligibilityToggle } from "./helpers/ForkTestBase.sol";

/// @title ArbitrumConvictionVotingForkTest
/// @notice Fork tests for UnifiedPowerRegistry against live Arbitrum Hats and Gardens V2 strategy reads.
contract ArbitrumConvictionVotingForkTest is Test {
    address internal constant HATS_PROTOCOL = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;
    address internal constant REAL_CV_POOL = 0x19a0f3D7734dCa40F1847C44EF717Ef3ef5C50a5;

    UnifiedPowerRegistry public powerRegistry;
    ForkTestEligibilityToggle public eligibility;

    address public owner = address(0xA1);
    address public gardensModule;
    address public garden = address(0xC1);

    address public operator;
    address public gardener;
    address public communityMember;
    address public nonMember;

    uint256 public operatorHatId;
    uint256 public gardenerHatId;
    uint256 public communityHatId;

    function _tryFork() internal returns (bool) {
        string memory rpc;
        try vm.envString("ARBITRUM_FORK_RPC_URL") returns (string memory value) {
            rpc = value;
        } catch {
            try vm.envString("ARBITRUM_FORK_RPC") returns (string memory forkRpc) {
                rpc = forkRpc;
            } catch {
                try vm.envString("ARBITRUM_RPC_URL") returns (string memory primaryRpc) {
                    rpc = primaryRpc;
                } catch {
                    try vm.envString("ARBITRUM_RPC") returns (string memory legacyRpc) {
                        rpc = legacyRpc;
                    } catch {
                        return false;
                    }
                }
            }
        }
        if (bytes(rpc).length == 0) return false;

        uint256 forkBlock;
        try vm.envUint("ARBITRUM_FORK_BLOCK_NUMBER") returns (uint256 value) {
            forkBlock = value;
        } catch {
            try vm.envUint("ARBITRUM_BLOCK_NUMBER") returns (uint256 legacyBlock) {
                forkBlock = legacyBlock;
            } catch { }
        }

        uint256 forkId = forkBlock == 0 ? vm.createFork(rpc) : vm.createFork(rpc, forkBlock);
        vm.selectFork(forkId);
        return true;
    }

    function _deployStack() internal {
        operator = makeAddr("operator");
        gardener = makeAddr("gardener");
        communityMember = makeAddr("communityMember");
        nonMember = makeAddr("nonMember");
        gardensModule = makeAddr("gardensModule");

        UnifiedPowerRegistry impl = new UnifiedPowerRegistry();
        bytes memory initData =
            abi.encodeWithSelector(UnifiedPowerRegistry.initialize.selector, owner, HATS_PROTOCOL, gardensModule);
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        powerRegistry = UnifiedPowerRegistry(address(proxy));

        _setupHatsTree();
        _registerGardenPowerSources();

        vm.prank(gardensModule);
        powerRegistry.registerPool(REAL_CV_POOL, garden);
    }

    function _setupHatsTree() internal {
        IHats hats = IHats(HATS_PROTOCOL);
        eligibility = new ForkTestEligibilityToggle(address(this));
        address module = address(eligibility);

        uint256 topHat = hats.mintTopHat(address(this), "CV Fork Test Tree", "");

        communityHatId = hats.createHat(topHat, "Community", 100, module, module, true, "");
        operatorHatId = hats.createHat(communityHatId, "Operator", 100, module, module, true, "");
        gardenerHatId = hats.createHat(communityHatId, "Gardener", 100, module, module, true, "");

        eligibility.setHatActive(communityHatId, true);
        eligibility.setHatActive(operatorHatId, true);
        eligibility.setHatActive(gardenerHatId, true);
        eligibility.setWearerStatus(communityHatId, communityMember, true, true);
        eligibility.setWearerStatus(operatorHatId, operator, true, true);
        eligibility.setWearerStatus(gardenerHatId, gardener, true, true);

        hats.mintHat(communityHatId, communityMember);
        hats.mintHat(operatorHatId, operator);
        hats.mintHat(gardenerHatId, gardener);
    }

    function _registerGardenPowerSources() internal {
        NFTPowerSource[] memory sources = new NFTPowerSource[](3);
        sources[0] =
            NFTPowerSource({ token: HATS_PROTOCOL, nftType: NFTType.HAT, weight: 30_000, tokenId: 0, hatId: operatorHatId });
        sources[1] =
            NFTPowerSource({ token: HATS_PROTOCOL, nftType: NFTType.HAT, weight: 20_000, tokenId: 0, hatId: gardenerHatId });
        sources[2] = NFTPowerSource({
            token: HATS_PROTOCOL,
            nftType: NFTType.HAT,
            weight: 10_000,
            tokenId: 0,
            hatId: communityHatId
        });

        vm.prank(gardensModule);
        powerRegistry.registerGarden(garden, sources);
    }

    function test_forkCV_hatsProtocolAndLivePoolAreDeployed() public {
        if (!_tryFork()) return;

        assertGt(HATS_PROTOCOL.code.length, 0, "Hats Protocol should be deployed on Arbitrum");
        assertGt(REAL_CV_POOL.code.length, 0, "live Gardens V2 pool should be deployed on Arbitrum");
        assertGt(ICVStrategy(REAL_CV_POOL).proposalCounter(), 0, "live pool should expose proposals");
    }

    function test_forkCV_registryResolvesHatWeightedPowerForLivePool() public {
        if (!_tryFork()) return;
        _deployStack();

        assertEq(powerRegistry.getPoolGarden(REAL_CV_POOL), garden, "live pool should map to garden");
        assertEq(powerRegistry.getMemberPowerInStrategy(operator, REAL_CV_POOL), 3, "operator should have 3x power");
        assertEq(powerRegistry.getMemberPowerInStrategy(gardener, REAL_CV_POOL), 2, "gardener should have 2x power");
        assertEq(
            powerRegistry.getMemberPowerInStrategy(communityMember, REAL_CV_POOL),
            1,
            "community member should have 1x power"
        );
        assertEq(powerRegistry.getMemberPowerInStrategy(nonMember, REAL_CV_POOL), 0, "non-member should have no power");
    }

    function test_forkCV_isMemberUsesCallingLivePool() public {
        if (!_tryFork()) return;
        _deployStack();

        vm.prank(REAL_CV_POOL);
        assertTrue(powerRegistry.isMember(operator), "operator should be a member for live pool mapping");

        vm.prank(REAL_CV_POOL);
        assertFalse(powerRegistry.isMember(nonMember), "non-member should not be a member for live pool mapping");
    }

    function test_forkCV_livePoolConvictionReadPath() public {
        if (!_tryFork()) return;

        uint256 proposalCount = ICVStrategy(REAL_CV_POOL).proposalCounter();
        assertGt(proposalCount, 0, "live pool should have proposals");

        uint256 inspected;
        uint256 activeWithConviction;
        uint256 max = proposalCount > 20 ? 20 : proposalCount;
        for (uint256 i = 1; i <= max; i++) {
            (,,,,, uint8 status,,,,,,) = ICVStrategy(REAL_CV_POOL).getProposal(i);
            if (status != 1) continue;

            inspected++;
            if (ICVStrategy(REAL_CV_POOL).calculateProposalConviction(i) > 0) {
                activeWithConviction++;
            }
        }

        assertGt(inspected, 0, "live pool should expose active proposals");
        assertGt(activeWithConviction, 0, "live pool should expose active conviction");
    }
}
