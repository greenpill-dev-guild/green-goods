// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { KarmaGAPModule } from "../../src/modules/Karma.sol";
import { IKarmaGAPModule } from "../../src/interfaces/IKarmaGAPModule.sol";
import { MockGAP } from "../../src/mocks/GAP.sol";

/// @title KarmaModuleTest
/// @notice Unit tests for KarmaGAPModule (src/modules/Karma.sol) — the real production module
/// @dev The existing KarmaGAPModule.t.sol only tests MockGAP. This file tests the actual module.
/// Tests both unsupported chain (localhost 31337) and supported chain (Base Sepolia 84532) paths.
contract KarmaModuleTest is Test {
    KarmaGAPModule internal module;
    MockGAP internal mockGAP;

    address internal constant OWNER = address(0xA1);
    address internal constant GARDEN_TOKEN = address(0xA2);
    address internal constant WORK_APPROVAL_RESOLVER = address(0xA3);
    address internal constant ASSESSMENT_RESOLVER = address(0xA4);
    address internal constant HATS_MODULE = address(0xA5);
    address internal constant UNAUTHORIZED = address(0xA6);
    address internal constant GARDEN = address(0xA7);
    address internal constant OPERATOR = address(0xA8);
    address internal constant ADMIN = address(0xA9);

    /// @dev KarmaLib.getGapContract() returns this for chainId 84532 (Base Sepolia)
    address internal constant GAP_ADDRESS = 0x4Ca7230fB6b78875bdd1B1e4F665B7B7f1891239;

    // Events from IKarmaGAPModule
    event GAPProjectCreated(bytes32 indexed projectUID, address indexed garden, string projectName);
    event GAPProjectAdminAdded(bytes32 indexed projectUID, address indexed admin);
    event GAPProjectAdminRemoved(bytes32 indexed projectUID, address indexed admin);
    event GAPImpactCreated(bytes32 indexed projectUID, bytes32 indexed impactUID, bytes32 workUID);
    event GAPMilestoneCreated(bytes32 indexed projectUID, bytes32 indexed milestoneUID, string title);
    event GAPOperationFailed(address indexed garden, string operation, string reason);

    function setUp() public {
        KarmaGAPModule implementation = new KarmaGAPModule();
        bytes memory initData = abi.encodeWithSelector(
            KarmaGAPModule.initialize.selector, OWNER, GARDEN_TOKEN, WORK_APPROVAL_RESOLVER, ASSESSMENT_RESOLVER
        );
        module = KarmaGAPModule(address(new ERC1967Proxy(address(implementation), initData)));
    }

    // =========================================================================
    // Initialization Tests
    // =========================================================================

    function test_initialize_setsOwner() public {
        assertEq(module.owner(), OWNER, "Owner should be set");
    }

    function test_initialize_setsGardenToken() public {
        assertEq(module.gardenToken(), GARDEN_TOKEN, "GardenToken should be set");
    }

    function test_initialize_setsResolvers() public {
        assertEq(module.workApprovalResolver(), WORK_APPROVAL_RESOLVER, "WorkApprovalResolver should be set");
        assertEq(module.assessmentResolver(), ASSESSMENT_RESOLVER, "AssessmentResolver should be set");
    }

    function test_initialize_revertsForZeroOwner() public {
        KarmaGAPModule impl = new KarmaGAPModule();
        bytes memory initData =
            abi.encodeWithSelector(KarmaGAPModule.initialize.selector, address(0), GARDEN_TOKEN, address(0), address(0));

        vm.expectRevert(IKarmaGAPModule.ZeroAddress.selector);
        new ERC1967Proxy(address(impl), initData);
    }

    function test_initialize_revertsForZeroGardenToken() public {
        KarmaGAPModule impl = new KarmaGAPModule();
        bytes memory initData =
            abi.encodeWithSelector(KarmaGAPModule.initialize.selector, OWNER, address(0), address(0), address(0));

        vm.expectRevert(IKarmaGAPModule.ZeroAddress.selector);
        new ERC1967Proxy(address(impl), initData);
    }

    function test_initialize_allowsZeroResolvers() public {
        KarmaGAPModule impl = new KarmaGAPModule();
        bytes memory initData =
            abi.encodeWithSelector(KarmaGAPModule.initialize.selector, OWNER, GARDEN_TOKEN, address(0), address(0));

        KarmaGAPModule m = KarmaGAPModule(address(new ERC1967Proxy(address(impl), initData)));
        assertEq(m.workApprovalResolver(), address(0));
        assertEq(m.assessmentResolver(), address(0));
    }

    function test_initialize_revertsOnDoubleInit() public {
        vm.expectRevert("Initializable: contract is already initialized");
        module.initialize(OWNER, GARDEN_TOKEN, address(0), address(0));
    }

    // =========================================================================
    // Admin Setter Tests
    // =========================================================================

    function test_setGardenToken_updatesValue() public {
        address newToken = address(0xB1);
        vm.prank(OWNER);
        module.setGardenToken(newToken);
        assertEq(module.gardenToken(), newToken);
    }

    function test_setGardenToken_revertsForZeroAddress() public {
        vm.prank(OWNER);
        vm.expectRevert(IKarmaGAPModule.ZeroAddress.selector);
        module.setGardenToken(address(0));
    }

    function test_setGardenToken_onlyOwner() public {
        vm.prank(UNAUTHORIZED);
        vm.expectRevert("Ownable: caller is not the owner");
        module.setGardenToken(address(0xB1));
    }

    function test_setWorkApprovalResolver_updatesValue() public {
        vm.prank(OWNER);
        module.setWorkApprovalResolver(address(0xB2));
        assertEq(module.workApprovalResolver(), address(0xB2));
    }

    function test_setWorkApprovalResolver_onlyOwner() public {
        vm.prank(UNAUTHORIZED);
        vm.expectRevert("Ownable: caller is not the owner");
        module.setWorkApprovalResolver(address(0xB2));
    }

    function test_setAssessmentResolver_updatesValue() public {
        vm.prank(OWNER);
        module.setAssessmentResolver(address(0xB3));
        assertEq(module.assessmentResolver(), address(0xB3));
    }

    function test_setAssessmentResolver_onlyOwner() public {
        vm.prank(UNAUTHORIZED);
        vm.expectRevert("Ownable: caller is not the owner");
        module.setAssessmentResolver(address(0xB3));
    }

    function test_setHatsModule_updatesValue() public {
        vm.prank(OWNER);
        module.setHatsModule(HATS_MODULE);
        assertEq(module.hatsModule(), HATS_MODULE);
    }

    function test_setHatsModule_revertsForZeroAddress() public {
        vm.prank(OWNER);
        vm.expectRevert(IKarmaGAPModule.ZeroAddress.selector);
        module.setHatsModule(address(0));
    }

    function test_setHatsModule_onlyOwner() public {
        vm.prank(UNAUTHORIZED);
        vm.expectRevert("Ownable: caller is not the owner");
        module.setHatsModule(HATS_MODULE);
    }

    // =========================================================================
    // Modifier / Access Control Tests
    // =========================================================================

    function test_createProject_revertsForNonGardenToken() public {
        vm.prank(UNAUTHORIZED);
        vm.expectRevert(IKarmaGAPModule.NotGardenToken.selector);
        module.createProject(GARDEN, OPERATOR, "Garden", "Desc", "Loc", "Banner");
    }

    function test_createImpact_revertsForNonWorkApprovalResolver() public {
        vm.prank(UNAUTHORIZED);
        vm.expectRevert(IKarmaGAPModule.NotWorkApprovalResolver.selector);
        module.createImpact(GARDEN, 1, "Title", "Desc", "ipfs://proof", bytes32(uint256(1)));
    }

    function test_createMilestone_revertsForNonAssessmentResolver() public {
        vm.prank(UNAUTHORIZED);
        vm.expectRevert(IKarmaGAPModule.NotAssessmentResolver.selector);
        module.createMilestone(GARDEN, "Title", "Desc", "meta");
    }

    function test_addProjectAdmin_revertsForUnauthorizedCaller() public {
        vm.prank(UNAUTHORIZED);
        vm.expectRevert(IKarmaGAPModule.NotAuthorizedCaller.selector);
        module.addProjectAdmin(GARDEN, ADMIN);
    }

    function test_removeProjectAdmin_revertsForUnauthorizedCaller() public {
        vm.prank(UNAUTHORIZED);
        vm.expectRevert(IKarmaGAPModule.NotAuthorizedCaller.selector);
        module.removeProjectAdmin(GARDEN, ADMIN);
    }

    function test_addProjectAdmin_allowsGardenToken() public {
        vm.prank(GARDEN_TOKEN);
        module.addProjectAdmin(GARDEN, ADMIN); // No revert = success
    }

    function test_addProjectAdmin_allowsWorkApprovalResolver() public {
        vm.prank(WORK_APPROVAL_RESOLVER);
        module.addProjectAdmin(GARDEN, ADMIN);
    }

    function test_addProjectAdmin_allowsAssessmentResolver() public {
        vm.prank(ASSESSMENT_RESOLVER);
        module.addProjectAdmin(GARDEN, ADMIN);
    }

    function test_addProjectAdmin_allowsHatsModule() public {
        vm.prank(OWNER);
        module.setHatsModule(HATS_MODULE);

        vm.prank(HATS_MODULE);
        module.addProjectAdmin(GARDEN, ADMIN);
    }

    // =========================================================================
    // Unsupported Chain Tests (chainId 31337 — localhost)
    // =========================================================================

    function test_createProject_emitsFailedOnUnsupportedChain() public {
        vm.expectEmit(true, false, false, true);
        emit GAPOperationFailed(GARDEN, "createProject", "Chain not supported");

        vm.prank(GARDEN_TOKEN);
        bytes32 uid = module.createProject(GARDEN, OPERATOR, "Garden", "Desc", "Loc", "Banner");
        assertEq(uid, bytes32(0), "Should return zero UID on unsupported chain");
    }

    function test_addProjectAdmin_silentReturnWhenNoProject() public {
        // gardenProjects[garden] == bytes32(0) → early return
        vm.prank(GARDEN_TOKEN);
        module.addProjectAdmin(GARDEN, ADMIN);
    }

    function test_removeProjectAdmin_silentReturnWhenNoProject() public {
        vm.prank(GARDEN_TOKEN);
        module.removeProjectAdmin(GARDEN, ADMIN);
    }

    function test_createImpact_emitsFailedWhenNoProject() public {
        vm.expectEmit(true, false, false, true);
        emit GAPOperationFailed(GARDEN, "createImpact", "No project");

        vm.prank(WORK_APPROVAL_RESOLVER);
        bytes32 uid = module.createImpact(GARDEN, 1, "Title", "Desc", "ipfs://proof", bytes32(uint256(1)));
        assertEq(uid, bytes32(0));
    }

    function test_createMilestone_emitsFailedWhenNoProject() public {
        vm.expectEmit(true, false, false, true);
        emit GAPOperationFailed(GARDEN, "createMilestone", "No project");

        vm.prank(ASSESSMENT_RESOLVER);
        bytes32 uid = module.createMilestone(GARDEN, "Title", "Desc", "meta");
        assertEq(uid, bytes32(0));
    }

    // =========================================================================
    // Supported Chain Tests (chainId 84532 — Base Sepolia)
    // =========================================================================

    function _setupSupportedChain() internal {
        vm.chainId(84_532);
        MockGAP impl = new MockGAP();
        vm.etch(GAP_ADDRESS, address(impl).code);
        mockGAP = MockGAP(GAP_ADDRESS);
    }

    function test_createProject_succeeds_onSupportedChain() public {
        _setupSupportedChain();

        vm.prank(GARDEN_TOKEN);
        bytes32 uid = module.createProject(GARDEN, OPERATOR, "Test Garden", "A garden", "Earth", "banner.png");

        assertTrue(uid != bytes32(0), "Should return non-zero project UID");
        assertEq(module.gardenProjects(GARDEN), uid, "gardenProjects mapping should be set");
        assertEq(module.getProjectUID(GARDEN), uid, "getProjectUID should return the UID");
    }

    function test_createProject_revertsForDuplicateProject() public {
        _setupSupportedChain();

        vm.prank(GARDEN_TOKEN);
        module.createProject(GARDEN, OPERATOR, "Garden 1", "Desc", "Loc", "Banner");

        vm.prank(GARDEN_TOKEN);
        vm.expectRevert(abi.encodeWithSelector(IKarmaGAPModule.ProjectAlreadyExists.selector, GARDEN));
        module.createProject(GARDEN, OPERATOR, "Garden 2", "Desc", "Loc", "Banner");
    }

    function test_createProject_gracefulWhenGAPAttestFails() public {
        _setupSupportedChain();
        mockGAP.setShouldRevert(true);

        vm.expectEmit(true, false, false, true);
        emit GAPOperationFailed(GARDEN, "createProject", "Project attestation failed");

        vm.prank(GARDEN_TOKEN);
        bytes32 uid = module.createProject(GARDEN, OPERATOR, "Garden", "Desc", "Loc", "Banner");
        assertEq(uid, bytes32(0), "Should return zero UID when GAP fails");
    }

    function test_addProjectAdmin_callsGAP_onSupportedChain() public {
        _setupSupportedChain();

        vm.prank(GARDEN_TOKEN);
        bytes32 projectUID = module.createProject(GARDEN, OPERATOR, "Garden", "Desc", "Loc", "Banner");

        vm.expectEmit(true, true, false, false);
        emit GAPProjectAdminAdded(projectUID, ADMIN);

        vm.prank(GARDEN_TOKEN);
        module.addProjectAdmin(GARDEN, ADMIN);
    }

    function test_removeProjectAdmin_callsGAP_onSupportedChain() public {
        _setupSupportedChain();

        vm.prank(GARDEN_TOKEN);
        bytes32 projectUID = module.createProject(GARDEN, OPERATOR, "Garden", "Desc", "Loc", "Banner");

        vm.prank(GARDEN_TOKEN);
        module.addProjectAdmin(GARDEN, ADMIN);

        vm.expectEmit(true, true, false, false);
        emit GAPProjectAdminRemoved(projectUID, ADMIN);

        vm.prank(GARDEN_TOKEN);
        module.removeProjectAdmin(GARDEN, ADMIN);
    }

    function test_addProjectAdmin_emitsFailedWhenGAPReverts() public {
        _setupSupportedChain();

        vm.prank(GARDEN_TOKEN);
        module.createProject(GARDEN, OPERATOR, "Garden", "Desc", "Loc", "Banner");

        mockGAP.setShouldRevert(true);

        vm.expectEmit(true, false, false, true);
        emit GAPOperationFailed(GARDEN, "addProjectAdmin", "Failed to add admin");

        vm.prank(GARDEN_TOKEN);
        module.addProjectAdmin(GARDEN, ADMIN);
    }

    function test_removeProjectAdmin_emitsFailedWhenGAPReverts() public {
        _setupSupportedChain();

        vm.prank(GARDEN_TOKEN);
        module.createProject(GARDEN, OPERATOR, "Garden", "Desc", "Loc", "Banner");

        mockGAP.setShouldRevert(true);

        vm.expectEmit(true, false, false, true);
        emit GAPOperationFailed(GARDEN, "removeProjectAdmin", "Failed to remove admin");

        vm.prank(GARDEN_TOKEN);
        module.removeProjectAdmin(GARDEN, ADMIN);
    }

    function test_createImpact_succeeds_onSupportedChain() public {
        _setupSupportedChain();

        vm.prank(GARDEN_TOKEN);
        module.createProject(GARDEN, OPERATOR, "Garden", "Desc", "Loc", "Banner");

        vm.prank(WORK_APPROVAL_RESOLVER);
        bytes32 impactUID =
            module.createImpact(GARDEN, 1, "Tree Planting", "Planted 50 trees", "ipfs://proof", bytes32(uint256(42)));

        assertTrue(impactUID != bytes32(0), "Should return non-zero impact UID");
    }

    function test_createImpact_emitsFailedOnUnsupportedChainAfterProjectCreated() public {
        _setupSupportedChain();
        vm.prank(GARDEN_TOKEN);
        module.createProject(GARDEN, OPERATOR, "Garden", "Desc", "Loc", "Banner");

        vm.chainId(31_337);

        vm.expectEmit(true, false, false, true);
        emit GAPOperationFailed(GARDEN, "createImpact", "Chain not supported");

        vm.prank(WORK_APPROVAL_RESOLVER);
        bytes32 uid = module.createImpact(GARDEN, 1, "Title", "Desc", "ipfs://proof", bytes32(uint256(1)));
        assertEq(uid, bytes32(0));
    }

    function test_createImpact_gracefulWhenGAPFails() public {
        _setupSupportedChain();

        vm.prank(GARDEN_TOKEN);
        module.createProject(GARDEN, OPERATOR, "Garden", "Desc", "Loc", "Banner");

        mockGAP.setShouldRevert(true);

        vm.expectEmit(true, false, false, true);
        emit GAPOperationFailed(GARDEN, "createImpact", "Attestation failed");

        vm.prank(WORK_APPROVAL_RESOLVER);
        bytes32 uid = module.createImpact(GARDEN, 1, "Title", "Desc", "ipfs://proof", bytes32(uint256(1)));
        assertEq(uid, bytes32(0));
    }

    function test_createMilestone_succeeds_onSupportedChain() public {
        _setupSupportedChain();

        vm.prank(GARDEN_TOKEN);
        module.createProject(GARDEN, OPERATOR, "Garden", "Desc", "Loc", "Banner");

        vm.prank(ASSESSMENT_RESOLVER);
        bytes32 milestoneUID = module.createMilestone(GARDEN, "Q1 Assessment", "Biodiversity review", "{\"type\":\"bio\"}");

        assertTrue(milestoneUID != bytes32(0), "Should return non-zero milestone UID");
    }

    function test_createMilestone_emitsFailedOnUnsupportedChainAfterProjectCreated() public {
        _setupSupportedChain();
        vm.prank(GARDEN_TOKEN);
        module.createProject(GARDEN, OPERATOR, "Garden", "Desc", "Loc", "Banner");

        vm.chainId(31_337);

        vm.expectEmit(true, false, false, true);
        emit GAPOperationFailed(GARDEN, "createMilestone", "Chain not supported");

        vm.prank(ASSESSMENT_RESOLVER);
        bytes32 uid = module.createMilestone(GARDEN, "Title", "Desc", "meta");
        assertEq(uid, bytes32(0));
    }

    function test_createMilestone_gracefulWhenGAPFails() public {
        _setupSupportedChain();

        vm.prank(GARDEN_TOKEN);
        module.createProject(GARDEN, OPERATOR, "Garden", "Desc", "Loc", "Banner");

        mockGAP.setShouldRevert(true);

        vm.expectEmit(true, false, false, true);
        emit GAPOperationFailed(GARDEN, "createMilestone", "Attestation failed");

        vm.prank(ASSESSMENT_RESOLVER);
        bytes32 uid = module.createMilestone(GARDEN, "Title", "Desc", "meta");
        assertEq(uid, bytes32(0));
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    function test_getProjectUID_returnsZeroForUnknownGarden() public {
        assertEq(module.getProjectUID(address(0xDEAD)), bytes32(0));
    }

    function test_isSupported_returnsFalseOnLocalhost() public {
        assertFalse(module.isSupported());
    }

    function test_isSupported_returnsTrueOnBaseSepolia() public {
        vm.chainId(84_532);
        assertTrue(module.isSupported());
    }

    function test_isSupported_returnsTrueOnArbitrum() public {
        vm.chainId(42_161);
        assertTrue(module.isSupported());
    }

    function test_isSupported_returnsTrueOnCelo() public {
        vm.chainId(42_220);
        assertTrue(module.isSupported());
    }

    // =========================================================================
    // UUPS Upgrade Tests
    // =========================================================================

    function test_authorizeUpgrade_ownerCanUpgrade() public {
        KarmaGAPModule newImpl = new KarmaGAPModule();
        vm.prank(OWNER);
        module.upgradeTo(address(newImpl));
    }

    function test_authorizeUpgrade_nonOwnerCannotUpgrade() public {
        KarmaGAPModule newImpl = new KarmaGAPModule();
        vm.prank(UNAUTHORIZED);
        vm.expectRevert("Ownable: caller is not the owner");
        module.upgradeTo(address(newImpl));
    }
}
