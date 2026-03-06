// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { UnifiedPowerRegistry } from "../../src/registries/Power.sol";
import { MockCVStrategy } from "../../src/mocks/CVStrategy.sol";
import { IHats } from "../../src/interfaces/IHats.sol";
import { NFTPowerSource, NFTType } from "../../src/interfaces/IGardensV2.sol";

/// @title ArbitrumConvictionVotingForkTest
/// @notice Fork tests for UnifiedPowerRegistry + MockCVStrategy on Arbitrum mainnet.
/// @dev Exercises Hats-derived voting power resolution against the real Hats Protocol,
///      then verifies conviction accumulation through the MockCVStrategy signal pool.
///      Gracefully skips when ARBITRUM_RPC_URL is not set.
contract ArbitrumConvictionVotingForkTest is Test {
    /// @notice Hats Protocol on all EVM chains
    address internal constant HATS_PROTOCOL = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;

    UnifiedPowerRegistry public powerRegistry;
    MockCVStrategy public strategy;

    address public owner = address(0xA1);
    address public gardensModule; // mock authorized caller for registry
    address public garden = address(0xC1);

    // Test actors — will wear hats
    address public operator;
    address public gardener;
    address public communityMember;
    address public nonMember;

    // Hat IDs (set during _setupHatsTree)
    uint256 public operatorHatId;
    uint256 public gardenerHatId;
    uint256 public communityHatId;

    // CV parameters (match GardensModule defaults)
    uint256 internal constant DEFAULT_DECAY = 9_999_799;
    uint256 internal constant DEFAULT_MAX_RATIO = 2_000_000;
    uint256 internal constant DEFAULT_WEIGHT = 10_000;
    uint256 internal constant DEFAULT_MIN_THRESHOLD_POINTS = 2_500_000;

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
    // Deploy Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Create test actors, deploy UnifiedPowerRegistry, set up Hats tree
    function _deployStack() internal {
        // 1. Create test actors
        operator = makeAddr("operator");
        gardener = makeAddr("gardener");
        communityMember = makeAddr("communityMember");
        nonMember = makeAddr("nonMember");
        gardensModule = makeAddr("gardensModule");

        // 2. Deploy UnifiedPowerRegistry behind UUPS proxy
        UnifiedPowerRegistry impl = new UnifiedPowerRegistry();
        bytes memory initData =
            abi.encodeWithSelector(UnifiedPowerRegistry.initialize.selector, owner, HATS_PROTOCOL, gardensModule);
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        powerRegistry = UnifiedPowerRegistry(address(proxy));

        // 3. Set up Hats tree on the real protocol
        _setupHatsTree();

        // 4. Register garden with Hats-based power sources (Linear weights)
        _registerGardenPowerSources();
    }

    /// @notice Create a Hats tree owned by address(this), mint hats to test actors
    function _setupHatsTree() internal {
        IHats hats = IHats(HATS_PROTOCOL);

        // Non-zero placeholder for eligibility/toggle (defaults to permissive)
        address permissive = address(0xdead);

        // Top hat — owned by this test contract
        uint256 topHat = hats.mintTopHat(address(this), "CV Fork Test Tree", "");

        // Community hat (level 1)
        communityHatId = hats.createHat(topHat, "Community", 100, permissive, permissive, true, "");

        // Operator hat (level 2, under community)
        operatorHatId = hats.createHat(communityHatId, "Operator", 100, permissive, permissive, true, "");

        // Gardener hat (level 2, under community)
        gardenerHatId = hats.createHat(communityHatId, "Gardener", 100, permissive, permissive, true, "");

        // Mint hats to actors
        hats.mintHat(communityHatId, communityMember);
        hats.mintHat(operatorHatId, operator);
        hats.mintHat(gardenerHatId, gardener);
        // nonMember gets no hat
    }

    /// @notice Register garden power sources using Linear weight scheme (10k/20k/30k)
    function _registerGardenPowerSources() internal {
        NFTPowerSource[] memory sources = new NFTPowerSource[](3);
        sources[0] = NFTPowerSource({
            token: HATS_PROTOCOL,
            nftType: NFTType.HAT,
            weight: 30_000, // Operator: 3x
            tokenId: 0,
            hatId: operatorHatId
        });
        sources[1] = NFTPowerSource({
            token: HATS_PROTOCOL,
            nftType: NFTType.HAT,
            weight: 20_000, // Gardener: 2x
            tokenId: 0,
            hatId: gardenerHatId
        });
        sources[2] = NFTPowerSource({
            token: HATS_PROTOCOL,
            nftType: NFTType.HAT,
            weight: 10_000, // Community: 1x
            tokenId: 0,
            hatId: communityHatId
        });

        vm.prank(gardensModule);
        powerRegistry.registerGarden(garden, sources);
    }

    /// @notice Deploy MockCVStrategy wired to the power registry and register pool mapping
    function _deployStrategy() internal {
        strategy = new MockCVStrategy(
            address(powerRegistry),
            address(0),
            DEFAULT_DECAY,
            DEFAULT_MAX_RATIO,
            DEFAULT_WEIGHT,
            DEFAULT_MIN_THRESHOLD_POINTS
        );

        // Map pool (strategy address) to garden in power registry
        vm.prank(gardensModule);
        powerRegistry.registerPool(address(strategy), garden);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Real Hats Protocol is deployed
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkCV_hatsProtocolIsDeployed() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        assertGt(HATS_PROTOCOL.code.length, 0, "Hats Protocol should be deployed on Arbitrum");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Power registry initializes with real Hats
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkCV_registryInitializesWithRealHats() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployStack();

        assertEq(powerRegistry.owner(), owner, "owner should be set");
        assertEq(powerRegistry.hatsProtocol(), HATS_PROTOCOL, "hats protocol should point to real address");
        assertEq(powerRegistry.gardensModule(), gardensModule, "gardens module should be authorized");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Garden power sources registered correctly
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkCV_gardenPowerSourcesRegistered() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployStack();

        assertTrue(powerRegistry.isGardenRegistered(garden), "garden should be registered");
        assertEq(powerRegistry.getGardenSourceCount(garden), 3, "garden should have 3 power sources");

        NFTPowerSource[] memory sources = powerRegistry.getGardenSources(garden);
        assertEq(sources[0].weight, 30_000, "operator source should have 30000 weight");
        assertEq(sources[0].hatId, operatorHatId, "operator source should reference operator hat");
        assertEq(sources[1].weight, 20_000, "gardener source should have 20000 weight");
        assertEq(sources[1].hatId, gardenerHatId, "gardener source should reference gardener hat");
        assertEq(sources[2].weight, 10_000, "community source should have 10000 weight");
        assertEq(sources[2].hatId, communityHatId, "community source should reference community hat");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Hats-derived power for hat wearers
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkCV_hatsDerivedPowerForWearers() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployStack();
        _deployStrategy();

        // Operator wears operator hat -> (1 * 30000) / 10000 = 3
        uint256 opPower = powerRegistry.getMemberPowerInStrategy(operator, address(strategy));
        assertEq(opPower, 3, "operator should have power 3 from operator hat");

        // Gardener wears gardener hat -> (1 * 20000) / 10000 = 2
        uint256 gardenerPower = powerRegistry.getMemberPowerInStrategy(gardener, address(strategy));
        assertEq(gardenerPower, 2, "gardener should have power 2 from gardener hat");

        // Community member wears community hat -> (1 * 10000) / 10000 = 1
        uint256 communityPower = powerRegistry.getMemberPowerInStrategy(communityMember, address(strategy));
        assertEq(communityPower, 1, "community member should have power 1 from community hat");

        // Non-member has no hat -> 0 power
        uint256 nonMemberPower = powerRegistry.getMemberPowerInStrategy(nonMember, address(strategy));
        assertEq(nonMemberPower, 0, "non-member should have zero power");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: isMember resolves correctly via real Hats
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkCV_isMemberResolvesViaRealHats() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployStack();
        _deployStrategy();

        // isMember uses msg.sender as strategy — we prank as the strategy to test
        vm.prank(address(strategy));
        assertTrue(powerRegistry.isMember(operator), "operator should be member");

        vm.prank(address(strategy));
        assertTrue(powerRegistry.isMember(gardener), "gardener should be member");

        vm.prank(address(strategy));
        assertTrue(powerRegistry.isMember(communityMember), "community member should be member");

        vm.prank(address(strategy));
        assertFalse(powerRegistry.isMember(nonMember), "non-member should not be member");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Pool-garden mapping enables power resolution
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkCV_poolGardenMappingEnablesPowerResolution() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployStack();
        _deployStrategy();

        // Verify pool -> garden mapping
        assertEq(powerRegistry.getPoolGarden(address(strategy)), garden, "pool should map to garden");

        // Power resolution works via pool -> garden -> sources -> Hats
        uint256 power = powerRegistry.getMemberPowerInStrategy(operator, address(strategy));
        assertGt(power, 0, "operator power should be non-zero via pool mapping");

        // Unknown pool returns zero power (no revert)
        uint256 unknownPower = powerRegistry.getMemberPowerInStrategy(operator, address(0xDEAD));
        assertEq(unknownPower, 0, "unknown pool should return zero power");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Full conviction voting flow
    // registerHypercert -> allocateSupport -> vm.warp() -> calculateConviction
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkCV_fullConvictionVotingFlow() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployStack();
        _deployStrategy();

        // 1. Register a hypercert
        uint256 hypercertId = 42;
        strategy.registerHypercert(hypercertId);

        // 2. Operator allocates support (has power = 3)
        MockCVStrategy.Signal[] memory signals = new MockCVStrategy.Signal[](1);
        signals[0] = MockCVStrategy.Signal({ hypercertId: hypercertId, deltaSupport: 100 });

        vm.prank(operator);
        strategy.allocateSupport(signals);

        // Verify allocation state
        uint256 allocation = strategy.voterAllocations(operator, hypercertId);
        assertEq(allocation, 100, "operator should have 100 allocated");

        (uint256 stakedAmount,,, bool active) = strategy.entries(hypercertId);
        assertEq(stakedAmount, 100, "hypercert should have 100 total staked");
        assertTrue(active, "hypercert should be active");

        // 3. Advance time (blocks) to accumulate conviction
        uint256 convictionBefore = strategy.calculateConviction(hypercertId);
        assertEq(convictionBefore, 0, "conviction should be 0 before time passes");

        vm.roll(block.number + 1000);

        // 4. Verify conviction grew
        uint256 convictionAfter = strategy.calculateConviction(hypercertId);
        assertGt(convictionAfter, 0, "conviction should be non-zero after block advancement");

        // Expected: stakedAmount(100) * elapsed(1000) * weight(10000) / D(10000000)
        //         = 100 * 1000 * 10000 / 10000000 = 100
        uint256 expected = (100 * 1000 * DEFAULT_WEIGHT) / 10_000_000;
        assertEq(convictionAfter, expected, "conviction should match formula");

        emit log_named_uint("conviction after 1000 blocks", convictionAfter);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Non-eligible voter cannot allocate support
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkCV_nonEligibleVoterCannotAllocate() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployStack();
        _deployStrategy();

        uint256 hypercertId = 99;
        strategy.registerHypercert(hypercertId);

        MockCVStrategy.Signal[] memory signals = new MockCVStrategy.Signal[](1);
        signals[0] = MockCVStrategy.Signal({ hypercertId: hypercertId, deltaSupport: 50 });

        // Non-member should be rejected
        vm.prank(nonMember);
        vm.expectRevert(abi.encodeWithSelector(MockCVStrategy.NotEligibleVoter.selector, nonMember));
        strategy.allocateSupport(signals);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Multiple voters with different hat-based powers
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkCV_multipleVotersWithDifferentPowers() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployStack();
        _deployStrategy();

        uint256 hypercertId = 7;
        strategy.registerHypercert(hypercertId);

        // Operator allocates 50
        MockCVStrategy.Signal[] memory opSignals = new MockCVStrategy.Signal[](1);
        opSignals[0] = MockCVStrategy.Signal({ hypercertId: hypercertId, deltaSupport: 50 });
        vm.prank(operator);
        strategy.allocateSupport(opSignals);

        // Gardener allocates 30
        MockCVStrategy.Signal[] memory gardenerSignals = new MockCVStrategy.Signal[](1);
        gardenerSignals[0] = MockCVStrategy.Signal({ hypercertId: hypercertId, deltaSupport: 30 });
        vm.prank(gardener);
        strategy.allocateSupport(gardenerSignals);

        // Community member allocates 20
        MockCVStrategy.Signal[] memory communitySignals = new MockCVStrategy.Signal[](1);
        communitySignals[0] = MockCVStrategy.Signal({ hypercertId: hypercertId, deltaSupport: 20 });
        vm.prank(communityMember);
        strategy.allocateSupport(communitySignals);

        // Total staked = 50 + 30 + 20 = 100
        (uint256 totalStaked,,,) = strategy.entries(hypercertId);
        assertEq(totalStaked, 100, "total staked should be 100");

        // Verify individual allocations
        assertEq(strategy.voterAllocations(operator, hypercertId), 50, "operator allocation");
        assertEq(strategy.voterAllocations(gardener, hypercertId), 30, "gardener allocation");
        assertEq(strategy.voterAllocations(communityMember, hypercertId), 20, "community member allocation");

        // Advance blocks and verify conviction
        vm.roll(block.number + 500);
        uint256 conviction = strategy.calculateConviction(hypercertId);
        uint256 expected = (100 * 500 * DEFAULT_WEIGHT) / 10_000_000;
        assertEq(conviction, expected, "conviction should reflect total staked amount");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Conviction weights across multiple hypercerts
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkCV_convictionWeightsAcrossHypercerts() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployStack();
        _deployStrategy();

        // Register two hypercerts
        uint256 hc1 = 1;
        uint256 hc2 = 2;
        strategy.registerHypercert(hc1);
        strategy.registerHypercert(hc2);

        // Operator allocates differently to each
        MockCVStrategy.Signal[] memory signals = new MockCVStrategy.Signal[](2);
        signals[0] = MockCVStrategy.Signal({ hypercertId: hc1, deltaSupport: 100 });
        signals[1] = MockCVStrategy.Signal({ hypercertId: hc2, deltaSupport: 50 });
        vm.prank(operator);
        strategy.allocateSupport(signals);

        // Advance blocks
        vm.roll(block.number + 200);

        // Get conviction weights
        (uint256[] memory ids, uint256[] memory weights) = strategy.getConvictionWeights();
        assertEq(ids.length, 2, "should have 2 hypercerts");
        assertEq(ids[0], hc1, "first hypercert id");
        assertEq(ids[1], hc2, "second hypercert id");

        // hc1: (100 * 200 * 10000) / 10000000 = 20
        // hc2: (50 * 200 * 10000) / 10000000 = 10
        assertEq(weights[0], 20, "hc1 conviction should be 20");
        assertEq(weights[1], 10, "hc2 conviction should be 10");

        // Higher allocation leads to higher conviction
        assertGt(weights[0], weights[1], "hc1 should have more conviction than hc2");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Deregister garden clears all state
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkCV_deregisterGardenClearsState() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployStack();
        _deployStrategy();

        // Verify registered
        assertTrue(powerRegistry.isGardenRegistered(garden), "garden should be registered");
        assertEq(powerRegistry.getPoolGarden(address(strategy)), garden, "pool should map to garden");

        // Deregister
        address[] memory pools = new address[](1);
        pools[0] = address(strategy);
        vm.prank(gardensModule);
        powerRegistry.deregisterGarden(garden, pools);

        // Verify cleared
        assertFalse(powerRegistry.isGardenRegistered(garden), "garden should not be registered after deregister");
        assertEq(powerRegistry.getPoolGarden(address(strategy)), address(0), "pool mapping should be cleared");
        assertEq(powerRegistry.getGardenSourceCount(garden), 0, "sources should be cleared");

        // Power should return 0 for all members
        uint256 power = powerRegistry.getMemberPowerInStrategy(operator, address(strategy));
        assertEq(power, 0, "operator power should be 0 after deregister");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Explicit pool registration write with auth checks
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkCV_registerPoolExplicitWriteTest() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployStack();

        // Deploy a fresh strategy
        MockCVStrategy freshStrategy = new MockCVStrategy(
            address(powerRegistry),
            address(0),
            DEFAULT_DECAY,
            DEFAULT_MAX_RATIO,
            DEFAULT_WEIGHT,
            DEFAULT_MIN_THRESHOLD_POINTS
        );

        // Non-authorized caller should fail to register pool
        vm.prank(address(0xDEAD));
        vm.expectRevert();
        powerRegistry.registerPool(address(freshStrategy), garden);

        // Authorized gardensModule should succeed
        vm.prank(gardensModule);
        powerRegistry.registerPool(address(freshStrategy), garden);

        // Verify the pool mapping was written correctly
        assertEq(powerRegistry.getPoolGarden(address(freshStrategy)), garden, "fresh pool should map to garden");

        // Power resolution should work through the new pool
        uint256 opPower = powerRegistry.getMemberPowerInStrategy(operator, address(freshStrategy));
        assertEq(opPower, 3, "operator power should resolve through new pool");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test: Deallocate support reduces conviction
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkCV_deallocateReducesConviction() public {
        if (!_tryFork()) {
            emit log("SKIPPED: ARBITRUM_RPC_URL not set");
            return;
        }

        _deployStack();
        _deployStrategy();

        uint256 hypercertId = 55;
        strategy.registerHypercert(hypercertId);

        // Allocate 100
        MockCVStrategy.Signal[] memory allocSignals = new MockCVStrategy.Signal[](1);
        allocSignals[0] = MockCVStrategy.Signal({ hypercertId: hypercertId, deltaSupport: 100 });
        vm.prank(operator);
        strategy.allocateSupport(allocSignals);

        // Advance blocks to accumulate conviction
        vm.roll(block.number + 100);

        uint256 convictionWithFull = strategy.calculateConviction(hypercertId);
        assertGt(convictionWithFull, 0, "should have conviction after blocks");

        // Deallocate 50 (negative delta)
        MockCVStrategy.Signal[] memory deallocSignals = new MockCVStrategy.Signal[](1);
        deallocSignals[0] = MockCVStrategy.Signal({ hypercertId: hypercertId, deltaSupport: -50 });
        vm.prank(operator);
        strategy.allocateSupport(deallocSignals);

        // Verify allocation reduced
        assertEq(strategy.voterAllocations(operator, hypercertId), 50, "allocation should be 50 after deallocation");
        (uint256 stakedAfter,,,) = strategy.entries(hypercertId);
        assertEq(stakedAfter, 50, "total staked should be 50");

        // Advance same number of blocks — conviction growth should be slower
        vm.roll(block.number + 100);

        uint256 convictionFinal = strategy.calculateConviction(hypercertId);
        // The snapshotted conviction (from when we had 100 staked for 100 blocks) is preserved
        // Plus new growth from 50 staked for 100 blocks
        // Growth rate with 50 staked < growth rate with 100 staked
        // Total conviction should still grow: snapshot from first period + new growth from reduced stake
        assertGt(convictionFinal, convictionWithFull, "total conviction should still grow even with reduced stake");

        emit log_named_uint("conviction with full stake + 100 blocks", convictionWithFull);
        emit log_named_uint("conviction final (after deallocation + 100 more blocks)", convictionFinal);
    }
}
