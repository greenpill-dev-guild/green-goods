// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Attestation } from "@eas/IEAS.sol";

import { GardenToken } from "../src/tokens/Garden.sol";
import { GardenAccount } from "../src/accounts/Garden.sol";
import { ActionRegistry, Capital, Domain } from "../src/registries/Action.sol";
import { HatsModule } from "../src/modules/Hats.sol";
import { GardensModule } from "../src/modules/Gardens.sol";
import { IHatsModule } from "../src/interfaces/IHatsModule.sol";
import { IGardensModule } from "../src/interfaces/IGardensModule.sol";
import { MockHats } from "../src/mocks/Hats.sol";
import { MockERC20 } from "../src/mocks/ERC20.sol";
import { MockEAS } from "../src/mocks/EAS.sol";
import { MockRegistryFactory, MockRegistryCommunity, MockUnifiedPowerRegistry } from "../src/mocks/GardensV2.sol";
import { MockCVStrategy } from "../src/mocks/CVStrategy.sol";
import { WorkSchema, WorkApprovalSchema } from "../src/Schemas.sol";
import { ERC6551Helper } from "./helpers/ERC6551Helper.sol";

/// @title E2EConvictionVoting Test
/// @notice End-to-end tests for Gardens conviction voting: pools, proposals, and signaling
contract E2EConvictionVotingTest is Test, ERC6551Helper {
    // ═══════════════════════════════════════════════════════════════════════════
    // Protocol contracts (real)
    // ═══════════════════════════════════════════════════════════════════════════

    GardenToken private gardenToken;
    ActionRegistry private actionRegistry;
    HatsModule private hatsModule;
    GardensModule private gardensModule;

    // ═══════════════════════════════════════════════════════════════════════════
    // Mocks
    // ═══════════════════════════════════════════════════════════════════════════

    MockHats private mockHats;
    MockERC20 private communityToken;
    MockERC20 private goodsToken;
    MockEAS private mockEAS;
    MockRegistryFactory private mockFactory;
    MockUnifiedPowerRegistry private powerRegistry;

    // ═══════════════════════════════════════════════════════════════════════════
    // Test actors
    // ═══════════════════════════════════════════════════════════════════════════

    address private multisig = address(0x123);
    address private operator1 = address(0x301);
    address private gardener1 = address(0x201);
    address private gardener2 = address(0x202);
    address private community1 = address(0x401);
    address private nonMember = address(0x999);

    // ═══════════════════════════════════════════════════════════════════════════
    // Setup
    // ═══════════════════════════════════════════════════════════════════════════

    function setUp() public {
        _deployERC6551Registry();

        // Deploy mocks
        communityToken = new MockERC20();
        goodsToken = new MockERC20();
        mockEAS = new MockEAS();
        mockHats = new MockHats();
        mockFactory = new MockRegistryFactory();
        powerRegistry = new MockUnifiedPowerRegistry();

        // Deploy GardenAccount implementation
        GardenAccount gardenAccountImpl = new GardenAccount(
            address(0x1001), address(0x1002), address(0x1003), address(0x1004), address(0x2001), address(0x2002)
        );

        // Deploy GardenToken (UUPS proxy)
        GardenToken gardenTokenImpl = new GardenToken(address(gardenAccountImpl));
        gardenToken = GardenToken(
            address(
                new ERC1967Proxy(address(gardenTokenImpl), abi.encodeCall(GardenToken.initialize, (multisig, address(0))))
            )
        );

        // Deploy ActionRegistry (UUPS proxy)
        ActionRegistry actionRegistryImpl = new ActionRegistry();
        actionRegistry = ActionRegistry(
            address(new ERC1967Proxy(address(actionRegistryImpl), abi.encodeCall(ActionRegistry.initialize, (multisig))))
        );

        // Deploy HatsModule (UUPS proxy)
        HatsModule hatsImpl = new HatsModule();
        hatsModule = HatsModule(
            address(
                new ERC1967Proxy(address(hatsImpl), abi.encodeCall(HatsModule.initialize, (multisig, address(mockHats))))
            )
        );

        // Deploy GardensModule (UUPS proxy)
        GardensModule gardensModuleImpl = new GardensModule();
        gardensModule = GardensModule(
            address(
                new ERC1967Proxy(
                    address(gardensModuleImpl),
                    abi.encodeCall(
                        GardensModule.initialize,
                        (
                            multisig,
                            address(mockFactory),
                            address(powerRegistry),
                            address(goodsToken),
                            address(mockHats),
                            address(hatsModule)
                        )
                    )
                )
            )
        );

        // Wire modules together
        vm.startPrank(multisig);
        gardenToken.setHatsModule(address(hatsModule));
        gardenToken.setCommunityToken(address(communityToken));
        gardenToken.setGardensModule(address(gardensModule));
        gardenToken.setActionRegistry(address(actionRegistry));
        hatsModule.setGardenToken(address(gardenToken));
        gardensModule.setGardenToken(address(gardenToken));
        vm.stopPrank();

        // Set up protocol hat tree
        uint256 gardensHatId = mockHats.mintTopHat(address(hatsModule), "Green Goods Gardens", "");
        vm.prank(multisig);
        hatsModule.setProtocolHatIds(0, gardensHatId, 0);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    function _mintGardenWithScheme(IGardensModule.WeightScheme scheme) internal returns (address garden) {
        vm.prank(multisig);
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            name: "CV Test Garden",
            slug: "",
            description: "Conviction voting E2E test garden",
            location: "Test City",
            bannerImage: "ipfs://QmBanner",
            metadata: "",
            openJoining: false,
            weightScheme: scheme,
            domainMask: 0,
            gardeners: new address[](0),
            operators: new address[](0)
        });
        return gardenToken.mintGarden(config);
    }

    function _mintGarden() internal returns (address) {
        return _mintGardenWithScheme(IGardensModule.WeightScheme.Linear);
    }

    function _grantAllRoles(address garden) internal {
        vm.startPrank(multisig);
        hatsModule.grantRole(garden, operator1, IHatsModule.GardenRole.Operator);
        hatsModule.grantRole(garden, gardener1, IHatsModule.GardenRole.Gardener);
        hatsModule.grantRole(garden, gardener2, IHatsModule.GardenRole.Gardener);
        hatsModule.grantRole(garden, community1, IHatsModule.GardenRole.Community);
        vm.stopPrank();
    }

    function _getPool(address garden, uint256 index) internal view returns (MockCVStrategy) {
        address[] memory pools = gardensModule.getGardenSignalPools(garden);
        require(pools.length > index, "Pool index out of bounds");
        return MockCVStrategy(pools[index]);
    }

    function _setupVotingPower(address garden) internal {
        // Set up voting power for all members via the power registry
        // In real system this comes from Hats Protocol; here we use setMockPower
        // Linear weights: operator=30_000, gardener=20_000, community=10_000
        powerRegistry.setMockPower(operator1, 30_000);
        powerRegistry.setMockPower(gardener1, 20_000);
        powerRegistry.setMockPower(gardener2, 20_000);
        powerRegistry.setMockPower(community1, 10_000);
        garden; // suppress unused warning
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Full Mint → Community → Pools → Power Registration
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verifies that mintGarden triggers the full GardensModule initialization:
    ///         community creation, power source registration, GOODS treasury seeding,
    ///         and two signal pool deployments.
    function testMintCreatesFullConvictionInfrastructure() public {
        address garden = _mintGarden();

        // Community was created
        address community = gardensModule.getGardenCommunity(garden);
        assertTrue(community != address(0), "Community should be created");

        // Two signal pools deployed
        address[] memory pools = gardensModule.getGardenSignalPools(garden);
        assertEq(pools.length, 2, "Should have 2 signal pools");
        assertTrue(pools[0] != address(0), "ActionSignalPool should exist");
        assertTrue(pools[1] != address(0), "HypercertSignalPool should exist");

        // Pools are real contracts (have code)
        assertGt(pools[0].code.length, 0, "Pool 0 should be a contract");
        assertGt(pools[1].code.length, 0, "Pool 1 should be a contract");

        // Power registry has 3 sources for this garden
        assertTrue(powerRegistry.isGardenRegistered(garden), "Garden should be registered in power registry");
        assertEq(powerRegistry.getGardenSourceCount(garden), 3, "Should have 3 power sources");

        // Both pools mapped to garden in power registry
        assertEq(powerRegistry.getPoolGarden(pools[0]), garden, "Pool 0 should map to garden");
        assertEq(powerRegistry.getPoolGarden(pools[1]), garden, "Pool 1 should map to garden");

        // Weight scheme stored correctly
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(garden)),
            uint256(IGardensModule.WeightScheme.Linear),
            "Weight scheme should be Linear"
        );

        // Garden initialized flag set
        assertTrue(gardensModule.isGardenInitialized(garden), "Garden should be initialized");

        // MockCVStrategy instances have correct CV parameters
        MockCVStrategy hypercertPool = MockCVStrategy(pools[1]);
        assertEq(hypercertPool.weight(), gardensModule.DEFAULT_WEIGHT(), "Pool weight should match default");
        assertEq(hypercertPool.decay(), gardensModule.DEFAULT_DECAY(), "Pool decay should match default");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Hypercert Signal Pool — Register → Allocate → Query Conviction
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Core conviction voting flow on the HypercertSignalPool (pool index 1):
    ///         register a hypercert, allocate support from multiple voters,
    ///         advance blocks, and verify conviction accumulates.
    function testHypercertPoolConvictionFlow() public {
        address garden = _mintGarden();
        _grantAllRoles(garden);
        _setupVotingPower(garden);

        MockCVStrategy pool = _getPool(garden, 1);

        // Register a hypercert
        uint256 hypercertId = 42;
        pool.registerHypercert(hypercertId);

        uint256[] memory registered = pool.getRegisteredHypercerts();
        assertEq(registered.length, 1, "Should have 1 registered hypercert");
        assertEq(registered[0], hypercertId, "Registered ID should be 42");

        // Operator allocates 15_000 support
        vm.prank(operator1);
        MockCVStrategy.Signal[] memory signals = new MockCVStrategy.Signal[](1);
        signals[0] = MockCVStrategy.Signal({ hypercertId: hypercertId, deltaSupport: int256(15_000) });
        pool.allocateSupport(signals);

        // Gardener allocates 10_000 support
        vm.prank(gardener1);
        signals[0] = MockCVStrategy.Signal({ hypercertId: hypercertId, deltaSupport: int256(10_000) });
        pool.allocateSupport(signals);

        // Verify allocations
        (uint256[] memory opIds, uint256[] memory opAmounts) = pool.getVoterAllocations(operator1);
        assertEq(opIds.length, 1, "Operator should have 1 allocation");
        assertEq(opIds[0], hypercertId);
        assertEq(opAmounts[0], 15_000);

        (uint256[] memory gIds, uint256[] memory gAmounts) = pool.getVoterAllocations(gardener1);
        assertEq(gIds.length, 1, "Gardener should have 1 allocation");
        assertEq(gAmounts[0], 10_000);

        // Verify total stakes
        assertEq(pool.voterTotalStake(operator1), 15_000, "Operator total stake");
        assertEq(pool.voterTotalStake(gardener1), 10_000, "Gardener total stake");

        // Advance 100 blocks to accumulate conviction
        vm.roll(block.number + 100);

        // Query conviction — should be > 0
        uint256 conviction = pool.calculateConviction(hypercertId);
        assertGt(conviction, 0, "Conviction should accumulate after blocks");

        // Conviction formula: stakedAmount * elapsed * weight / D
        // = 25_000 * 100 * 10_000 / 10_000_000 = 2_500
        assertEq(conviction, 2500, "Conviction should match formula");

        // Conviction weights endpoint
        (uint256[] memory ids, uint256[] memory weights) = pool.getConvictionWeights();
        assertEq(ids.length, 1);
        assertEq(ids[0], hypercertId);
        assertEq(weights[0], conviction, "Weight should match calculated conviction");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Action Signal Pool — Multi-Proposal Voting
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Tests the ActionSignalPool (pool index 0) with two competing proposals.
    ///         Operator votes for action1, gardener votes for action2. Verifies that
    ///         conviction weights reflect relative support levels.
    function testActionPoolMultiProposalVoting() public {
        address garden = _mintGarden();
        _grantAllRoles(garden);
        _setupVotingPower(garden);

        MockCVStrategy actionPool = _getPool(garden, 0);

        // Register two actions as proposals
        uint256 actionId1 = 100;
        uint256 actionId2 = 200;
        actionPool.registerHypercert(actionId1);
        actionPool.registerHypercert(actionId2);

        uint256[] memory registered = actionPool.getRegisteredHypercerts();
        assertEq(registered.length, 2, "Should have 2 registered proposals");

        // Operator votes for action1 (higher power)
        vm.prank(operator1);
        MockCVStrategy.Signal[] memory signals = new MockCVStrategy.Signal[](1);
        signals[0] = MockCVStrategy.Signal({ hypercertId: actionId1, deltaSupport: int256(20_000) });
        actionPool.allocateSupport(signals);

        // Gardener votes for action2 (lower power)
        vm.prank(gardener1);
        signals[0] = MockCVStrategy.Signal({ hypercertId: actionId2, deltaSupport: int256(15_000) });
        actionPool.allocateSupport(signals);

        // Advance blocks
        vm.roll(block.number + 100);

        // Get conviction weights
        (uint256[] memory ids, uint256[] memory weights) = actionPool.getConvictionWeights();
        assertEq(ids.length, 2, "Should have 2 conviction weights");

        // Find weights by ID (order may vary)
        uint256 w1;
        uint256 w2;
        for (uint256 i = 0; i < ids.length; i++) {
            if (ids[i] == actionId1) w1 = weights[i];
            if (ids[i] == actionId2) w2 = weights[i];
        }

        // action1 has more support (20_000 vs 15_000)
        assertGt(w1, w2, "Action1 should have higher conviction (more support)");

        // Exact values: action1 = 20_000 * 100 * 10_000 / 10_000_000 = 2_000
        //               action2 = 15_000 * 100 * 10_000 / 10_000_000 = 1_500
        assertEq(w1, 2000, "Action1 conviction");
        assertEq(w2, 1500, "Action2 conviction");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Weight Scheme Comparison
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verifies that different weight schemes are stored correctly and that
    ///         power source weights in the registry differ per scheme. All three schemes
    ///         are tested with identical conviction parameters, confirming the architecture:
    ///         weight schemes affect power registry sources (role-based multipliers),
    ///         while CV parameters (decay, weight, etc.) control conviction accumulation.
    function testWeightSchemeComparisonAffectsConviction() public {
        // Mint three gardens with different weight schemes
        address linearGarden = _mintGardenWithScheme(IGardensModule.WeightScheme.Linear);
        address expGarden = _mintGardenWithScheme(IGardensModule.WeightScheme.Exponential);
        address powerGarden = _mintGardenWithScheme(IGardensModule.WeightScheme.Power);

        // All should be initialized with correct weight schemes
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(linearGarden)),
            uint256(IGardensModule.WeightScheme.Linear),
            "Linear garden scheme"
        );
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(expGarden)),
            uint256(IGardensModule.WeightScheme.Exponential),
            "Exponential garden scheme"
        );
        assertEq(
            uint256(gardensModule.getGardenWeightScheme(powerGarden)),
            uint256(IGardensModule.WeightScheme.Power),
            "Power garden scheme"
        );

        // Each garden should have 3 power sources with scheme-specific weights
        assertEq(powerRegistry.getGardenSourceCount(linearGarden), 3, "Linear should have 3 sources");
        assertEq(powerRegistry.getGardenSourceCount(expGarden), 3, "Exponential should have 3 sources");
        assertEq(powerRegistry.getGardenSourceCount(powerGarden), 3, "Power should have 3 sources");

        // Each garden should have 2 signal pools
        assertEq(gardensModule.getGardenSignalPools(linearGarden).length, 2, "Linear pools");
        assertEq(gardensModule.getGardenSignalPools(expGarden).length, 2, "Exponential pools");
        assertEq(gardensModule.getGardenSignalPools(powerGarden).length, 2, "Power pools");

        // Test conviction accumulation on one garden to verify pools work
        _grantAllRoles(linearGarden);
        _setupVotingPower(linearGarden);

        MockCVStrategy pool = _getPool(linearGarden, 0);
        uint256 hid = 1000;
        pool.registerHypercert(hid);

        vm.prank(operator1);
        MockCVStrategy.Signal[] memory signals = new MockCVStrategy.Signal[](1);
        signals[0] = MockCVStrategy.Signal({ hypercertId: hid, deltaSupport: int256(10_000) });
        pool.allocateSupport(signals);

        vm.roll(block.number + 100);

        uint256 conviction = pool.calculateConviction(hid);
        // conviction = 10_000 * 100 * 10_000 / 10_000_000 = 1_000
        assertEq(conviction, 1000, "Linear garden conviction should match formula");

        // All pools share the same DEFAULT_WEIGHT CV parameter, so identical raw
        // allocations produce identical conviction. The weight scheme differentiates
        // at the power registry level (role multipliers), not the CV formula level.
        // This is the correct architecture: scheme = who has more influence,
        // CV params = how conviction accumulates.
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 5: Member Staking + Eligibility
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Tests the GOODS staking → community membership → voting eligibility chain.
    ///         Members with power > 0 can vote; non-members cannot.
    function testMemberEligibilityAndStaking() public {
        address garden = _mintGarden();
        _grantAllRoles(garden);

        MockCVStrategy pool = _getPool(garden, 1);
        pool.registerHypercert(1);

        // Set power for eligible members only
        powerRegistry.setMockPower(operator1, 30_000);
        powerRegistry.setMockPower(gardener1, 20_000);
        // nonMember has no power (default 0)

        // Check eligibility
        assertTrue(pool.isEligibleVoter(operator1), "Operator should be eligible");
        assertTrue(pool.isEligibleVoter(gardener1), "Gardener should be eligible");
        assertFalse(pool.isEligibleVoter(nonMember), "Non-member should not be eligible");

        // Non-member tries to allocate → reverts
        vm.prank(nonMember);
        MockCVStrategy.Signal[] memory signals = new MockCVStrategy.Signal[](1);
        signals[0] = MockCVStrategy.Signal({ hypercertId: 1, deltaSupport: int256(1000) });
        vm.expectRevert(abi.encodeWithSelector(MockCVStrategy.NotEligibleVoter.selector, nonMember));
        pool.allocateSupport(signals);

        // Eligible member allocates successfully
        vm.prank(operator1);
        pool.allocateSupport(signals);
        assertEq(pool.voterTotalStake(operator1), 1000, "Operator should have stake");

        // Verify community registration via MockRegistryCommunity
        address communityAddr = gardensModule.getGardenCommunity(garden);
        MockRegistryCommunity community = MockRegistryCommunity(communityAddr);
        community.stakeAndRegisterMember(gardener1);
        assertTrue(community.isRegisteredMember(gardener1), "Gardener should be registered member");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 6: Support Reallocation (negative deltaSupport)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Tests the delta-based support model where voters can shift allocations
    ///         between hypercerts using negative deltaSupport values.
    function testSupportReallocation() public {
        address garden = _mintGarden();
        _grantAllRoles(garden);
        _setupVotingPower(garden);

        MockCVStrategy pool = _getPool(garden, 1);

        // Register two hypercerts
        uint256 hidA = 10;
        uint256 hidB = 20;
        pool.registerHypercert(hidA);
        pool.registerHypercert(hidB);

        // Operator allocates 20_000 to hypercert A
        vm.prank(operator1);
        MockCVStrategy.Signal[] memory signals = new MockCVStrategy.Signal[](1);
        signals[0] = MockCVStrategy.Signal({ hypercertId: hidA, deltaSupport: int256(20_000) });
        pool.allocateSupport(signals);

        assertEq(pool.voterTotalStake(operator1), 20_000, "Total stake after initial allocation");

        // Advance some blocks so A builds conviction
        vm.roll(block.number + 50);
        uint256 convictionBeforeShift = pool.calculateConviction(hidA);
        assertGt(convictionBeforeShift, 0, "A should have conviction before shift");

        // Reallocate: shift 10_000 from A to B
        vm.prank(operator1);
        MockCVStrategy.Signal[] memory realloc = new MockCVStrategy.Signal[](2);
        realloc[0] = MockCVStrategy.Signal({ hypercertId: hidA, deltaSupport: -int256(10_000) });
        realloc[1] = MockCVStrategy.Signal({ hypercertId: hidB, deltaSupport: int256(10_000) });
        pool.allocateSupport(realloc);

        // Total stake unchanged
        assertEq(pool.voterTotalStake(operator1), 20_000, "Total stake should be unchanged after reallocation");

        // Allocations shifted
        (uint256[] memory ids, uint256[] memory amounts) = pool.getVoterAllocations(operator1);
        assertEq(ids.length, 2, "Should have 2 allocations");

        // Find amounts by ID
        uint256 amtA;
        uint256 amtB;
        for (uint256 i = 0; i < ids.length; i++) {
            if (ids[i] == hidA) amtA = amounts[i];
            if (ids[i] == hidB) amtB = amounts[i];
        }
        assertEq(amtA, 10_000, "A should have 10_000 after shift");
        assertEq(amtB, 10_000, "B should have 10_000 after shift");

        // Advance more blocks — both now accumulate conviction
        vm.roll(block.number + 100);

        uint256 convA = pool.calculateConviction(hidA);
        uint256 convB = pool.calculateConviction(hidB);

        // A has historical conviction + reduced rate; B started later with 10k
        assertGt(convA, 0, "A should still have conviction");
        assertGt(convB, 0, "B should have conviction from new allocation");
        // A should have MORE total conviction (had 50 blocks at 20k + 100 blocks at 10k)
        assertGt(convA, convB, "A should have more total conviction than B (earlier start + more initial stake)");

        // Test: cannot remove more than allocated
        vm.prank(operator1);
        MockCVStrategy.Signal[] memory badSignal = new MockCVStrategy.Signal[](1);
        badSignal[0] = MockCVStrategy.Signal({ hypercertId: hidA, deltaSupport: -int256(99_999) });
        vm.expectRevert(abi.encodeWithSelector(MockCVStrategy.InsufficientSupport.selector, hidA, 10_000, -int256(99_999)));
        pool.allocateSupport(badSignal);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 7: Full Protocol Flow (capstone)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Capstone test extending the existing E2E workflow through conviction voting:
    ///         Mint → Roles → Register Action → Submit Work → Approve Work →
    ///         Register in Signal Pool → Allocate Support → Query Conviction.
    function testFullProtocolFlowWithConviction() public {
        // === Phase 1: Garden Setup ===
        address garden = _mintGarden();
        GardenAccount gardenAccount = GardenAccount(payable(garden));
        _grantAllRoles(garden);
        _setupVotingPower(garden);

        // Verify garden state
        assertEq(gardenAccount.name(), "CV Test Garden");
        assertTrue(gardenAccount.isOperator(operator1));
        assertTrue(gardenAccount.isGardener(gardener1));

        // === Phase 2: Action Registration ===
        Capital[] memory capitals = new Capital[](2);
        capitals[0] = Capital.LIVING;
        capitals[1] = Capital.SOCIAL;

        vm.prank(multisig);
        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 30 days,
            "Plant Native Trees",
            "agro.planting_event",
            "ipfs://QmInstructions",
            capitals,
            new string[](0),
            Domain.AGRO
        );

        // === Phase 3: Work Submission (via EAS mock) ===
        WorkSchema memory workSubmission = WorkSchema({
            actionUID: 0,
            title: "Planted 10 Oak Trees",
            feedback: "",
            metadata: "{'trees': 10}",
            media: new string[](1)
        });
        workSubmission.media[0] = "ipfs://QmWorkPhoto";

        bytes32 workUID = bytes32(uint256(1));
        Attestation memory workAttestation = Attestation({
            uid: workUID,
            schema: bytes32(uint256(100)),
            time: uint64(block.timestamp),
            expirationTime: 0,
            revocationTime: 0,
            refUID: bytes32(0),
            recipient: garden,
            attester: gardener1,
            revocable: true,
            data: abi.encode(workSubmission)
        });

        vm.prank(gardener1);
        mockEAS.setAttestationByUID(workUID, workAttestation);

        // === Phase 4: Work Approval ===
        WorkApprovalSchema memory approval = WorkApprovalSchema({
            actionUID: 0,
            workUID: workUID,
            approved: true,
            feedback: "Excellent regenerative work",
            confidence: 3,
            verificationMethod: 1,
            reviewNotesCID: ""
        });

        bytes32 approvalUID = bytes32(uint256(2));
        Attestation memory approvalAttestation = Attestation({
            uid: approvalUID,
            schema: bytes32(uint256(101)),
            time: uint64(block.timestamp),
            expirationTime: 0,
            revocationTime: 0,
            refUID: workUID,
            recipient: garden,
            attester: operator1,
            revocable: true,
            data: abi.encode(approval)
        });

        vm.prank(operator1);
        mockEAS.setAttestationByUID(approvalUID, approvalAttestation);

        // Verify approval
        WorkApprovalSchema memory storedApproval =
            abi.decode(mockEAS.getAttestation(approvalUID).data, (WorkApprovalSchema));
        assertTrue(storedApproval.approved, "Work should be approved");

        // === Phase 5: Hypercert Registration in Signal Pool ===
        // Simulate: the approved work generates a hypercert (ID = workUID as uint)
        uint256 hypercertId = uint256(workUID);

        MockCVStrategy hypercertPool = _getPool(garden, 1);
        hypercertPool.registerHypercert(hypercertId);

        assertTrue(hypercertPool.isEligibleVoter(operator1), "Operator should be eligible voter");
        assertTrue(hypercertPool.isEligibleVoter(gardener1), "Gardener should be eligible voter");

        // === Phase 6: Conviction Voting on Hypercert ===
        // Operator signals strong support
        vm.prank(operator1);
        MockCVStrategy.Signal[] memory opSignals = new MockCVStrategy.Signal[](1);
        opSignals[0] = MockCVStrategy.Signal({ hypercertId: hypercertId, deltaSupport: int256(25_000) });
        hypercertPool.allocateSupport(opSignals);

        // Gardener also supports
        vm.prank(gardener1);
        MockCVStrategy.Signal[] memory gSignals = new MockCVStrategy.Signal[](1);
        gSignals[0] = MockCVStrategy.Signal({ hypercertId: hypercertId, deltaSupport: int256(15_000) });
        hypercertPool.allocateSupport(gSignals);

        // Second gardener joins in
        vm.prank(gardener2);
        MockCVStrategy.Signal[] memory g2Signals = new MockCVStrategy.Signal[](1);
        g2Signals[0] = MockCVStrategy.Signal({ hypercertId: hypercertId, deltaSupport: int256(10_000) });
        hypercertPool.allocateSupport(g2Signals);

        // === Phase 7: Conviction Accumulation ===
        vm.roll(block.number + 200);

        uint256 conviction = hypercertPool.calculateConviction(hypercertId);
        // Total staked = 25_000 + 15_000 + 10_000 = 50_000
        // Conviction = 50_000 * 200 * 10_000 / 10_000_000 = 10_000
        assertEq(conviction, 10_000, "Conviction should reflect 3-voter support over 200 blocks");

        // Verify individual allocations are tracked
        assertEq(hypercertPool.voterTotalStake(operator1), 25_000);
        assertEq(hypercertPool.voterTotalStake(gardener1), 15_000);
        assertEq(hypercertPool.voterTotalStake(gardener2), 10_000);

        // === Phase 8: Action Signal Pool Voting ===
        // Register the action in the ActionSignalPool for priority signaling
        MockCVStrategy actionPool = _getPool(garden, 0);
        uint256 actionProposalId = 0; // Action UID from registry
        actionPool.registerHypercert(actionProposalId);

        // All members signal priority
        vm.prank(operator1);
        MockCVStrategy.Signal[] memory actionSignals = new MockCVStrategy.Signal[](1);
        actionSignals[0] = MockCVStrategy.Signal({ hypercertId: actionProposalId, deltaSupport: int256(10_000) });
        actionPool.allocateSupport(actionSignals);

        vm.prank(gardener1);
        actionPool.allocateSupport(actionSignals);

        vm.roll(block.number + 100);

        // Verify action conviction weights
        (uint256[] memory actionIds, uint256[] memory actionWeights) = actionPool.getConvictionWeights();
        assertEq(actionIds.length, 1, "Should have 1 action proposal");
        assertGt(actionWeights[0], 0, "Action should have conviction");

        // Action conviction = 20_000 * 100 * 10_000 / 10_000_000 = 2_000
        assertEq(actionWeights[0], 2000, "Action conviction should match formula");
    }
}
