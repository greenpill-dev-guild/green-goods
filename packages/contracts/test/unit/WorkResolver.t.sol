// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Attestation } from "@eas/IEAS.sol";

import { WorkSchema } from "../../src/Schemas.sol";
import {
    WorkResolver,
    ActionDomainMismatch,
    MetadataRequired,
    NotActiveAction,
    NotGardenMember,
    NotInActionRegistry,
    TitleRequired,
    InvalidSchema
} from "../../src/resolvers/Work.sol";
import { ActionRegistry, Capital, Domain } from "../../src/registries/Action.sol";
import { MockEAS } from "../../src/mocks/EAS.sol";
import { MockGardenAccessControl } from "../../src/mocks/GardenAccessControl.sol";

/// @title WorkResolverTest
/// @notice Unit tests for WorkResolver onAttest validation logic
/// @dev Uses MockGardenAccessControl to isolate resolver logic from GardenAccount/HatsModule
contract WorkResolverTest is Test {
    WorkResolver private workResolver;
    ActionRegistry private actionRegistry;
    MockEAS private mockEAS;
    MockGardenAccessControl private mockGarden;

    address private multisig = address(0x123);
    address private gardener = address(0x456);
    address private operator = address(0x789);
    address private stranger = address(0x999);

    uint256 private activeActionId;

    function setUp() public {
        // Deploy mock EAS and garden access control
        mockEAS = new MockEAS();
        mockGarden = new MockGardenAccessControl();

        // Configure roles: gardener is a gardener, operator is both
        mockGarden.setGardener(gardener, true);
        mockGarden.setOperator(operator, true);
        mockGarden.setGardener(operator, true);

        // Deploy ActionRegistry
        ActionRegistry actionImpl = new ActionRegistry();
        bytes memory actionInitData = abi.encodeWithSelector(ActionRegistry.initialize.selector, multisig);
        ERC1967Proxy actionProxy = new ERC1967Proxy(address(actionImpl), actionInitData);
        actionRegistry = ActionRegistry(address(actionProxy));

        // Register an active action (AGRO domain)
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

        // Set garden's domain bitmask to include AGRO (bit 1 = 0x02)
        // Use setGardenDomainsFromMint which only requires gardenToken authorization
        vm.prank(multisig);
        actionRegistry.setGardenToken(address(this));
        actionRegistry.setGardenDomainsFromMint(address(mockGarden), 0x02); // AGRO enabled

        // Deploy WorkResolver with proxy
        WorkResolver resolverImpl = new WorkResolver(address(mockEAS), address(actionRegistry));
        bytes memory resolverInitData = abi.encodeWithSelector(WorkResolver.initialize.selector, multisig);
        ERC1967Proxy resolverProxy = new ERC1967Proxy(address(resolverImpl), resolverInitData);
        workResolver = WorkResolver(payable(address(resolverProxy)));
    }

    // =========================================================================
    // Initialization Tests
    // =========================================================================

    function testInitialize() public {
        assertEq(workResolver.owner(), multisig, "Owner should be multisig");
    }

    function testIsPayable() public {
        assertFalse(workResolver.isPayable(), "Resolver should not be payable");
    }

    function testActionRegistrySet() public {
        assertEq(workResolver.ACTION_REGISTRY(), address(actionRegistry), "Action registry should be set");
    }

    // =========================================================================
    // onAttest: Happy Path Tests
    // =========================================================================

    function testOnAttestValidGardener() public {
        Attestation memory attestation = _buildWorkAttestation(gardener, activeActionId);

        vm.prank(address(mockEAS));
        bool result = workResolver.attest(attestation);
        assertTrue(result, "Valid gardener attestation should succeed");
    }

    function testOnAttestValidOperator() public {
        Attestation memory attestation = _buildWorkAttestation(operator, activeActionId);

        vm.prank(address(mockEAS));
        bool result = workResolver.attest(attestation);
        assertTrue(result, "Operator should also be able to submit work");
    }

    // =========================================================================
    // onAttest: Identity Validation (FIRST check)
    // =========================================================================

    function testOnAttestRevertsForNonMember() public {
        Attestation memory attestation = _buildWorkAttestation(stranger, activeActionId);

        vm.prank(address(mockEAS));
        vm.expectRevert(NotGardenMember.selector);
        workResolver.attest(attestation);
    }

    function testOnAttestRevertsForEvaluatorOnly() public {
        // Evaluators without gardener role cannot submit work
        address evaluator = address(0xABC);
        mockGarden.setEvaluator(evaluator, true);

        Attestation memory attestation = _buildWorkAttestation(evaluator, activeActionId);

        vm.prank(address(mockEAS));
        vm.expectRevert(NotGardenMember.selector);
        workResolver.attest(attestation);
    }

    // =========================================================================
    // onAttest: Required Fields Validation (SECOND check)
    // =========================================================================

    function testOnAttestRevertsForEmptyTitle() public {
        Attestation memory attestation = _buildWorkAttestationFull(gardener, activeActionId, "", "ipfs://QmTestMetadata");

        vm.prank(address(mockEAS));
        vm.expectRevert(TitleRequired.selector);
        workResolver.attest(attestation);
    }

    function testOnAttestRevertsForEmptyMetadata() public {
        Attestation memory attestation = _buildWorkAttestationFull(gardener, activeActionId, "Test Work", "");

        vm.prank(address(mockEAS));
        vm.expectRevert(MetadataRequired.selector);
        workResolver.attest(attestation);
    }

    function testOnAttestAcceptsValidTitleAndMetadata() public {
        Attestation memory attestation = _buildWorkAttestationFull(gardener, activeActionId, "My Work", "ipfs://QmValid");

        vm.prank(address(mockEAS));
        bool result = workResolver.attest(attestation);
        assertTrue(result, "Valid title and metadata should succeed");
    }

    // =========================================================================
    // onAttest: Action Validation (THIRD check)
    // =========================================================================

    function testOnAttestRevertsForNonExistentAction() public {
        uint256 nonExistentAction = 999;
        Attestation memory attestation = _buildWorkAttestation(gardener, nonExistentAction);

        vm.prank(address(mockEAS));
        vm.expectRevert(NotInActionRegistry.selector);
        workResolver.attest(attestation);
    }

    // =========================================================================
    // onAttest: Timing Validation (FOURTH check)
    // =========================================================================

    function testOnAttestRevertsForExpiredAction() public {
        // Register an AGRO action that will expire (garden already has AGRO enabled)
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.SOCIAL;

        vm.prank(multisig);
        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 1 hours,
            "Short Action",
            "test.short",
            "ipfs://short",
            capitals,
            new string[](0),
            Domain.AGRO
        );
        uint256 expiredActionId = 1;

        // Warp past the end time
        vm.warp(block.timestamp + 2 hours);

        Attestation memory attestation = _buildWorkAttestation(gardener, expiredActionId);

        vm.prank(address(mockEAS));
        vm.expectRevert(NotActiveAction.selector);
        workResolver.attest(attestation);
    }

    function test_revert_WorkBeforeActionStart() public {
        // Register an AGRO action with startTime in the future
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.SOCIAL;

        uint256 futureStart = block.timestamp + 7 days;
        vm.prank(multisig);
        actionRegistry.registerAction(
            futureStart,
            futureStart + 30 days,
            "Future Action",
            "agro.future",
            "ipfs://future",
            capitals,
            new string[](0),
            Domain.AGRO
        );
        uint256 futureActionId = 1;

        // Current time is before the action's startTime
        Attestation memory attestation = _buildWorkAttestation(gardener, futureActionId);

        vm.prank(address(mockEAS));
        vm.expectRevert(NotActiveAction.selector);
        workResolver.attest(attestation);
    }

    function testOnAttestSucceedsRightBeforeExpiry() public {
        // Register AGRO action ending in 1 hour (garden already has AGRO enabled)
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.MATERIAL;

        vm.prank(multisig);
        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 1 hours,
            "Timed Action",
            "test.timed",
            "ipfs://timed",
            capitals,
            new string[](0),
            Domain.AGRO
        );
        uint256 timedActionId = 1;

        // Warp to just before expiry
        vm.warp(block.timestamp + 1 hours - 1);

        Attestation memory attestation = _buildWorkAttestation(gardener, timedActionId);

        vm.prank(address(mockEAS));
        bool result = workResolver.attest(attestation);
        assertTrue(result, "Should succeed right before expiry");
    }

    // =========================================================================
    // onAttest: Domain Validation (FIFTH check)
    // =========================================================================

    function testOnAttestRevertsForDomainMismatch() public {
        // Register a SOLAR action (domain = 0)
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.SOCIAL;

        vm.prank(multisig);
        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 30 days,
            "Solar Panel Install",
            "solar.install",
            "ipfs://solar",
            capitals,
            new string[](0),
            Domain.SOLAR
        );
        uint256 solarActionId = 1;

        // Garden only has AGRO (0x02) enabled — SOLAR (0x01) is NOT enabled
        Attestation memory attestation = _buildWorkAttestation(gardener, solarActionId);

        vm.prank(address(mockEAS));
        vm.expectRevert(ActionDomainMismatch.selector);
        workResolver.attest(attestation);
    }

    function testOnAttestSucceedsForMatchingDomain() public {
        // The default action is AGRO and the garden has AGRO enabled
        Attestation memory attestation = _buildWorkAttestation(gardener, activeActionId);

        vm.prank(address(mockEAS));
        bool result = workResolver.attest(attestation);
        assertTrue(result, "Matching domain should succeed");
    }

    function testOnAttestSucceedsForGardenWithMultipleDomains() public {
        // Register a SOLAR action
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.SOCIAL;

        vm.prank(multisig);
        actionRegistry.registerAction(
            block.timestamp,
            block.timestamp + 30 days,
            "Solar Maintenance",
            "solar.maintenance",
            "ipfs://solar-maint",
            capitals,
            new string[](0),
            Domain.SOLAR
        );
        uint256 solarActionId = 1;

        // Enable both SOLAR (0x01) and AGRO (0x02) = 0x03
        actionRegistry.setGardenDomainsFromMint(address(mockGarden), 0x03);

        Attestation memory attestation = _buildWorkAttestation(gardener, solarActionId);

        vm.prank(address(mockEAS));
        bool result = workResolver.attest(attestation);
        assertTrue(result, "Garden with multiple domains should accept matching action");
    }

    function testOnAttestRevertsForGardenWithNoDomains() public {
        // Set garden domains to 0 (no domains enabled)
        actionRegistry.setGardenDomainsFromMint(address(mockGarden), 0x00);

        Attestation memory attestation = _buildWorkAttestation(gardener, activeActionId);

        vm.prank(address(mockEAS));
        vm.expectRevert(ActionDomainMismatch.selector);
        workResolver.attest(attestation);
    }

    // =========================================================================
    // onAttest: Validation Order Tests
    // =========================================================================

    function testValidationOrderIdentityBeforeFields() public {
        // Stranger with empty title: should revert with NotGardenMember (identity check first)
        Attestation memory attestation = _buildWorkAttestationFull(stranger, activeActionId, "", "");

        vm.prank(address(mockEAS));
        vm.expectRevert(NotGardenMember.selector);
        workResolver.attest(attestation);
    }

    function testValidationOrderFieldsBeforeAction() public {
        // Valid member with empty title + non-existent action: should revert with TitleRequired
        uint256 nonExistentAction = 999;
        Attestation memory attestation = _buildWorkAttestationFull(gardener, nonExistentAction, "", "ipfs://QmTestMetadata");

        vm.prank(address(mockEAS));
        vm.expectRevert(TitleRequired.selector);
        workResolver.attest(attestation);
    }

    function testValidationOrderIdentityBeforeAction() public {
        // Stranger with non-existent action: should revert with NotGardenMember (identity check first)
        uint256 nonExistentAction = 999;
        Attestation memory attestation = _buildWorkAttestation(stranger, nonExistentAction);

        vm.prank(address(mockEAS));
        vm.expectRevert(NotGardenMember.selector);
        workResolver.attest(attestation);
    }

    // =========================================================================
    // onAttest: Return Value Verification
    // =========================================================================

    function testOnAttestReturnsTrueForValidWork() public {
        Attestation memory attestation = _buildWorkAttestation(gardener, activeActionId);

        vm.prank(address(mockEAS));
        bool result = workResolver.attest(attestation);
        assertTrue(result, "onAttest should explicitly return true for valid work submission");
    }

    // =========================================================================
    // onRevoke Tests
    // =========================================================================

    function testOnRevokeAlwaysReturnsFalse() public {
        Attestation memory attestation = _buildWorkAttestation(gardener, activeActionId);

        vm.prank(address(mockEAS));
        bool result = workResolver.revoke(attestation);
        assertFalse(result, "Work submissions should not be revocable");
    }

    // =========================================================================
    // Access Control Tests
    // =========================================================================

    function testOnlyEASCanCallAttest() public {
        Attestation memory attestation = _buildWorkAttestation(gardener, activeActionId);

        vm.prank(stranger);
        vm.expectRevert();
        workResolver.attest(attestation);
    }

    // =========================================================================
    // Double Initialization Test
    // =========================================================================

    function test_initialize_revertsOnDoubleInit() public {
        vm.expectRevert("Initializable: contract is already initialized");
        workResolver.initialize(address(0x999));
    }

    // =========================================================================
    // UUPS Upgrade Tests
    // =========================================================================

    function test_authorizeUpgrade_ownerCanUpgrade() public {
        WorkResolver newImpl = new WorkResolver(address(mockEAS), address(actionRegistry));

        vm.prank(multisig);
        workResolver.upgradeTo(address(newImpl));
    }

    function test_authorizeUpgrade_nonOwnerCannotUpgrade() public {
        WorkResolver newImpl = new WorkResolver(address(mockEAS), address(actionRegistry));

        vm.prank(stranger);
        vm.expectRevert("Ownable: caller is not the owner");
        workResolver.upgradeTo(address(newImpl));
    }

    // =========================================================================
    // Schema UID Validation Tests
    // =========================================================================

    function test_revert_InvalidSchema() public {
        bytes32 expectedSchema = bytes32(uint256(200));
        vm.prank(multisig);
        workResolver.setSchemaUID(expectedSchema);

        // Build attestation with a different schema UID (100 != 200)
        Attestation memory attestation = _buildWorkAttestation(gardener, activeActionId);

        vm.prank(address(mockEAS));
        vm.expectRevert(InvalidSchema.selector);
        workResolver.attest(attestation);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    function _buildWorkAttestation(address attester, uint256 actionUID) internal view returns (Attestation memory) {
        return _buildWorkAttestationFull(attester, actionUID, "Test Work", "ipfs://QmTestMetadata");
    }

    function _buildWorkAttestationFull(
        address attester,
        uint256 actionUID,
        string memory title,
        string memory metadata
    )
        internal
        view
        returns (Attestation memory)
    {
        WorkSchema memory schema =
            WorkSchema({ actionUID: actionUID, title: title, feedback: "", metadata: metadata, media: new string[](0) });

        return Attestation({
            uid: bytes32(uint256(1)),
            schema: bytes32(uint256(100)),
            time: uint64(block.timestamp),
            expirationTime: 0,
            revocationTime: 0,
            refUID: bytes32(0),
            recipient: address(mockGarden), // Garden address = IGardenAccessControl
            attester: attester,
            revocable: false,
            data: abi.encode(schema)
        });
    }
}
