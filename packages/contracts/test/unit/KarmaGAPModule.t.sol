// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { AttestationRequest, AttestationRequestData } from "@eas/IEAS.sol";
import { MockGAP } from "../../src/mocks/GAP.sol";
import { GAPTestHelper } from "../helpers/GAPTestHelper.sol";

/// @title KarmaGAPModuleTest
/// @notice TDD tests for KarmaGAPModule - to be implemented
/// @dev Tests define expected behavior for Karma GAP project management
///
/// **KarmaGAPModule Responsibilities:**
/// 1. Create GAP projects for gardens during minting
/// 2. Add garden operators as GAP project admins
/// 3. Create project impacts for approved work
/// 4. Create project milestones for assessments
/// 5. Handle graceful degradation when GAP is unavailable
///
/// **Integration Points:**
/// - Called by GardenToken during garden minting
/// - Called by GardenHatsModule when operators are added/removed
/// - Called by WorkApprovalResolver on work approval
/// - Called by AssessmentResolver on assessment creation
contract KarmaGAPModuleTest is Test {
    // ═══════════════════════════════════════════════════════════════════════════
    // Test Contracts
    // ═══════════════════════════════════════════════════════════════════════════

    MockGAP public mockGAP;

    // ═══════════════════════════════════════════════════════════════════════════
    // Test Addresses
    // ═══════════════════════════════════════════════════════════════════════════

    address public owner;
    address public gardenToken;
    address public workApprovalResolver;
    address public assessmentResolver;
    address public garden1;
    address public garden2;
    address public operator1;
    address public operator2;
    address public gardener1;

    // ═══════════════════════════════════════════════════════════════════════════
    // Mock Schema UIDs (matching Base Sepolia)
    // ═══════════════════════════════════════════════════════════════════════════

    bytes32 constant PROJECT_SCHEMA = 0x5ddd6b7a11406771308431ca9bd146cc717848b74b52993a532dc1aad0ccc83f;
    bytes32 constant DETAILS_SCHEMA = 0x9b06f811608d135f913c18295486693fe626f35e213a7d132be87b1f952e508c;
    bytes32 constant MEMBEROF_SCHEMA = 0x857398d86e2d31bec5af882b950ee7b00d1fefefba2432737ab28b68ee041eb8;

    // ═══════════════════════════════════════════════════════════════════════════
    // Events (expected from KarmaGAPModule)
    // ═══════════════════════════════════════════════════════════════════════════

    event GAPProjectCreated(bytes32 indexed projectUID, address indexed garden, string projectName);
    event GAPProjectAdminAdded(bytes32 indexed projectUID, address indexed admin);
    event GAPProjectAdminRemoved(bytes32 indexed projectUID, address indexed admin);
    event GAPImpactCreated(bytes32 indexed projectUID, bytes32 indexed impactUID, bytes32 workUID);
    event GAPMilestoneCreated(bytes32 indexed projectUID, bytes32 indexed milestoneUID, string title);
    event GAPOperationFailed(address indexed garden, string operation, string reason);

    function setUp() public {
        owner = address(this);
        gardenToken = address(0x1000);
        workApprovalResolver = address(0x1100);
        assessmentResolver = address(0x1200);
        garden1 = address(0x2000);
        garden2 = address(0x3000);
        operator1 = address(0x4000);
        operator2 = address(0x4001);
        gardener1 = address(0x5000);

        // Deploy mock GAP
        mockGAP = new MockGAP();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Project Creation Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_createProject_createsGAPProject() public {
        // TODO: Implement KarmaGAPModule
        // Expected: Creates project attestation via MockGAP
        return; // TODO: Implement
    }

    function test_createProject_storesProjectUID() public {
        // TODO: Implement KarmaGAPModule
        // Expected: Module stores mapping garden -> projectUID
        return; // TODO: Implement
    }

    function test_createProject_emitsEvent() public {
        // TODO: Implement KarmaGAPModule
        return; // TODO: Implement
    }

    function test_createProject_addsMinterAsOwner() public {
        // TODO: Implement KarmaGAPModule
        // Expected: Minter becomes GAP project owner
        return; // TODO: Implement
    }

    function test_createProject_revertsIfNotGardenToken() public {
        // TODO: Implement KarmaGAPModule
        // Expected: Only GardenToken can create projects
        return; // TODO: Implement
    }

    function test_createProject_revertsIfProjectExists() public {
        // TODO: Implement KarmaGAPModule
        // Expected: Cannot create duplicate project for same garden
        return; // TODO: Implement
    }

    function test_createProject_gracefullyHandlesGAPFailure() public {
        // Setup MockGAP to revert
        mockGAP.setShouldRevert(true);

        // TODO: Implement KarmaGAPModule
        // Expected: Emits GAPOperationFailed but doesn't revert garden creation
        return; // TODO: Implement
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Project Details Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_createProject_includesGardenDetails() public {
        // TODO: Implement KarmaGAPModule
        // Expected: Project details include name, description, location, image
        return; // TODO: Implement
    }

    function test_createProject_generatesValidSlug() public {
        // TODO: Implement KarmaGAPModule
        // Expected: Slug is URL-friendly version of garden name
        return; // TODO: Implement
    }

    function test_createProject_setsCorrectSchema() public {
        // TODO: Implement KarmaGAPModule
        // Expected: Uses PROJECT_SCHEMA for project attestation
        return; // TODO: Implement
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Admin Management Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_addProjectAdmin_addsOperatorAsAdmin() public {
        // Create project first
        bytes32 projectUID = _createMockProject(garden1, owner);

        // Add admin
        mockGAP.addProjectAdmin(projectUID, operator1);

        // Verify
        assertTrue(mockGAP.isAdmin(projectUID, operator1), "Operator should be admin");
    }

    function test_addProjectAdmin_emitsEvent() public {
        bytes32 projectUID = _createMockProject(garden1, owner);

        vm.expectEmit(true, true, false, false);
        emit MockGAP.AdminAdded(projectUID, operator1);

        mockGAP.addProjectAdmin(projectUID, operator1);
    }

    function test_addProjectAdmin_revertsIfNotProjectAdmin() public {
        bytes32 projectUID = _createMockProject(garden1, owner);

        vm.prank(gardener1); // Non-admin caller
        vm.expectRevert(MockGAP.NotProjectAdmin.selector);
        mockGAP.addProjectAdmin(projectUID, operator1);
    }

    function test_addProjectAdmin_revertsIfAlreadyAdmin() public {
        bytes32 projectUID = _createMockProject(garden1, owner);
        mockGAP.addProjectAdmin(projectUID, operator1);

        vm.expectRevert(MockGAP.AlreadyAdmin.selector);
        mockGAP.addProjectAdmin(projectUID, operator1);
    }

    function test_removeProjectAdmin_removesAdmin() public {
        bytes32 projectUID = _createMockProject(garden1, owner);
        mockGAP.addProjectAdmin(projectUID, operator1);
        assertTrue(mockGAP.isAdmin(projectUID, operator1), "Should be admin before removal");

        mockGAP.removeProjectAdmin(projectUID, operator1);

        assertFalse(mockGAP.isAdmin(projectUID, operator1), "Should not be admin after removal");
    }

    function test_removeProjectAdmin_emitsEvent() public {
        bytes32 projectUID = _createMockProject(garden1, owner);
        mockGAP.addProjectAdmin(projectUID, operator1);

        vm.expectEmit(true, true, false, false);
        emit MockGAP.AdminRemoved(projectUID, operator1);

        mockGAP.removeProjectAdmin(projectUID, operator1);
    }

    function test_removeProjectAdmin_cannotRemoveOwner() public {
        bytes32 projectUID = _createMockProject(garden1, owner);

        // Try to remove owner
        vm.expectRevert("Cannot remove owner as admin");
        mockGAP.removeProjectAdmin(projectUID, owner);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Ownership Transfer Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_transferOwnership_changesOwner() public {
        bytes32 projectUID = _createMockProject(garden1, owner);

        mockGAP.transferProjectOwnership(projectUID, operator1);

        assertTrue(mockGAP.isOwner(projectUID, operator1), "Operator should be new owner");
        assertFalse(mockGAP.isOwner(projectUID, owner), "Previous owner should not be owner");
    }

    function test_transferOwnership_newOwnerBecomesAdmin() public {
        bytes32 projectUID = _createMockProject(garden1, owner);

        mockGAP.transferProjectOwnership(projectUID, operator1);

        assertTrue(mockGAP.isAdmin(projectUID, operator1), "New owner should be admin");
    }

    function test_transferOwnership_revertsIfNotOwner() public {
        bytes32 projectUID = _createMockProject(garden1, owner);

        vm.prank(operator1);
        vm.expectRevert(MockGAP.NotProjectOwner.selector);
        mockGAP.transferProjectOwnership(projectUID, operator2);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Impact Creation Tests (Work Approval)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_createImpact_createsAttestation() public {
        // TODO: Implement KarmaGAPModule
        // Expected: Creates impact attestation referencing project
        return; // TODO: Implement
    }

    function test_createImpact_returnsImpactUID() public {
        // TODO: Implement KarmaGAPModule
        return; // TODO: Implement
    }

    function test_createImpact_revertsIfNoProject() public {
        // TODO: Implement KarmaGAPModule
        // Expected: Cannot create impact without project
        return; // TODO: Implement
    }

    function test_createImpact_onlyWorkApprovalResolver() public {
        // TODO: Implement KarmaGAPModule
        // Expected: Only WorkApprovalResolver can create impacts
        return; // TODO: Implement
    }

    function test_createImpact_includesWorkDetails() public {
        // TODO: Implement KarmaGAPModule
        // Expected: Impact includes title, description, proof, link to work
        return; // TODO: Implement
    }

    function test_createImpact_gracefullyHandlesFailure() public {
        // TODO: Implement KarmaGAPModule
        // Expected: Logs failure but doesn't prevent work approval
        return; // TODO: Implement
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Impact JSON Format Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_createImpact_hasCorrectJSONStructure() public {
        // TODO: Implement KarmaGAPModule
        // Expected JSON:
        // {
        //   "title": "Work Title",
        //   "text": "Impact description",
        //   "startDate": "2024-01-01T00:00:00.000Z",
        //   "endDate": "2024-01-01T00:00:00.000Z",
        //   "deliverables": [{
        //     "name": "Work Evidence",
        //     "proof": "ipfs://...",
        //     "description": "..."
        //   }],
        //   "links": [{
        //     "type": "other",
        //     "url": "https://greengoods.me/garden/...",
        //     "label": "View in Green Goods"
        //   }],
        //   "type": "project-update"
        // }
        return; // TODO: Implement
    }

    function test_createImpact_escapesJSONSpecialChars() public {
        // TODO: Implement KarmaGAPModule
        // Expected: Properly escapes quotes, newlines, backslashes
        return; // TODO: Implement
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Milestone Creation Tests (Assessment)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_createMilestone_createsAttestation() public {
        // TODO: Implement KarmaGAPModule
        // Expected: Creates milestone attestation referencing project
        return; // TODO: Implement
    }

    function test_createMilestone_returnsMilestoneUID() public {
        // TODO: Implement KarmaGAPModule
        return; // TODO: Implement
    }

    function test_createMilestone_revertsIfNoProject() public {
        // TODO: Implement KarmaGAPModule
        return; // TODO: Implement
    }

    function test_createMilestone_onlyAssessmentResolver() public {
        // TODO: Implement KarmaGAPModule
        // Expected: Only AssessmentResolver can create milestones
        return; // TODO: Implement
    }

    function test_createMilestone_includesCapitalScores() public {
        // TODO: Implement KarmaGAPModule
        // Expected: Milestone includes 8 forms of capital
        return; // TODO: Implement
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Milestone JSON Format Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_createMilestone_hasCorrectJSONStructure() public {
        // TODO: Implement KarmaGAPModule
        // Expected JSON:
        // {
        //   "title": "Assessment Title",
        //   "text": "Assessment description",
        //   "type": "project-milestone",
        //   "data": {
        //     "capitals": {...},
        //     "metrics": {...}
        //   }
        // }
        return; // TODO: Implement
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Query Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_getProjectUID_returnsCorrectUID() public {
        // TODO: Implement KarmaGAPModule
        // Expected: Returns stored project UID for garden
        return; // TODO: Implement
    }

    function test_getProjectUID_returnsZeroForUnknownGarden() public {
        // TODO: Implement KarmaGAPModule
        // Expected: Returns bytes32(0) for unconfigured garden
        return; // TODO: Implement
    }

    function test_isProjectAdmin_checksCorrectly() public {
        bytes32 projectUID = _createMockProject(garden1, owner);

        assertTrue(mockGAP.isAdmin(projectUID, owner), "Owner should be admin");
        assertFalse(mockGAP.isAdmin(projectUID, gardener1), "Non-admin should not be admin");
    }

    function test_isProjectOwner_checksCorrectly() public {
        bytes32 projectUID = _createMockProject(garden1, owner);

        assertTrue(mockGAP.isOwner(projectUID, owner), "Should be owner");
        assertFalse(mockGAP.isOwner(projectUID, operator1), "Non-owner should not be owner");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Chain Support Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_isSupported_returnsTrueForSupportedChains() public {
        // TODO: Implement KarmaGAPModule
        // Expected: Returns true for Arbitrum, Celo, Base Sepolia, etc.
        return; // TODO: Implement
    }

    function test_isSupported_returnsFalseForLocalhost() public {
        // TODO: Implement KarmaGAPModule
        // Expected: Returns false for chainId 31337
        return; // TODO: Implement
    }

    function test_operations_skipOnUnsupportedChain() public {
        // TODO: Implement KarmaGAPModule
        // Expected: Operations return gracefully on unsupported chains
        return; // TODO: Implement
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Graceful Degradation Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_gapFailure_doesNotBlockGardenCreation() public {
        mockGAP.setShouldRevert(true);

        // TODO: Implement KarmaGAPModule
        // Expected: Garden creation succeeds, GAP failure is logged
        return; // TODO: Implement
    }

    function test_gapFailure_doesNotBlockWorkApproval() public {
        mockGAP.setShouldRevert(true);

        // TODO: Implement KarmaGAPModule
        // Expected: Work approval succeeds, impact creation failure is logged
        return; // TODO: Implement
    }

    function test_gapFailure_doesNotBlockAssessment() public {
        mockGAP.setShouldRevert(true);

        // TODO: Implement KarmaGAPModule
        // Expected: Assessment succeeds, milestone creation failure is logged
        return; // TODO: Implement
    }

    function test_gapFailure_emitsFailureEvent() public {
        mockGAP.setShouldRevert(true);
        mockGAP.setRevertMessage("RPC timeout");

        // TODO: Implement KarmaGAPModule
        // Expected: Emits GAPOperationFailed with reason
        return; // TODO: Implement
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MockGAP Attestation Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_mockGAP_attestationExists() public {
        bytes32 projectUID = _createMockProject(garden1, owner);

        assertTrue(mockGAP.attestationExists(projectUID), "Attestation should exist");
    }

    function test_mockGAP_getAttestation() public {
        bytes32 projectUID = _createMockProject(garden1, owner);

        (bytes32 schema, address recipient,, bytes memory data, bool exists) = mockGAP.getAttestation(projectUID);

        assertEq(schema, PROJECT_SCHEMA, "Schema should match");
        assertEq(recipient, garden1, "Recipient should be garden");
        assertTrue(exists, "Should exist");
        assertEq(abi.decode(data, (bool)), true, "Data should be true");
    }

    function test_mockGAP_projectExists() public {
        bytes32 projectUID = _createMockProject(garden1, owner);

        assertTrue(mockGAP.projectExists(projectUID), "Project should exist");
    }

    function test_mockGAP_getProjectOwner() public {
        bytes32 projectUID = _createMockProject(garden1, owner);

        assertEq(mockGAP.getProjectOwner(projectUID), owner, "Owner should match");
    }

    function test_mockGAP_getProjectAdmins() public {
        bytes32 projectUID = _createMockProject(garden1, owner);
        mockGAP.addProjectAdmin(projectUID, operator1);
        mockGAP.addProjectAdmin(projectUID, operator2);

        address[] memory admins = mockGAP.getProjectAdmins(projectUID);

        assertEq(admins.length, 3, "Should have 3 admins (owner + 2 operators)");
        assertEq(admins[0], owner, "First admin should be owner");
        assertEq(admins[1], operator1, "Second admin should be operator1");
        assertEq(admins[2], operator2, "Third admin should be operator2");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UID Validation Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_isValidProjectUID_trueForNonZero() public {
        bytes32 uid = bytes32(uint256(1));
        assertTrue(GAPTestHelper.isValidProjectUID(uid), "Non-zero should be valid");
    }

    function test_isValidProjectUID_falseForZero() public {
        assertFalse(GAPTestHelper.isValidProjectUID(bytes32(0)), "Zero should be invalid");
    }

    function test_isValidImpactUID_trueForNonZero() public {
        bytes32 uid = bytes32(uint256(123));
        assertTrue(GAPTestHelper.isValidImpactUID(uid), "Non-zero should be valid");
    }

    function test_isValidMilestoneUID_trueForNonZero() public {
        bytes32 uid = bytes32(uint256(456));
        assertTrue(GAPTestHelper.isValidMilestoneUID(uid), "Non-zero should be valid");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Helper Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev Creates a mock project and returns its UID
    function _createMockProject(address garden, address projectOwner) internal returns (bytes32) {
        vm.prank(projectOwner);
        return mockGAP.attest(
            _buildProjectRequest(garden)
        );
    }

    /// @dev Builds a project attestation request
    function _buildProjectRequest(address recipient)
        internal
        pure
        returns (AttestationRequest memory)
    {
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
}
