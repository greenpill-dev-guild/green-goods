// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { ForkTestBase, IEASBase } from "../helpers/ForkTestBase.sol";
import { AttestationRequest, AttestationRequestData } from "@eas/IEAS.sol";
import { WorkSchema, WorkApprovalSchema, AssessmentSchema } from "../../../src/Schemas.sol";
import { GardenToken } from "../../../src/tokens/Garden.sol";
import { GardenAccount } from "../../../src/accounts/Garden.sol";
import { IHatsModule } from "../../../src/interfaces/IHatsModule.sol";
import { IGardensModule } from "../../../src/interfaces/IGardensModule.sol";
import { NotGardenMember } from "../../../src/resolvers/Work.sol";
import { NotGardenOperator } from "../../../src/resolvers/WorkApproval.sol";

/// @title FullProtocolE2EForkTest
/// @notice Fork tests covering the complete protocol lifecycle against real EAS infrastructure.
/// @dev Deploys the full stack on a forked chain and exercises garden minting, role grants,
/// action registration, work submission, work approval, and assessment attestation.
contract FullProtocolE2EForkTest is ForkTestBase {
    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Complete Protocol Lifecycle (Golden Path)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Exercises the full protocol flow: deploy -> mint -> roles -> action -> work -> approval -> assessment
    function test_fork_e2e_completeProtocolLifecycle() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();

        // 1. Verify schemas were registered
        assertTrue(workSchemaUID != bytes32(0), "workSchemaUID should be registered");
        assertTrue(workApprovalSchemaUID != bytes32(0), "workApprovalSchemaUID should be registered");
        assertTrue(assessmentSchemaUID != bytes32(0), "assessmentSchemaUID should be registered");

        // 2. Mint garden with all domains enabled (0x0F = bits 0-3)
        address garden = _mintTestGarden("E2E Garden", 0x0F);
        assertTrue(garden != address(0), "garden account should be created");

        // 3. Verify garden account metadata
        GardenAccount gardenAcct = GardenAccount(payable(garden));
        assertEq(keccak256(bytes(gardenAcct.name())), keccak256(bytes("E2E Garden")), "garden name should match");

        // 4. Grant roles: operator, gardener, evaluator
        _grantGardenRole(garden, forkOperator, IHatsModule.GardenRole.Operator);
        _grantGardenRole(garden, forkGardener, IHatsModule.GardenRole.Gardener);
        _grantGardenRole(garden, forkEvaluator, IHatsModule.GardenRole.Evaluator);

        // Verify roles
        assertTrue(hatsModule.isOperatorOf(garden, forkOperator), "operator role should be granted");
        assertTrue(hatsModule.isGardenerOf(garden, forkGardener), "gardener role should be granted");
        assertTrue(hatsModule.isEvaluatorOf(garden, forkEvaluator), "evaluator role should be granted");

        // 5. Register an action
        uint256 actionUID = _registerTestAction();

        // 6. Submit work via EAS attest (as gardener)
        (address eas,) = _getEASForChain(block.chainid);

        WorkSchema memory workData = WorkSchema({
            actionUID: actionUID,
            title: "E2E Work Submission",
            feedback: "Planted native species",
            metadata: "ipfs://QmE2EWorkMeta",
            media: new string[](0)
        });

        AttestationRequest memory workRequest = AttestationRequest({
            schema: workSchemaUID,
            data: AttestationRequestData({
                recipient: garden,
                expirationTime: 0,
                revocable: false, // Work schema is non-revocable per schemas.json
                refUID: bytes32(0),
                data: abi.encode(workData),
                value: 0
            })
        });

        vm.prank(forkGardener);
        bytes32 workAttestUID = IEASBase(eas).attest(workRequest);
        assertTrue(workAttestUID != bytes32(0), "work attestation UID should be non-zero");

        // 7. Approve work via EAS attest (as operator)
        WorkApprovalSchema memory approvalData = WorkApprovalSchema({
            actionUID: actionUID,
            workUID: workAttestUID,
            approved: true,
            feedback: "Good work",
            confidence: 2, // MEDIUM
            verificationMethod: 1, // Direct observation
            reviewNotesCID: "ipfs://QmE2EReviewNotes"
        });

        AttestationRequest memory approvalRequest = AttestationRequest({
            schema: workApprovalSchemaUID,
            data: AttestationRequestData({
                recipient: garden,
                expirationTime: 0,
                revocable: false, // Work approval schema is non-revocable per schemas.json
                refUID: workAttestUID,
                data: abi.encode(approvalData),
                value: 0
            })
        });

        vm.prank(forkOperator);
        bytes32 approvalAttestUID = IEASBase(eas).attest(approvalRequest);
        assertTrue(approvalAttestUID != bytes32(0), "work approval attestation UID should be non-zero");

        // 8. Create assessment via EAS attest (as evaluator)
        AssessmentSchema memory assessmentData = AssessmentSchema({
            title: "E2E Assessment",
            description: "Quarterly biodiversity assessment",
            assessmentConfigCID: "ipfs://QmE2EAssessmentConfig",
            domain: 1, // AGRO
            startDate: block.timestamp,
            endDate: block.timestamp + 30 days,
            location: "E2E Garden Site"
        });

        AttestationRequest memory assessmentRequest = AttestationRequest({
            schema: assessmentSchemaUID,
            data: AttestationRequestData({
                recipient: garden,
                expirationTime: 0,
                revocable: false, // Assessment schema is non-revocable per schemas.json
                refUID: bytes32(0),
                data: abi.encode(assessmentData),
                value: 0
            })
        });

        vm.prank(forkEvaluator);
        bytes32 assessmentAttestUID = IEASBase(eas).attest(assessmentRequest);
        assertTrue(assessmentAttestUID != bytes32(0), "assessment attestation UID should be non-zero");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Garden Mint With All Modules Wired
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Verifies garden mint succeeds with full module wiring and metadata is correct
    function test_fork_e2e_gardenMintWithAllModules() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();

        // Verify all modules are wired
        assertTrue(address(gardenToken.hatsModule()) != address(0), "hatsModule should be wired");
        assertTrue(address(gardenToken.karmaGAPModule()) != address(0), "karmaGAPModule should be wired");
        assertTrue(address(gardenToken.octantModule()) != address(0), "octantModule should be wired");
        assertTrue(address(gardenToken.gardensModule()) != address(0), "gardensModule should be wired");
        assertTrue(address(gardenToken.actionRegistry()) != address(0), "actionRegistry should be wired");

        // Mint garden with specific metadata
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            name: "Module Wiring Garden",
            slug: "",
            description: "Tests all modules",
            location: "Test Location Alpha",
            bannerImage: "ipfs://QmBanner123",
            metadata: "ipfs://QmMeta456",
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
        assertEq(keccak256(bytes(gardenAcct.name())), keccak256(bytes("Module Wiring Garden")), "name mismatch");
        assertEq(keccak256(bytes(gardenAcct.description())), keccak256(bytes("Tests all modules")), "description mismatch");
        assertEq(keccak256(bytes(gardenAcct.location())), keccak256(bytes("Test Location Alpha")), "location mismatch");
        assertEq(keccak256(bytes(gardenAcct.bannerImage())), keccak256(bytes("ipfs://QmBanner123")), "bannerImage mismatch");

        // Verify hat tree was created (configured flag should be true)
        (,,,,,,, bool configured) = hatsModule.getGardenHatIds(garden);
        assertTrue(configured, "garden hat tree should be configured");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Graceful Degradation Matrix
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Tests garden mint succeeds with optional modules disabled, reverts without HatsModule
    function test_fork_e2e_gracefulDegradationMatrix() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();

        // Test 1: No KarmaGAP -- mint should succeed
        gardenToken.setKarmaGAPModule(address(0));
        address garden1 = _mintTestGarden("No KarmaGAP Garden", 0x01);
        assertTrue(garden1 != address(0), "mint should succeed without KarmaGAP");

        // Restore KarmaGAP for next test
        gardenToken.setKarmaGAPModule(address(karmaGAPModule));

        // Test 2: No Octant -- mint should succeed
        gardenToken.setOctantModule(address(0));
        address garden2 = _mintTestGarden("No Octant Garden", 0x02);
        assertTrue(garden2 != address(0), "mint should succeed without Octant");

        // Restore Octant for next test
        gardenToken.setOctantModule(address(octantModule));

        // Test 3: No GardensModule -- mint should succeed
        gardenToken.setGardensModule(address(0));
        address garden3 = _mintTestGarden("No Gardens Garden", 0x04);
        assertTrue(garden3 != address(0), "mint should succeed without GardensModule");

        // Restore GardensModule
        gardenToken.setGardensModule(address(gardensModule));

        // Test 4: No ActionRegistry -- mint should succeed (domainMask skipped)
        gardenToken.setActionRegistry(address(0));
        address garden4 = _mintTestGarden("No ActionRegistry Garden", 0x08);
        assertTrue(garden4 != address(0), "mint should succeed without ActionRegistry");

        // Restore ActionRegistry
        gardenToken.setActionRegistry(address(actionRegistry));

        // Test 5: No HatsModule -- mint MUST revert (critical dependency)
        gardenToken.setHatsModule(address(0));
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            name: "Should Fail",
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

        // Restore for safety
        gardenToken.setHatsModule(address(hatsModule));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Batch Mint Gardens
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Tests batch minting 3 gardens with different configurations
    function test_fork_e2e_batchMintGardens() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();

        // Create 3 configs with different names, weight schemes, and domain masks
        GardenToken.GardenConfig[] memory configs = new GardenToken.GardenConfig[](3);

        configs[0] = GardenToken.GardenConfig({
            name: "Batch Garden Alpha",
            slug: "",
            description: "First batch garden",
            location: "Location A",
            bannerImage: "ipfs://QmAlpha",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0x01, // SOLAR only
            gardeners: new address[](0),
            operators: new address[](0)
        });

        configs[1] = GardenToken.GardenConfig({
            name: "Batch Garden Beta",
            slug: "",
            description: "Second batch garden",
            location: "Location B",
            bannerImage: "ipfs://QmBeta",
            metadata: "",
            openJoining: true,
            weightScheme: IGardensModule.WeightScheme.Exponential,
            domainMask: 0x03, // SOLAR + AGRO
            gardeners: new address[](0),
            operators: new address[](0)
        });

        configs[2] = GardenToken.GardenConfig({
            name: "Batch Garden Gamma",
            slug: "",
            description: "Third batch garden",
            location: "Location C",
            bannerImage: "ipfs://QmGamma",
            metadata: "",
            openJoining: false,
            weightScheme: IGardensModule.WeightScheme.Power,
            domainMask: 0x0F, // All domains
            gardeners: new address[](0),
            operators: new address[](0)
        });

        address[] memory accounts = gardenToken.batchMintGardens(configs);

        // Verify 3 distinct garden accounts created
        assertEq(accounts.length, 3, "should create 3 garden accounts");

        // Verify each has a unique address and correct name
        assertTrue(accounts[0] != accounts[1], "gardens 0 and 1 should have different addresses");
        assertTrue(accounts[1] != accounts[2], "gardens 1 and 2 should have different addresses");
        assertTrue(accounts[0] != accounts[2], "gardens 0 and 2 should have different addresses");

        assertEq(
            keccak256(bytes(GardenAccount(payable(accounts[0])).name())),
            keccak256(bytes("Batch Garden Alpha")),
            "garden 0 name mismatch"
        );
        assertEq(
            keccak256(bytes(GardenAccount(payable(accounts[1])).name())),
            keccak256(bytes("Batch Garden Beta")),
            "garden 1 name mismatch"
        );
        assertEq(
            keccak256(bytes(GardenAccount(payable(accounts[2])).name())),
            keccak256(bytes("Batch Garden Gamma")),
            "garden 2 name mismatch"
        );

        // Verify each garden has its hat tree configured
        for (uint256 i = 0; i < 3; i++) {
            (,,,,,,, bool configured) = hatsModule.getGardenHatIds(accounts[i]);
            assertTrue(configured, string.concat("garden ", vm.toString(i), " hat tree should be configured"));
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 5: Open Joining Flow
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Tests that open joining allows a non-member to join and become a gardener
    function test_fork_e2e_openJoiningFlow() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();

        // Mint garden with openJoining = true (bypass _mintTestGarden which defaults to false)
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            name: "Open Joining Garden",
            slug: "",
            description: "Anyone can join",
            location: "Open Location",
            bannerImage: "ipfs://QmOpen",
            metadata: "",
            openJoining: true,
            weightScheme: IGardensModule.WeightScheme.Linear,
            domainMask: 0x0F,
            gardeners: new address[](0),
            operators: new address[](0)
        });

        address garden = gardenToken.mintGarden(config);
        GardenAccount gardenAcct = GardenAccount(payable(garden));

        // Verify open joining is enabled
        assertTrue(gardenAcct.openJoining(), "open joining should be enabled");

        // Non-member joins the garden
        vm.prank(forkNonMember);
        gardenAcct.joinGarden();

        // Verify: non-member is now a gardener
        assertTrue(gardenAcct.isGardener(forkNonMember), "non-member should be gardener after joining");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 6: Unauthorized Work Submission (Error Path)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Non-member work attestation reverts on real Sepolia EAS
    function test_fork_e2e_unauthorizedWorkSubmission() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();

        (address garden, uint256 actionUID) = _setupGardenWithRolesAndAction("Auth Test Garden");

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
    function test_fork_e2e_crossGardenRoleIsolation() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();

        // Garden A: forkOperator is operator
        (, uint256 actionUID_A) = _setupGardenWithRolesAndAction("Garden A");

        // Garden B: separate garden, forkOperator has NO role here
        address gardenB = _mintTestGarden("Garden B", 0x0F);
        address gardenB_operator = makeAddr("gardenB_operator");
        address gardenB_gardener = makeAddr("gardenB_gardener");
        _grantGardenRole(gardenB, gardenB_operator, IHatsModule.GardenRole.Operator);
        _grantGardenRole(gardenB, gardenB_gardener, IHatsModule.GardenRole.Gardener);

        // Submit work on garden B as its gardener
        bytes32 workAttUID = _submitWorkAttestation(gardenB_gardener, gardenB, actionUID_A);
        assertTrue(workAttUID != bytes32(0), "work on garden B should succeed");

        // forkOperator (garden A operator) tries to approve work on garden B — should revert
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
    function test_fork_e2e_doubleRoleGrantIsIdempotent() public {
        if (!_tryChainFork("sepolia")) {
            return;
        }

        _deployFullStackOnFork();

        address garden = _mintTestGarden("Double Grant Garden", 0x0F);

        // First grant should succeed
        _grantGardenRole(garden, forkGardener, IHatsModule.GardenRole.Gardener);
        assertTrue(hatsModule.isGardenerOf(garden, forkGardener), "first grant should succeed");

        // Second identical grant should be a no-op under current HatsModule semantics
        _grantGardenRole(garden, forkGardener, IHatsModule.GardenRole.Gardener);
        assertTrue(hatsModule.isGardenerOf(garden, forkGardener), "second grant should keep role intact");
    }
}
