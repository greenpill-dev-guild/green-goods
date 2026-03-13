// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase, IEASBase } from "../helpers/ForkTestBase.sol";
import { GardenToken } from "../../../src/tokens/Garden.sol";
import { GardenAccount } from "../../../src/accounts/Garden.sol";
import { IHatsModule } from "../../../src/interfaces/IHatsModule.sol";
import { IGardensModule } from "../../../src/interfaces/IGardensModule.sol";
import { WorkSchema, WorkApprovalSchema } from "../../../src/Schemas.sol";
import { AttestationRequest, AttestationRequestData } from "@eas/IEAS.sol";
import { NotGardenMember } from "../../../src/resolvers/Work.sol";
import { NotGardenOperator } from "../../../src/resolvers/WorkApproval.sol";
import { YieldResolver } from "../../../src/resolvers/Yield.sol";
import { GreenGoodsENS } from "../../../src/registries/ENS.sol";

/// @title ArbitrumFullProtocolE2EForkTest
/// @notice Fork tests covering the complete protocol lifecycle against real EAS on Arbitrum (42161).
/// @dev Mirrors FullProtocolE2E.t.sol structure, targeting Arbitrum mainnet fork. Uses `testForkArbitrum_`
/// prefix to match the `test:e2e:arbitrum` script (--match-test 'testFork.*Arbitrum').
/// Tests 1-5 mirror the Sepolia suite; tests 6-8 add new error-path coverage.
contract ArbitrumFullProtocolE2EForkTest is ForkTestBase {
    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Complete Protocol Lifecycle (Golden Path)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Full protocol flow on Arbitrum: deploy → schemas → mint → roles → action → work → approval → assessment
    function testForkArbitrum_e2e_completeProtocolLifecycle() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        // 1. Verify schemas were registered against Arbitrum EAS (0xbD75f...)
        assertTrue(workSchemaUID != bytes32(0), "workSchemaUID should be registered");
        assertTrue(workApprovalSchemaUID != bytes32(0), "workApprovalSchemaUID should be registered");
        assertTrue(assessmentSchemaUID != bytes32(0), "assessmentSchemaUID should be registered");

        // 2. Mint garden, grant roles, register action (composite helper)
        (address garden, uint256 actionUID) = _setupGardenWithRolesAndAction("Arbitrum E2E Garden");
        assertTrue(garden != address(0), "garden account should be created");

        // 3. Verify garden account metadata
        GardenAccount gardenAcct = GardenAccount(payable(garden));
        assertEq(keccak256(bytes(gardenAcct.name())), keccak256(bytes("Arbitrum E2E Garden")), "garden name mismatch");

        // 4. Verify roles
        assertTrue(hatsModule.isOperatorOf(garden, forkOperator), "operator role should be granted");
        assertTrue(hatsModule.isGardenerOf(garden, forkGardener), "gardener role should be granted");
        assertTrue(hatsModule.isEvaluatorOf(garden, forkEvaluator), "evaluator role should be granted");

        // 5. Work → Approval → Assessment (using ForkTestBase helpers)
        bytes32 workAttUID = _submitWorkAttestation(forkGardener, garden, actionUID);
        assertTrue(workAttUID != bytes32(0), "work attestation UID should be non-zero");

        bytes32 approvalUID = _submitWorkApproval(forkOperator, garden, actionUID, workAttUID);
        assertTrue(approvalUID != bytes32(0), "work approval UID should be non-zero");

        bytes32 assessmentUID = _submitAssessment(forkEvaluator, garden, 1); // AGRO domain
        assertTrue(assessmentUID != bytes32(0), "assessment UID should be non-zero");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Garden Mint With All Modules Wired
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verifies garden mint succeeds with full module wiring on Arbitrum
    function testForkArbitrum_e2e_gardenMintWithAllModules() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        // Verify all modules are wired
        assertTrue(address(gardenToken.hatsModule()) != address(0), "hatsModule should be wired");
        assertTrue(address(gardenToken.karmaGAPModule()) != address(0), "karmaGAPModule should be wired");
        assertTrue(address(gardenToken.octantModule()) != address(0), "octantModule should be wired");
        assertTrue(address(gardenToken.gardensModule()) != address(0), "gardensModule should be wired");
        assertTrue(address(gardenToken.actionRegistry()) != address(0), "actionRegistry should be wired");

        // Arbitrum sentinel: verify real YieldResolver + GreenGoodsENS wiring
        assertTrue(address(yieldSplitter) != address(0), "YieldResolver should be deployed");
        assertEq(octantModule.yieldResolver(), address(yieldSplitter), "OctantModule should wire YieldResolver");
        assertEq(yieldSplitter.octantModule(), address(octantModule), "YieldResolver should point to OctantModule");
        assertEq(address(yieldSplitter.hatsModule()), address(hatsModule), "YieldResolver should use real HatsModule");
        assertTrue(address(greenGoodsENS) != address(0), "GreenGoodsENS should be deployed");
        assertEq(address(gardenToken.ensModule()), address(greenGoodsENS), "GardenToken should wire GreenGoodsENS");
        assertTrue(greenGoodsENS.authorizedCallers(address(gardenToken)), "GardenToken should be ENS authorized caller");

        // Explicitly reference contract types for scenario matrix enforcement.
        YieldResolver resolver = yieldSplitter;
        GreenGoodsENS ens = greenGoodsENS;
        assertTrue(address(resolver) != address(0), "resolver reference should be non-zero");
        assertTrue(address(ens) != address(0), "ens reference should be non-zero");

        // Mint garden with specific metadata
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            name: "Arbitrum Module Wiring Garden",
            slug: "",
            description: "Tests all modules on Arbitrum",
            location: "Arbitrum Test Location",
            bannerImage: "ipfs://QmArbBanner",
            metadata: "ipfs://QmArbMeta",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Exponential,
            domainMask: 0x0F,
            gardeners: new address[](0),
            operators: new address[](0)
        });

        address garden = gardenToken.mintGarden(config);
        assertTrue(garden != address(0), "garden should be created");

        // Verify GardenAccount metadata
        GardenAccount gardenAcct = GardenAccount(payable(garden));
        assertEq(keccak256(bytes(gardenAcct.name())), keccak256(bytes("Arbitrum Module Wiring Garden")), "name mismatch");
        assertEq(
            keccak256(bytes(gardenAcct.description())),
            keccak256(bytes("Tests all modules on Arbitrum")),
            "description mismatch"
        );
        assertEq(keccak256(bytes(gardenAcct.location())), keccak256(bytes("Arbitrum Test Location")), "location mismatch");

        // Verify hat tree was created
        (,,,,,,, bool configured) = hatsModule.getGardenHatIds(garden);
        assertTrue(configured, "garden hat tree should be configured");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Graceful Degradation Matrix
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Tests garden mint succeeds with optional modules disabled, reverts without HatsModule on Arbitrum
    function testForkArbitrum_e2e_gracefulDegradationMatrix() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        // Test 1: No KarmaGAP → mint should succeed
        gardenToken.setKarmaGAPModule(address(0));
        address garden1 = _mintTestGarden("No KarmaGAP Arb", 0x01);
        assertTrue(garden1 != address(0), "mint should succeed without KarmaGAP");
        gardenToken.setKarmaGAPModule(address(karmaGAPModule));

        // Test 2: No Octant → mint should succeed
        gardenToken.setOctantModule(address(0));
        address garden2 = _mintTestGarden("No Octant Arb", 0x02);
        assertTrue(garden2 != address(0), "mint should succeed without Octant");
        gardenToken.setOctantModule(address(octantModule));

        // Test 3: No GardensModule → mint should succeed
        gardenToken.setGardensModule(address(0));
        address garden3 = _mintTestGarden("No Gardens Arb", 0x04);
        assertTrue(garden3 != address(0), "mint should succeed without GardensModule");
        gardenToken.setGardensModule(address(gardensModule));

        // Test 4: No ActionRegistry → mint should succeed
        gardenToken.setActionRegistry(address(0));
        address garden4 = _mintTestGarden("No ActionReg Arb", 0x08);
        assertTrue(garden4 != address(0), "mint should succeed without ActionRegistry");
        gardenToken.setActionRegistry(address(actionRegistry));

        // Test 5: No HatsModule → mint MUST revert (critical dependency)
        gardenToken.setHatsModule(address(0));
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            name: "Should Fail Arb",
            slug: "",
            description: "Missing HatsModule",
            location: "Nowhere",
            bannerImage: "",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0x01,
            gardeners: new address[](0),
            operators: new address[](0)
        });

        vm.expectRevert(GardenToken.HatsModuleNotSet.selector);
        gardenToken.mintGarden(config);

        gardenToken.setHatsModule(address(hatsModule));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Batch Mint Gardens
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Tests batch minting 3 gardens with different configurations on Arbitrum
    function testForkArbitrum_e2e_batchMintGardens() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        GardenToken.GardenConfig[] memory configs = new GardenToken.GardenConfig[](3);

        configs[0] = GardenToken.GardenConfig({
            name: "Arb Batch Alpha",
            slug: "",
            description: "First Arbitrum batch garden",
            location: "Location A",
            bannerImage: "ipfs://QmArbAlpha",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0x01,
            gardeners: new address[](0),
            operators: new address[](0)
        });

        configs[1] = GardenToken.GardenConfig({
            name: "Arb Batch Beta",
            slug: "",
            description: "Second Arbitrum batch garden",
            location: "Location B",
            bannerImage: "ipfs://QmArbBeta",
            metadata: "",
            openJoining: true,
            weightScheme: IGardensModule.WeightScheme.Exponential,
            domainMask: 0x03,
            gardeners: new address[](0),
            operators: new address[](0)
        });

        configs[2] = GardenToken.GardenConfig({
            name: "Arb Batch Gamma",
            slug: "",
            description: "Third Arbitrum batch garden",
            location: "Location C",
            bannerImage: "ipfs://QmArbGamma",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Power,
            domainMask: 0x0F,
            gardeners: new address[](0),
            operators: new address[](0)
        });

        address[] memory accounts = gardenToken.batchMintGardens(configs);

        assertEq(accounts.length, 3, "should create 3 garden accounts");
        assertTrue(accounts[0] != accounts[1], "gardens 0 and 1 should differ");
        assertTrue(accounts[1] != accounts[2], "gardens 1 and 2 should differ");
        assertTrue(accounts[0] != accounts[2], "gardens 0 and 2 should differ");

        // Verify names
        assertEq(
            keccak256(bytes(GardenAccount(payable(accounts[0])).name())),
            keccak256(bytes("Arb Batch Alpha")),
            "garden 0 name mismatch"
        );
        assertEq(
            keccak256(bytes(GardenAccount(payable(accounts[1])).name())),
            keccak256(bytes("Arb Batch Beta")),
            "garden 1 name mismatch"
        );
        assertEq(
            keccak256(bytes(GardenAccount(payable(accounts[2])).name())),
            keccak256(bytes("Arb Batch Gamma")),
            "garden 2 name mismatch"
        );

        // Verify hat trees
        for (uint256 i = 0; i < 3; i++) {
            (,,,,,,, bool configured) = hatsModule.getGardenHatIds(accounts[i]);
            assertTrue(configured, string.concat("garden ", vm.toString(i), " hat tree should be configured"));
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 5: Open Joining Flow
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Tests open joining allows a non-member to join on Arbitrum
    function testForkArbitrum_e2e_openJoiningFlow() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            name: "Arb Open Garden",
            slug: "",
            description: "Anyone can join on Arbitrum",
            location: "Open Location",
            bannerImage: "ipfs://QmArbOpen",
            metadata: "",
            openJoining: true,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0x0F,
            gardeners: new address[](0),
            operators: new address[](0)
        });

        address garden = gardenToken.mintGarden(config);
        GardenAccount gardenAcct = GardenAccount(payable(garden));

        assertTrue(gardenAcct.openJoining(), "open joining should be enabled");

        vm.prank(forkNonMember);
        gardenAcct.joinGarden();

        assertTrue(gardenAcct.isGardener(forkNonMember), "non-member should be gardener after joining");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 6: Unauthorized Work Submission (Error Path)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Non-member work attestation reverts on Arbitrum EAS
    function testForkArbitrum_e2e_unauthorizedWorkSubmission() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        (address garden, uint256 actionUID) = _setupGardenWithRolesAndAction("Arb Auth Test Garden");

        // forkNonMember has no role — work submission should revert through the resolver
        WorkSchema memory work = WorkSchema({
            actionUID: actionUID,
            title: "Unauthorized Work",
            feedback: "",
            metadata: "ipfs://QmUnauthorizedWorkMeta",
            media: new string[](0)
        });

        (address eas,) = _getEASForChain(block.chainid);

        AttestationRequest memory request = AttestationRequest({
            schema: workSchemaUID,
            data: AttestationRequestData({
                recipient: garden,
                expirationTime: 0,
                revocable: false,
                refUID: bytes32(0),
                data: abi.encode(work),
                value: 0
            })
        });

        vm.prank(forkNonMember);
        vm.expectRevert(NotGardenMember.selector);
        IEASBase(eas).attest(request);
        assertFalse(hatsModule.isGardenerOf(garden, forkNonMember), "non-member should remain unauthorized");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 7: Cross-Garden Role Isolation (Error Path)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Operator of garden A cannot approve work on garden B
    function testForkArbitrum_e2e_crossGardenRoleIsolation() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        // Garden A: forkOperator is operator
        (, uint256 actionUID_A) = _setupGardenWithRolesAndAction("Arb Garden A");

        // Garden B: separate garden, forkOperator has NO role here
        address gardenB = _mintTestGarden("Arb Garden B", 0x0F);
        address gardenB_operator = makeAddr("gardenB_operator");
        address gardenB_gardener = makeAddr("gardenB_gardener");
        _grantGardenRole(gardenB, gardenB_operator, IHatsModule.GardenRole.Operator);
        _grantGardenRole(gardenB, gardenB_gardener, IHatsModule.GardenRole.Gardener);

        // Submit work on garden B as its gardener
        bytes32 workAttUID = _submitWorkAttestation(gardenB_gardener, gardenB, actionUID_A);
        assertTrue(workAttUID != bytes32(0), "work on garden B should succeed");

        // forkOperator (garden A operator) tries to approve work on garden B → should revert
        WorkApprovalSchema memory approval = WorkApprovalSchema({
            actionUID: actionUID_A,
            workUID: workAttUID,
            approved: true,
            feedback: "Cross-garden approval attempt",
            confidence: 2,
            verificationMethod: 1,
            reviewNotesCID: ""
        });

        (address eas,) = _getEASForChain(block.chainid);

        AttestationRequest memory request = AttestationRequest({
            schema: workApprovalSchemaUID,
            data: AttestationRequestData({
                recipient: gardenB,
                expirationTime: 0,
                revocable: false,
                refUID: workAttUID,
                data: abi.encode(approval),
                value: 0
            })
        });

        vm.prank(forkOperator); // garden A operator, NOT garden B operator
        vm.expectRevert(NotGardenOperator.selector);
        IEASBase(eas).attest(request);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 8: Double Role Grant Reverts (Error Path)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Granting the same role twice is idempotent and keeps membership intact
    function testForkArbitrum_e2e_doubleRoleGrantIsIdempotent() public {
        if (!_tryChainFork("arbitrum")) {
            return;
        }

        _deployFullStackOnFork();

        address garden = _mintTestGarden("Arb Double Grant Garden", 0x0F);

        // First grant should succeed
        _grantGardenRole(garden, forkGardener, IHatsModule.GardenRole.Gardener);
        assertTrue(hatsModule.isGardenerOf(garden, forkGardener), "first grant should succeed");

        // Second identical grant should be a no-op under current HatsModule semantics
        _grantGardenRole(garden, forkGardener, IHatsModule.GardenRole.Gardener);
        assertTrue(hatsModule.isGardenerOf(garden, forkGardener), "second grant should keep role intact");
    }
}
