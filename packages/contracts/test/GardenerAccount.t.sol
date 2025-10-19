// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import { IEntryPoint } from "account-abstraction/interfaces/IEntryPoint.sol";
import { Gardener } from "../src/accounts/Gardener.sol";
import { ENSRegistrar } from "../src/registries/ENSRegistrar.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title GardenerTest
/// @notice Comprehensive tests for Gardener ENS identity management
contract GardenerTest is Test {
    Gardener private account;
    Gardener private l2Account; // Account on L2 without ENS
    IEntryPoint private entryPoint;
    ENSRegistrar private ensRegistrar;
    address private owner = address(0x100);
    address private unauthorized = address(0x999);
    
    // Mock ENS addresses (for testing)
    address private constant MOCK_ENS_REGISTRY = address(0x1);
    address private constant MOCK_ENS_RESOLVER = address(0x2);
    // Precomputed: keccak256(abi.encodePacked(namehash("eth"), keccak256("greengoods")))
    bytes32 private constant GREENGOODS_BASE_NODE = 0x0b35b2d5b2f667f75a0da49b3b77e5ffb07f5e5c0e1c6f8e3a0f1e7b2d4c9a6b;

    function setUp() public {
        // Deploy mock EntryPoint
        entryPoint = IEntryPoint(address(0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789));
        
        // Deploy ENSRegistrar (non-upgradeable)
        ensRegistrar = new ENSRegistrar(MOCK_ENS_REGISTRY, MOCK_ENS_RESOLVER, GREENGOODS_BASE_NODE, owner);
        
        // Deploy Gardener implementation contracts
        Gardener accountImpl = new Gardener(entryPoint, address(ensRegistrar));
        Gardener l2AccountImpl = new Gardener(entryPoint, address(0));
        
        // Deploy proxies and initialize
        // Use function signature instead of selector since initialize() is inherited from Kernel
        bytes memory initData = abi.encodeWithSignature("initialize(address)", owner);
        
        ERC1967Proxy accountProxy = new ERC1967Proxy(address(accountImpl), initData);
        account = Gardener(payable(address(accountProxy)));
        
        ERC1967Proxy l2AccountProxy = new ERC1967Proxy(address(l2AccountImpl), initData);
        l2Account = Gardener(payable(address(l2AccountProxy)));
        
        // Initialize Gardener-specific logic (prank as owner)
        vm.startPrank(owner);
        account.initializeGardener();
        l2Account.initializeGardener();
        vm.stopPrank();
    }

    // ============================================================================
    // INITIALIZATION TESTS
    // ============================================================================

    function testAccountDeployment() public {
        assertEq(account.owner(), owner, "Owner should be set correctly");
        assertEq(account.claimedAt(), 1, "claimedAt should be set to 1 after initialization");
    }

    function testL2AccountDeployment() public {
        assertEq(l2Account.owner(), owner, "L2 owner should be set correctly");
        assertEq(l2Account.ENS_REGISTRAR(), address(0), "L2 account should have no ENS registrar");
    }

    function testAccountDeployedEventEmitted() public {
        // Deploy implementation
        Gardener newAccountImpl = new Gardener(entryPoint, address(ensRegistrar));
        
        // Deploy proxy with initialization
        bytes memory initData = abi.encodeWithSignature("initialize(address)", owner);
        ERC1967Proxy newAccountProxy = new ERC1967Proxy(address(newAccountImpl), initData);
        Gardener newAccount = Gardener(payable(address(newAccountProxy)));
        
        vm.startPrank(owner);
        vm.expectEmit(true, true, true, true);
        emit Gardener.AccountDeployed(address(newAccount), owner, block.timestamp);

        newAccount.initializeGardener();
        vm.stopPrank();
    }

    function testCannotReinitialize() public {
        vm.expectRevert(Gardener.AlreadyInitialized.selector);
        account.initializeGardener();
    }

    // ============================================================================
    // ENS CLAIMING TESTS (Mainnet)
    // ============================================================================

    function testClaimENSName() public {
        string memory ensName = "alice";
        bytes32 credentialId = bytes32(uint256(12345));
        
        vm.prank(owner);
        vm.mockCall(
            address(ensRegistrar),
            abi.encodeWithSelector(ENSRegistrar.available.selector, ensName),
            abi.encode(true)
        );
        vm.mockCall(
            address(ensRegistrar),
            abi.encodeWithSelector(ENSRegistrar.register.selector, ensName, address(account)),
            abi.encode()
        );
        
        account.claimENSName(ensName, credentialId);
        
        assertEq(account.ensName(), "alice.greengoods.eth", "ENS name should be set");
        assertEq(account.passkeyCredentialId(), credentialId, "Credential ID should be set");
        assertTrue(account.claimedAt() > 1, "claimedAt should be updated");
    }

    function testCannotClaimTwice() public {
        string memory ensName = "alice";
        bytes32 credentialId = bytes32(uint256(12345));
        
        vm.startPrank(owner);
        vm.mockCall(
            address(ensRegistrar),
            abi.encodeWithSelector(ENSRegistrar.available.selector, ensName),
            abi.encode(true)
        );
        vm.mockCall(
            address(ensRegistrar),
            abi.encodeWithSelector(ENSRegistrar.register.selector, ensName, address(account)),
            abi.encode()
        );
        
        account.claimENSName(ensName, credentialId);
        
        vm.expectRevert(Gardener.AlreadyClaimed.selector);
        account.claimENSName("bob", bytes32(uint256(67890)));
        vm.stopPrank();
    }

    function testCannotClaimWithInvalidName() public {
        bytes32 credentialId = bytes32(uint256(12345));
        
        vm.startPrank(owner);
        
        // Empty name
        vm.expectRevert(Gardener.InvalidENSName.selector);
        account.claimENSName("", credentialId);
        
        // Too long name (> 50 chars - this is 51 characters)
        string memory longName = "thisnameiswaylongerthanfiftycharssoshouldrevert1234";
        vm.expectRevert(Gardener.InvalidENSName.selector);
        account.claimENSName(longName, credentialId);
        
        vm.stopPrank();
    }

    function testCannotClaimWithInvalidCredentialId() public {
        string memory ensName = "alice";
        
        vm.prank(owner);
        vm.expectRevert(Gardener.InvalidCredentialId.selector);
        account.claimENSName(ensName, bytes32(0));
    }

    function testOnlyOwnerCanClaimENS() public {
        string memory ensName = "alice";
        bytes32 credentialId = bytes32(uint256(12345));
        
        vm.prank(unauthorized);
        vm.expectRevert(Gardener.NotAuthorized.selector);
        account.claimENSName(ensName, credentialId);
    }

    // ============================================================================
    // L2 GRACEFUL DEGRADATION TESTS
    // ============================================================================

    function testCannotClaimENSOnL2() public {
        string memory ensName = "alice";
        bytes32 credentialId = bytes32(uint256(12345));
        
        vm.prank(owner);
        vm.expectRevert(Gardener.ENSNotSupportedOnChain.selector);
        l2Account.claimENSName(ensName, credentialId);
    }

    // ============================================================================
    // RECOVERY TESTS
    // ============================================================================

    function testVerifyCredentialId() public {
        string memory ensName = "alice";
        bytes32 credentialId = bytes32(uint256(12345));
        
        vm.prank(owner);
        vm.mockCall(
            address(ensRegistrar),
            abi.encodeWithSelector(ENSRegistrar.available.selector, ensName),
            abi.encode(true)
        );
        vm.mockCall(
            address(ensRegistrar),
            abi.encodeWithSelector(ENSRegistrar.register.selector, ensName, address(account)),
            abi.encode()
        );
        
        account.claimENSName(ensName, credentialId);
        
        assertTrue(account.verifyCredentialId(credentialId), "Should verify correct credential ID");
        assertFalse(account.verifyCredentialId(bytes32(uint256(99999))), "Should reject wrong credential ID");
    }

    function testGetRecoveryData() public {
        string memory ensName = "alice";
        bytes32 credentialId = bytes32(uint256(12345));
        
        vm.prank(owner);
        vm.mockCall(
            address(ensRegistrar),
            abi.encodeWithSelector(ENSRegistrar.available.selector, ensName),
            abi.encode(true)
        );
        vm.mockCall(
            address(ensRegistrar),
            abi.encodeWithSelector(ENSRegistrar.register.selector, ensName, address(account)),
            abi.encode()
        );
        
        account.claimENSName(ensName, credentialId);
        
        (string memory _ensName, bytes32 _credentialId, address _owner) = account.getRecoveryData();
        
        assertEq(_ensName, "alice.greengoods.eth", "Should return correct ENS name");
        assertEq(_credentialId, credentialId, "Should return correct credential ID");
        assertEq(_owner, owner, "Should return correct owner");
    }

    // ============================================================================
    // ERC-165 TESTS
    // ============================================================================

    function testSupportsERC165Interface() public {
        assertTrue(account.supportsInterface(type(IERC165).interfaceId), "Should support ERC-165");
    }
}
