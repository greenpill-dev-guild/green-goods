// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
// import { Attestation } from "@eas/IEAS.sol";

// import { WorkSchema } from "../src/Schemas.sol";
// import { NotInActionRegistry, NotGardenerAccount } from "../src/Constants.sol";
import { WorkResolver, NotActiveAction } from "../src/resolvers/Work.sol";
import { ActionRegistry } from "../src/registries/Action.sol";
import { GardenAccount } from "../src/accounts/Garden.sol";
import { MockEAS } from "../src/mocks/EAS.sol";

contract WorkResolverTest is Test {
    WorkResolver private workResolver;
    ActionRegistry private mockActionRegistry;
    GardenAccount private mockGardenAccount;
    MockEAS private mockIEAS;

    address private owner = address(this);
    address private multisig = address(0x124);
    address private attester = address(0x476);
    address private recipient = address(0x787);

    function setUp() public {
        // Deploy the mock contracts
        mockActionRegistry = new ActionRegistry();
        mockGardenAccount = new GardenAccount(address(0x021), address(0x022), address(0x023), address(0x024));
        mockIEAS = new MockEAS();

        mockActionRegistry.initialize(multisig);
        mockGardenAccount.initialize(
            address(0x545), "Test Garden", "Test Description", "Test Location", "", new address[](0), new address[](0)
        );

        // Deploy the WorkResolver contract
        workResolver = new WorkResolver(address(mockIEAS), address(mockActionRegistry));
        workResolver.initialize(multisig);
    }

    function testInitialize() public {
        // Test that the contract is properly initialized
        assertEq(workResolver.owner(), owner, "Owner should be the multisig address");
    }

    function testIsPayable() public {
        // Test that the resolver is payable
        assertTrue(workResolver.isPayable(), "Resolver should be payable");
    }

    // function testOnAttestValid() public {
    //     // Mock a valid action and garden account
    //     mockGardenAccount.setGardener(attester, true);
    //     mockActionRegistry.setAction(1, block.timestamp - 1, block.timestamp + 1000);

    //     // Create a valid attestation
    //     bytes memory data = abi.encode(WorkSchema(1));
    //     Attestation memory attestation = Attestation(attester, recipient, data);

    //     bool result = workResolver.onAttest(attestation, 0);
    //     assertTrue(result, "Attestation should be valid");
    // }

    // function testOnAttestInvalidGardener() public {
    //     // Mock an invalid gardener
    //     mockGardenAccount.setGardener(attester, false);
    //     mockActionRegistry.setAction(1, block.timestamp - 1, block.timestamp + 1000);

    //     // Create an attestation with an invalid gardener
    //     bytes memory data = abi.encode(WorkSchema(1));
    //     Attestation memory attestation = Attestation(attester, recipient, data);

    //     vm.expectRevert(NotGardenerAccount.selector);
    //     workResolver.onAttest(attestation, 0);
    // }

    // function testOnAttestInvalidAction() public {
    //     // Mock a valid gardener but an invalid action
    //     mockGardenAccount.setGardener(attester, true);
    //     mockActionRegistry.setAction(1, 0, 0);

    //     // Create an attestation with an invalid action
    //     bytes memory data = abi.encode(WorkSchema(1));
    //     Attestation memory attestation = Attestation(attester, recipient, data);

    //     vm.expectRevert(NotInActionRegistry.selector);
    //     workResolver.onAttest(attestation, 0);
    // }

    // function testOnAttestExpiredAction() public {
    //     // Mock a valid gardener but an expired action
    //     mockGardenAccount.setGardener(attester, true);
    //     mockActionRegistry.setAction(1, block.timestamp - 1000, block.timestamp - 500);

    //     // Create an attestation with an expired action
    //     bytes memory data = abi.encode(WorkSchema(1));
    //     Attestation memory attestation = Attestation(attester, recipient, data);

    //     vm.expectRevert(NotActiveAction.selector);
    //     workResolver.onAttest(attestation, 0);
    // }

    // function testOnRevoke() public {
    //     // Test that the onRevoke function works correctly and can only be called by the owner
    //     Attestation memory attestation = Attestation(attester, recipient, "");

    //     vm.prank(multisig);
    //     bool result = workResolver.onRevoke(attestation, 0);
    //     assertTrue(result, "Revocation should be valid");
    // }

    // function testOnRevokeNonOwner() public {
    //     // Test that non-owners cannot revoke
    //     Attestation memory attestation = Attestation(attester, recipient, "");

    //     vm.prank(address(0x999));
    //     vm.expectRevert("Ownable: caller is not the owner");
    //     workResolver.onRevoke(attestation, 0);
    // }

    // function testAuthorizeUpgrade() public {
    //     // Test that only the owner can authorize an upgrade
    //     address newImplementation = address(0x456);

    //     vm.prank(multisig);
    //     workResolver._authorizeUpgrade(newImplementation);
    // }

    // function testNonOwnerCannotUpgrade() public {
    //     // Test that non-owners cannot authorize an upgrade
    //     address newImplementation = address(0x456);

    //     vm.prank(address(0x999));
    //     vm.expectRevert("Ownable: caller is not the owner");
    //     workResolver._authorizeUpgrade(newImplementation);
    // }
}
