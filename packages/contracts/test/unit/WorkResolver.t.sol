// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Attestation } from "@eas/IEAS.sol";

import { WorkSchema } from "../../src/Schemas.sol";
import { WorkResolver, NotGardenMember, NotInActionRegistry, NotActiveAction } from "../../src/resolvers/Work.sol";
import { ActionRegistry, Capital } from "../../src/registries/Action.sol";
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

        // Register an active action
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.LIVING;

        vm.prank(multisig);
        actionRegistry.registerAction(
            block.timestamp, block.timestamp + 30 days, "Plant Trees", "ipfs://instructions", capitals, new string[](0)
        );
        activeActionId = 0;

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
        assertTrue(workResolver.isPayable(), "Resolver should be payable");
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
    // onAttest: Action Validation (SECOND check)
    // =========================================================================

    function testOnAttestRevertsForNonExistentAction() public {
        uint256 nonExistentAction = 999;
        Attestation memory attestation = _buildWorkAttestation(gardener, nonExistentAction);

        vm.prank(address(mockEAS));
        vm.expectRevert(NotInActionRegistry.selector);
        workResolver.attest(attestation);
    }

    // =========================================================================
    // onAttest: Timing Validation (THIRD check)
    // =========================================================================

    function testOnAttestRevertsForExpiredAction() public {
        // Register an action that's already expired
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.SOCIAL;

        vm.prank(multisig);
        actionRegistry.registerAction(
            block.timestamp, block.timestamp + 1 hours, "Short Action", "ipfs://short", capitals, new string[](0)
        );
        uint256 expiredActionId = 1;

        // Warp past the end time
        vm.warp(block.timestamp + 2 hours);

        Attestation memory attestation = _buildWorkAttestation(gardener, expiredActionId);

        vm.prank(address(mockEAS));
        vm.expectRevert(NotActiveAction.selector);
        workResolver.attest(attestation);
    }

    function testOnAttestSucceedsRightBeforeExpiry() public {
        // Register action ending in 1 hour
        Capital[] memory capitals = new Capital[](1);
        capitals[0] = Capital.MATERIAL;

        vm.prank(multisig);
        actionRegistry.registerAction(
            block.timestamp, block.timestamp + 1 hours, "Timed Action", "ipfs://timed", capitals, new string[](0)
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
    // onAttest: Validation Order Tests
    // =========================================================================

    function testValidationOrderIdentityBeforeAction() public {
        // Stranger with non-existent action: should revert with NotGardenMember (identity check first)
        uint256 nonExistentAction = 999;
        Attestation memory attestation = _buildWorkAttestation(stranger, nonExistentAction);

        vm.prank(address(mockEAS));
        vm.expectRevert(NotGardenMember.selector);
        workResolver.attest(attestation);
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
    // Helpers
    // =========================================================================

    function _buildWorkAttestation(address attester, uint256 actionUID) internal view returns (Attestation memory) {
        WorkSchema memory schema =
            WorkSchema({ actionUID: actionUID, title: "Test Work", feedback: "", metadata: "", media: new string[](0) });

        return Attestation({
            uid: bytes32(uint256(1)),
            schema: bytes32(uint256(100)),
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
