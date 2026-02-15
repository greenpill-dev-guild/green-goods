// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { TBALib, SALT, TOKENBOUND_REGISTRY, InvalidChainId } from "../../src/lib/TBA.sol";
import { ERC6551Helper } from "../helpers/ERC6551Helper.sol";

/// @title TBALibTest
/// @notice Unit tests for TBALib account creation and retrieval
/// @dev Deploys ERC6551Registry at canonical address for testing
contract TBALibTest is Test, ERC6551Helper {
    address private implementation = address(0xBEEF);
    address private tokenContract = address(0xCAFE);

    function setUp() public {
        // Deploy ERC6551 Registry at canonical Tokenbound address
        _deployERC6551Registry();
    }

    // =========================================================================
    // Constants
    // =========================================================================

    function testTokenboundRegistryAddress() public {
        assertEq(TOKENBOUND_REGISTRY, 0x000000006551c19487814612e58FE06813775758);
    }

    function testSaltIsNonZero() public {
        assertTrue(SALT != bytes32(0), "Salt should be non-zero");
    }

    // =========================================================================
    // Supported Chains
    // =========================================================================

    function testCreateAccountOnArbitrum() public {
        vm.chainId(42_161);
        address account = TBALib.createAccount(implementation, tokenContract, 1);
        assertTrue(account != address(0), "Account should be created on Arbitrum");
    }

    function testCreateAccountOnSepolia() public {
        vm.chainId(11_155_111);
        address account = TBALib.createAccount(implementation, tokenContract, 1);
        assertTrue(account != address(0), "Account should be created on Sepolia");
    }

    function testCreateAccountOnBaseSepolia() public {
        vm.chainId(84_532);
        address account = TBALib.createAccount(implementation, tokenContract, 1);
        assertTrue(account != address(0), "Account should be created on Base Sepolia");
    }

    function testCreateAccountOnBaseMainnet() public {
        vm.chainId(8453);
        address account = TBALib.createAccount(implementation, tokenContract, 1);
        assertTrue(account != address(0), "Account should be created on Base mainnet");
    }

    function testCreateAccountOnOptimism() public {
        vm.chainId(10);
        address account = TBALib.createAccount(implementation, tokenContract, 1);
        assertTrue(account != address(0), "Account should be created on Optimism");
    }

    function testCreateAccountOnCelo() public {
        vm.chainId(42_220);
        address account = TBALib.createAccount(implementation, tokenContract, 1);
        assertTrue(account != address(0), "Account should be created on Celo");
    }

    function testCreateAccountOnLocalhost() public {
        vm.chainId(31_337);
        address account = TBALib.createAccount(implementation, tokenContract, 1);
        assertTrue(account != address(0), "Account should be created on localhost");
    }

    // =========================================================================
    // Unsupported Chain
    // =========================================================================

    function testCreateAccountRevertsOnUnsupportedChain() public {
        vm.chainId(999_999);
        vm.expectRevert(InvalidChainId.selector);
        TBALib.createAccount(implementation, tokenContract, 1);
    }

    function testGetAccountRevertsOnUnsupportedChain() public {
        vm.chainId(999_999);
        vm.expectRevert(InvalidChainId.selector);
        TBALib.getAccount(implementation, tokenContract, 1);
    }

    // =========================================================================
    // Deterministic Address Tests
    // =========================================================================

    function testGetAccountMatchesCreateAccount() public {
        vm.chainId(42_161);

        // Get predicted address
        address predicted = TBALib.getAccount(implementation, tokenContract, 1);

        // Create actual account
        address created = TBALib.createAccount(implementation, tokenContract, 1);

        assertEq(predicted, created, "getAccount should predict createAccount address");
    }

    function testDifferentTokenIdsProduceDifferentAddresses() public {
        vm.chainId(42_161);

        address account1 = TBALib.createAccount(implementation, tokenContract, 1);
        address account2 = TBALib.createAccount(implementation, tokenContract, 2);

        assertTrue(account1 != account2, "Different token IDs should produce different addresses");
    }

    function testDifferentImplementationsProduceDifferentAddresses() public {
        vm.chainId(42_161);

        address account1 = TBALib.createAccount(address(0xBEEF), tokenContract, 1);
        address account2 = TBALib.createAccount(address(0xDEAD), tokenContract, 1);

        assertTrue(account1 != account2, "Different implementations should produce different addresses");
    }

    function testDifferentTokenContractsProduceDifferentAddresses() public {
        vm.chainId(42_161);

        address account1 = TBALib.createAccount(implementation, address(0xCAFE), 1);
        address account2 = TBALib.createAccount(implementation, address(0xFACE), 1);

        assertTrue(account1 != account2, "Different token contracts should produce different addresses");
    }

    function testSameInputsProduceSameAddress() public {
        vm.chainId(42_161);

        address account1 = TBALib.getAccount(implementation, tokenContract, 42);
        address account2 = TBALib.getAccount(implementation, tokenContract, 42);

        assertEq(account1, account2, "Same inputs should always produce same address");
    }
}
