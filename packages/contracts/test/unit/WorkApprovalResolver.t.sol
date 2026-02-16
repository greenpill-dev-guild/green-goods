// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Attestation } from "@eas/IEAS.sol";

import { WorkApprovalSchema, WorkSchema } from "../../src/Schemas.sol";
import {
    WorkApprovalResolver,
    NotInWorkRegistry,
    NotGardenOperator,
    InvalidConfidence,
    InvalidVerificationMethod,
    ActionMismatch,
    InvalidSchema
} from "../../src/resolvers/WorkApproval.sol";
import { NotInActionRegistry } from "../../src/resolvers/Work.sol";
import { ActionRegistry, Capital, Domain } from "../../src/registries/Action.sol";
import { MockEAS } from "../../src/mocks/EAS.sol";
import { MockGardenAccessControl } from "../../src/mocks/GardenAccessControl.sol";

/// @title WorkApprovalResolverTest
/// @notice Unit tests for WorkApprovalResolver onAttest validation logic
/// @dev Uses MockGardenAccessControl and MockEAS to isolate approval validation
contract WorkApprovalResolverTest is Test {
    WorkApprovalResolver private workApprovalResolver;
    ActionRegistry private actionRegistry;
    MockEAS private mockEAS;
    MockGardenAccessControl private mockGarden;

    address private multisig = address(0x123);
    address private evaluator = address(0x456);
    address private operator = address(0x789);
    address private gardener = address(0x201);
    address private stranger = address(0x999);

    uint256 private activeActionId;
    bytes32 private workUID;

    function setUp() public {
        // Deploy mock EAS and garden access control
        mockEAS = new MockEAS();
        mockGarden = new MockGardenAccessControl();

        // Configure roles
        mockGarden.setEvaluator(evaluator, true);
        mockGarden.setOperator(operator, true);
        mockGarden.setGardener(gardener, true);

        // Deploy ActionRegistry
        ActionRegistry actionImpl = new ActionRegistry();
        bytes memory actionInitData = abi.encodeWithSelector(ActionRegistry.initialize.selector, multisig);
        ERC1967Proxy actionProxy = new ERC1967Proxy(address(actionImpl), actionInitData);
        actionRegistry = ActionRegistry(address(actionProxy));

        // Register an active action
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.LIVING;

        vm.prank(multisig);
        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 30 days,
            "Plant Trees",
            "agro.planting",
            "ipfs://instructions",
            capitals,
            new string[](0),
            Domain.AGRO
        );
        activeActionId = 0;

        // Deploy WorkApprovalResolver with proxy
        WorkApprovalResolver resolverImpl = new WorkApprovalResolver(address(mockEAS), address(actionRegistry));
        bytes memory resolverInitData = abi.encodeWithSelector(WorkApprovalResolver.initialize.selector, multisig);
        ERC1967Proxy resolverProxy = new ERC1967Proxy(address(resolverImpl), resolverInitData);
        workApprovalResolver = WorkApprovalResolver(payable(address(resolverProxy)));

        // Pre-populate a valid work attestation in MockEAS
        workUID = bytes32(uint256(42));
        WorkSchema memory workSchema = WorkSchema({
            actionUID: activeActionId,
            title: "Planted Trees",
            feedback: "",
            metadata: "",
            media: new string[](1)
        });
        workSchema.media[0] = "ipfs://QmWorkPhoto";

        Attestation memory workAttestation = Attestation({
            uid: workUID,
            schema: bytes32(uint256(100)),
            time: uint64(block.timestamp),
            expirationTime: 0,
            revocationTime: 0,
            refUID: bytes32(0),
            recipient: address(mockGarden), // Work was submitted to this garden
            attester: gardener,
            revocable: true,
            data: abi.encode(workSchema)
        });
        mockEAS.setAttestationByUID(workUID, workAttestation);
    }

    // =========================================================================
    // Initialization Tests
    // =========================================================================

    function testInitialize() public {
        assertEq(workApprovalResolver.owner(), multisig, "Owner should be multisig");
    }

    function testIsPayable() public {
        assertFalse(workApprovalResolver.isPayable(), "Resolver should not be payable");
    }

    function testActionRegistrySet() public {
        assertEq(workApprovalResolver.ACTION_REGISTRY(), address(actionRegistry), "Action registry should be set");
    }

    // =========================================================================
    // onAttest: Happy Path Tests
    // =========================================================================

    function testOnAttestValidOperatorApproval() public {
        Attestation memory attestation = _buildApprovalAttestation(operator, workUID, activeActionId, true);

        vm.prank(address(mockEAS));
        bool result = workApprovalResolver.attest(attestation);
        assertTrue(result, "Operator should be able to approve work");
    }

    function testOnAttestValidOperatorRejection() public {
        Attestation memory attestation = _buildApprovalAttestation(operator, workUID, activeActionId, false);

        vm.prank(address(mockEAS));
        bool result = workApprovalResolver.attest(attestation);
        assertTrue(result, "Operator should be able to reject work");
    }

    // =========================================================================
    // onAttest: Work Relationship Validation (FIRST check)
    // =========================================================================

    function testOnAttestRevertsForWorkFromDifferentGarden() public {
        // Create a different garden
        MockGardenAccessControl otherGarden = new MockGardenAccessControl();
        otherGarden.setEvaluator(evaluator, true);

        // The work attestation is for mockGarden, but approval targets otherGarden
        Attestation memory attestation = _buildApprovalAttestation(evaluator, workUID, activeActionId, true);
        attestation.recipient = address(otherGarden); // Different garden than work's recipient

        vm.prank(address(mockEAS));
        vm.expectRevert(NotInWorkRegistry.selector);
        workApprovalResolver.attest(attestation);
    }

    function testOnAttestRevertsForNonExistentWork() public {
        bytes32 fakeWorkUID = bytes32(uint256(9999));
        Attestation memory attestation = _buildApprovalAttestation(evaluator, fakeWorkUID, activeActionId, true);

        // MockEAS returns empty attestation for unknown UIDs (recipient = address(0))
        // So recipient mismatch triggers NotInWorkRegistry
        vm.prank(address(mockEAS));
        vm.expectRevert(NotInWorkRegistry.selector);
        workApprovalResolver.attest(attestation);
    }

    // =========================================================================
    // onAttest: Identity Validation (SECOND check)
    // =========================================================================

    function testOnAttestRevertsForStranger() public {
        Attestation memory attestation = _buildApprovalAttestation(stranger, workUID, activeActionId, true);

        vm.prank(address(mockEAS));
        vm.expectRevert(NotGardenOperator.selector);
        workApprovalResolver.attest(attestation);
    }

    function testOnAttestRevertsForEvaluator() public {
        // Evaluators handle assessments, not work approvals — only operators can
        Attestation memory attestation = _buildApprovalAttestation(evaluator, workUID, activeActionId, true);

        vm.prank(address(mockEAS));
        vm.expectRevert(NotGardenOperator.selector);
        workApprovalResolver.attest(attestation);
    }

    function testOnAttestRevertsForGardener() public {
        // Gardeners cannot approve work — only operators can
        Attestation memory attestation = _buildApprovalAttestation(gardener, workUID, activeActionId, true);

        vm.prank(address(mockEAS));
        vm.expectRevert(NotGardenOperator.selector);
        workApprovalResolver.attest(attestation);
    }

    // =========================================================================
    // onAttest: Action Validation (THIRD check)
    // =========================================================================

    function testOnAttestRevertsForNonExistentAction() public {
        uint256 nonExistentAction = 999;
        Attestation memory attestation = _buildApprovalAttestation(operator, workUID, nonExistentAction, true);

        // Cross-validation (ActionMismatch) fires before registry check (NotInActionRegistry)
        // because work.actionUID (0) != approval.actionUID (999)
        vm.prank(address(mockEAS));
        vm.expectRevert(ActionMismatch.selector);
        workApprovalResolver.attest(attestation);
    }

    // =========================================================================
    // onAttest: Action Cross-Validation
    // =========================================================================

    function test_revert_ActionMismatch() public {
        // Register a second action
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.LIVING;

        vm.prank(multisig);
        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 30 days,
            "Different Action",
            "agro.different",
            "ipfs://different",
            capitals,
            new string[](0),
            Domain.AGRO
        );
        uint256 differentActionId = 1;

        // Work was submitted with activeActionId (0), but approval references differentActionId (1)
        Attestation memory attestation = _buildApprovalAttestation(operator, workUID, differentActionId, true);

        vm.prank(address(mockEAS));
        vm.expectRevert(ActionMismatch.selector);
        workApprovalResolver.attest(attestation);
    }

    // =========================================================================
    // onRevoke Tests — revocation is always rejected
    // =========================================================================

    function testOnRevokeAlwaysReturnsFalse() public {
        Attestation memory attestation = _buildApprovalAttestation(operator, workUID, activeActionId, true);

        vm.prank(address(mockEAS));
        bool result = workApprovalResolver.revoke(attestation);
        assertFalse(result, "Revocation should always be rejected");
    }

    // =========================================================================
    // Configuration Tests
    // =========================================================================

    function testSetKarmaGAPModule() public {
        address module = address(0xCAFE);

        vm.prank(multisig);
        workApprovalResolver.setKarmaGAPModule(module);

        assertEq(address(workApprovalResolver.karmaGAPModule()), module);
    }

    function testOnlyOwnerCanSetKarmaGAPModule() public {
        vm.prank(stranger);
        vm.expectRevert("Ownable: caller is not the owner");
        workApprovalResolver.setKarmaGAPModule(address(0xCAFE));
    }

    // =========================================================================
    // Access Control Tests
    // =========================================================================

    function testOnlyEASCanCallAttest() public {
        Attestation memory attestation = _buildApprovalAttestation(operator, workUID, activeActionId, true);

        vm.prank(stranger);
        vm.expectRevert();
        workApprovalResolver.attest(attestation);
    }

    // =========================================================================
    // Double Initialization Test
    // =========================================================================

    function test_initialize_revertsOnDoubleInit() public {
        vm.expectRevert("Initializable: contract is already initialized");
        workApprovalResolver.initialize(address(0x999));
    }

    // =========================================================================
    // UUPS Upgrade Tests
    // =========================================================================

    function test_authorizeUpgrade_ownerCanUpgrade() public {
        WorkApprovalResolver newImpl = new WorkApprovalResolver(address(mockEAS), address(actionRegistry));

        vm.prank(multisig);
        workApprovalResolver.upgradeTo(address(newImpl));
    }

    function test_authorizeUpgrade_nonOwnerCannotUpgrade() public {
        WorkApprovalResolver newImpl = new WorkApprovalResolver(address(mockEAS), address(actionRegistry));

        vm.prank(stranger);
        vm.expectRevert("Ownable: caller is not the owner");
        workApprovalResolver.upgradeTo(address(newImpl));
    }

    // =========================================================================
    // GAP Integration Branch Tests
    // =========================================================================

    function testOnAttestApproval_skipsGAPWhenNoModule() public {
        // Default: karmaGAPModule == address(0)
        Attestation memory attestation = _buildApprovalAttestation(operator, workUID, activeActionId, true);

        vm.prank(address(mockEAS));
        bool result = workApprovalResolver.attest(attestation);
        assertTrue(result, "Approval should succeed without GAP module");
    }

    function testOnAttestApproval_callsGAPWhenConfigured() public {
        MockKarmaForWorkApproval mockModule = new MockKarmaForWorkApproval();
        vm.prank(multisig);
        workApprovalResolver.setKarmaGAPModule(address(mockModule));

        // Mock IERC6551Account.token() on the garden address (work attestation recipient)
        // _createGAPProjectImpact calls token() BEFORE the try/catch block
        vm.mockCall(
            address(mockGarden),
            abi.encodeWithSignature("token()"),
            abi.encode(uint256(11_155_111), address(0xdead), uint256(1))
        );

        Attestation memory attestation = _buildApprovalAttestation(operator, workUID, activeActionId, true);

        vm.prank(address(mockEAS));
        bool result = workApprovalResolver.attest(attestation);
        assertTrue(result, "Approval should succeed with GAP module");
    }

    function testOnAttestRejection_doesNotCallGAP() public {
        MockKarmaForWorkApproval mockModule = new MockKarmaForWorkApproval();
        vm.prank(multisig);
        workApprovalResolver.setKarmaGAPModule(address(mockModule));

        // Rejection: approved = false → GAP branch skipped
        Attestation memory attestation = _buildApprovalAttestation(operator, workUID, activeActionId, false);

        vm.prank(address(mockEAS));
        bool result = workApprovalResolver.attest(attestation);
        assertTrue(result, "Rejection should succeed without calling GAP");
    }

    // =========================================================================
    // Event Tests for Configuration Setters
    // =========================================================================

    event KarmaGAPModuleUpdated(address indexed oldModule, address indexed newModule);

    function testSetKarmaGAPModule_emitsEvent() public {
        address module = address(0xCAFE);

        vm.expectEmit(true, true, false, false);
        emit KarmaGAPModuleUpdated(address(0), module);

        vm.prank(multisig);
        workApprovalResolver.setKarmaGAPModule(module);
    }

    // =========================================================================
    // onAttest: Confidence Validation (FOURTH check)
    // =========================================================================

    function testOnAttestRevertsForInvalidConfidence() public {
        // confidence=4 exceeds max value of 3 (HIGH)
        Attestation memory attestation =
            _buildApprovalAttestationExtended(operator, workUID, activeActionId, true, 4, 1, "");

        vm.prank(address(mockEAS));
        vm.expectRevert(InvalidConfidence.selector);
        workApprovalResolver.attest(attestation);
    }

    function testOnAttestRevertsForConfidence255() public {
        // Edge case: max uint8 value
        Attestation memory attestation =
            _buildApprovalAttestationExtended(operator, workUID, activeActionId, true, 255, 1, "");

        vm.prank(address(mockEAS));
        vm.expectRevert(InvalidConfidence.selector);
        workApprovalResolver.attest(attestation);
    }

    function testOnAttestApprovalWithZeroConfidence() public {
        // approved=true, confidence=0 (NONE) is valid — no minimum confidence required
        Attestation memory attestation =
            _buildApprovalAttestationExtended(operator, workUID, activeActionId, true, 0, 1, "");

        vm.prank(address(mockEAS));
        bool result = workApprovalResolver.attest(attestation);
        assertTrue(result, "Approval with NONE confidence should succeed");
    }

    function testOnAttestApprovalWithLowConfidence() public {
        // approved=true, confidence=1 (LOW) should succeed
        Attestation memory attestation =
            _buildApprovalAttestationExtended(operator, workUID, activeActionId, true, 1, 1, "");

        vm.prank(address(mockEAS));
        bool result = workApprovalResolver.attest(attestation);
        assertTrue(result, "Approval with LOW confidence should succeed");
    }

    function testOnAttestApprovalWithHighConfidence() public {
        // approved=true, confidence=3 (HIGH) should succeed
        Attestation memory attestation =
            _buildApprovalAttestationExtended(operator, workUID, activeActionId, true, 3, 1, "");

        vm.prank(address(mockEAS));
        bool result = workApprovalResolver.attest(attestation);
        assertTrue(result, "Approval with HIGH confidence should succeed");
    }

    function testOnAttestRejectionWithZeroConfidence() public {
        // approved=false, confidence=0 (NONE) should succeed for rejections
        Attestation memory attestation =
            _buildApprovalAttestationExtended(operator, workUID, activeActionId, false, 0, 0, "");

        vm.prank(address(mockEAS));
        bool result = workApprovalResolver.attest(attestation);
        assertTrue(result, "Rejection with NONE confidence should succeed");
    }

    // =========================================================================
    // onAttest: VerificationMethod Validation (FIFTH check)
    // =========================================================================

    function testOnAttestRevertsForInvalidVerificationMethod() public {
        // verificationMethod=16 exceeds the 4-bit bitmask (max 15)
        Attestation memory attestation =
            _buildApprovalAttestationExtended(operator, workUID, activeActionId, true, 2, 16, "");

        vm.prank(address(mockEAS));
        vm.expectRevert(InvalidVerificationMethod.selector);
        workApprovalResolver.attest(attestation);
    }

    function testOnAttestRevertsForVerificationMethod255() public {
        // Edge case: max uint8 value
        Attestation memory attestation =
            _buildApprovalAttestationExtended(operator, workUID, activeActionId, true, 2, 255, "");

        vm.prank(address(mockEAS));
        vm.expectRevert(InvalidVerificationMethod.selector);
        workApprovalResolver.attest(attestation);
    }

    function testOnAttestValidCombinedVerificationMethods() public {
        // HUMAN(1) + IOT(2) = 3 — valid bitmask combination
        Attestation memory attestation =
            _buildApprovalAttestationExtended(operator, workUID, activeActionId, true, 2, 3, "");

        vm.prank(address(mockEAS));
        bool result = workApprovalResolver.attest(attestation);
        assertTrue(result, "Combined HUMAN+IOT method should succeed");
    }

    function testOnAttestAllVerificationMethods() public {
        // HUMAN(1) + IOT(2) + ONCHAIN(4) + AGENT(8) = 15 — all methods
        Attestation memory attestation =
            _buildApprovalAttestationExtended(operator, workUID, activeActionId, true, 3, 15, "");

        vm.prank(address(mockEAS));
        bool result = workApprovalResolver.attest(attestation);
        assertTrue(result, "All verification methods combined should succeed");
    }

    // =========================================================================
    // onAttest: ReviewNotesCID (optional field — no revert expected)
    // =========================================================================

    function testOnAttestWithReviewNotesCID() public {
        Attestation memory attestation = _buildApprovalAttestationExtended(
            operator, workUID, activeActionId, true, 2, 1, "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
        );

        vm.prank(address(mockEAS));
        bool result = workApprovalResolver.attest(attestation);
        assertTrue(result, "Approval with reviewNotesCID should succeed");
    }

    function testOnAttestWithEmptyReviewNotesCID() public {
        Attestation memory attestation =
            _buildApprovalAttestationExtended(operator, workUID, activeActionId, true, 2, 1, "");

        vm.prank(address(mockEAS));
        bool result = workApprovalResolver.attest(attestation);
        assertTrue(result, "Approval with empty reviewNotesCID should succeed");
    }

    // =========================================================================
    // Schema UID Validation Tests
    // =========================================================================

    function test_revert_InvalidSchema() public {
        bytes32 expectedSchema = bytes32(uint256(200));
        vm.prank(multisig);
        workApprovalResolver.setSchemaUID(expectedSchema);

        // Build attestation with a different schema UID (101 != 200)
        Attestation memory attestation = _buildApprovalAttestation(operator, workUID, activeActionId, true);

        vm.prank(address(mockEAS));
        vm.expectRevert(InvalidSchema.selector);
        workApprovalResolver.attest(attestation);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    function _buildApprovalAttestation(
        address attester,
        bytes32 _workUID,
        uint256 actionUID,
        bool approved
    )
        internal
        view
        returns (Attestation memory)
    {
        return _buildApprovalAttestationExtended(
            attester, _workUID, actionUID, approved, approved ? 2 : 0, approved ? 1 : 0, ""
        );
    }

    function _buildApprovalAttestationExtended(
        address attester,
        bytes32 _workUID,
        uint256 actionUID,
        bool approved,
        uint8 confidence,
        uint8 verificationMethod,
        string memory reviewNotesCID
    )
        internal
        view
        returns (Attestation memory)
    {
        WorkApprovalSchema memory schema = WorkApprovalSchema({
            actionUID: actionUID,
            workUID: _workUID,
            approved: approved,
            feedback: approved ? "Good work" : "Needs improvement",
            confidence: confidence,
            verificationMethod: verificationMethod,
            reviewNotesCID: reviewNotesCID
        });

        return Attestation({
            uid: bytes32(uint256(100)),
            schema: bytes32(uint256(101)),
            time: uint64(block.timestamp),
            expirationTime: 0,
            revocationTime: 0,
            refUID: _workUID,
            recipient: address(mockGarden),
            attester: attester,
            revocable: true,
            data: abi.encode(schema)
        });
    }
}

/// @notice Mock KarmaGAPModule for testing the GAP integration branch
contract MockKarmaForWorkApproval {
    function createImpact(
        address,
        uint256,
        string calldata,
        string calldata,
        string calldata,
        bytes32
    )
        external
        pure
        returns (bytes32)
    {
        return bytes32(uint256(1));
    }
}
