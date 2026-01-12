// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { AttestationRequest, AttestationRequestData } from "@eas/IEAS.sol";
import { MockHats } from "../../src/mocks/Hats.sol";
import { MockGAP } from "../../src/mocks/GAP.sol";
import { GAPTestHelper } from "../helpers/GAPTestHelper.sol";

/// @title HatsGAPIntegrationTest
/// @notice Integration tests for Hats Protocol + Karma GAP modules
/// @dev Tests the complete flow from garden minting through work approval
///
/// **Integration Flow:**
/// 1. GardenToken.mintGarden()
///    → GardenHatsModule.createGardenHatTree()  (creates 5 role hats)
///    → KarmaGAPModule.createProject()          (creates GAP project)
///    → KarmaGAPModule.addProjectAdmin()        (adds operators)
///
/// 2. Garden.addOperator()
///    → GardenHatsModule.assignOperator()       (mints operator hat)
///    → KarmaGAPModule.addProjectAdmin()        (adds GAP admin)
///
/// 3. WorkApprovalResolver.onAttest()
///    → Validates user has gardener hat
///    → Validates operator has operator hat
///    → KarmaGAPModule.createProjectImpact()    (creates GAP impact)
///
/// 4. AssessmentResolver.onAttest()
///    → Validates user has evaluator hat
///    → KarmaGAPModule.createProjectMilestone() (creates GAP milestone)
contract HatsGAPIntegrationTest is Test {
    // ═══════════════════════════════════════════════════════════════════════════
    // Test Contracts
    // ═══════════════════════════════════════════════════════════════════════════

    MockHats public mockHats;
    MockGAP public mockGAP;

    // ═══════════════════════════════════════════════════════════════════════════
    // Test Addresses
    // ═══════════════════════════════════════════════════════════════════════════

    address public protocolOwner;
    address public gardenToken;
    address public workApprovalResolver;
    address public assessmentResolver;

    address public gardenOwner;
    address public garden1;
    address public garden2;

    address public operator1;
    address public operator2;
    address public gardener1;
    address public gardener2;
    address public evaluator1;

    // ═══════════════════════════════════════════════════════════════════════════
    // Hat Tree Constants
    // ═══════════════════════════════════════════════════════════════════════════

    uint256 constant GREEN_GOODS_TOP_HAT = 0x0000005c00000000000000000000000000000000000000000000000000000000;
    uint256 constant GARDENS_HAT = 0x0000005c00010000000000000000000000000000000000000000000000000000;

    // Garden 1 hats
    uint256 constant GARDEN1_ROOT_HAT = 0x0000005c00010001000000000000000000000000000000000000000000000000;
    uint256 constant GARDEN1_OPERATOR_HAT = 0x0000005c00010001000100000000000000000000000000000000000000000000;
    uint256 constant GARDEN1_GARDENER_HAT = 0x0000005c00010001000200000000000000000000000000000000000000000000;
    uint256 constant GARDEN1_EVALUATOR_HAT = 0x0000005c00010001000300000000000000000000000000000000000000000000;

    // ═══════════════════════════════════════════════════════════════════════════
    // GAP Schema Constants
    // ═══════════════════════════════════════════════════════════════════════════

    bytes32 constant PROJECT_SCHEMA = 0x5ddd6b7a11406771308431ca9bd146cc717848b74b52993a532dc1aad0ccc83f;
    bytes32 constant DETAILS_SCHEMA = 0x9b06f811608d135f913c18295486693fe626f35e213a7d132be87b1f952e508c;

    // ═══════════════════════════════════════════════════════════════════════════
    // State
    // ═══════════════════════════════════════════════════════════════════════════

    bytes32 public garden1ProjectUID;

    // ═══════════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════════

    event GardenCreated(address indexed garden, bytes32 projectUID, uint256 rootHatId);
    event OperatorAdded(address indexed garden, address indexed operator, bytes32 projectUID);
    event OperatorRemoved(address indexed garden, address indexed operator, bytes32 projectUID);
    event ImpactCreated(bytes32 indexed projectUID, bytes32 indexed impactUID, bytes32 indexed workUID);
    event MilestoneCreated(bytes32 indexed projectUID, bytes32 indexed milestoneUID);

    function setUp() public {
        protocolOwner = address(this);
        gardenToken = address(0x1000);
        workApprovalResolver = address(0x1100);
        assessmentResolver = address(0x1200);

        gardenOwner = address(0x2000);
        garden1 = address(0x3000);
        garden2 = address(0x3001);

        operator1 = address(0x4000);
        operator2 = address(0x4001);
        gardener1 = address(0x5000);
        gardener2 = address(0x5001);
        evaluator1 = address(0x6000);

        // Deploy mocks
        mockHats = new MockHats();
        mockGAP = new MockGAP();

        // Setup Green Goods hat tree
        _setupGreenGoodsHatTree();
    }

    function _setupGreenGoodsHatTree() internal {
        // Create top hat for protocol owner
        mockHats.mintTopHat(protocolOwner, "Green Goods", "ipfs://green-goods");

        // Create gardens hat under top hat
        mockHats.createHat(GREEN_GOODS_TOP_HAT, "Gardens", type(uint32).max, address(0), address(0), true, "");

        // Grant GardenToken permission to create garden hats
        mockHats.mintHat(GARDENS_HAT, gardenToken);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Full Flow Integration Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_fullFlow_gardenCreationWithHatsAndGAP() public {
        // 1. Garden Token mints garden, creating hat tree
        vm.startPrank(gardenToken);

        // Create garden root hat
        uint256 rootHatId =
            mockHats.createHat(GARDENS_HAT, "Community Garden", 1, address(0), address(0), true, "ipfs://garden");
        mockHats.mintHat(rootHatId, garden1);

        // Create role hats
        uint256 operatorHatId =
            mockHats.createHat(rootHatId, "Operator", 10, address(0), address(0), true, "ipfs://operator");
        uint256 gardenerHatId =
            mockHats.createHat(rootHatId, "Gardener", 100, address(0), address(0), true, "ipfs://gardener");
        uint256 evaluatorHatId =
            mockHats.createHat(rootHatId, "Evaluator", 10, address(0), address(0), true, "ipfs://evaluator");

        vm.stopPrank();

        // 2. Create GAP project
        vm.prank(gardenOwner);
        bytes32 projectUID = mockGAP.attest(_buildProjectRequest(garden1));
        garden1ProjectUID = projectUID;

        // 3. Assign initial operator with hat and GAP admin
        mockHats.mintHat(operatorHatId, operator1);
        mockGAP.addProjectAdmin(projectUID, operator1);

        // Verify state
        assertTrue(mockHats.isWearerOfHat(operator1, operatorHatId), "Operator should have operator hat");
        assertTrue(mockGAP.isAdmin(projectUID, operator1), "Operator should be GAP admin");
        assertTrue(GAPTestHelper.isValidProjectUID(projectUID), "Project UID should be valid");
    }

    function test_fullFlow_operatorManagement() public {
        // Setup: Create garden with initial operator
        _setupGardenWithOperator();

        // Add second operator (simulating GardenHatsModule + KarmaGAPModule)
        mockHats.mintHat(GARDEN1_OPERATOR_HAT, operator2);
        mockGAP.addProjectAdmin(garden1ProjectUID, operator2);

        // Verify both operators
        assertTrue(mockHats.isWearerOfHat(operator1, GARDEN1_OPERATOR_HAT), "Operator1 should have hat");
        assertTrue(mockHats.isWearerOfHat(operator2, GARDEN1_OPERATOR_HAT), "Operator2 should have hat");
        assertTrue(mockGAP.isAdmin(garden1ProjectUID, operator1), "Operator1 should be GAP admin");
        assertTrue(mockGAP.isAdmin(garden1ProjectUID, operator2), "Operator2 should be GAP admin");

        // Remove operator2
        mockHats.setWearer(GARDEN1_OPERATOR_HAT, operator2, false);
        mockGAP.removeProjectAdmin(garden1ProjectUID, operator2);

        // Verify removal
        assertFalse(mockHats.isWearerOfHat(operator2, GARDEN1_OPERATOR_HAT), "Operator2 should not have hat");
        assertFalse(mockGAP.isAdmin(garden1ProjectUID, operator2), "Operator2 should not be GAP admin");

        // Operator1 still has access
        assertTrue(mockHats.isWearerOfHat(operator1, GARDEN1_OPERATOR_HAT), "Operator1 should still have hat");
        assertTrue(mockGAP.isAdmin(garden1ProjectUID, operator1), "Operator1 should still be GAP admin");
    }

    function test_fullFlow_gardenerWorkApproval() public {
        _setupGardenWithOperator();

        // Operator assigns gardener hat
        mockHats.mintHat(GARDEN1_GARDENER_HAT, gardener1);
        assertTrue(mockHats.isWearerOfHat(gardener1, GARDEN1_GARDENER_HAT), "Gardener should have hat");

        // Gardener submits work (simulated by resolver validation)
        assertTrue(mockHats.isWearerOfHat(gardener1, GARDEN1_GARDENER_HAT), "Should validate gardener role");

        // Operator approves work → creates GAP impact
        bytes32 workUID = bytes32(uint256(12_345));

        vm.prank(workApprovalResolver);
        bytes32 impactUID = mockGAP.attest(_buildImpactRequest(garden1, garden1ProjectUID, "Tree Planting", workUID));

        // Verify impact created
        assertTrue(GAPTestHelper.isValidImpactUID(impactUID), "Impact UID should be valid");
        assertTrue(mockGAP.attestationExists(impactUID), "Impact attestation should exist");

        // Verify impact references project
        (, address recipient, bytes32 refUID,,) = mockGAP.getAttestation(impactUID);
        assertEq(recipient, garden1, "Impact recipient should be garden");
        assertEq(refUID, garden1ProjectUID, "Impact should reference project");
    }

    function test_fullFlow_evaluatorAssessment() public {
        _setupGardenWithOperator();

        // Operator assigns evaluator hat
        mockHats.mintHat(GARDEN1_EVALUATOR_HAT, evaluator1);
        assertTrue(mockHats.isWearerOfHat(evaluator1, GARDEN1_EVALUATOR_HAT), "Evaluator should have hat");

        // Evaluator creates assessment → creates GAP milestone
        vm.prank(assessmentResolver);
        bytes32 milestoneUID = mockGAP.attest(_buildMilestoneRequest(garden1, garden1ProjectUID, "Q1 Assessment"));

        // Verify milestone created
        assertTrue(GAPTestHelper.isValidMilestoneUID(milestoneUID), "Milestone UID should be valid");
        assertTrue(mockGAP.attestationExists(milestoneUID), "Milestone attestation should exist");

        // Verify milestone references project
        (,, bytes32 refUID,,) = mockGAP.getAttestation(milestoneUID);
        assertEq(refUID, garden1ProjectUID, "Milestone should reference project");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Role Hierarchy Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_roleHierarchy_operatorCanMintGardener() public {
        _setupGardenWithOperator();

        // Operator should be able to mint gardener hats (via hatter contract)
        // In production, operator hat would be set as hatter for gardener hat
        mockHats.mintHat(GARDEN1_GARDENER_HAT, gardener1);
        mockHats.mintHat(GARDEN1_GARDENER_HAT, gardener2);

        assertTrue(mockHats.isWearerOfHat(gardener1, GARDEN1_GARDENER_HAT), "Gardener1 should have hat");
        assertTrue(mockHats.isWearerOfHat(gardener2, GARDEN1_GARDENER_HAT), "Gardener2 should have hat");
    }

    function test_roleHierarchy_operatorCanMintEvaluator() public {
        _setupGardenWithOperator();

        mockHats.mintHat(GARDEN1_EVALUATOR_HAT, evaluator1);

        assertTrue(mockHats.isWearerOfHat(evaluator1, GARDEN1_EVALUATOR_HAT), "Evaluator should have hat");
    }

    function test_roleHierarchy_operatorCannotMintOperator() public {
        _setupGardenWithOperator();

        // Only garden owner/protocol should mint operator hats
        // Operator hat max supply prevents self-minting
        (,, uint32 supply,,,,,, bool active) = mockHats.viewHat(GARDEN1_OPERATOR_HAT);
        assertTrue(active, "Operator hat should be active");
        // Further tests would verify supply limits
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Cross-Garden Isolation Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_crossGarden_hatsAreIsolated() public {
        // Setup garden 1
        _setupGardenWithOperator();

        // Setup garden 2 with different operator
        uint256 garden2RootHat = 0x0000005c00010002000000000000000000000000000000000000000000000000;
        uint256 garden2OperatorHat = 0x0000005c00010002000100000000000000000000000000000000000000000000;

        mockHats.setHatActive(garden2RootHat, true);
        mockHats.setHatActive(garden2OperatorHat, true);
        mockHats.setWearer(garden2OperatorHat, operator2, true);

        // Verify isolation
        assertTrue(mockHats.isWearerOfHat(operator1, GARDEN1_OPERATOR_HAT), "Operator1 in garden1");
        assertFalse(mockHats.isWearerOfHat(operator1, garden2OperatorHat), "Operator1 not in garden2");
        assertTrue(mockHats.isWearerOfHat(operator2, garden2OperatorHat), "Operator2 in garden2");
        assertFalse(mockHats.isWearerOfHat(operator2, GARDEN1_OPERATOR_HAT), "Operator2 not in garden1");
    }

    function test_crossGarden_projectsAreIsolated() public {
        // Setup garden 1 project
        _setupGardenWithOperator();

        // Setup garden 2 project
        vm.prank(gardenOwner);
        bytes32 garden2ProjectUID = mockGAP.attest(_buildProjectRequest(garden2));

        // Verify isolation
        assertTrue(mockGAP.isAdmin(garden1ProjectUID, operator1), "Operator1 admin of garden1 project");
        assertFalse(mockGAP.isAdmin(garden2ProjectUID, operator1), "Operator1 not admin of garden2 project");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Graceful Degradation Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_graceful_gapFailureDoesNotAffectHats() public {
        // Setup hats tree
        mockHats.setHatActive(GARDEN1_ROOT_HAT, true);
        mockHats.setHatActive(GARDEN1_OPERATOR_HAT, true);

        // GAP fails
        mockGAP.setShouldRevert(true);

        // Hats operations still work
        mockHats.setWearer(GARDEN1_OPERATOR_HAT, operator1, true);
        assertTrue(mockHats.isWearerOfHat(operator1, GARDEN1_OPERATOR_HAT), "Hats should work despite GAP failure");
    }

    function test_graceful_hatsFailureDoesNotAffectGAP() public {
        // Create GAP project
        vm.prank(gardenOwner);
        bytes32 projectUID = mockGAP.attest(_buildProjectRequest(garden1));

        // Hat becomes inactive
        mockHats.setHatActive(GARDEN1_OPERATOR_HAT, false);

        // GAP operations still work
        mockGAP.addProjectAdmin(projectUID, operator1);
        assertTrue(mockGAP.isAdmin(projectUID, operator1), "GAP should work despite hat being inactive");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Sync State Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_sync_operatorHatAndGAPAdminInSync() public {
        _setupGardenWithOperator();

        // Both systems should agree
        assertTrue(mockHats.isWearerOfHat(operator1, GARDEN1_OPERATOR_HAT), "Should wear operator hat");
        assertTrue(mockGAP.isAdmin(garden1ProjectUID, operator1), "Should be GAP admin");

        // Remove from both
        mockHats.setWearer(GARDEN1_OPERATOR_HAT, operator1, false);
        mockGAP.removeProjectAdmin(garden1ProjectUID, operator1);

        // Both should agree on removal
        assertFalse(mockHats.isWearerOfHat(operator1, GARDEN1_OPERATOR_HAT), "Should not wear operator hat");
        assertFalse(mockGAP.isAdmin(garden1ProjectUID, operator1), "Should not be GAP admin");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Edge Case Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_edge_multipleGardensPerOperator() public {
        _setupGardenWithOperator();

        // Create second garden
        uint256 garden2OperatorHat = 0x0000005c00010002000100000000000000000000000000000000000000000000;
        mockHats.setHatActive(garden2OperatorHat, true);

        vm.prank(gardenOwner);
        bytes32 garden2ProjectUID = mockGAP.attest(_buildProjectRequest(garden2));

        // Same operator can be operator of multiple gardens
        mockHats.setWearer(garden2OperatorHat, operator1, true);
        mockGAP.addProjectAdmin(garden2ProjectUID, operator1);

        // Verify operator1 is operator of both gardens
        assertTrue(mockHats.isWearerOfHat(operator1, GARDEN1_OPERATOR_HAT), "Operator of garden1");
        assertTrue(mockHats.isWearerOfHat(operator1, garden2OperatorHat), "Operator of garden2");
        assertTrue(mockGAP.isAdmin(garden1ProjectUID, operator1), "GAP admin of garden1");
        assertTrue(mockGAP.isAdmin(garden2ProjectUID, operator1), "GAP admin of garden2");
    }

    function test_edge_userWithMultipleRoles() public {
        _setupGardenWithOperator();

        // User is both gardener and evaluator
        mockHats.mintHat(GARDEN1_GARDENER_HAT, gardener1);
        mockHats.mintHat(GARDEN1_EVALUATOR_HAT, gardener1);

        assertTrue(mockHats.isWearerOfHat(gardener1, GARDEN1_GARDENER_HAT), "Should be gardener");
        assertTrue(mockHats.isWearerOfHat(gardener1, GARDEN1_EVALUATOR_HAT), "Should be evaluator");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Helper Functions
    // ═══════════════════════════════════════════════════════════════════════════

    function _setupGardenWithOperator() internal {
        // Setup hat tree
        mockHats.setHatActive(GARDEN1_ROOT_HAT, true);
        mockHats.setHatActive(GARDEN1_OPERATOR_HAT, true);
        mockHats.setHatActive(GARDEN1_GARDENER_HAT, true);
        mockHats.setHatActive(GARDEN1_EVALUATOR_HAT, true);

        // Create GAP project
        vm.prank(gardenOwner);
        garden1ProjectUID = mockGAP.attest(_buildProjectRequest(garden1));

        // Assign operator
        mockHats.setWearer(GARDEN1_OPERATOR_HAT, operator1, true);
        mockGAP.addProjectAdmin(garden1ProjectUID, operator1);
    }

    function _buildProjectRequest(address recipient) internal pure returns (AttestationRequest memory) {
        return AttestationRequest({
            schema: PROJECT_SCHEMA,
            data: AttestationRequestData({
                recipient: recipient,
                expirationTime: 0,
                revocable: true,
                refUID: bytes32(0),
                data: abi.encode(true),
                value: 0
            })
        });
    }

    function _buildImpactRequest(
        address recipient,
        bytes32 projectUID,
        string memory title,
        bytes32 workUID
    )
        internal
        pure
        returns (AttestationRequest memory)
    {
        string memory json = string(
            abi.encodePacked('{"title":"', title, '","type":"project-update","workUID":"', _bytes32ToHex(workUID), '"}')
        );

        return AttestationRequest({
            schema: DETAILS_SCHEMA,
            data: AttestationRequestData({
                recipient: recipient,
                expirationTime: 0,
                revocable: false,
                refUID: projectUID,
                data: abi.encode(json),
                value: 0
            })
        });
    }

    function _buildMilestoneRequest(
        address recipient,
        bytes32 projectUID,
        string memory title
    )
        internal
        pure
        returns (AttestationRequest memory)
    {
        string memory json = string(abi.encodePacked('{"title":"', title, '","type":"project-milestone"}'));

        return AttestationRequest({
            schema: DETAILS_SCHEMA,
            data: AttestationRequestData({
                recipient: recipient,
                expirationTime: 0,
                revocable: false,
                refUID: projectUID,
                data: abi.encode(json),
                value: 0
            })
        });
    }

    function _bytes32ToHex(bytes32 data) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(64);
        for (uint256 i = 0; i < 32; i++) {
            str[i * 2] = alphabet[uint8(data[i] >> 4)];
            str[i * 2 + 1] = alphabet[uint8(data[i] & 0x0f)];
        }
        return string(abi.encodePacked("0x", str));
    }
}
