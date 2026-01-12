// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
// import { Attestation } from "@eas/IEAS.sol";

// import { WorkSchema } from "../../src/Schemas.sol";
// import { NotInActionRegistry, NotGardenerAccount } from "../../src/Constants.sol";
import { WorkResolver } from "../../src/resolvers/Work.sol";
import { ActionRegistry } from "../../src/registries/Action.sol";
import { GardenAccount } from "../../src/accounts/Garden.sol";
import { IGardenAccount } from "../../src/interfaces/IGardenAccount.sol";
import { HatsModule } from "../../src/modules/Hats.sol";
import { MockEAS } from "../../src/mocks/EAS.sol";
import { MockERC20 } from "../../src/mocks/ERC20.sol";
import { MockHatsProtocol } from "../../src/mocks/HatsProtocol.sol";

contract WorkResolverTest is Test {
    WorkResolver private workResolver;
    ActionRegistry private mockActionRegistry;
    GardenAccount private mockGardenAccount;
    HatsModule private hatsModule;
    MockEAS private mockIEAS;
    MockERC20 private mockCommunityToken;
    MockHatsProtocol private mockHats;

    address private owner = address(this);
    address private multisig = address(0x124);
    address private attester = address(0x476);
    address private recipient = address(0x787);

    function setUp() public {
        // Deploy mock community token
        mockCommunityToken = new MockERC20();
        mockIEAS = new MockEAS();

        // Deploy mock Hats Protocol
        mockHats = new MockHatsProtocol();
        uint256 topHatId = mockHats.mintTopHat(multisig, "Top Hat", "");
        uint256 gardensHatId = mockHats.createHat(topHatId, "Gardens", type(uint32).max, address(0), address(0), true, "");

        // Deploy HatsModule
        HatsModule hatsModuleImpl = new HatsModule();
        bytes memory hatsModuleInitData = abi.encodeWithSelector(
            HatsModule.initialize.selector,
            multisig,
            address(mockHats),
            gardensHatId
        );
        ERC1967Proxy hatsModuleProxy = new ERC1967Proxy(address(hatsModuleImpl), hatsModuleInitData);
        hatsModule = HatsModule(address(hatsModuleProxy));

        // Create minimal mock contracts with code (use non-precompile addresses)
        vm.etch(address(0x1021), hex"00"); // erc4337EntryPoint
        vm.etch(address(0x1022), hex"00"); // multicallForwarder
        vm.etch(address(0x1023), hex"00"); // erc6551Registry
        vm.etch(address(0x1024), hex"00"); // guardian

        // Deploy the mock contracts
        ActionRegistry actionImpl = new ActionRegistry();
        bytes memory actionInitData = abi.encodeWithSelector(ActionRegistry.initialize.selector, multisig);
        ERC1967Proxy actionProxy = new ERC1967Proxy(address(actionImpl), actionInitData);
        mockActionRegistry = ActionRegistry(address(actionProxy));

        // Deploy mock garden account (needs proxy for upgradeable contract)
        GardenAccount gardenAccountImpl = new GardenAccount(
            address(0x1021), address(0x1022), address(0x1023), address(0x1024)
        );

        IGardenAccount.InitParams memory params = IGardenAccount.InitParams({
            communityToken: address(mockCommunityToken),
            name: "Test Garden",
            description: "Test Description",
            location: "Test Location",
            bannerImage: "",
            metadata: "",
            openJoining: false,
            gardeners: new address[](0),
            gardenOperators: new address[](0)
        });

        bytes memory gardenAccountInitData = abi.encodeWithSelector(GardenAccount.initialize.selector, params);

        ERC1967Proxy gardenAccountProxy = new ERC1967Proxy(address(gardenAccountImpl), gardenAccountInitData);
        mockGardenAccount = GardenAccount(payable(address(gardenAccountProxy)));

        // Deploy the WorkResolver implementation (now requires hatsModule)
        WorkResolver resolverImpl = new WorkResolver(address(mockIEAS), address(mockActionRegistry), address(hatsModule));

        // Deploy with proxy and initialize
        bytes memory resolverInitData = abi.encodeWithSelector(WorkResolver.initialize.selector, multisig);
        ERC1967Proxy resolverProxy = new ERC1967Proxy(address(resolverImpl), resolverInitData);
        workResolver = WorkResolver(payable(address(resolverProxy)));
    }

    function testInitialize() public {
        // Test that the contract is properly initialized
        assertEq(workResolver.owner(), multisig, "Owner should be the multisig address");
    }

    function testIsPayable() public {
        // Test that the resolver is payable
        assertTrue(workResolver.isPayable(), "Resolver should be payable");
    }

    function testActionRegistrySet() public {
        // Test that action registry is properly configured
        assertEq(workResolver.ACTION_REGISTRY(), address(mockActionRegistry), "Action registry should be set");
    }

    function testOwnerIsMultisig() public {
        // Verify owner is the multisig
        assertEq(workResolver.owner(), multisig, "Owner should be multisig");
    }

    // Note: Full integration tests for onAttest validation are in Integration.t.sol
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
