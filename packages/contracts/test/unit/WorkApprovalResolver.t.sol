// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Attestation } from "@eas/IEAS.sol";

import { WorkApprovalSchema, WorkSchema } from "../../src/Schemas.sol";
import { WorkApprovalResolver, NotInWorkRegistry, NotGardenOperator } from "../../src/resolvers/WorkApproval.sol";
import { NotInActionRegistry } from "../../src/resolvers/Work.sol";
import { ActionRegistry, Capital } from "../../src/registries/Action.sol";
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
            block.timestamp, block.timestamp + 30 days, "Plant Trees", "ipfs://instructions", capitals, new string[](0)
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
        assertTrue(workApprovalResolver.isPayable(), "Resolver should be payable");
    }

    function testActionRegistrySet() public {
        assertEq(workApprovalResolver.ACTION_REGISTRY(), address(actionRegistry), "Action registry should be set");
    }

    // =========================================================================
    // onAttest: Happy Path Tests
    // =========================================================================

    function testOnAttestValidEvaluatorApproval() public {
        Attestation memory attestation = _buildApprovalAttestation(evaluator, workUID, activeActionId, true);

        vm.prank(address(mockEAS));
        bool result = workApprovalResolver.attest(attestation);
        assertTrue(result, "Valid evaluator approval should succeed");
    }

    function testOnAttestValidOperatorApproval() public {
        Attestation memory attestation = _buildApprovalAttestation(operator, workUID, activeActionId, true);

        vm.prank(address(mockEAS));
        bool result = workApprovalResolver.attest(attestation);
        assertTrue(result, "Operator should also be able to approve work");
    }

    function testOnAttestValidRejection() public {
        Attestation memory attestation = _buildApprovalAttestation(evaluator, workUID, activeActionId, false);

        vm.prank(address(mockEAS));
        bool result = workApprovalResolver.attest(attestation);
        assertTrue(result, "Rejection (approved=false) should also succeed");
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

    function testOnAttestRevertsForNonEvaluatorNonOperator() public {
        Attestation memory attestation = _buildApprovalAttestation(stranger, workUID, activeActionId, true);

        vm.prank(address(mockEAS));
        vm.expectRevert(NotGardenOperator.selector);
        workApprovalResolver.attest(attestation);
    }

    function testOnAttestRevertsForGardenerOnly() public {
        // Gardeners cannot approve work - only evaluators and operators can
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
        Attestation memory attestation = _buildApprovalAttestation(evaluator, workUID, nonExistentAction, true);

        vm.prank(address(mockEAS));
        vm.expectRevert(NotInActionRegistry.selector);
        workApprovalResolver.attest(attestation);
    }

    // =========================================================================
    // onRevoke Tests
    // =========================================================================

    function testOnRevokeByEvaluator() public {
        Attestation memory attestation = _buildApprovalAttestation(evaluator, workUID, activeActionId, true);

        vm.prank(address(mockEAS));
        bool result = workApprovalResolver.revoke(attestation);
        assertTrue(result, "Evaluator should be able to revoke approval");
    }

    function testOnRevokeByOperator() public {
        Attestation memory attestation = _buildApprovalAttestation(operator, workUID, activeActionId, true);

        vm.prank(address(mockEAS));
        bool result = workApprovalResolver.revoke(attestation);
        assertTrue(result, "Operator should be able to revoke approval");
    }

    function testOnRevokeRevertsForNonEvaluator() public {
        Attestation memory attestation = _buildApprovalAttestation(stranger, workUID, activeActionId, true);

        vm.prank(address(mockEAS));
        vm.expectRevert(NotGardenOperator.selector);
        workApprovalResolver.revoke(attestation);
    }

    function testOnRevokeRevertsForGardener() public {
        Attestation memory attestation = _buildApprovalAttestation(gardener, workUID, activeActionId, true);

        vm.prank(address(mockEAS));
        vm.expectRevert(NotGardenOperator.selector);
        workApprovalResolver.revoke(attestation);
    }

    // =========================================================================
    // Configuration Tests
    // =========================================================================

    function testSetGreenGoodsResolver() public {
        address resolver = address(0xBEEF);

        vm.prank(multisig);
        workApprovalResolver.setGreenGoodsResolver(resolver);

        assertEq(address(workApprovalResolver.greenGoodsResolver()), resolver);
    }

    function testSetKarmaGAPModule() public {
        address module = address(0xCAFE);

        vm.prank(multisig);
        workApprovalResolver.setKarmaGAPModule(module);

        assertEq(address(workApprovalResolver.karmaGAPModule()), module);
    }

    function testOnlyOwnerCanSetGreenGoodsResolver() public {
        vm.prank(stranger);
        vm.expectRevert("Ownable: caller is not the owner");
        workApprovalResolver.setGreenGoodsResolver(address(0xBEEF));
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
        Attestation memory attestation = _buildApprovalAttestation(evaluator, workUID, activeActionId, true);

        vm.prank(stranger);
        vm.expectRevert();
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
        WorkApprovalSchema memory schema = WorkApprovalSchema({
            actionUID: actionUID,
            workUID: _workUID,
            approved: approved,
            feedback: approved ? "Good work" : "Needs improvement"
        });

        return Attestation({
            uid: bytes32(uint256(100)),
            schema: bytes32(uint256(101)),
            time: uint64(block.timestamp),
            expirationTime: 0,
            revocationTime: 0,
            refUID: _workUID,
            recipient: address(mockGarden), // Same garden as work attestation
            attester: attester,
            revocable: true,
            data: abi.encode(schema)
        });
    }
}
