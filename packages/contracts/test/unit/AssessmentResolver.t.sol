// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Attestation } from "@eas/IEAS.sol";

import { AssessmentSchema } from "../../src/Schemas.sol";
import {
    AssessmentResolver,
    NotGardenOperator,
    TitleRequired,
    AssessmentTypeRequired,
    AtLeastOneCapitalRequired,
    InvalidCapital
} from "../../src/resolvers/Assessment.sol";
import { MockEAS } from "../../src/mocks/EAS.sol";
import { MockGardenAccessControl } from "../../src/mocks/GardenAccessControl.sol";

/// @title AssessmentResolverTest
/// @notice Unit tests for AssessmentResolver onAttest validation logic
/// @dev Tests identity checks, required field validation, and capital validation
contract AssessmentResolverTest is Test {
    AssessmentResolver private assessmentResolver;
    MockEAS private mockEAS;
    MockGardenAccessControl private mockGarden;

    address private multisig = address(0x123);
    address private evaluator = address(0x456);
    address private operator = address(0x789);
    address private gardener = address(0x201);
    address private stranger = address(0x999);

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
        assertTrue(assessmentResolver.isPayable(), "Resolver should be payable");
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

    function testOnAttestAllValidCapitals() public {
        // Test all 8 valid capital types
        string[] memory allCapitals = new string[](8);
        allCapitals[0] = "social";
        allCapitals[1] = "material";
        allCapitals[2] = "financial";
        allCapitals[3] = "living";
        allCapitals[4] = "intellectual";
        allCapitals[5] = "experiential";
        allCapitals[6] = "spiritual";
        allCapitals[7] = "cultural";

        AssessmentSchema memory schema = _validAssessment();
        schema.capitals = allCapitals;

        Attestation memory attestation = _buildAssessmentAttestation(evaluator, schema);

        vm.prank(address(mockEAS));
        bool result = assessmentResolver.attest(attestation);
        assertTrue(result, "All 8 valid capitals should be accepted");
    }

    // =========================================================================
    // onAttest: Identity Validation (FIRST check)
    // =========================================================================

    function testOnAttestRevertsForNonEvaluatorNonOperator() public {
        Attestation memory attestation = _buildAssessmentAttestation(stranger, _validAssessment());

        vm.prank(address(mockEAS));
        vm.expectRevert(NotGardenOperator.selector);
        assessmentResolver.attest(attestation);
    }

    function testOnAttestRevertsForGardenerOnly() public {
        // Gardeners cannot create assessments
        Attestation memory attestation = _buildAssessmentAttestation(gardener, _validAssessment());

        vm.prank(address(mockEAS));
        vm.expectRevert(NotGardenOperator.selector);
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

    function testOnAttestRevertsForEmptyAssessmentType() public {
        AssessmentSchema memory schema = _validAssessment();
        schema.assessmentType = "";

        Attestation memory attestation = _buildAssessmentAttestation(evaluator, schema);

        vm.prank(address(mockEAS));
        vm.expectRevert(AssessmentTypeRequired.selector);
        assessmentResolver.attest(attestation);
    }

    function testOnAttestRevertsForEmptyCapitals() public {
        AssessmentSchema memory schema = _validAssessment();
        schema.capitals = new string[](0);

        Attestation memory attestation = _buildAssessmentAttestation(evaluator, schema);

        vm.prank(address(mockEAS));
        vm.expectRevert(AtLeastOneCapitalRequired.selector);
        assessmentResolver.attest(attestation);
    }

    // =========================================================================
    // onAttest: Capital Validation
    // =========================================================================

    function testOnAttestRevertsForInvalidCapital() public {
        AssessmentSchema memory schema = _validAssessment();
        schema.capitals = new string[](1);
        schema.capitals[0] = "invalid_capital";

        Attestation memory attestation = _buildAssessmentAttestation(evaluator, schema);

        vm.prank(address(mockEAS));
        vm.expectRevert(abi.encodeWithSelector(InvalidCapital.selector, "invalid_capital"));
        assessmentResolver.attest(attestation);
    }

    function testOnAttestRevertsForMixedValidAndInvalidCapitals() public {
        AssessmentSchema memory schema = _validAssessment();
        schema.capitals = new string[](3);
        schema.capitals[0] = "social"; // valid
        schema.capitals[1] = "living"; // valid
        schema.capitals[2] = "bogus"; // invalid

        Attestation memory attestation = _buildAssessmentAttestation(evaluator, schema);

        vm.prank(address(mockEAS));
        vm.expectRevert(abi.encodeWithSelector(InvalidCapital.selector, "bogus"));
        assessmentResolver.attest(attestation);
    }

    function testOnAttestRevertsForCapitalCaseSensitivity() public {
        // Capitals must be lowercase
        AssessmentSchema memory schema = _validAssessment();
        schema.capitals = new string[](1);
        schema.capitals[0] = "Social"; // uppercase S should fail

        Attestation memory attestation = _buildAssessmentAttestation(evaluator, schema);

        vm.prank(address(mockEAS));
        vm.expectRevert(abi.encodeWithSelector(InvalidCapital.selector, "Social"));
        assessmentResolver.attest(attestation);
    }

    // =========================================================================
    // onAttest: Validation Order Tests
    // =========================================================================

    function testValidationOrderIdentityBeforeFields() public {
        // Stranger with empty title: should revert with NotGardenOperator (identity check first)
        AssessmentSchema memory schema = _validAssessment();
        schema.title = "";

        Attestation memory attestation = _buildAssessmentAttestation(stranger, schema);

        vm.prank(address(mockEAS));
        vm.expectRevert(NotGardenOperator.selector);
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
    // Configuration Tests
    // =========================================================================

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
    // Helpers
    // =========================================================================

    function _validAssessment() internal pure returns (AssessmentSchema memory) {
        string[] memory capitals = new string[](2);
        capitals[0] = "living";
        capitals[1] = "social";

        string[] memory evidence = new string[](1);
        evidence[0] = "ipfs://QmEvidence";

        string[] memory reports = new string[](1);
        reports[0] = "ipfs://QmReport";

        string[] memory tags = new string[](1);
        tags[0] = "biodiversity";

        return AssessmentSchema({
            title: "Q1 Assessment",
            description: "Biodiversity assessment",
            assessmentType: "biodiversity",
            capitals: capitals,
            metricsJSON: "ipfs://QmMetrics",
            evidenceMedia: evidence,
            reportDocuments: reports,
            impactAttestations: new bytes32[](0),
            startDate: 1_000_000,
            endDate: 2_000_000,
            location: "Garden Plot A",
            tags: tags
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
            data: abi.encode(schema)
        });
    }
}
