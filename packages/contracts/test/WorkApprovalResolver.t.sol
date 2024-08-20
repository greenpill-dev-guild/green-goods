// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
// import { Attestation } from "@eas/IEAS.sol";

// import { WorkApprovalSchema } from "../src/Schemas.sol";
// import { NotInActionRegistry } from "../src/Constants.sol";
import { GardenAccount } from "../src/accounts/Garden.sol";
import { ActionRegistry } from "../src/registries/Action.sol";
import { WorkApprovalResolver, NotGardenOperator, NotInWorkRegistry } from "../src/resolvers/WorkApproval.sol";
import { MockEAS } from "../src/mocks/EAS.sol";

contract WorkApprovalResolverTest is Test {
    WorkApprovalResolver private workApprovalResolver;
    ActionRegistry private mockActionRegistry;
    GardenAccount private mockGardenAccount;
    MockEAS private mockIEAS;

    address private multisig = address(0x123);
    address private attester = address(0x456);
    address private recipient = address(0x789);

    function setUp() public {
        // Deploy the mock contracts
        mockActionRegistry = new ActionRegistry();
        mockGardenAccount = new GardenAccount(address(mockIEAS), address(0x002), address(0x003), address(0x004));
        mockIEAS = new MockEAS();

        mockActionRegistry.initialize(multisig);
        mockGardenAccount.initialize(address(0x555), "Test Garden", new address[](0), new address[](0));

        // Deploy the WorkApprovalResolver contract
        workApprovalResolver = new WorkApprovalResolver(address(address(0x007)), address(mockActionRegistry));
        workApprovalResolver.initialize(multisig);
    }

    function testInitialize() public {
        // Test that the contract is properly initialized
        assertEq(workApprovalResolver.owner(), multisig, "Owner should be the multisig address");
    }

    // function testIsPayable() public {
    //     // Test that the resolver is payable
    //     assertTrue(workApprovalResolver.isPayable(), "Resolver should be payable");
    // }

    // function testOnAttestValid() public {
    //     // Mock a valid action and garden account
    //     mockGardenAccount.addGardenOperator(attester);
    //     mockActionRegistry.registerAction(1, block.timestamp - 1, block.timestamp + 1000);

    //     // Mock a valid work attestation
    //     Attestation memory workAttestation = Attestation(attester, recipient, "");
    //     mockIEAS.setAttestation(1, workAttestation);

    //     // Create a valid attestation
    //     bytes memory data = abi.encode(WorkApprovalSchema(1, 1));
    //     Attestation memory attestation = Attestation(attester, recipient, data);

    //     bool result = workApprovalResolver.onAttest(attestation, 0);
    //     assertTrue(result, "Attestation should be valid");
    // }

    // function testOnAttestInvalidOperator() public {
    //     // Mock an invalid garden operator
    //     mockGardenAccount.setGardenOperator(attester, false);
    //     mockActionRegistry.setAction(1, block.timestamp - 1, block.timestamp + 1000);

    //     // Mock a valid work attestation
    //     Attestation memory workAttestation = Attestation(attester, recipient, "");
    //     mockIEAS.setAttestation(1, workAttestation);

    //     // Create an attestation with an invalid operator
    //     bytes memory data = abi.encode(WorkApprovalSchema(1, 1));
    //     Attestation memory attestation = Attestation(attester, recipient, data);

    //     vm.expectRevert(NotGardenOperator.selector);
    //     workApprovalResolver.onAttest(attestation, 0);
    // }

    // function testOnAttestInvalidWork() public {
    //     // Mock a valid garden operator but an invalid work attestation
    //     mockGardenAccount.setGardenOperator(attester, true);
    //     mockActionRegistry.setAction(1, block.timestamp - 1, block.timestamp + 1000);

    //     // Mock an invalid work attestation
    //     Attestation memory workAttestation = Attestation(address(0x999), recipient, "");
    //     mockIEAS.setAttestation(1, workAttestation);

    //     // Create an attestation with invalid work
    //     bytes memory data = abi.encode(WorkApprovalSchema(1, 1));
    //     Attestation memory attestation = Attestation(attester, recipient, data);

    //     vm.expectRevert(NotInWorkRegistry.selector);
    //     workApprovalResolver.onAttest(attestation, 0);
    // }

    // function testOnAttestInvalidAction() public {
    //     // Mock a valid garden operator but an invalid action
    //     mockGardenAccount.setGardenOperator(attester, true);
    //     mockActionRegistry.setAction(1, 0, 0);

    //     // Mock a valid work attestation
    //     Attestation memory workAttestation = Attestation(attester, recipient, "");
    //     mockIEAS.setAttestation(1, workAttestation);

    //     // Create an attestation with an invalid action
    //     bytes memory data = abi.encode(WorkApprovalSchema(1, 1));
    //     Attestation memory attestation = Attestation(attester, recipient, data);

    //     vm.expectRevert(NotInActionRegistry.selector);
    //     workApprovalResolver.onAttest(attestation, 0);
    // }

    // function testOnRevoke() public {
    //     // Test that the onRevoke function works correctly and can only be called by the owner
    //     Attestation memory attestation = Attestation(attester, recipient, "");

    //     vm.prank(multisig);
    //     bool result = workApprovalResolver.onRevoke(attestation, 0);
    //     assertTrue(result, "Revocation should be valid");
    // }

    // function testOnRevokeNonOwner() public {
    //     // Test that non-owners cannot revoke
    //     Attestation memory attestation = Attestation(attester, recipient, "");

    //     vm.prank(address(0x999));
    //     vm.expectRevert("Ownable: caller is not the owner");
    //     workApprovalResolver.onRevoke(attestation, 0);
    // }

    // function testAuthorizeUpgrade() public {
    //     // Test that only the owner can authorize an upgrade
    //     address newImplementation = address(0x456);

    //     vm.prank(multisig);
    //     workApprovalResolver._authorizeUpgrade(newImplementation);
    // }

    // function testNonOwnerCannotUpgrade() public {
    //     // Test that non-owners cannot authorize an upgrade
    //     address newImplementation = address(0x456);

    //     vm.prank(address(0x999));
    //     vm.expectRevert("Ownable: caller is not the owner");
    //     workApprovalResolver._authorizeUpgrade(newImplementation);
    // }
}
