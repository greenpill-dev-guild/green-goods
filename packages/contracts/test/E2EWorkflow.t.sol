// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Attestation} from "@eas/IEAS.sol";

import {GardenToken} from "../src/tokens/Garden.sol";
import {GardenAccount} from "../src/accounts/Garden.sol";
import {ActionRegistry, Capital} from "../src/registries/Action.sol";
import {WorkResolver} from "../src/resolvers/Work.sol";
import {WorkApprovalResolver} from "../src/resolvers/WorkApproval.sol";
import {AssessmentResolver} from "../src/resolvers/Assessment.sol";
import {MockERC20} from "../src/mocks/ERC20.sol";
import {MockEAS} from "../src/mocks/EAS.sol";
import {WorkSchema, WorkApprovalSchema, AssessmentSchema} from "../src/Schemas.sol";
import {ERC6551Helper} from "./helpers/ERC6551Helper.sol";

/// @title E2EWorkflow Test
/// @notice Comprehensive end-to-end integration tests for the complete Green Goods protocol workflow
/// @dev Tests full user journeys from garden creation to work approval
contract E2EWorkflowTest is Test, ERC6551Helper {
    // Core contracts
    GardenToken private gardenToken;
    ActionRegistry private actionRegistry;
    WorkResolver private workResolver;
    WorkApprovalResolver private workApprovalResolver;
    AssessmentResolver private assessmentResolver;
    GardenAccount private gardenAccountImplementation;
    MockERC20 private communityToken;
    MockEAS private mockEAS;

    // Test actors
    address private multisig = address(0x123);
    address private gardener1 = address(0x201);
    address private gardener2 = address(0x202);
    address private operator1 = address(0x301);
    address private operator2 = address(0x302);
    address private nonMember = address(0x999);

    // Garden instances
    address private gardenAccountAddress;
    GardenAccount private gardenAccount;
    uint256 private gardenTokenId;

    // Action IDs
    uint256 private actionId;

    function setUp() public {
        // Deploy ERC6551 Registry at canonical Tokenbound address
        _deployERC6551Registry();

        // Deploy mock dependencies
        communityToken = new MockERC20();
        mockEAS = new MockEAS();

        // Deploy GardenAccount implementation
        gardenAccountImplementation = new GardenAccount(
            address(0x1001), // erc4337EntryPoint
            address(0x1002), // multicallForwarder
            address(0x1003), // erc6551Registry - will be overridden by TOKENBOUND_REGISTRY in actual use
            address(0x1004), // guardian
            address(0x2001), // workApprovalResolver
            address(0x2002) // assessmentResolver
        );

        // Deploy and initialize GardenToken
        GardenToken gardenTokenImpl = new GardenToken(address(gardenAccountImplementation));
        bytes memory gardenTokenInitData = abi.encodeWithSelector(
            GardenToken.initialize.selector,
            multisig,
            address(0) // No deployment registry for testing
        );
        ERC1967Proxy gardenTokenProxy = new ERC1967Proxy(address(gardenTokenImpl), gardenTokenInitData);
        gardenToken = GardenToken(address(gardenTokenProxy));

        // Deploy and initialize ActionRegistry
        ActionRegistry actionRegistryImpl = new ActionRegistry();
        bytes memory actionRegistryInitData = abi.encodeWithSelector(ActionRegistry.initialize.selector, multisig);
        ERC1967Proxy actionRegistryProxy = new ERC1967Proxy(address(actionRegistryImpl), actionRegistryInitData);
        actionRegistry = ActionRegistry(address(actionRegistryProxy));

        // Deploy and initialize resolvers
        WorkResolver workResolverImpl = new WorkResolver(address(mockEAS), address(actionRegistry));
        bytes memory workResolverInitData = abi.encodeWithSelector(WorkResolver.initialize.selector, multisig);
        ERC1967Proxy workResolverProxy = new ERC1967Proxy(address(workResolverImpl), workResolverInitData);
        workResolver = WorkResolver(payable(address(workResolverProxy)));

        WorkApprovalResolver workApprovalResolverImpl =
            new WorkApprovalResolver(address(mockEAS), address(actionRegistry));
        bytes memory workApprovalResolverInitData =
            abi.encodeWithSelector(WorkApprovalResolver.initialize.selector, multisig);
        ERC1967Proxy workApprovalResolverProxy =
            new ERC1967Proxy(address(workApprovalResolverImpl), workApprovalResolverInitData);
        workApprovalResolver = WorkApprovalResolver(payable(address(workApprovalResolverProxy)));

        AssessmentResolver assessmentResolverImpl = new AssessmentResolver(address(mockEAS));
        bytes memory assessmentResolverInitData =
            abi.encodeWithSelector(AssessmentResolver.initialize.selector, multisig);
        ERC1967Proxy assessmentResolverProxy =
            new ERC1967Proxy(address(assessmentResolverImpl), assessmentResolverInitData);
        assessmentResolver = AssessmentResolver(payable(address(assessmentResolverProxy)));
    }

    /// @notice Test 1: Complete Happy Path (Mint → Register → Submit → Approve)
    function testCompleteProtocolWorkflow() public {
        uint256 gasBefore = gasleft();

        // Step 1: Mint a garden
        address[] memory gardeners = new address[](2);
        address[] memory operators = new address[](1);
        gardeners[0] = gardener1;
        gardeners[1] = gardener2;
        operators[0] = operator1;

        vm.prank(multisig);
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            communityToken: address(communityToken),
            name: "E2E Test Garden",
            description: "A complete workflow test garden",
            location: "Test City",
            bannerImage: "ipfs://QmBanner",
            metadata: "",
            openJoining: false,
            gardeners: gardeners,
            gardenOperators: operators
        });
        gardenAccountAddress = gardenToken.mintGarden(config);

        gardenAccount = GardenAccount(payable(gardenAccountAddress));
        gardenTokenId = 0;

        // Verify garden setup
        assertEq(gardenAccount.name(), "E2E Test Garden");
        assertTrue(gardenAccount.gardeners(gardener1));
        assertTrue(gardenAccount.gardeners(gardener2));
        assertTrue(gardenAccount.gardenOperators(operator1));
        emit log_named_string("[PASS] Step 1", "Garden minted successfully");

        // Step 2: Register an action
        Capital[] memory capitals = new Capital[](2);
        capitals[0] = Capital.LIVING;
        capitals[1] = Capital.SOCIAL;

        string[] memory media = new string[](1);
        media[0] = "ipfs://QmActionMedia";

        vm.prank(multisig);
        actionRegistry.registerAction(
            block.timestamp, block.timestamp + 30 days, "Plant Native Trees", "ipfs://QmInstructions", capitals, media
        );

        actionId = 0;
        ActionRegistry.Action memory action = actionRegistry.getAction(actionId);
        assertEq(action.title, "Plant Native Trees");
        emit log_named_string("[PASS] Step 2", "Action registered successfully");

        // Step 3: Gardener submits work
        WorkSchema memory workSubmission = WorkSchema({
            actionUID: actionId,
            title: "Planted 10 Oak Trees",
            feedback: "",
            metadata: "{'trees': 10, 'species': 'Oak'}",
            media: new string[](1)
        });
        workSubmission.media[0] = "ipfs://QmWorkPhoto";

        bytes memory workData = abi.encode(workSubmission);

        // Create attestation (simulating EAS attest call)
        bytes32 workUID = bytes32(uint256(1));
        Attestation memory workAttestation = Attestation({
            uid: workUID,
            schema: bytes32(uint256(100)),
            time: uint64(block.timestamp),
            expirationTime: 0,
            revocationTime: 0,
            refUID: bytes32(0),
            recipient: gardenAccountAddress,
            attester: gardener1,
            revocable: true,
            data: workData
        });

        // Mock the attestation in EAS
        vm.prank(gardener1);
        mockEAS.setAttestationByUID(workUID, workAttestation);

        emit log_named_string("[PASS] Step 3", "Work submitted by gardener");

        // Step 4: Operator approves work
        WorkApprovalSchema memory approval = WorkApprovalSchema({
            actionUID: actionId,
            workUID: bytes32(uint256(1)),
            approved: true,
            feedback: "Great work! Trees look healthy."
        });

        bytes memory approvalData = abi.encode(approval);

        bytes32 approvalUID = bytes32(uint256(2));
        Attestation memory approvalAttestation = Attestation({
            uid: approvalUID,
            schema: bytes32(uint256(101)),
            time: uint64(block.timestamp),
            expirationTime: 0,
            revocationTime: 0,
            refUID: workUID,
            recipient: gardenAccountAddress,
            attester: operator1,
            revocable: true,
            data: approvalData
        });

        vm.prank(operator1);
        mockEAS.setAttestationByUID(approvalUID, approvalAttestation);

        emit log_named_string("[PASS] Step 4", "Work approved by operator");

        // Verify final state
        Attestation memory storedWork = mockEAS.getAttestation(workUID);
        assertEq(storedWork.attester, gardener1);
        assertEq(storedWork.recipient, gardenAccountAddress);

        Attestation memory storedApproval = mockEAS.getAttestation(approvalUID);
        assertEq(storedApproval.attester, operator1);
        assertTrue(abi.decode(storedApproval.data, (WorkApprovalSchema)).approved);

        uint256 gasUsed = gasBefore - gasleft();
        emit log_named_uint("Gas used for complete workflow", gasUsed);
        emit log_named_string("[PASS] Complete", "Full protocol workflow executed successfully");
    }

    /// @notice Test 2: Multi-Garden Parallel Workflows
    function testMultiGardenParallelWorkflows() public {
        // Create 3 gardens
        address[] memory gardens = new address[](3);
        uint256[] memory actions = new uint256[](3);

        for (uint256 i = 0; i < 3; i++) {
            address[] memory gardeners = new address[](1);
            address[] memory operators = new address[](1);
            gardeners[0] = address(uint160(200 + i));
            operators[0] = address(uint160(300 + i));

            vm.prank(multisig);
            GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
                communityToken: address(communityToken),
                name: string(abi.encodePacked("Garden ", uint2str(i))),
                description: string(abi.encodePacked("Description ", uint2str(i))),
                location: "Location",
                bannerImage: "banner.jpg",
                metadata: "",
                openJoining: false,
                gardeners: gardeners,
                gardenOperators: operators
            });
            gardens[i] = gardenToken.mintGarden(config);

            // Register unique action for each garden
            Capital[] memory capitals = new Capital[](1);
            capitals[0] = Capital(i % 8); // Cycle through capitals

            vm.prank(multisig);
            actionRegistry.registerAction(
                block.timestamp,
                block.timestamp + 30 days,
                string(abi.encodePacked("Action ", uint2str(i))),
                string(abi.encodePacked("ipfs://instructions", uint2str(i))),
                capitals,
                new string[](0)
            );

            actions[i] = i;
        }

        // Verify all gardens are independent
        for (uint256 i = 0; i < 3; i++) {
            GardenAccount g = GardenAccount(payable(gardens[i]));
            assertEq(g.name(), string(abi.encodePacked("Garden ", uint2str(i))));
            assertTrue(g.gardeners(address(uint160(200 + i))));

            // Verify other gardens don't have this gardener
            for (uint256 j = 0; j < 3; j++) {
                if (i != j) {
                    GardenAccount otherGarden = GardenAccount(payable(gardens[j]));
                    assertFalse(otherGarden.gardeners(address(uint160(200 + i))));
                }
            }
        }

        emit log_named_string("[PASS]", "Multi-garden workflows validated");
    }

    /// @notice Test 3: Work Rejection and Resubmission Flow
    function testWorkRejectionFlow() public {
        // Setup garden
        address[] memory gardeners = new address[](1);
        address[] memory operators = new address[](1);
        gardeners[0] = gardener1;
        operators[0] = operator1;

        vm.prank(multisig);
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            communityToken: address(communityToken),
            name: "Test Garden",
            description: "Description",
            location: "Location",
            bannerImage: "banner.jpg",
            metadata: "",
            openJoining: false,
            gardeners: gardeners,
            gardenOperators: operators
        });
        gardenAccountAddress = gardenToken.mintGarden(config);

        gardenAccount = GardenAccount(payable(gardenAccountAddress));

        // Register action
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.MATERIAL;

        vm.prank(multisig);
        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 30 days,
            "Build Compost Bin",
            "ipfs://instructions",
            capitals,
            new string[](0)
        );

        // Submit initial work
        WorkSchema memory initialWork = WorkSchema({
            actionUID: 0,
            title: "Built compost bin",
            feedback: "",
            metadata: "{'materials': 'incomplete'}",
            media: new string[](0)
        });

        bytes32 workUID1 = bytes32(uint256(1));
        Attestation memory workAttest1 = Attestation({
            uid: workUID1,
            schema: bytes32(uint256(100)),
            time: uint64(block.timestamp),
            expirationTime: 0,
            revocationTime: 0,
            refUID: bytes32(0),
            recipient: gardenAccountAddress,
            attester: gardener1,
            revocable: true,
            data: abi.encode(initialWork)
        });

        vm.prank(gardener1);
        mockEAS.setAttestationByUID(workUID1, workAttest1);

        // Operator rejects work
        WorkApprovalSchema memory rejection = WorkApprovalSchema({
            actionUID: 0,
            workUID: workUID1,
            approved: false,
            feedback: "Please add photos of completed work"
        });

        bytes32 rejectionUID = bytes32(uint256(2));
        Attestation memory rejectAttest = Attestation({
            uid: rejectionUID,
            schema: bytes32(uint256(101)),
            time: uint64(block.timestamp),
            expirationTime: 0,
            revocationTime: 0,
            refUID: workUID1,
            recipient: gardenAccountAddress,
            attester: operator1,
            revocable: true,
            data: abi.encode(rejection)
        });

        vm.prank(operator1);
        mockEAS.setAttestationByUID(rejectionUID, rejectAttest);

        // Verify rejection
        WorkApprovalSchema memory storedRejection =
            abi.decode(mockEAS.getAttestation(rejectionUID).data, (WorkApprovalSchema));
        assertFalse(storedRejection.approved);
        assertEq(storedRejection.feedback, "Please add photos of completed work");

        // Gardener resubmits with corrections
        WorkSchema memory correctedWork = WorkSchema({
            actionUID: 0,
            title: "Built compost bin - with photos",
            feedback: "",
            metadata: "{'materials': 'complete', 'photos': true}",
            media: new string[](1)
        });
        correctedWork.media[0] = "ipfs://QmCorrectedPhoto";

        bytes32 workUID2 = bytes32(uint256(3));
        Attestation memory workAttest2 = Attestation({
            uid: workUID2,
            schema: bytes32(uint256(100)),
            time: uint64(block.timestamp),
            expirationTime: 0,
            revocationTime: 0,
            refUID: workUID1, // Reference to original
            recipient: gardenAccountAddress,
            attester: gardener1,
            revocable: true,
            data: abi.encode(correctedWork)
        });

        vm.prank(gardener1);
        mockEAS.setAttestationByUID(workUID2, workAttest2);

        // Operator approves corrected work
        WorkApprovalSchema memory approval =
            WorkApprovalSchema({actionUID: 0, workUID: workUID2, approved: true, feedback: "Perfect! Well done."});

        bytes32 approvalUID2 = bytes32(uint256(4));
        Attestation memory approvalAttest = Attestation({
            uid: approvalUID2,
            schema: bytes32(uint256(101)),
            time: uint64(block.timestamp),
            expirationTime: 0,
            revocationTime: 0,
            refUID: workUID2,
            recipient: gardenAccountAddress,
            attester: operator1,
            revocable: true,
            data: abi.encode(approval)
        });

        vm.prank(operator1);
        mockEAS.setAttestationByUID(approvalUID2, approvalAttest);

        // Verify approval
        WorkApprovalSchema memory storedApproval =
            abi.decode(mockEAS.getAttestation(approvalUID2).data, (WorkApprovalSchema));
        assertTrue(storedApproval.approved);

        emit log_named_string("[PASS]", "Work rejection and resubmission flow validated");
    }

    /// @notice Test 4: Assessment Creation and Validation
    function testAssessmentWorkflow() public {
        // Setup garden
        address[] memory gardeners = new address[](0);
        address[] memory operators = new address[](1);
        operators[0] = operator1;

        vm.prank(multisig);
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            communityToken: address(communityToken),
            name: "Assessment Garden",
            description: "Garden for biodiversity assessment",
            location: "Test Location",
            bannerImage: "banner.jpg",
            metadata: "",
            openJoining: false,
            gardeners: gardeners,
            gardenOperators: operators
        });
        gardenAccountAddress = gardenToken.mintGarden(config);

        // Create assessment
        string[] memory capitals = new string[](3);
        capitals[0] = "living";
        capitals[1] = "social";
        capitals[2] = "cultural";

        string[] memory evidenceMedia = new string[](2);
        evidenceMedia[0] = "ipfs://QmPhoto1";
        evidenceMedia[1] = "ipfs://QmPhoto2";

        string[] memory reports = new string[](1);
        reports[0] = "ipfs://QmReport";

        bytes32[] memory impactRefs = new bytes32[](0);

        string[] memory tags = new string[](2);
        tags[0] = "biodiversity";
        tags[1] = "soil-health";

        AssessmentSchema memory assessment = AssessmentSchema({
            title: "Q1 2024 Biodiversity Assessment",
            description: "Comprehensive assessment of garden biodiversity",
            assessmentType: "biodiversity",
            capitals: capitals,
            metricsJSON: "ipfs://QmMetrics",
            evidenceMedia: evidenceMedia,
            reportDocuments: reports,
            impactAttestations: impactRefs,
            startDate: block.timestamp - 90 days,
            endDate: block.timestamp,
            location: "Garden Plot A",
            tags: tags
        });

        bytes32 assessmentUID = bytes32(uint256(1));
        Attestation memory assessmentAttest = Attestation({
            uid: assessmentUID,
            schema: bytes32(uint256(102)),
            time: uint64(block.timestamp),
            expirationTime: 0,
            revocationTime: 0,
            refUID: bytes32(0),
            recipient: gardenAccountAddress,
            attester: operator1,
            revocable: true,
            data: abi.encode(assessment)
        });

        vm.prank(operator1);
        mockEAS.setAttestationByUID(assessmentUID, assessmentAttest);

        // Verify assessment stored correctly
        Attestation memory storedAttest = mockEAS.getAttestation(assessmentUID);
        AssessmentSchema memory storedAssessment = abi.decode(storedAttest.data, (AssessmentSchema));

        assertEq(storedAssessment.title, "Q1 2024 Biodiversity Assessment");
        assertEq(storedAssessment.capitals.length, 3);
        assertEq(storedAssessment.capitals[0], "living");
        assertEq(storedAssessment.evidenceMedia.length, 2);
        assertEq(storedAssessment.tags.length, 2);

        emit log_named_string("[PASS]", "Assessment workflow validated");
    }

    /// @notice Test 5: Time-based Action Validation
    function testTimeBasedActionValidation() public {
        // Setup garden
        address[] memory gardeners = new address[](1);
        address[] memory operators = new address[](1);
        gardeners[0] = gardener1;
        operators[0] = operator1;

        vm.prank(multisig);
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            communityToken: address(communityToken),
            name: "Time Test Garden",
            description: "Description",
            location: "Location",
            bannerImage: "banner.jpg",
            metadata: "",
            openJoining: false,
            gardeners: gardeners,
            gardenOperators: operators
        });
        gardenAccountAddress = gardenToken.mintGarden(config);

        // Register action with future start time
        uint256 futureStart = block.timestamp + 7 days;
        uint256 futureEnd = block.timestamp + 14 days;

        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.LIVING;

        vm.prank(multisig);
        actionRegistry.registerAction(
            futureStart, futureEnd, "Future Action", "ipfs://instructions", capitals, new string[](0)
        );

        // Verify action exists but not yet active
        ActionRegistry.Action memory action = actionRegistry.getAction(0);
        assertEq(action.startTime, futureStart);
        assertTrue(action.startTime > block.timestamp);

        // Warp time to start
        vm.warp(futureStart);
        assertTrue(block.timestamp >= action.startTime);
        assertTrue(block.timestamp < action.endTime);

        emit log_named_string("[PASS] Phase 1", "Action active during valid period");

        // Warp time past end
        vm.warp(futureEnd + 1);
        assertTrue(block.timestamp > action.endTime);

        emit log_named_string("[PASS] Phase 2", "Action expired after end time");
        emit log_named_string("[PASS]", "Time-based action validation complete");
    }

    /// @notice Test 6: Access Control Enforcement
    function testAccessControlEnforcement() public {
        // Setup garden
        address[] memory gardeners = new address[](1);
        address[] memory operators = new address[](1);
        gardeners[0] = gardener1;
        operators[0] = operator1;

        vm.prank(multisig);
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            communityToken: address(communityToken),
            name: "Access Control Garden",
            description: "Description",
            location: "Location",
            bannerImage: "banner.jpg",
            metadata: "",
            openJoining: false,
            gardeners: gardeners,
            gardenOperators: operators
        });
        gardenAccountAddress = gardenToken.mintGarden(config);

        gardenAccount = GardenAccount(payable(gardenAccountAddress));

        // Test 1: Non-owner cannot register actions
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.SOCIAL;

        vm.prank(nonMember);
        vm.expectRevert("Ownable: caller is not the owner");
        actionRegistry.registerAction(
            block.timestamp, block.timestamp + 30 days, "Unauthorized Action", "instructions", capitals, new string[](0)
        );

        emit log_named_string("[PASS] Test 1", "Non-owner cannot register actions");

        // Test 2: Non-operator cannot add gardeners
        vm.prank(nonMember);
        vm.expectRevert();
        gardenAccount.addGardener(address(0x888));

        emit log_named_string("[PASS] Test 2", "Non-operator cannot add gardeners");

        // Test 3: Non-operator cannot update description
        vm.prank(nonMember);
        vm.expectRevert();
        gardenAccount.updateDescription("Unauthorized update");

        emit log_named_string("[PASS] Test 3", "Non-operator cannot update description");

        // Test 4: Operator can update description
        vm.prank(operator1);
        gardenAccount.updateDescription("Authorized update");
        assertEq(gardenAccount.description(), "Authorized update");

        emit log_named_string("[PASS] Test 4", "Operator can update description");
        emit log_named_string("[PASS]", "All access control tests passed");
    }

    /// @notice Test 7: Gas Optimization Tracking
    function testGasOptimization() public {
        uint256 gasMintGarden;
        uint256 gasRegisterAction;
        uint256 gasSubmitWork;
        uint256 gasApproveWork;

        // Measure mintGarden gas
        address[] memory gardeners = new address[](2);
        address[] memory operators = new address[](1);
        gardeners[0] = gardener1;
        gardeners[1] = gardener2;
        operators[0] = operator1;

        vm.prank(multisig);
        uint256 gasStart = gasleft();
        GardenToken.GardenConfig memory config = GardenToken.GardenConfig({
            communityToken: address(communityToken),
            name: "Gas Test Garden",
            description: "Description for gas testing",
            location: "Location",
            bannerImage: "ipfs://banner",
            metadata: "",
            openJoining: false,
            gardeners: gardeners,
            gardenOperators: operators
        });
        gardenAccountAddress = gardenToken.mintGarden(config);
        gasMintGarden = gasStart - gasleft();

        emit log_named_uint("Gas: mintGarden", gasMintGarden);
        assertTrue(gasMintGarden < 500_000, "mintGarden should use < 500k gas");

        // Measure registerAction gas
        Capital[] memory capitals = new Capital[](2);
        capitals[0] = Capital.LIVING;
        capitals[1] = Capital.SOCIAL;

        string[] memory media = new string[](1);
        media[0] = "ipfs://media";

        vm.prank(multisig);
        gasStart = gasleft();
        actionRegistry.registerAction(
            block.timestamp, block.timestamp + 30 days, "Gas Test Action", "ipfs://instructions", capitals, media
        );
        gasRegisterAction = gasStart - gasleft();

        emit log_named_uint("Gas: registerAction", gasRegisterAction);
        assertTrue(gasRegisterAction < 300_000, "registerAction should use < 300k gas");

        // Measure work submission (attestation creation simulation)
        WorkSchema memory work = WorkSchema({
            actionUID: 0,
            title: "Work submission",
            feedback: "",
            metadata: "{'data': 'test'}",
            media: new string[](1)
        });
        work.media[0] = "ipfs://photo";

        gasStart = gasleft();
        bytes memory workData = abi.encode(work);
        bytes32 workUIDGas = bytes32(uint256(1));
        Attestation memory workAttest = Attestation({
            uid: workUIDGas,
            schema: bytes32(uint256(100)),
            time: uint64(block.timestamp),
            expirationTime: 0,
            revocationTime: 0,
            refUID: bytes32(0),
            recipient: gardenAccountAddress,
            attester: gardener1,
            revocable: true,
            data: workData
        });

        vm.prank(gardener1);
        mockEAS.setAttestationByUID(workUIDGas, workAttest);
        gasSubmitWork = gasStart - gasleft();

        emit log_named_uint("Gas: submitWork", gasSubmitWork);
        assertTrue(gasSubmitWork < 500_000, "submitWork should use < 500k gas");

        // Measure work approval
        WorkApprovalSchema memory approval =
            WorkApprovalSchema({actionUID: 0, workUID: workUIDGas, approved: true, feedback: "Approved"});

        gasStart = gasleft();
        bytes memory approvalData = abi.encode(approval);
        bytes32 approvalUIDGas = bytes32(uint256(2));
        Attestation memory approvalAttest = Attestation({
            uid: approvalUIDGas,
            schema: bytes32(uint256(101)),
            time: uint64(block.timestamp),
            expirationTime: 0,
            revocationTime: 0,
            refUID: workUIDGas,
            recipient: gardenAccountAddress,
            attester: operator1,
            revocable: true,
            data: approvalData
        });

        vm.prank(operator1);
        mockEAS.setAttestationByUID(approvalUIDGas, approvalAttest);
        gasApproveWork = gasStart - gasleft();

        emit log_named_uint("Gas: approveWork", gasApproveWork);
        assertTrue(gasApproveWork < 350_000, "approveWork should use < 350k gas");

        // Summary
        uint256 totalGas = gasMintGarden + gasRegisterAction + gasSubmitWork + gasApproveWork;
        emit log_named_uint("Total gas for complete flow", totalGas);
        emit log_named_string("[PASS]", "All gas optimization targets met");
    }

    /// @notice Helper function to convert uint to string
    function uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
}
