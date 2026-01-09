// SPDX-License-Identifier: MIT
// solhint-disable one-contract-per-file
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { GreenGoodsResolver } from "../../src/resolvers/GreenGoods.sol";
import { OctantModule } from "../../src/modules/Octant.sol";
import { UnlockModule } from "../../src/modules/Unlock.sol";
import { MockOctantFactory } from "../../src/mocks/Octant.sol";
import { MockUnlockFactory, MockPublicLock } from "../../src/mocks/Unlock.sol";

/// @title GreenGoodsResolverTest
/// @notice Tests for the GreenGoodsResolver contract
contract GreenGoodsResolverTest is Test {
    GreenGoodsResolver public resolver;
    OctantModule public octantModule;
    UnlockModule public unlockModule;
    MockOctantFactory public mockOctantFactory;
    MockUnlockFactory public mockUnlockFactory;

    address public owner;
    address public workApprovalResolver;
    address public assessmentResolver;
    address public unauthorizedUser;
    address public garden;
    address public worker;
    address public defaultAsset;

    // Events
    event ModuleStatusChanged(bytes32 indexed moduleId, bool enabled);
    event ModuleExecutionSuccess(bytes32 indexed moduleId, address indexed garden, bytes32 indexed attestationUID);
    event ModuleExecutionFailed(bytes32 indexed moduleId, address indexed garden, bytes32 indexed attestationUID);
    event AuthorizedCallerChanged(address indexed caller, bool authorized);
    event OctantModuleUpdated(address indexed oldModule, address indexed newModule);
    event UnlockModuleUpdated(address indexed oldModule, address indexed newModule);

    function setUp() public {
        owner = address(this);
        workApprovalResolver = address(0x1000);
        assessmentResolver = address(0x2000);
        unauthorizedUser = address(0x3000);
        garden = address(0x4000);
        worker = address(0x5000);
        defaultAsset = address(0x6000); // Mock USDC

        // Deploy mock factories
        mockOctantFactory = new MockOctantFactory();
        mockUnlockFactory = new MockUnlockFactory();

        // Deploy resolver implementation and proxy
        GreenGoodsResolver resolverImpl = new GreenGoodsResolver();
        bytes memory resolverInitData =
            abi.encodeWithSelector(GreenGoodsResolver.initialize.selector, owner, workApprovalResolver, assessmentResolver);
        address resolverProxyAddr = address(new ERC1967Proxy(address(resolverImpl), resolverInitData));
        resolver = GreenGoodsResolver(resolverProxyAddr);

        // Deploy Octant module implementation and proxy
        OctantModule octantImpl = new OctantModule();
        bytes memory octantInitData = abi.encodeWithSelector(
            OctantModule.initialize.selector,
            owner,
            address(resolver),
            address(mockOctantFactory),
            defaultAsset,
            7 days // profit unlock time
        );
        address octantProxyAddr = address(new ERC1967Proxy(address(octantImpl), octantInitData));
        octantModule = OctantModule(octantProxyAddr);

        // Deploy Unlock module implementation and proxy
        UnlockModule unlockImpl = new UnlockModule();
        bytes memory unlockInitData = abi.encodeWithSelector(
            UnlockModule.initialize.selector,
            owner,
            address(resolver),
            address(mockUnlockFactory),
            0 // permanent badges
        );
        address unlockProxyAddr = address(new ERC1967Proxy(address(unlockImpl), unlockInitData));
        unlockModule = UnlockModule(unlockProxyAddr);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Initialization Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_initialize_setsOwner() public {
        assertEq(resolver.owner(), owner, "Owner should be set correctly");
    }

    function test_initialize_authorizesResolvers() public {
        assertTrue(resolver.authorizedCallers(workApprovalResolver), "WorkApprovalResolver should be authorized");
        assertTrue(resolver.authorizedCallers(assessmentResolver), "AssessmentResolver should be authorized");
    }

    function test_initialize_enablesGAPModule() public {
        assertTrue(resolver.isModuleEnabled(resolver.MODULE_GAP()), "GAP module should be enabled by default");
    }

    function test_initialize_disablesOtherModules() public {
        assertFalse(resolver.isModuleEnabled(resolver.MODULE_OCTANT()), "Octant module should be disabled");
        assertFalse(resolver.isModuleEnabled(resolver.MODULE_UNLOCK()), "Unlock module should be disabled");
        assertFalse(resolver.isModuleEnabled(resolver.MODULE_HYPERCERTS()), "Hypercerts module should be disabled");
        assertFalse(resolver.isModuleEnabled(resolver.MODULE_GREENWILL()), "GreenWill module should be disabled");
    }

    function test_initialize_revertsOnZeroOwner() public {
        GreenGoodsResolver impl = new GreenGoodsResolver();

        bytes memory initData = abi.encodeWithSelector(
            GreenGoodsResolver.initialize.selector, address(0), workApprovalResolver, assessmentResolver
        );

        vm.expectRevert(GreenGoodsResolver.ZeroAddress.selector);
        new ERC1967Proxy(address(impl), initData);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Module Enable/Disable Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setModuleEnabled_enablesModule() public {
        bytes32 moduleId = resolver.MODULE_OCTANT();

        vm.expectEmit(true, false, false, true);
        emit ModuleStatusChanged(moduleId, true);

        resolver.setModuleEnabled(moduleId, true);

        assertTrue(resolver.isModuleEnabled(moduleId), "Module should be enabled");
    }

    function test_setModuleEnabled_disablesModule() public {
        bytes32 moduleId = resolver.MODULE_GAP();

        vm.expectEmit(true, false, false, true);
        emit ModuleStatusChanged(moduleId, false);

        resolver.setModuleEnabled(moduleId, false);

        assertFalse(resolver.isModuleEnabled(moduleId), "Module should be disabled");
    }

    function test_setModuleEnabled_revertsForNonOwner() public {
        bytes32 moduleId = resolver.MODULE_OCTANT();
        vm.prank(unauthorizedUser);
        vm.expectRevert();
        resolver.setModuleEnabled(moduleId, true);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Authorized Caller Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setAuthorizedCaller_addsNewCaller() public {
        address newCaller = address(0x5000);

        vm.expectEmit(true, false, false, true);
        emit AuthorizedCallerChanged(newCaller, true);

        resolver.setAuthorizedCaller(newCaller, true);

        assertTrue(resolver.authorizedCallers(newCaller), "New caller should be authorized");
    }

    function test_setAuthorizedCaller_removesCaller() public {
        vm.expectEmit(true, false, false, true);
        emit AuthorizedCallerChanged(workApprovalResolver, false);

        resolver.setAuthorizedCaller(workApprovalResolver, false);

        assertFalse(resolver.authorizedCallers(workApprovalResolver), "Caller should be deauthorized");
    }

    function test_setAuthorizedCaller_revertsForNonOwner() public {
        vm.prank(unauthorizedUser);
        vm.expectRevert();
        resolver.setAuthorizedCaller(address(0x6000), true);
    }

    function test_setAuthorizedCaller_revertsForZeroAddress() public {
        vm.expectRevert(GreenGoodsResolver.ZeroAddress.selector);
        resolver.setAuthorizedCaller(address(0), true);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // onWorkApproved Access Control Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onWorkApproved_succeedsForAuthorizedCaller() public {
        vm.prank(workApprovalResolver);

        // Should not revert
        resolver.onWorkApproved(
            garden,
            bytes32(uint256(1)), // workUID
            bytes32(uint256(2)), // approvalUID
            bytes32(uint256(3)), // actionUID
            worker, // worker (who submitted)
            address(0x7000), // attester (operator)
            "Great work!", // feedback
            "QmTest123" // mediaIPFS
        );
    }

    function test_onWorkApproved_succeedsForOwner() public {
        // Owner can also call
        resolver.onWorkApproved(
            garden,
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3)),
            worker,
            address(0x7000),
            "Great work!",
            "QmTest123"
        );
    }

    function test_onWorkApproved_revertsForUnauthorizedCaller() public {
        vm.prank(unauthorizedUser);

        vm.expectRevert(abi.encodeWithSelector(GreenGoodsResolver.UnauthorizedCaller.selector, unauthorizedUser));
        resolver.onWorkApproved(
            garden,
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3)),
            worker,
            address(0x7000),
            "Great work!",
            "QmTest123"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // onAssessmentCreated Access Control Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_onAssessmentCreated_succeedsForAuthorizedCaller() public {
        string[] memory capitals = new string[](2);
        capitals[0] = "social";
        capitals[1] = "living";

        vm.prank(assessmentResolver);

        // Should not revert
        resolver.onAssessmentCreated(
            garden,
            bytes32(uint256(1)), // assessmentUID
            address(0x7000), // attester
            "Garden Assessment", // title
            "Quarterly review", // description
            capitals,
            "review" // assessmentType
        );
    }

    function test_onAssessmentCreated_revertsForUnauthorizedCaller() public {
        string[] memory capitals = new string[](1);
        capitals[0] = "social";

        vm.prank(unauthorizedUser);

        vm.expectRevert(abi.encodeWithSelector(GreenGoodsResolver.UnauthorizedCaller.selector, unauthorizedUser));
        resolver.onAssessmentCreated(
            garden, bytes32(uint256(1)), address(0x7000), "Garden Assessment", "Quarterly review", capitals, "review"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Module Constant Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_moduleConstants_areCorrect() public {
        assertEq(resolver.MODULE_GAP(), keccak256("GAP"), "GAP module ID should match");
        assertEq(resolver.MODULE_OCTANT(), keccak256("OCTANT"), "Octant module ID should match");
        assertEq(resolver.MODULE_UNLOCK(), keccak256("UNLOCK"), "Unlock module ID should match");
        assertEq(resolver.MODULE_HYPERCERTS(), keccak256("HYPERCERTS"), "Hypercerts module ID should match");
        assertEq(resolver.MODULE_GREENWILL(), keccak256("GREENWILL"), "GreenWill module ID should match");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Multiple Module Toggle Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_multipleModulesCanBeEnabled() public {
        resolver.setModuleEnabled(resolver.MODULE_OCTANT(), true);
        resolver.setModuleEnabled(resolver.MODULE_UNLOCK(), true);
        resolver.setModuleEnabled(resolver.MODULE_HYPERCERTS(), true);

        assertTrue(resolver.isModuleEnabled(resolver.MODULE_GAP()), "GAP should still be enabled");
        assertTrue(resolver.isModuleEnabled(resolver.MODULE_OCTANT()), "Octant should be enabled");
        assertTrue(resolver.isModuleEnabled(resolver.MODULE_UNLOCK()), "Unlock should be enabled");
        assertTrue(resolver.isModuleEnabled(resolver.MODULE_HYPERCERTS()), "Hypercerts should be enabled");
        assertFalse(resolver.isModuleEnabled(resolver.MODULE_GREENWILL()), "GreenWill should still be disabled");
    }

    function test_allModulesCanBeDisabled() public {
        resolver.setModuleEnabled(resolver.MODULE_GAP(), false);

        assertFalse(resolver.isModuleEnabled(resolver.MODULE_GAP()), "GAP should be disabled");
        assertFalse(resolver.isModuleEnabled(resolver.MODULE_OCTANT()), "Octant should be disabled");
        assertFalse(resolver.isModuleEnabled(resolver.MODULE_UNLOCK()), "Unlock should be disabled");
        assertFalse(resolver.isModuleEnabled(resolver.MODULE_HYPERCERTS()), "Hypercerts should be disabled");
        assertFalse(resolver.isModuleEnabled(resolver.MODULE_GREENWILL()), "GreenWill should be disabled");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Module Address Configuration Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setOctantModule_setsAddress() public {
        vm.expectEmit(true, true, false, true);
        emit OctantModuleUpdated(address(0), address(octantModule));

        resolver.setOctantModule(address(octantModule));

        assertEq(address(resolver.octantModule()), address(octantModule), "Octant module should be set");
    }

    function test_setUnlockModule_setsAddress() public {
        vm.expectEmit(true, true, false, true);
        emit UnlockModuleUpdated(address(0), address(unlockModule));

        resolver.setUnlockModule(address(unlockModule));

        assertEq(address(resolver.unlockModule()), address(unlockModule), "Unlock module should be set");
    }

    function test_setOctantModule_revertsForNonOwner() public {
        vm.prank(unauthorizedUser);
        vm.expectRevert();
        resolver.setOctantModule(address(octantModule));
    }

    function test_setUnlockModule_revertsForNonOwner() public {
        vm.prank(unauthorizedUser);
        vm.expectRevert();
        resolver.setUnlockModule(address(unlockModule));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Octant Module Integration Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_octantModule_createsVaultOnWorkApproval() public {
        // Setup: Configure resolver with Octant module enabled
        resolver.setOctantModule(address(octantModule));
        resolver.setModuleEnabled(resolver.MODULE_OCTANT(), true);

        // Create a mock garden that returns a name
        MockGarden mockGarden = new MockGarden("Test Garden");

        vm.prank(workApprovalResolver);
        resolver.onWorkApproved(
            address(mockGarden),
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3)),
            worker,
            address(0x7000),
            "Great work!",
            "QmTest123"
        );

        // Check vault was created
        assertTrue(octantModule.hasVault(address(mockGarden)), "Vault should be created for garden");
        address vault = octantModule.getVault(address(mockGarden));
        assertTrue(vault != address(0), "Vault address should not be zero");
    }

    function test_octantModule_skipsWhenModuleDisabled() public {
        // Setup: Configure resolver but keep Octant disabled
        resolver.setOctantModule(address(octantModule));
        // MODULE_OCTANT is disabled by default

        MockGarden mockGarden = new MockGarden("Test Garden");

        vm.prank(workApprovalResolver);
        resolver.onWorkApproved(
            address(mockGarden),
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3)),
            worker,
            address(0x7000),
            "Great work!",
            "QmTest123"
        );

        // Check vault was NOT created
        assertFalse(octantModule.hasVault(address(mockGarden)), "Vault should not be created when module disabled");
    }

    function test_octantModule_skipsWhenNoModuleConfigured() public {
        // Setup: Enable Octant module but don't set address
        resolver.setModuleEnabled(resolver.MODULE_OCTANT(), true);
        // Don't call resolver.setOctantModule()

        MockGarden mockGarden = new MockGarden("Test Garden");

        // Should not revert
        vm.prank(workApprovalResolver);
        resolver.onWorkApproved(
            address(mockGarden),
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3)),
            worker,
            address(0x7000),
            "Great work!",
            "QmTest123"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Unlock Module Integration Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_unlockModule_grantsBadgeOnWorkApproval() public {
        // Setup: Configure resolver with Unlock module enabled
        resolver.setUnlockModule(address(unlockModule));
        resolver.setModuleEnabled(resolver.MODULE_UNLOCK(), true);

        MockGarden mockGarden = new MockGarden("Test Garden");

        // Configure a badge lock for the garden
        MockPublicLock lock = new MockPublicLock();
        unlockModule.configureLockForGarden(address(mockGarden), address(lock));

        vm.prank(workApprovalResolver);
        resolver.onWorkApproved(
            address(mockGarden),
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3)),
            worker,
            address(0x7000),
            "Great work!",
            "QmTest123"
        );

        // Check badge was granted
        assertTrue(lock.getHasValidKey(worker), "Worker should have a valid badge");
    }

    function test_unlockModule_skipsWhenNoLockConfigured() public {
        // Setup: Configure resolver with Unlock module enabled but no lock for garden
        resolver.setUnlockModule(address(unlockModule));
        resolver.setModuleEnabled(resolver.MODULE_UNLOCK(), true);

        MockGarden mockGarden = new MockGarden("Test Garden");
        // Don't configure lock for this garden

        // Should not revert
        vm.prank(workApprovalResolver);
        resolver.onWorkApproved(
            address(mockGarden),
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3)),
            worker,
            address(0x7000),
            "Great work!",
            "QmTest123"
        );

        // No badge granted (no lock configured)
        assertFalse(unlockModule.hasLock(address(mockGarden)), "Garden should not have a lock configured");
    }

    function test_unlockModule_skipsWhenModuleDisabled() public {
        // Setup: Configure resolver but keep Unlock disabled
        resolver.setUnlockModule(address(unlockModule));
        // MODULE_UNLOCK is disabled by default

        MockGarden mockGarden = new MockGarden("Test Garden");
        MockPublicLock lock = new MockPublicLock();
        unlockModule.configureLockForGarden(address(mockGarden), address(lock));

        vm.prank(workApprovalResolver);
        resolver.onWorkApproved(
            address(mockGarden),
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3)),
            worker,
            address(0x7000),
            "Great work!",
            "QmTest123"
        );

        // Check badge was NOT granted
        assertFalse(lock.getHasValidKey(worker), "Worker should not have badge when module disabled");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Combined Module Tests
    // ═══════════════════════════════════════════════════════════════════════════

    function test_bothModules_executeOnSameWorkApproval() public {
        // Setup both modules
        resolver.setOctantModule(address(octantModule));
        resolver.setUnlockModule(address(unlockModule));
        resolver.setModuleEnabled(resolver.MODULE_OCTANT(), true);
        resolver.setModuleEnabled(resolver.MODULE_UNLOCK(), true);

        MockGarden mockGarden = new MockGarden("Test Garden");
        MockPublicLock lock = new MockPublicLock();
        unlockModule.configureLockForGarden(address(mockGarden), address(lock));

        vm.prank(workApprovalResolver);
        resolver.onWorkApproved(
            address(mockGarden),
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3)),
            worker,
            address(0x7000),
            "Great work!",
            "QmTest123"
        );

        // Both should have executed
        assertTrue(octantModule.hasVault(address(mockGarden)), "Octant vault should be created");
        assertTrue(lock.getHasValidKey(worker), "Unlock badge should be granted");
    }
}

/// @title MockGarden
/// @notice Mock garden account for testing
contract MockGarden {
    string public name;

    constructor(string memory _name) {
        name = _name;
    }
}
