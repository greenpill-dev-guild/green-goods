// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";

import {
    GardenerRegistry,
    NameNotAvailable,
    InvalidName,
    UnauthorizedCaller,
    ENSNotConfigured,
    InvalidCredentialId
} from "../../src/registries/Gardener.sol";

/// @notice Minimal mock for ENS Registry
contract MockENSRegistry {
    mapping(bytes32 => mapping(bytes32 => address)) public subnodeOwners;
    mapping(bytes32 => address) public resolvers;

    function setSubnodeOwner(bytes32 node, bytes32 label, address ownerAddr) external returns (bytes32) {
        bytes32 subnode = keccak256(abi.encodePacked(node, label));
        subnodeOwners[node][label] = ownerAddr;
        return subnode;
    }

    function setResolver(bytes32 node, address resolver) external {
        resolvers[node] = resolver;
    }
}

/// @notice Minimal mock for ENS Resolver
contract MockENSResolver {
    mapping(bytes32 => address) public addresses;

    function setAddr(bytes32 node, address addr) external {
        addresses[node] = addr;
    }

    function addr(bytes32 node) external view returns (address payable) {
        return payable(addresses[node]);
    }
}

/// @title GardenerRegistryTest
/// @notice Unit tests for GardenerRegistry — ENS subdomain + passkey recovery
contract GardenerRegistryTest is Test {
    GardenerRegistry internal registry;
    MockENSRegistry internal ensRegistry;
    MockENSResolver internal ensResolver;

    bytes32 internal constant BASE_NODE = keccak256("greengoods.eth");
    bytes32 internal constant CREDENTIAL_1 = bytes32(uint256(0xCAFE));
    bytes32 internal constant CREDENTIAL_2 = bytes32(uint256(0xBEEF));

    address internal constant OWNER = address(0xA1);
    address internal constant GARDENER_1 = address(0xA2);
    address internal constant GARDENER_2 = address(0xA3);
    address internal constant STRANGER = address(0xA4);

    event SubdomainRegistered(string indexed name, address indexed owner, bytes32 indexed credentialId, uint256 timestamp);

    function setUp() public {
        ensRegistry = new MockENSRegistry();
        ensResolver = new MockENSResolver();
        registry = new GardenerRegistry(address(ensRegistry), address(ensResolver), BASE_NODE, OWNER);
    }

    // =========================================================================
    // Constructor Tests
    // =========================================================================

    function test_constructor_setsImmutables() public {
        assertEq(registry.ENS_REGISTRY(), address(ensRegistry));
        assertEq(registry.ENS_RESOLVER(), address(ensResolver));
        assertEq(registry.BASE_NODE(), BASE_NODE);
        assertEq(registry.owner(), OWNER);
    }

    function test_constructor_revertsForZeroRegistry() public {
        vm.expectRevert(ENSNotConfigured.selector);
        new GardenerRegistry(address(0), address(ensResolver), BASE_NODE, OWNER);
    }

    function test_constructor_revertsForZeroResolver() public {
        vm.expectRevert(ENSNotConfigured.selector);
        new GardenerRegistry(address(ensRegistry), address(0), BASE_NODE, OWNER);
    }

    function test_constructor_revertsForZeroBaseNode() public {
        vm.expectRevert(ENSNotConfigured.selector);
        new GardenerRegistry(address(ensRegistry), address(ensResolver), bytes32(0), OWNER);
    }

    // =========================================================================
    // Registration Tests
    // =========================================================================

    function test_register_succeeds() public {
        vm.prank(GARDENER_1);
        registry.register("alice", GARDENER_1, CREDENTIAL_1);

        assertEq(registry.ownerOf("alice"), GARDENER_1);
        assertEq(registry.resolve("alice"), GARDENER_1);
    }

    function test_register_storesProfile() public {
        vm.prank(GARDENER_1);
        registry.register("alice", GARDENER_1, CREDENTIAL_1);

        (address profileOwner, bytes32 credId, uint256 claimedAt) = registry.getRecoveryData("alice");
        assertEq(profileOwner, GARDENER_1);
        assertEq(credId, CREDENTIAL_1);
        assertEq(claimedAt, block.timestamp);
    }

    function test_register_setsSubdomainMapping() public {
        vm.prank(GARDENER_1);
        registry.register("alice", GARDENER_1, CREDENTIAL_1);

        assertEq(registry.subdomains("alice"), GARDENER_1);
    }

    function test_register_setsAccountToName() public {
        vm.prank(GARDENER_1);
        registry.register("alice", GARDENER_1, CREDENTIAL_1);

        assertEq(registry.accountToName(GARDENER_1), "alice");
    }

    function test_register_callsENS() public {
        vm.prank(GARDENER_1);
        registry.register("alice", GARDENER_1, CREDENTIAL_1);

        bytes32 label = keccak256(bytes("alice"));
        bytes32 node = keccak256(abi.encodePacked(BASE_NODE, label));

        // Verify ENS resolver was set
        assertEq(ensResolver.addr(node), GARDENER_1, "ENS resolver should point to gardener");
    }

    function test_register_emitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit SubdomainRegistered("alice", GARDENER_1, CREDENTIAL_1, block.timestamp);

        vm.prank(GARDENER_1);
        registry.register("alice", GARDENER_1, CREDENTIAL_1);
    }

    // =========================================================================
    // Registration Validation Tests
    // =========================================================================

    function test_register_revertsForUnauthorizedCaller() public {
        vm.prank(STRANGER);
        vm.expectRevert(UnauthorizedCaller.selector);
        registry.register("alice", GARDENER_1, CREDENTIAL_1);
    }

    function test_register_revertsForDuplicateName() public {
        vm.prank(GARDENER_1);
        registry.register("alice", GARDENER_1, CREDENTIAL_1);

        vm.prank(GARDENER_2);
        vm.expectRevert(NameNotAvailable.selector);
        registry.register("alice", GARDENER_2, CREDENTIAL_2);
    }

    function test_register_revertsForZeroCredentialId() public {
        vm.prank(GARDENER_1);
        vm.expectRevert(InvalidCredentialId.selector);
        registry.register("alice", GARDENER_1, bytes32(0));
    }

    function test_register_revertsForEmptyName() public {
        vm.prank(GARDENER_1);
        vm.expectRevert(InvalidName.selector);
        registry.register("", GARDENER_1, CREDENTIAL_1);
    }

    function test_register_revertsForNameTooLong() public {
        // 51 characters exceeds the 50-char limit
        string memory longName = "abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmno";
        assertEq(bytes(longName).length, 51);

        vm.prank(GARDENER_1);
        vm.expectRevert(InvalidName.selector);
        registry.register(longName, GARDENER_1, CREDENTIAL_1);
    }

    function test_register_succeedsForMaxLengthName() public {
        // Exactly 50 characters should succeed
        string memory maxName = "abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmn";
        assertEq(bytes(maxName).length, 50);

        vm.prank(GARDENER_1);
        registry.register(maxName, GARDENER_1, CREDENTIAL_1);
        assertEq(registry.ownerOf(maxName), GARDENER_1);
    }

    function test_register_succeedsForSingleCharName() public {
        vm.prank(GARDENER_1);
        registry.register("a", GARDENER_1, CREDENTIAL_1);
        assertEq(registry.ownerOf("a"), GARDENER_1);
    }

    // =========================================================================
    // View Function Tests
    // =========================================================================

    function test_available_returnsTrueForUnregistered() public {
        assertTrue(registry.available("bob"));
    }

    function test_available_returnsFalseForRegistered() public {
        vm.prank(GARDENER_1);
        registry.register("alice", GARDENER_1, CREDENTIAL_1);

        assertFalse(registry.available("alice"));
    }

    function test_ownerOf_returnsZeroForUnregistered() public {
        assertEq(registry.ownerOf("nonexistent"), address(0));
    }

    function test_resolve_returnsZeroForUnregistered() public {
        assertEq(registry.resolve("nonexistent"), address(0));
    }

    function test_getRecoveryData_returnsDefaultsForUnregistered() public {
        (address ownerAddr, bytes32 credId, uint256 claimedAt) = registry.getRecoveryData("nonexistent");
        assertEq(ownerAddr, address(0));
        assertEq(credId, bytes32(0));
        assertEq(claimedAt, 0);
    }

    // =========================================================================
    // Multi-Registration Tests
    // =========================================================================

    function test_register_multipleGardeners() public {
        vm.prank(GARDENER_1);
        registry.register("alice", GARDENER_1, CREDENTIAL_1);

        vm.prank(GARDENER_2);
        registry.register("bob", GARDENER_2, CREDENTIAL_2);

        assertEq(registry.ownerOf("alice"), GARDENER_1);
        assertEq(registry.ownerOf("bob"), GARDENER_2);
        assertEq(registry.accountToName(GARDENER_1), "alice");
        assertEq(registry.accountToName(GARDENER_2), "bob");
    }
}
