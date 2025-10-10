// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
// import { Attestation } from "@eas/IEAS.sol";

// import { WorkApprovalSchema } from "../src/Schemas.sol";
// import { NotInActionRegistry } from "../src/Constants.sol";
import { GardenAccount } from "../src/accounts/Garden.sol";
import { ActionRegistry } from "../src/registries/Action.sol";
import { WorkApprovalResolver } from "../src/resolvers/WorkApproval.sol";
import { MockEAS } from "../src/mocks/EAS.sol";
import { MockERC20 } from "../src/mocks/ERC20.sol";

contract WorkApprovalResolverTest is Test {
    WorkApprovalResolver private workApprovalResolver;
    ActionRegistry private mockActionRegistry;
    GardenAccount private mockGardenAccount;
    MockEAS private mockIEAS;
    MockERC20 private mockCommunityToken;

    address private owner = address(this);
    address private multisig = address(0x123);
    address private attester = address(0x456);
    address private recipient = address(0x789);

    function setUp() public {
        // Deploy mock community token
        mockCommunityToken = new MockERC20();
        
        // Create minimal mock contracts with code (use non-precompile addresses)
        vm.etch(address(0x1002), hex"00"); // multicallForwarder
        vm.etch(address(0x1003), hex"00"); // erc6551Registry
        vm.etch(address(0x1004), hex"00"); // guardian
        
        // Deploy the mock contracts
        mockIEAS = new MockEAS();

        ActionRegistry actionImpl = new ActionRegistry();
        bytes memory actionInitData = abi.encodeWithSelector(ActionRegistry.initialize.selector, multisig);
        ERC1967Proxy actionProxy = new ERC1967Proxy(address(actionImpl), actionInitData);
        mockActionRegistry = ActionRegistry(address(actionProxy));

        // Deploy mock garden account (needs proxy for upgradeable contract)
        GardenAccount gardenAccountImpl = new GardenAccount(address(mockIEAS), address(0x1002), address(0x1003), address(0x1004));

        bytes memory gardenAccountInitData = abi.encodeWithSelector(
            GardenAccount.initialize.selector,
            address(mockCommunityToken),
            "Test Garden",
            "Test Description",
            "Test Location",
            "",
            new address[](0),
            new address[](0)
        );
        
        ERC1967Proxy gardenAccountProxy = new ERC1967Proxy(address(gardenAccountImpl), gardenAccountInitData);
        mockGardenAccount = GardenAccount(payable(address(gardenAccountProxy)));

        // Deploy the WorkApprovalResolver implementation
        WorkApprovalResolver resolverImpl = new WorkApprovalResolver(address(mockIEAS), address(mockActionRegistry));

        // Deploy with proxy and initialize
        bytes memory resolverInitData = abi.encodeWithSelector(WorkApprovalResolver.initialize.selector, multisig);
        ERC1967Proxy resolverProxy = new ERC1967Proxy(address(resolverImpl), resolverInitData);
        workApprovalResolver = WorkApprovalResolver(payable(address(resolverProxy)));
    }

    function testInitialize() public {
        // Test that the contract is properly initialized
        assertEq(workApprovalResolver.owner(), multisig, "Owner should be the multisig address");
    }

    function testIsPayable() public {
        // Test that the resolver is payable
        assertTrue(workApprovalResolver.isPayable(), "Resolver should be payable");
    }

    function testActionRegistrySet() public {
        // Test that action registry is properly configured
        assertEq(workApprovalResolver.ACTION_REGISTRY(), address(mockActionRegistry), "Action registry should be set");
    }

    function testOwnerIsMultisig() public {
        // Verify owner is the multisig
        assertEq(workApprovalResolver.owner(), multisig, "Owner should be multisig");
    }

    // Note: Full integration tests for onAttest validation are in Integration.t.sol
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
