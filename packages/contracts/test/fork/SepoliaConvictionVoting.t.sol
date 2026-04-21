// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { UnifiedPowerRegistry } from "../../src/registries/Power.sol";
import { IHats } from "../../src/interfaces/IHats.sol";
import { NFTPowerSource, NFTType } from "../../src/interfaces/IGardensV2.sol";
import { ForkTestBase, ForkTestEligibilityToggle } from "./helpers/ForkTestBase.sol";

/// @title SepoliaPowerRegistryForkTest
/// @notice Fork tests for UnifiedPowerRegistry against live Sepolia Hats Protocol state.
/// @dev This suite intentionally verifies the fork-backed power registry boundary only.
///      Conviction math is covered by Arbitrum live-pool tests where real Gardens V2 pools exist.
contract SepoliaPowerRegistryForkTest is ForkTestBase {
    UnifiedPowerRegistry public powerRegistry;
    ForkTestEligibilityToggle public eligibilityToggle;

    address public gardensModuleCaller;
    address public garden;
    address public signalPool;
    address public communityMember;

    uint256 public operatorHatId;
    uint256 public gardenerHatId;
    uint256 public communityHatId;

    function _deployRegistryAndHats() internal {
        forkOwner = address(this);
        forkOperator = makeAddr("operator");
        forkGardener = makeAddr("gardener");
        forkNonMember = makeAddr("nonMember");
        communityMember = makeAddr("communityMember");
        gardensModuleCaller = makeAddr("gardensModule");
        garden = makeAddr("garden");
        signalPool = makeAddr("signalPool");

        UnifiedPowerRegistry impl = new UnifiedPowerRegistry();
        bytes memory initData =
            abi.encodeWithSelector(UnifiedPowerRegistry.initialize.selector, forkOwner, HATS_PROTOCOL, gardensModuleCaller);
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        powerRegistry = UnifiedPowerRegistry(address(proxy));

        _setupLiveHatsTree();
        _registerGardenPowerSources();

        vm.prank(gardensModuleCaller);
        powerRegistry.registerPool(signalPool, garden);
    }

    function _setupLiveHatsTree() internal {
        IHats hats = IHats(HATS_PROTOCOL);
        eligibilityToggle = new ForkTestEligibilityToggle(address(this));
        address module = address(eligibilityToggle);

        uint256 topHat = hats.mintTopHat(address(this), "Sepolia Power Registry Fork Test Tree", "");
        communityHatId = hats.createHat(topHat, "Community", 100, module, module, true, "");
        operatorHatId = hats.createHat(communityHatId, "Operator", 100, module, module, true, "");
        gardenerHatId = hats.createHat(communityHatId, "Gardener", 100, module, module, true, "");

        eligibilityToggle.setHatActive(communityHatId, true);
        eligibilityToggle.setHatActive(operatorHatId, true);
        eligibilityToggle.setHatActive(gardenerHatId, true);
        eligibilityToggle.setWearerStatus(communityHatId, communityMember, true, true);
        eligibilityToggle.setWearerStatus(operatorHatId, forkOperator, true, true);
        eligibilityToggle.setWearerStatus(gardenerHatId, forkGardener, true, true);

        hats.mintHat(communityHatId, communityMember);
        hats.mintHat(operatorHatId, forkOperator);
        hats.mintHat(gardenerHatId, forkGardener);
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

        vm.prank(gardensModuleCaller);
        powerRegistry.registerGarden(garden, sources);
    }

    function test_fork_powerRegistry_resolvesLiveHatWeights() public {
        if (!_tryChainFork("sepolia")) return;
        _deployRegistryAndHats();

        assertEq(powerRegistry.getMemberPowerInStrategy(forkOperator, signalPool), 3, "operator power");
        assertEq(powerRegistry.getMemberPowerInStrategy(forkGardener, signalPool), 2, "gardener power");
        assertEq(powerRegistry.getMemberPowerInStrategy(communityMember, signalPool), 1, "community power");
        assertEq(powerRegistry.getMemberPowerInStrategy(forkNonMember, signalPool), 0, "non-member power");
    }

    function test_fork_powerRegistry_updatesAfterLiveHatMint() public {
        if (!_tryChainFork("sepolia")) return;
        _deployRegistryAndHats();

        address newMember = makeAddr("newMember");
        assertEq(powerRegistry.getMemberPowerInStrategy(newMember, signalPool), 0, "new member starts with no power");

        eligibilityToggle.setWearerStatus(communityHatId, newMember, true, true);
        IHats(HATS_PROTOCOL).mintHat(communityHatId, newMember);

        assertEq(powerRegistry.getMemberPowerInStrategy(newMember, signalPool), 1, "new community wearer gains power");
    }

    function test_fork_powerRegistry_isMemberUsesCallingPool() public {
        if (!_tryChainFork("sepolia")) return;
        _deployRegistryAndHats();

        vm.prank(signalPool);
        assertTrue(powerRegistry.isMember(forkOperator), "registered pool should see operator membership");

        vm.prank(signalPool);
        assertFalse(powerRegistry.isMember(forkNonMember), "registered pool should reject non-member");

        vm.prank(makeAddr("unregisteredPool"));
        assertFalse(powerRegistry.isMember(forkOperator), "unregistered pool should not resolve membership");
    }

    function test_fork_powerRegistry_duplicateGardenReverts() public {
        if (!_tryChainFork("sepolia")) return;
        _deployRegistryAndHats();

        NFTPowerSource[] memory sources = powerRegistry.getGardenSources(garden);

        vm.prank(gardensModuleCaller);
        vm.expectRevert(abi.encodeWithSelector(UnifiedPowerRegistry.GardenAlreadyRegistered.selector, garden));
        powerRegistry.registerGarden(garden, sources);
    }

    function test_fork_powerRegistry_deregisterClearsPoolAndSources() public {
        if (!_tryChainFork("sepolia")) return;
        _deployRegistryAndHats();

        address[] memory pools = new address[](1);
        pools[0] = signalPool;

        vm.prank(gardensModuleCaller);
        powerRegistry.deregisterGarden(garden, pools);

        assertEq(powerRegistry.getPoolGarden(signalPool), address(0), "pool mapping should clear");
        assertFalse(powerRegistry.isGardenRegistered(garden), "garden sources should clear");
        assertEq(powerRegistry.getMemberPowerInStrategy(forkOperator, signalPool), 0, "cleared pool has no power");
    }
}
