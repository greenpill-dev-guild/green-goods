// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Attestation } from "@eas/IEAS.sol";

import { AssessmentSchema } from "../../src/Schemas.sol";
import {
    AssessmentResolver,
    NotAuthorizedAttester,
    TitleRequired,
    ConfigCIDRequired,
    InvalidDomain,
    InvalidSchema
} from "../../src/resolvers/Assessment.sol";
import { MockEAS } from "../../src/mocks/EAS.sol";
import { MockGardenAccessControl } from "../../src/mocks/GardenAccessControl.sol";

interface IAssessmentV3ConfigRedTarget {
    function setAssessmentV3SchemaUID(bytes32 uid) external;
    function assessmentV3SchemaUID() external view returns (bytes32);
}

struct AssessmentV3Input {
    string title;
    string description;
    string assessmentConfigCID;
    uint8 domain;
    uint256 startDate;
    uint256 endDate;
    string location;
    uint8 assessmentKind;
    uint256 cycleId;
    bytes32 baselineUID;
}

error AssessmentV2SchemaUIDRequired();
error AssessmentV3SchemaUIDRequired();
error SchemaUIDCollision(bytes32 uid);
error InvalidAssessmentKind(uint8 kind);
error BaselineRequired();
error BaselineForbidden();
error InvalidBaseline(bytes32 baselineUID);
error BaselineGardenMismatch(bytes32 baselineUID, address expectedGarden, address actualGarden);

/// @title AssessmentResolverTest
/// @notice Unit tests for AssessmentResolver v2 onAttest validation logic
/// @dev Tests identity checks, required field validation, and domain validation
contract AssessmentResolverTest is Test {
    AssessmentResolver private assessmentResolver;
    MockEAS private mockEAS;
    MockGardenAccessControl private mockGarden;

    address private multisig = address(0x123);
    address private evaluator = address(0x456);
    address private operator = address(0x789);
    address private gardener = address(0x201);
    address private stranger = address(0x999);

    bytes32 private constant ASSESSMENT_V2_UID = bytes32(uint256(200));
    bytes32 private constant ASSESSMENT_V3_UID = bytes32(uint256(300));

    function setUp() public {
        // Deploy mock EAS and garden access control
        mockEAS = new MockEAS();
        mockGarden = new MockGardenAccessControl();

        // Configure roles
        mockGarden.setEvaluator(evaluator, true);
        mockGarden.setOperator(operator, true);
        mockGarden.setGardener(gardener, true);

        // Deploy AssessmentResolver with proxy
        AssessmentResolver resolverImpl = new AssessmentResolver(address(mockEAS));
        bytes memory resolverInitData = abi.encodeWithSelector(AssessmentResolver.initialize.selector, multisig);
        ERC1967Proxy resolverProxy = new ERC1967Proxy(address(resolverImpl), resolverInitData);
        assessmentResolver = AssessmentResolver(payable(address(resolverProxy)));
    }

    // =========================================================================
    // Initialization Tests
    // =========================================================================

    function testInitialize() public {
        assertEq(assessmentResolver.owner(), multisig, "Owner should be multisig");
    }

    function testIsPayable() public {
        assertFalse(assessmentResolver.isPayable(), "Resolver should not be payable");
    }

    // =========================================================================
    // onAttest: Happy Path Tests
    // =========================================================================

    function testOnAttestValidEvaluatorAssessment() public {
        Attestation memory attestation = _buildAssessmentAttestation(evaluator, _validAssessment());

        vm.prank(address(mockEAS));
        bool result = assessmentResolver.attest(attestation);
        assertTrue(result, "Valid evaluator assessment should succeed");
    }

    function testOnAttestValidOperatorAssessment() public {
        Attestation memory attestation = _buildAssessmentAttestation(operator, _validAssessment());

        vm.prank(address(mockEAS));
        bool result = assessmentResolver.attest(attestation);
        assertTrue(result, "Operator should also be able to create assessments");
    }

    function testOnAttestAllValidDomains() public {
        // Test all 4 valid domain values (SOLAR=0, AGRO=1, EDU=2, WASTE=3)
        for (uint8 d = 0; d <= 3; d++) {
            AssessmentSchema memory schema = _validAssessment();
            schema.domain = d;

            Attestation memory attestation = _buildAssessmentAttestation(evaluator, schema);

            vm.prank(address(mockEAS));
            bool result = assessmentResolver.attest(attestation);
            assertTrue(result, "Valid domain should be accepted");
        }
    }

    // =========================================================================
    // onAttest: Identity Validation (FIRST check)
    // =========================================================================

    function testOnAttestRevertsForNonEvaluatorNonOperator() public {
        Attestation memory attestation = _buildAssessmentAttestation(stranger, _validAssessment());

        vm.prank(address(mockEAS));
        vm.expectRevert(NotAuthorizedAttester.selector);
        assessmentResolver.attest(attestation);
    }

    function testOnAttestRevertsForGardenerOnly() public {
        // Gardeners cannot create assessments
        Attestation memory attestation = _buildAssessmentAttestation(gardener, _validAssessment());

        vm.prank(address(mockEAS));
        vm.expectRevert(NotAuthorizedAttester.selector);
        assessmentResolver.attest(attestation);
    }

    // =========================================================================
    // onAttest: Required Fields Validation
    // =========================================================================

    function testOnAttestRevertsForEmptyTitle() public {
        AssessmentSchema memory schema = _validAssessment();
        schema.title = "";

        Attestation memory attestation = _buildAssessmentAttestation(evaluator, schema);

        vm.prank(address(mockEAS));
        vm.expectRevert(TitleRequired.selector);
        assessmentResolver.attest(attestation);
    }

    function testOnAttestRevertsForEmptyConfigCID() public {
        AssessmentSchema memory schema = _validAssessment();
        schema.assessmentConfigCID = "";

        Attestation memory attestation = _buildAssessmentAttestation(evaluator, schema);

        vm.prank(address(mockEAS));
        vm.expectRevert(ConfigCIDRequired.selector);
        assessmentResolver.attest(attestation);
    }

    // =========================================================================
    // onAttest: Domain Validation
    // =========================================================================

    function testOnAttestRevertsForInvalidDomain() public {
        AssessmentSchema memory schema = _validAssessment();
        schema.domain = 4; // Invalid — only 0-3 are valid

        Attestation memory attestation = _buildAssessmentAttestation(evaluator, schema);

        vm.prank(address(mockEAS));
        vm.expectRevert(abi.encodeWithSelector(InvalidDomain.selector, uint8(4)));
        assessmentResolver.attest(attestation);
    }

    function testOnAttestRevertsForMaxUint8Domain() public {
        AssessmentSchema memory schema = _validAssessment();
        schema.domain = 255;

        Attestation memory attestation = _buildAssessmentAttestation(evaluator, schema);

        vm.prank(address(mockEAS));
        vm.expectRevert(abi.encodeWithSelector(InvalidDomain.selector, uint8(255)));
        assessmentResolver.attest(attestation);
    }

    // =========================================================================
    // onAttest: Domain Fuzz Tests
    // =========================================================================

    function testFuzz_assessmentDomainValidation(uint8 domain) public {
        AssessmentSchema memory schema = _validAssessment();
        schema.domain = domain;

        Attestation memory attestation = _buildAssessmentAttestation(evaluator, schema);

        vm.prank(address(mockEAS));
        if (domain <= 3) {
            bool result = assessmentResolver.attest(attestation);
            assertTrue(result, "Valid domain should be accepted");
        } else {
            vm.expectRevert(abi.encodeWithSelector(InvalidDomain.selector, domain));
            assessmentResolver.attest(attestation);
        }
    }

    // =========================================================================
    // onAttest: Validation Order Tests
    // =========================================================================

    function testValidationOrderIdentityBeforeFields() public {
        // Stranger with empty title: should revert with NotAuthorizedAttester (identity check first)
        AssessmentSchema memory schema = _validAssessment();
        schema.title = "";

        Attestation memory attestation = _buildAssessmentAttestation(stranger, schema);

        vm.prank(address(mockEAS));
        vm.expectRevert(NotAuthorizedAttester.selector);
        assessmentResolver.attest(attestation);
    }

    // =========================================================================
    // onRevoke Tests
    // =========================================================================

    function testOnRevokeAlwaysReturnsFalse() public {
        Attestation memory attestation = _buildAssessmentAttestation(evaluator, _validAssessment());

        vm.prank(address(mockEAS));
        bool result = assessmentResolver.revoke(attestation);
        assertFalse(result, "Assessments should not be revocable");
    }

    // =========================================================================
    // Configuration Tests (with Event Verification)
    // =========================================================================

    event KarmaGAPModuleUpdated(address indexed oldModule, address indexed newModule);
    event SchemaUIDUpdated(bytes32 indexed schemaUID);

    function testSetSchemaUID_emitsEvent() public {
        bytes32 newSchemaUID = bytes32(uint256(300));

        vm.expectEmit(true, false, false, false);
        emit SchemaUIDUpdated(newSchemaUID);

        vm.prank(multisig);
        assessmentResolver.setSchemaUID(newSchemaUID);
    }

    function testSetKarmaGAPModule_emitsEvent() public {
        address module = address(0xCAFE);

        vm.expectEmit(true, true, false, false);
        emit KarmaGAPModuleUpdated(address(0), module);

        vm.prank(multisig);
        assessmentResolver.setKarmaGAPModule(module);
    }

    function testSetKarmaGAPModule() public {
        address module = address(0xCAFE);

        vm.prank(multisig);
        assessmentResolver.setKarmaGAPModule(module);

        assertEq(address(assessmentResolver.karmaGAPModule()), module);
    }

    function testOnlyOwnerCanSetKarmaGAPModule() public {
        vm.prank(stranger);
        vm.expectRevert("Ownable: caller is not the owner");
        assessmentResolver.setKarmaGAPModule(address(0xCAFE));
    }

    // =========================================================================
    // Access Control Tests
    // =========================================================================

    function testOnlyEASCanCallAttest() public {
        Attestation memory attestation = _buildAssessmentAttestation(evaluator, _validAssessment());

        vm.prank(stranger);
        vm.expectRevert();
        assessmentResolver.attest(attestation);
    }

    // =========================================================================
    // Double Initialization Test
    // =========================================================================

    function test_initialize_revertsOnDoubleInit() public {
        vm.expectRevert("Initializable: contract is already initialized");
        assessmentResolver.initialize(address(0x999));
    }

    // =========================================================================
    // UUPS Upgrade Tests
    // =========================================================================

    function test_authorizeUpgrade_ownerCanUpgrade() public {
        AssessmentResolver newImpl = new AssessmentResolver(address(mockEAS));

        vm.prank(multisig);
        assessmentResolver.upgradeTo(address(newImpl));
    }

    function test_authorizeUpgrade_nonOwnerCannotUpgrade() public {
        AssessmentResolver newImpl = new AssessmentResolver(address(mockEAS));

        vm.prank(stranger);
        vm.expectRevert("Ownable: caller is not the owner");
        assessmentResolver.upgradeTo(address(newImpl));
    }

    // =========================================================================
    // GAP Integration Branch Tests (karmaGAPModule configured vs not)
    // =========================================================================

    function testOnAttestSucceedsWithKarmaGAPModuleConfigured() public {
        // Configure a mock KarmaGAPModule (just needs to not revert on createMilestone)
        MockKarmaGAPModule mockModule = new MockKarmaGAPModule();

        vm.prank(multisig);
        assessmentResolver.setKarmaGAPModule(address(mockModule));

        Attestation memory attestation = _buildAssessmentAttestation(evaluator, _validAssessment());

        vm.prank(address(mockEAS));
        bool result = assessmentResolver.attest(attestation);
        assertTrue(result, "Assessment should succeed with GAP module configured");
        assertTrue(mockModule.createMilestoneCalled(), "GAP module should have been called");
    }

    function testOnAttestSucceedsWithoutKarmaGAPModule() public {
        // Default setup: no karmaGAPModule configured
        assertEq(address(assessmentResolver.karmaGAPModule()), address(0));

        Attestation memory attestation = _buildAssessmentAttestation(evaluator, _validAssessment());

        vm.prank(address(mockEAS));
        bool result = assessmentResolver.attest(attestation);
        assertTrue(result, "Assessment should succeed without GAP module");
    }

    function testOnAttestSucceedsWhenKarmaGAPModuleReverts() public {
        // Configure a failing mock
        MockKarmaGAPModule mockModule = new MockKarmaGAPModule();
        mockModule.setShouldRevert(true);

        vm.prank(multisig);
        assessmentResolver.setKarmaGAPModule(address(mockModule));

        Attestation memory attestation = _buildAssessmentAttestation(evaluator, _validAssessment());

        vm.prank(address(mockEAS));
        bool result = assessmentResolver.attest(attestation);
        assertTrue(result, "Assessment should succeed even when GAP module reverts (try/catch)");
    }

    // =========================================================================
    // Schema UID Validation Tests
    // =========================================================================

    function test_revert_InvalidSchema() public {
        bytes32 expectedSchema = bytes32(uint256(200));
        vm.prank(multisig);
        assessmentResolver.setSchemaUID(expectedSchema);

        // Build attestation with a different schema UID (102 != 200)
        Attestation memory attestation = _buildAssessmentAttestation(evaluator, _validAssessment());

        vm.prank(address(mockEAS));
        vm.expectRevert(InvalidSchema.selector);
        assessmentResolver.attest(attestation);
    }

    // =========================================================================
    // Assessment v3 In-Place Upgrade and Dual-Schema Tests (PRD-721 RED)
    // =========================================================================

    event AssessmentV3SchemaUIDUpdated(bytes32 indexed oldUID, bytes32 indexed newUID);

    function testSetAssessmentV3SchemaUIDRequiresPinnedV2() public {
        vm.prank(multisig);
        vm.expectRevert(AssessmentV2SchemaUIDRequired.selector);
        IAssessmentV3ConfigRedTarget(address(assessmentResolver)).setAssessmentV3SchemaUID(ASSESSMENT_V3_UID);
    }

    function testSetAssessmentV3SchemaUIDRejectsZeroAndCollision() public {
        vm.prank(multisig);
        assessmentResolver.setSchemaUID(ASSESSMENT_V2_UID);

        vm.prank(multisig);
        vm.expectRevert(AssessmentV3SchemaUIDRequired.selector);
        IAssessmentV3ConfigRedTarget(address(assessmentResolver)).setAssessmentV3SchemaUID(bytes32(0));

        vm.prank(multisig);
        vm.expectRevert(abi.encodeWithSelector(SchemaUIDCollision.selector, ASSESSMENT_V2_UID));
        IAssessmentV3ConfigRedTarget(address(assessmentResolver)).setAssessmentV3SchemaUID(ASSESSMENT_V2_UID);
    }

    function testSetAssessmentV3SchemaUIDEmitsOldAndNew() public {
        vm.prank(multisig);
        assessmentResolver.setSchemaUID(ASSESSMENT_V2_UID);

        vm.expectEmit(true, true, false, false);
        emit AssessmentV3SchemaUIDUpdated(bytes32(0), ASSESSMENT_V3_UID);
        vm.prank(multisig);
        IAssessmentV3ConfigRedTarget(address(assessmentResolver)).setAssessmentV3SchemaUID(ASSESSMENT_V3_UID);

        assertEq(IAssessmentV3ConfigRedTarget(address(assessmentResolver)).assessmentV3SchemaUID(), ASSESSMENT_V3_UID);
    }

    function testV2AttestationStillResolvesAfterV3Activation() public {
        _activateDualSchemas();
        Attestation memory attestation = _buildAssessmentAttestation(evaluator, _validAssessment());
        attestation.schema = ASSESSMENT_V2_UID;

        vm.prank(address(mockEAS));
        assertTrue(assessmentResolver.attest(attestation));
    }

    function testV3BaselineAllowsEvaluatorOrOperator() public {
        _activateDualSchemas();
        AssessmentV3Input memory schema = _validAssessmentV3();

        vm.prank(address(mockEAS));
        assertTrue(assessmentResolver.attest(_buildAssessmentV3Attestation(operator, schema)));

        vm.prank(address(mockEAS));
        assertTrue(assessmentResolver.attest(_buildAssessmentV3Attestation(evaluator, schema)));
    }

    function testV3DeltaRequiresEvaluator() public {
        _activateDualSchemas();
        bytes32 baselineUID = _storeBaselineAttestation(address(mockGarden), ASSESSMENT_V2_UID);
        AssessmentV3Input memory schema = _validAssessmentV3();
        schema.assessmentKind = 1;
        schema.baselineUID = baselineUID;

        vm.prank(address(mockEAS));
        vm.expectRevert(NotAuthorizedAttester.selector);
        assessmentResolver.attest(_buildAssessmentV3Attestation(operator, schema));
    }

    function testV3RejectsUnknownKind() public {
        _activateDualSchemas();
        AssessmentV3Input memory schema = _validAssessmentV3();
        schema.assessmentKind = 3;

        vm.prank(address(mockEAS));
        vm.expectRevert(abi.encodeWithSelector(InvalidAssessmentKind.selector, uint8(3)));
        assessmentResolver.attest(_buildAssessmentV3Attestation(evaluator, schema));
    }

    function testV3DeltaRequiresBaseline() public {
        _activateDualSchemas();
        AssessmentV3Input memory schema = _validAssessmentV3();
        schema.assessmentKind = 1;

        vm.prank(address(mockEAS));
        vm.expectRevert(BaselineRequired.selector);
        assessmentResolver.attest(_buildAssessmentV3Attestation(evaluator, schema));
    }

    function testV3BaselineForbidsBaselineUID() public {
        _activateDualSchemas();
        AssessmentV3Input memory schema = _validAssessmentV3();
        schema.baselineUID = bytes32(uint256(1));

        vm.prank(address(mockEAS));
        vm.expectRevert(BaselineForbidden.selector);
        assessmentResolver.attest(_buildAssessmentV3Attestation(evaluator, schema));
    }

    function testV3DeltaRejectsUnknownBaseline() public {
        _activateDualSchemas();
        AssessmentV3Input memory schema = _validAssessmentV3();
        schema.assessmentKind = 1;
        schema.baselineUID = bytes32(uint256(0xBAD));

        vm.prank(address(mockEAS));
        vm.expectRevert(abi.encodeWithSelector(InvalidBaseline.selector, schema.baselineUID));
        assessmentResolver.attest(_buildAssessmentV3Attestation(evaluator, schema));
    }

    function testV3DeltaRejectsBaselineFromAnotherGarden() public {
        _activateDualSchemas();
        address otherGarden = address(new MockGardenAccessControl());
        bytes32 baselineUID = _storeBaselineAttestation(otherGarden, ASSESSMENT_V2_UID);
        AssessmentV3Input memory schema = _validAssessmentV3();
        schema.assessmentKind = 1;
        schema.baselineUID = baselineUID;

        vm.prank(address(mockEAS));
        vm.expectRevert(
            abi.encodeWithSelector(BaselineGardenMismatch.selector, baselineUID, address(mockGarden), otherGarden)
        );
        assessmentResolver.attest(_buildAssessmentV3Attestation(evaluator, schema));
    }

    function testV2SetterCannotDisableOrCollideAfterV3Activation() public {
        _activateDualSchemas();

        vm.prank(multisig);
        vm.expectRevert(AssessmentV2SchemaUIDRequired.selector);
        assessmentResolver.setSchemaUID(bytes32(0));

        vm.prank(multisig);
        vm.expectRevert(abi.encodeWithSelector(SchemaUIDCollision.selector, ASSESSMENT_V3_UID));
        assessmentResolver.setSchemaUID(ASSESSMENT_V3_UID);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    function _validAssessment() internal pure returns (AssessmentSchema memory) {
        return AssessmentSchema({
            title: "Q1 Assessment",
            description: "Solar panel installation assessment",
            assessmentConfigCID: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
            domain: 0, // SOLAR
            startDate: 1_000_000,
            endDate: 2_000_000,
            location: "Garden Plot A"
        });
    }

    function _validAssessmentV3() internal pure returns (AssessmentV3Input memory) {
        return AssessmentV3Input({
            title: "Q2 Baseline",
            description: "Baseline assessment",
            assessmentConfigCID: "bafy-assessment-v3-config",
            domain: 1,
            startDate: 2_000_000,
            endDate: 3_000_000,
            location: "Garden Plot B",
            assessmentKind: 0,
            cycleId: 0,
            baselineUID: bytes32(0)
        });
    }

    function _activateDualSchemas() internal {
        vm.startPrank(multisig);
        assessmentResolver.setSchemaUID(ASSESSMENT_V2_UID);
        IAssessmentV3ConfigRedTarget(address(assessmentResolver)).setAssessmentV3SchemaUID(ASSESSMENT_V3_UID);
        vm.stopPrank();
    }

    function _storeBaselineAttestation(address recipient, bytes32 schema) internal returns (bytes32 uid) {
        uid = keccak256(abi.encode(recipient, schema));
        Attestation memory baseline = _buildAssessmentAttestation(evaluator, _validAssessment());
        baseline.uid = uid;
        baseline.schema = schema;
        baseline.recipient = recipient;
        mockEAS.setAttestationByUID(uid, baseline);
    }

    function _buildAssessmentV3Attestation(
        address attester,
        AssessmentV3Input memory schema
    )
        internal
        view
        returns (Attestation memory)
    {
        return Attestation({
            uid: bytes32(uint256(2)),
            schema: ASSESSMENT_V3_UID,
            time: uint64(block.timestamp),
            expirationTime: 0,
            revocationTime: 0,
            refUID: bytes32(0),
            recipient: address(mockGarden),
            attester: attester,
            revocable: false,
            data: abi.encode(
                schema.title,
                schema.description,
                schema.assessmentConfigCID,
                schema.domain,
                schema.startDate,
                schema.endDate,
                schema.location,
                schema.assessmentKind,
                schema.cycleId,
                schema.baselineUID
            )
        });
    }

    function _buildAssessmentAttestation(
        address attester,
        AssessmentSchema memory schema
    )
        internal
        view
        returns (Attestation memory)
    {
        // Encode as flat tuple to match how clients encode via encodeAbiParameters.
        // See src/resolvers/Work.sol for details on struct vs tuple ABI encoding.
        return Attestation({
            uid: bytes32(uint256(1)),
            schema: bytes32(uint256(102)),
            time: uint64(block.timestamp),
            expirationTime: 0,
            revocationTime: 0,
            refUID: bytes32(0),
            recipient: address(mockGarden), // Garden address = IGardenAccessControl
            attester: attester,
            revocable: true,
            data: abi.encode(
                schema.title,
                schema.description,
                schema.assessmentConfigCID,
                schema.domain,
                schema.startDate,
                schema.endDate,
                schema.location
            )
        });
    }
}

/// @notice Minimal mock for IKarmaGAPModule.createMilestone used in assessment tests
contract MockKarmaGAPModule {
    bool private _createMilestoneCalled;
    bool private _shouldRevert;

    function createMilestone(
        address,
        string calldata,
        string calldata,
        uint256,
        uint256,
        uint8,
        string calldata,
        string calldata
    )
        external
        returns (bytes32)
    {
        if (_shouldRevert) revert("MockKarmaGAPModule: failed");
        _createMilestoneCalled = true;
        return bytes32(uint256(1));
    }

    function createMilestoneCalled() external view returns (bool) {
        return _createMilestoneCalled;
    }

    function setShouldRevert(bool val) external {
        _shouldRevert = val;
    }
}
