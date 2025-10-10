// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { AssessmentResolver } from "../src/resolvers/Assessment.sol";
import { GardenAccount } from "../src/accounts/Garden.sol";
import { MockEAS } from "../src/mocks/EAS.sol";
import { MockERC20 } from "../src/mocks/ERC20.sol";

/// @title AssessmentResolverTest
/// @notice Test suite for the AssessmentResolver contract
contract AssessmentResolverTest is Test {
    AssessmentResolver private assessmentResolver;
    GardenAccount private mockGardenAccount;
    MockEAS private mockIEAS;
    MockERC20 private mockCommunityToken;
    
    address private multisig = address(0x123);
    address private operator = address(0x200);
    address private gardener = address(0x300);

    function setUp() public {
        // Deploy mock EAS
        mockIEAS = new MockEAS();
        
        // Deploy mock community token
        mockCommunityToken = new MockERC20();
        
        // Deploy mock garden account
        vm.etch(address(0x1001), hex"00");
        vm.etch(address(0x1002), hex"00");
        vm.etch(address(0x1003), hex"00");
        vm.etch(address(0x1004), hex"00");
        
        mockGardenAccount = new GardenAccount(
            address(0x1001), // erc4337EntryPoint
            address(0x1002), // multicallForwarder
            address(0x1003), // erc6551Registry
            address(0x1004) // guardian
        );
        
        address[] memory gardeners = new address[](1);
        address[] memory operators = new address[](1);
        gardeners[0] = gardener;
        operators[0] = operator;
        
        mockGardenAccount.initialize(
            address(mockCommunityToken),
            "Test Garden",
            "Test Description",
            "Test Location",
            "",
            gardeners,
            operators
        );
        
        // Deploy AssessmentResolver
        AssessmentResolver resolverImpl = new AssessmentResolver(address(mockIEAS));
        bytes memory resolverInitData = abi.encodeWithSelector(AssessmentResolver.initialize.selector, multisig);
        ERC1967Proxy resolverProxy = new ERC1967Proxy(address(resolverImpl), resolverInitData);
        assessmentResolver = AssessmentResolver(payable(address(resolverProxy)));
    }

    function testInitialize() public {
        assertEq(assessmentResolver.owner(), multisig, "Owner should be multisig");
    }

    function testIsPayable() public {
        assertTrue(assessmentResolver.isPayable(), "Resolver should be payable");
    }

    function testOwnerIsMultisig() public {
        assertEq(assessmentResolver.owner(), multisig, "Owner should be multisig");
    }

    // Note: Full integration tests for onAttest validation require complex mock setup
    // These are covered in Integration.t.sol with real contract interactions
}


