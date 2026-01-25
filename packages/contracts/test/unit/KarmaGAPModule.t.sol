// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { AttestationRequest, AttestationRequestData } from "@eas/IEAS.sol";
import { MockGAP } from "../../src/mocks/GAP.sol";
import { GAPTestHelper } from "../helpers/GAPTestHelper.sol";

/// @title KarmaGAPModuleTest
/// @notice Tests for MockGAP and GAPTestHelper functionality
/// @dev Tests verify mock GAP behavior for project/admin management used in garden integration tests
///
/// **Note:** GAP integration is implemented directly in GardenAccount, not as a separate module.
/// These tests verify the MockGAP contract works correctly for integration testing.
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
    // Query Tests
    // ═══════════════════════════════════════════════════════════════════════════

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
    // Graceful Degradation Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_mockGAP_revertModeWorks() public {
        mockGAP.setShouldRevert(true);

        vm.expectRevert("MockGAP: attestation failed");
        mockGAP.attest(_buildProjectRequest(garden1));
    }

    function test_mockGAP_customRevertMessage() public {
        mockGAP.setShouldRevert(true);
        mockGAP.setRevertMessage("RPC timeout");

        vm.expectRevert("RPC timeout");
        mockGAP.attest(_buildProjectRequest(garden1));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Helper Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @dev Creates a mock project and returns its UID
    function _createMockProject(address garden, address projectOwner) internal returns (bytes32) {
        vm.prank(projectOwner);
        return mockGAP.attest(_buildProjectRequest(garden));
    }

    /// @dev Builds a project attestation request
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
}
