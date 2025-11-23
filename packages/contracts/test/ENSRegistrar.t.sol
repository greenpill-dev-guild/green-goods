// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import {
    ENSRegistrar,
    NameNotAvailable,
    InvalidName,
    UnauthorizedCaller,
    InvalidCredentialId
} from "../src/registries/ENSRegistrar.sol";

/// @title ENSRegistrarTest
/// @notice Tests for ENSRegistrar with passkey recovery
contract ENSRegistrarTest is Test {
    ENSRegistrar private registrar;
    address private owner = address(0x100);
    address private gardenerAccount = address(0x200);
    address private unauthorized = address(0x999);

    // Mock ENS addresses (for testing)
    address private constant MOCK_ENS_REGISTRY = address(0xCAD0);
    address private constant MOCK_ENS_RESOLVER = address(0xCAD1);
    // Precomputed: keccak256(abi.encodePacked(namehash("eth"), keccak256("greengoods")))
    bytes32 private constant GREENGOODS_BASE_NODE = 0x0b35b2d5b2f667f75a0da49b3b77e5ffb07f5e5c0e1c6f8e3a0f1e7b2d4c9a6b;

    // Event declaration for testing
    event SubdomainRegistered(string indexed name, address indexed owner, bytes32 indexed credentialId, uint256 timestamp);

    function setUp() public {
        // Deploy ENSRegistrar (non-upgradeable)
        registrar = new ENSRegistrar(MOCK_ENS_REGISTRY, MOCK_ENS_RESOLVER, GREENGOODS_BASE_NODE, owner);
    }

    // ============================================================================
    // REGISTRATION TESTS
    // ============================================================================

    function testRegisterSubdomain() public {
        string memory name = "alice";
        bytes32 credentialId = bytes32(uint256(12_345));

        // Mock ENS calls
        bytes32 label = keccak256(bytes(name));
        vm.mockCall(
            MOCK_ENS_REGISTRY,
            abi.encodeWithSignature(
                "setSubnodeOwner(bytes32,bytes32,address)", GREENGOODS_BASE_NODE, label, address(registrar)
            ),
            abi.encode()
        );
        vm.mockCall(MOCK_ENS_REGISTRY, abi.encodeWithSignature("setResolver(bytes32,address)"), abi.encode());
        vm.mockCall(MOCK_ENS_RESOLVER, abi.encodeWithSignature("setAddr(bytes32,address)"), abi.encode());

        vm.prank(gardenerAccount);
        registrar.register(name, gardenerAccount, credentialId);

        // Verify storage
        assertEq(registrar.ownerOf(name), gardenerAccount, "Owner should be set");
        assertEq(registrar.resolve(name), gardenerAccount, "Resolve should work");
        assertEq(registrar.accountToName(gardenerAccount), name, "Reverse lookup should work");

        // Verify recovery data
        (address recOwner, bytes32 recCredId, uint256 recClaimedAt) = registrar.getRecoveryData(name);
        assertEq(recOwner, gardenerAccount, "Recovery owner should match");
        assertEq(recCredId, credentialId, "Credential ID should match");
        assertGt(recClaimedAt, 0, "Claimed timestamp should be set");
    }

    function testRegisterEmitsEvent() public {
        string memory name = "alice";
        bytes32 credentialId = bytes32(uint256(12_345));

        // Mock ENS calls
        bytes32 label = keccak256(bytes(name));
        vm.mockCall(
            MOCK_ENS_REGISTRY,
            abi.encodeWithSignature(
                "setSubnodeOwner(bytes32,bytes32,address)", GREENGOODS_BASE_NODE, label, address(registrar)
            ),
            abi.encode()
        );
        vm.mockCall(MOCK_ENS_REGISTRY, abi.encodeWithSignature("setResolver(bytes32,address)"), abi.encode());
        vm.mockCall(MOCK_ENS_RESOLVER, abi.encodeWithSignature("setAddr(bytes32,address)"), abi.encode());

        vm.prank(gardenerAccount);
        vm.expectEmit(true, true, true, true);
        // SubdomainRegistered(string indexed name, address indexed owner, bytes32 indexed credentialId, uint256 timestamp)
        emit SubdomainRegistered(name, gardenerAccount, credentialId, block.timestamp);

        registrar.register(name, gardenerAccount, credentialId);
    }

    function testAvailable() public {
        string memory name = "alice";

        // Initially available
        assertTrue(registrar.available(name), "Name should be available initially");

        // Mock ENS calls
        vm.mockCall(MOCK_ENS_REGISTRY, abi.encodeWithSignature("setSubnodeOwner(bytes32,bytes32,address)"), abi.encode());
        vm.mockCall(MOCK_ENS_REGISTRY, abi.encodeWithSignature("setResolver(bytes32,address)"), abi.encode());
        vm.mockCall(MOCK_ENS_RESOLVER, abi.encodeWithSignature("setAddr(bytes32,address)"), abi.encode());

        // Register name
        vm.prank(gardenerAccount);
        registrar.register(name, gardenerAccount, bytes32(uint256(12_345)));

        // No longer available
        assertFalse(registrar.available(name), "Name should not be available after registration");
    }

    // ============================================================================
    // VALIDATION TESTS
    // ============================================================================

    function testCannotRegisterTaken() public {
        string memory name = "alice";
        bytes32 credentialId = bytes32(uint256(12_345));

        // Mock ENS calls
        vm.mockCall(MOCK_ENS_REGISTRY, abi.encodeWithSignature("setSubnodeOwner(bytes32,bytes32,address)"), abi.encode());
        vm.mockCall(MOCK_ENS_REGISTRY, abi.encodeWithSignature("setResolver(bytes32,address)"), abi.encode());
        vm.mockCall(MOCK_ENS_RESOLVER, abi.encodeWithSignature("setAddr(bytes32,address)"), abi.encode());

        // First registration
        vm.prank(gardenerAccount);
        registrar.register(name, gardenerAccount, credentialId);

        // Try to register again
        address anotherAccount = address(0x300);
        vm.prank(anotherAccount);
        vm.expectRevert(NameNotAvailable.selector);
        registrar.register(name, anotherAccount, bytes32(uint256(67_890)));
    }

    function testCannotRegisterWithInvalidName() public {
        bytes32 credentialId = bytes32(uint256(12_345));

        // Empty name
        vm.prank(gardenerAccount);
        vm.expectRevert(InvalidName.selector);
        registrar.register("", gardenerAccount, credentialId);

        // Too long name (> 50 chars)
        string memory longName = "thisnameiswaylongerthanfiftycharssoshouldrevert1234";
        vm.prank(gardenerAccount);
        vm.expectRevert(InvalidName.selector);
        registrar.register(longName, gardenerAccount, credentialId);
    }

    function testCannotRegisterWithInvalidCredentialId() public {
        string memory name = "alice";

        vm.prank(gardenerAccount);
        vm.expectRevert(InvalidCredentialId.selector);
        registrar.register(name, gardenerAccount, bytes32(0));
    }

    function testOnlyOwnerCanRegister() public {
        string memory name = "alice";
        bytes32 credentialId = bytes32(uint256(12_345));

        // Try to register for someone else
        vm.prank(unauthorized);
        vm.expectRevert(UnauthorizedCaller.selector);
        registrar.register(name, gardenerAccount, credentialId);
    }

    // ============================================================================
    // RECOVERY TESTS
    // ============================================================================

    function testGetRecoveryData() public {
        string memory name = "alice";
        bytes32 credentialId = bytes32(uint256(12_345));

        // Mock ENS calls
        vm.mockCall(MOCK_ENS_REGISTRY, abi.encodeWithSignature("setSubnodeOwner(bytes32,bytes32,address)"), abi.encode());
        vm.mockCall(MOCK_ENS_REGISTRY, abi.encodeWithSignature("setResolver(bytes32,address)"), abi.encode());
        vm.mockCall(MOCK_ENS_RESOLVER, abi.encodeWithSignature("setAddr(bytes32,address)"), abi.encode());

        vm.prank(gardenerAccount);
        registrar.register(name, gardenerAccount, credentialId);

        // Get recovery data
        (address recOwner, bytes32 recCredId, uint256 recClaimedAt) = registrar.getRecoveryData(name);

        assertEq(recOwner, gardenerAccount, "Should return correct owner");
        assertEq(recCredId, credentialId, "Should return correct credential ID");
        assertEq(recClaimedAt, block.timestamp, "Should return correct timestamp");
    }

    function testGetRecoveryDataForUnregisteredName() public {
        // Get recovery data for non-existent name
        (address recOwner, bytes32 recCredId, uint256 recClaimedAt) = registrar.getRecoveryData("nonexistent");

        assertEq(recOwner, address(0), "Owner should be zero");
        assertEq(recCredId, bytes32(0), "Credential ID should be zero");
        assertEq(recClaimedAt, 0, "Timestamp should be zero");
    }

    // ============================================================================
    // GAS BENCHMARKS
    // ============================================================================

    function testGasRegisterSubdomain() public {
        string memory name = "alice";
        bytes32 credentialId = bytes32(uint256(12_345));

        // Mock ENS calls
        vm.mockCall(MOCK_ENS_REGISTRY, abi.encodeWithSignature("setSubnodeOwner(bytes32,bytes32,address)"), abi.encode());
        vm.mockCall(MOCK_ENS_REGISTRY, abi.encodeWithSignature("setResolver(bytes32,address)"), abi.encode());
        vm.mockCall(MOCK_ENS_RESOLVER, abi.encodeWithSignature("setAddr(bytes32,address)"), abi.encode());

        vm.prank(gardenerAccount);
        uint256 gasStart = gasleft();
        registrar.register(name, gardenerAccount, credentialId);
        uint256 gasUsed = gasStart - gasleft();

        emit log_named_uint("Gas: Register subdomain", gasUsed);
        // Should be significantly less than if we called through Gardener contract
        // Expected: ~150k gas (vs ~200k+ if routed through account)
        assertTrue(gasUsed < 200_000, "Registration should be gas efficient");
    }
}
