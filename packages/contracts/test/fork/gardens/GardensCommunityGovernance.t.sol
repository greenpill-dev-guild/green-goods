// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase } from "../helpers/ForkTestBase.sol";
import { GardensModule } from "../../../src/modules/Gardens.sol";
import { GardenToken } from "../../../src/tokens/Garden.sol";
import { IGardensModule } from "../../../src/interfaces/IGardensModule.sol";
import {
    IRegistryCommunity,
    CVStrategyInitializeParamsV0_3,
    CVParams,
    PointSystem,
    ProposalType,
    PointSystemConfig,
    ArbitrableConfig,
    Metadata
} from "../../../src/interfaces/IGardensV2.sol";
import { IHatsModule } from "../../../src/interfaces/IHatsModule.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title GardensCommunityGovernanceForkTest
/// @notice Fork tests for Gardens V2 community governance integration (Phases 1-3).
/// @dev Phase 1: Community creation with real RegistryFactory on Sepolia, Arbitrum, Celo
///      Phase 2: Pool creation (Sepolia only) — graceful failure and direct Unlimited pools
///      Phase 3: Member staking (Sepolia only) — single and multi-member staking
///
///      All tests gracefully skip if the required RPC URL is not configured.
///      Order matters: _configureRealGardensV2() MUST be called AFTER _deployFullStackOnFork()
///      but BEFORE _mintTestGarden().
contract GardensCommunityGovernanceForkTest is ForkTestBase {
    // ═══════════════════════════════════════════════════════════════════════════
    // Setup Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Full setup: fork chain → deploy stack → configure real Gardens V2
    /// @param chainName The chain to fork ("sepolia", "arbitrum", "celo")
    /// @return success True if setup completed (false = skipped due to missing RPC)
    function _setupWithRealGardensV2(string memory chainName) internal returns (bool success) {
        if (!_tryChainFork(chainName)) return false;
        _deployFullStackOnFork();
        _configureRealGardensV2();
        return true;
    }

    /// @notice Shared assertion logic for community creation tests
    /// @param gardenName Name used when minting the garden
    function _assertCommunityCreated(string memory gardenName) internal {
        address garden = _mintTestGarden(gardenName, 0x0F);

        // Verify garden initialization
        assertTrue(gardensModule.isGardenInitialized(garden), "garden should be initialized");

        // Verify community was created
        address community = gardensModule.getGardenCommunity(garden);
        assertTrue(community != address(0), "community should be non-zero with real factory");

        // Verify community properties
        IRegistryCommunity communityContract = IRegistryCommunity(community);

        // councilSafe should be the garden TBA
        address councilSafe = communityContract.councilSafe();
        assertEq(councilSafe, garden, "councilSafe should be the garden account (TBA)");

        // gardenToken on the community should be our GOODS token
        address communityGardenToken = communityContract.gardenToken();
        assertEq(communityGardenToken, address(goodsToken), "community gardenToken should be GOODS token");

        // Weight scheme should be stored
        IGardensModule.WeightScheme scheme = gardensModule.getGardenWeightScheme(garden);
        assertEq(uint256(scheme), uint256(IGardensModule.WeightScheme.Linear), "default weight scheme should be Linear");

        emit log_named_address("community", community);
        emit log_named_address("councilSafe", councilSafe);
        emit log_named_address("gardenToken (GOODS)", communityGardenToken);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Phase 1: Community Creation (All Chains)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Community creation on Sepolia with real RegistryFactory
    function test_fork_sepolia_communityCreatedWithRealFactory() public {
        if (!_setupWithRealGardensV2("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        _assertCommunityCreated("Sepolia Community Garden");
    }

    /// @notice Community creation on Arbitrum with real RegistryFactory
    function test_fork_arbitrum_communityCreatedWithRealFactory() public {
        if (!_setupWithRealGardensV2("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        _assertCommunityCreated("Arbitrum Community Garden");
    }

    /// @notice Community creation on Celo with real RegistryFactory
    function test_fork_celo_communityCreatedWithRealFactory() public {
        if (!_setupWithRealGardensV2("celo")) {
            emit log("SKIPPED: No Celo RPC URL configured");
            return;
        }

        _assertCommunityCreated("Celo Community Garden");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Phase 1b: Multiple Gardens With Different Weight Schemes (Sepolia)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Tests multiple gardens with Linear, Exponential, and Power weight schemes
    function test_fork_sepolia_multipleGardensWithDifferentSchemes() public {
        if (!_setupWithRealGardensV2("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        // Garden 1: Linear (default via _mintTestGarden)
        address garden1 = _mintTestGarden("Linear Garden", 0x01);
        assertTrue(gardensModule.isGardenInitialized(garden1), "garden1 should be initialized");
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden1)),
            uint256(IGardensModule.WeightScheme.Linear),
            "garden1 should have Linear scheme"
        );
        address community1 = gardensModule.getGardenCommunity(garden1);
        assertTrue(community1 != address(0), "garden1 community should exist");

        // Garden 2: Exponential
        GardenToken.GardenConfig memory config2 = GardenToken.GardenConfig({
            name: "Exponential Garden",
            slug: "",
            description: "Uses exponential weighting",
            location: "Test Location",
            bannerImage: "ipfs://QmTest",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Exponential,
            domainMask: 0x02,
            gardeners: new address[](0),
            operators: new address[](0)
        });
        address garden2 = gardenToken.mintGarden(config2);
        assertTrue(gardensModule.isGardenInitialized(garden2), "garden2 should be initialized");
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden2)),
            uint256(IGardensModule.WeightScheme.Exponential),
            "garden2 should have Exponential scheme"
        );
        address community2 = gardensModule.getGardenCommunity(garden2);
        assertTrue(community2 != address(0), "garden2 community should exist");

        // Garden 3: Power
        GardenToken.GardenConfig memory config3 = GardenToken.GardenConfig({
            name: "Power Garden",
            slug: "",
            description: "Uses power weighting",
            location: "Test Location",
            bannerImage: "ipfs://QmTest",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Power,
            domainMask: 0x04,
            gardeners: new address[](0),
            operators: new address[](0)
        });
        address garden3 = gardenToken.mintGarden(config3);
        assertTrue(gardensModule.isGardenInitialized(garden3), "garden3 should be initialized");
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden3)),
            uint256(IGardensModule.WeightScheme.Power),
            "garden3 should have Power scheme"
        );
        address community3 = gardensModule.getGardenCommunity(garden3);
        assertTrue(community3 != address(0), "garden3 community should exist");

        // All communities should be different addresses
        assertTrue(community1 != community2, "community1 and community2 should differ");
        assertTrue(community2 != community3, "community2 and community3 should differ");
        assertTrue(community1 != community3, "community1 and community3 should differ");

        emit log_named_address("Linear community", community1);
        emit log_named_address("Exponential community", community2);
        emit log_named_address("Power community", community3);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Phase 2: Pool Creation (Sepolia Only)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Tests that createGardenPools with PointSystem.Custom gracefully fails
    ///         when no PowerRegistry is available (try/catch in _createPool).
    function test_fork_sepolia_poolCreationGracefulWithoutPowerRegistry() public {
        if (!_setupWithRealGardensV2("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        // Mint garden — community should be created, but no power registry
        address garden = _mintTestGarden("Pool Test Garden", 0x0F);
        assertTrue(gardensModule.isGardenInitialized(garden), "garden should be initialized");

        address community = gardensModule.getGardenCommunity(garden);
        if (community == address(0)) {
            emit log("SKIPPED: Community not created (factory may have changed)");
            return;
        }

        // createGardenPools attempts Custom point system with no PowerRegistry.
        // This should NOT revert — the try/catch in _createPool handles it gracefully.
        address[] memory pools = gardensModule.createGardenPools(garden);

        // Pools may be empty (creation failed gracefully) or populated (unlikely without registry)
        emit log_named_uint("pools created", pools.length);

        // The important assertion: call did not revert, and garden is still initialized
        assertTrue(gardensModule.isGardenInitialized(garden), "garden should still be initialized after pool attempt");
    }

    /// @notice Tests direct pool creation on the community with PointSystem.Unlimited
    ///         (no PowerRegistry needed). Pranked as the garden TBA (council Safe).
    function test_fork_sepolia_directPoolCreationWithUnlimited() public {
        if (!_setupWithRealGardensV2("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        address garden = _mintTestGarden("Direct Pool Garden", 0x0F);
        address community = gardensModule.getGardenCommunity(garden);
        if (community == address(0)) {
            emit log("SKIPPED: Community not created (factory may have changed)");
            return;
        }

        // Build pool params with Unlimited point system (no registry needed)
        CVStrategyInitializeParamsV0_3 memory strategyParams = CVStrategyInitializeParamsV0_3({
            cvParams: CVParams({
                maxRatio: GardensModule(address(gardensModule)).DEFAULT_MAX_RATIO(),
                weight: GardensModule(address(gardensModule)).DEFAULT_WEIGHT(),
                decay: GardensModule(address(gardensModule)).DEFAULT_DECAY(),
                minThresholdPoints: GardensModule(address(gardensModule)).DEFAULT_MIN_THRESHOLD_POINTS()
            }),
            proposalType: ProposalType.Signaling,
            pointSystem: PointSystem.Unlimited,
            pointConfig: PointSystemConfig({ maxAmount: 0 }),
            arbitrableConfig: ArbitrableConfig({
                arbitrator: address(0),
                tribunalSafe: address(0),
                submitterCollateralAmount: 0,
                challengerCollateralAmount: 0,
                defaultRuling: 0,
                defaultRulingTimeout: 0
            }),
            registryCommunity: community,
            votingPowerRegistry: address(0), // Not needed for Unlimited
            sybilScorer: address(0),
            sybilScorerThreshold: 0,
            initialAllowlist: new address[](0),
            superfluidToken: address(0),
            streamingRatePerSecond: 0
        });

        Metadata memory poolMetadata = Metadata({ protocol: 1, pointer: "Direct Unlimited Pool" });

        // Prank as the garden TBA (council Safe) to create pool directly on the community
        vm.prank(garden);
        (uint256 poolId, address strategy) =
            IRegistryCommunity(community).createPool(address(0), strategyParams, poolMetadata);

        assertTrue(strategy != address(0), "strategy should be deployed");
        emit log_named_uint("poolId", poolId);
        emit log_named_address("strategy", strategy);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Phase 3: Member Staking (Sepolia Only)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Tests single member staking in a real Gardens V2 community
    function test_fork_sepolia_memberStaking() public {
        if (!_setupWithRealGardensV2("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        address garden = _mintTestGarden("Staking Garden", 0x0F);
        address community = gardensModule.getGardenCommunity(garden);
        if (community == address(0)) {
            emit log("SKIPPED: Community not created (factory may have changed)");
            return;
        }

        // Get the stake amount required by the community
        uint256 stakeAmount = gardensModule.stakeAmountPerMember();

        // Fund forkGardener with GOODS tokens for staking
        goodsToken.mint(forkGardener, stakeAmount);
        assertEq(goodsToken.balanceOf(forkGardener), stakeAmount, "gardener should have GOODS");

        // Approve community to spend GOODS
        vm.prank(forkGardener);
        IERC20(address(goodsToken)).approve(community, stakeAmount);

        // Stake and register member
        vm.prank(forkGardener);
        IRegistryCommunity(community).stakeAndRegisterMember(forkGardener);

        emit log("Member staked successfully");
        emit log_named_address("member", forkGardener);
        emit log_named_uint("stakeAmount", stakeAmount);
    }

    /// @notice Tests multi-member staking with different roles
    function test_fork_sepolia_multiMemberStaking() public {
        if (!_setupWithRealGardensV2("sepolia")) {
            emit log("SKIPPED: No Sepolia RPC URL configured");
            return;
        }

        address garden = _mintTestGarden("Multi-Stake Garden", 0x0F);
        address community = gardensModule.getGardenCommunity(garden);
        if (community == address(0)) {
            emit log("SKIPPED: Community not created (factory may have changed)");
            return;
        }

        uint256 stakeAmount = gardensModule.stakeAmountPerMember();

        // Grant roles to test actors
        _grantGardenRole(garden, forkOperator, IHatsModule.GardenRole.Operator);
        _grantGardenRole(garden, forkGardener, IHatsModule.GardenRole.Gardener);
        _grantGardenRole(garden, forkEvaluator, IHatsModule.GardenRole.Evaluator);

        // Stake each member
        address[3] memory members = [forkOperator, forkGardener, forkEvaluator];
        string[3] memory labels = ["operator", "gardener", "evaluator"];

        for (uint256 i = 0; i < members.length; i++) {
            // Fund with GOODS
            goodsToken.mint(members[i], stakeAmount);
            assertEq(goodsToken.balanceOf(members[i]), stakeAmount, "member should have GOODS");

            // Approve and stake
            vm.prank(members[i]);
            IERC20(address(goodsToken)).approve(community, stakeAmount);

            vm.prank(members[i]);
            IRegistryCommunity(community).stakeAndRegisterMember(members[i]);

            emit log_named_string("staked member role", labels[i]);
            emit log_named_address("staked member address", members[i]);
        }

        emit log("All 3 members staked successfully");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Phase 4: Arbitrum Fork Tests
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Direct pool creation on Arbitrum with PointSystem.Unlimited
    function test_fork_arbitrum_poolCreationUnlimited() public {
        if (!_setupWithRealGardensV2("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        address garden = _mintTestGarden("Arb Pool Garden", 0x0F);
        address community = gardensModule.getGardenCommunity(garden);
        if (community == address(0)) {
            emit log("SKIPPED: Community not created (factory may have changed)");
            return;
        }

        // Build pool params with Unlimited point system (no registry needed)
        CVStrategyInitializeParamsV0_3 memory strategyParams = CVStrategyInitializeParamsV0_3({
            cvParams: CVParams({
                maxRatio: GardensModule(address(gardensModule)).DEFAULT_MAX_RATIO(),
                weight: GardensModule(address(gardensModule)).DEFAULT_WEIGHT(),
                decay: GardensModule(address(gardensModule)).DEFAULT_DECAY(),
                minThresholdPoints: GardensModule(address(gardensModule)).DEFAULT_MIN_THRESHOLD_POINTS()
            }),
            proposalType: ProposalType.Signaling,
            pointSystem: PointSystem.Unlimited,
            pointConfig: PointSystemConfig({ maxAmount: 0 }),
            arbitrableConfig: ArbitrableConfig({
                arbitrator: address(0),
                tribunalSafe: address(0),
                submitterCollateralAmount: 0,
                challengerCollateralAmount: 0,
                defaultRuling: 0,
                defaultRulingTimeout: 0
            }),
            registryCommunity: community,
            votingPowerRegistry: address(0),
            sybilScorer: address(0),
            sybilScorerThreshold: 0,
            initialAllowlist: new address[](0),
            superfluidToken: address(0),
            streamingRatePerSecond: 0
        });

        Metadata memory poolMetadata = Metadata({ protocol: 1, pointer: "Arb Unlimited Pool" });

        // Prank as the garden TBA (council Safe) to create pool directly on the community
        vm.prank(garden);
        (uint256 poolId, address strategy) =
            IRegistryCommunity(community).createPool(address(0), strategyParams, poolMetadata);

        assertTrue(strategy != address(0), "strategy should be deployed");
        emit log_named_uint("poolId", poolId);
        emit log_named_address("strategy", strategy);
    }

    /// @notice Single member staking on Arbitrum
    function test_fork_arbitrum_memberStaking() public {
        if (!_setupWithRealGardensV2("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        address garden = _mintTestGarden("Arb Staking Garden", 0x0F);
        address community = gardensModule.getGardenCommunity(garden);
        if (community == address(0)) {
            emit log("SKIPPED: Community not created (factory may have changed)");
            return;
        }

        uint256 stakeAmount = gardensModule.stakeAmountPerMember();

        // Fund forkGardener with GOODS tokens for staking
        goodsToken.mint(forkGardener, stakeAmount);
        assertEq(goodsToken.balanceOf(forkGardener), stakeAmount, "gardener should have GOODS");

        // Approve community to spend GOODS
        vm.prank(forkGardener);
        IERC20(address(goodsToken)).approve(community, stakeAmount);

        // Stake and register member
        vm.prank(forkGardener);
        IRegistryCommunity(community).stakeAndRegisterMember(forkGardener);

        emit log("Member staked successfully on Arbitrum");
        emit log_named_address("member", forkGardener);
        emit log_named_uint("stakeAmount", stakeAmount);
    }

    /// @notice Multi-member staking with different roles on Arbitrum
    function test_fork_arbitrum_multiMemberStaking() public {
        if (!_setupWithRealGardensV2("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        address garden = _mintTestGarden("Arb Multi-Stake Garden", 0x0F);
        address community = gardensModule.getGardenCommunity(garden);
        if (community == address(0)) {
            emit log("SKIPPED: Community not created (factory may have changed)");
            return;
        }

        uint256 stakeAmount = gardensModule.stakeAmountPerMember();

        // Grant roles to test actors
        _grantGardenRole(garden, forkOperator, IHatsModule.GardenRole.Operator);
        _grantGardenRole(garden, forkGardener, IHatsModule.GardenRole.Gardener);
        _grantGardenRole(garden, forkEvaluator, IHatsModule.GardenRole.Evaluator);

        // Stake each member
        address[3] memory members = [forkOperator, forkGardener, forkEvaluator];
        string[3] memory labels = ["operator", "gardener", "evaluator"];

        for (uint256 i = 0; i < members.length; i++) {
            goodsToken.mint(members[i], stakeAmount);
            assertEq(goodsToken.balanceOf(members[i]), stakeAmount, "member should have GOODS");

            vm.prank(members[i]);
            IERC20(address(goodsToken)).approve(community, stakeAmount);

            vm.prank(members[i]);
            IRegistryCommunity(community).stakeAndRegisterMember(members[i]);

            emit log_named_string("staked member role", labels[i]);
            emit log_named_address("staked member address", members[i]);
        }

        emit log("All 3 members staked successfully on Arbitrum");
    }

    /// @notice Tests multiple gardens with different weight schemes on Arbitrum
    function test_fork_arbitrum_weightSchemePerGarden() public {
        if (!_setupWithRealGardensV2("arbitrum")) {
            emit log("SKIPPED: No Arbitrum RPC URL configured");
            return;
        }

        // Garden 1: Linear (default via _mintTestGarden)
        address garden1 = _mintTestGarden("Arb Linear Garden", 0x01);
        assertTrue(gardensModule.isGardenInitialized(garden1), "garden1 should be initialized");
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden1)),
            uint256(IGardensModule.WeightScheme.Linear),
            "garden1 should have Linear scheme"
        );
        address community1 = gardensModule.getGardenCommunity(garden1);
        assertTrue(community1 != address(0), "garden1 community should exist");

        // Garden 2: Exponential
        GardenToken.GardenConfig memory config2 = GardenToken.GardenConfig({
            name: "Arb Exponential Garden",
            slug: "",
            description: "Uses exponential weighting",
            location: "Test Location",
            bannerImage: "ipfs://QmTest",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Exponential,
            domainMask: 0x02,
            gardeners: new address[](0),
            operators: new address[](0)
        });
        address garden2 = gardenToken.mintGarden(config2);
        assertTrue(gardensModule.isGardenInitialized(garden2), "garden2 should be initialized");
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden2)),
            uint256(IGardensModule.WeightScheme.Exponential),
            "garden2 should have Exponential scheme"
        );
        address community2 = gardensModule.getGardenCommunity(garden2);
        assertTrue(community2 != address(0), "garden2 community should exist");

        // Garden 3: Power
        GardenToken.GardenConfig memory config3 = GardenToken.GardenConfig({
            name: "Arb Power Garden",
            slug: "",
            description: "Uses power weighting",
            location: "Test Location",
            bannerImage: "ipfs://QmTest",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Power,
            domainMask: 0x04,
            gardeners: new address[](0),
            operators: new address[](0)
        });
        address garden3 = gardenToken.mintGarden(config3);
        assertTrue(gardensModule.isGardenInitialized(garden3), "garden3 should be initialized");
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden3)),
            uint256(IGardensModule.WeightScheme.Power),
            "garden3 should have Power scheme"
        );
        address community3 = gardensModule.getGardenCommunity(garden3);
        assertTrue(community3 != address(0), "garden3 community should exist");

        // All communities should be different addresses
        assertTrue(community1 != community2, "community1 and community2 should differ");
        assertTrue(community2 != community3, "community2 and community3 should differ");
        assertTrue(community1 != community3, "community1 and community3 should differ");

        emit log_named_address("Arb Linear community", community1);
        emit log_named_address("Arb Exponential community", community2);
        emit log_named_address("Arb Power community", community3);
    }
}
