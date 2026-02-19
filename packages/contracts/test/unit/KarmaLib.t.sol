// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { KarmaLib, KarmaGAPNotSupported } from "../../src/lib/Karma.sol";

/// @title KarmaLibWrapper
/// @notice Wrapper contract to expose KarmaLib internal functions for testing
contract KarmaLibWrapper {
    function getProjectResolver() external view returns (address) {
        return KarmaLib.getProjectResolver();
    }

    function getGapContract() external view returns (address) {
        return KarmaLib.getGapContract();
    }

    function getProjectSchemaUID() external view returns (bytes32) {
        return KarmaLib.getProjectSchemaUID();
    }

    function getDetailsSchemaUID() external view returns (bytes32) {
        return KarmaLib.getDetailsSchemaUID();
    }

    function getMemberOfSchemaUID() external view returns (bytes32) {
        return KarmaLib.getMemberOfSchemaUID();
    }

    function isSupported() external view returns (bool) {
        return KarmaLib.isSupported();
    }
}

/// @title KarmaLibTest
/// @notice Unit tests for KarmaLib chain constant lookups
/// @dev Verifies correct addresses and schema UIDs across 7 supported networks
contract KarmaLibTest is Test {
    KarmaLibWrapper private wrapper;

    // All 7 supported chain IDs
    uint256 constant OPTIMISM = 10;
    uint256 constant OPTIMISM_SEPOLIA = 11_155_420;
    uint256 constant ARBITRUM = 42_161;
    uint256 constant SEPOLIA = 11_155_111;
    uint256 constant CELO = 42_220;
    uint256 constant SEI = 1329;
    uint256 constant SEI_TESTNET = 1328;

    function setUp() public {
        wrapper = new KarmaLibWrapper();
    }

    // =========================================================================
    // isSupported Tests
    // =========================================================================

    function testIsSupportedForGAPNetworks() public {
        // isSupported() gates on chains with full GAP contracts (3 networks only)
        uint256[3] memory supportedChains = [ARBITRUM, SEPOLIA, CELO];

        for (uint256 i = 0; i < supportedChains.length; i++) {
            vm.chainId(supportedChains[i]);
            assertTrue(wrapper.isSupported(), string.concat("Chain should be supported: ", vm.toString(supportedChains[i])));
        }
    }

    function testIsNotSupportedForResolverOnlyChains() public {
        // These chains have resolvers/schemas but no GAP contracts
        uint256[4] memory resolverOnlyChains = [OPTIMISM, OPTIMISM_SEPOLIA, SEI, SEI_TESTNET];

        for (uint256 i = 0; i < resolverOnlyChains.length; i++) {
            vm.chainId(resolverOnlyChains[i]);
            assertFalse(
                wrapper.isSupported(),
                string.concat("Resolver-only chain should NOT be supported: ", vm.toString(resolverOnlyChains[i]))
            );
        }
    }

    function testIsNotSupportedForLocalhost() public {
        vm.chainId(31_337);
        assertFalse(wrapper.isSupported(), "Localhost should NOT be supported");
    }

    function testIsNotSupportedForMainnet() public {
        vm.chainId(1);
        assertFalse(wrapper.isSupported(), "Ethereum mainnet should NOT be supported");
    }

    // =========================================================================
    // Project Resolver Address Tests
    // =========================================================================

    function testProjectResolverArbitrum() public {
        vm.chainId(ARBITRUM);
        assertEq(wrapper.getProjectResolver(), 0x28BE0b0515be8BB8822aF1467A6613795E74717b);
    }

    function testProjectResolverCelo() public {
        vm.chainId(CELO);
        assertEq(wrapper.getProjectResolver(), 0x6dC1D6b864e8BEf815806f9e4677123496e12026);
    }

    function testProjectResolverRevertsForUnsupported() public {
        vm.chainId(31_337);
        vm.expectRevert(KarmaGAPNotSupported.selector);
        wrapper.getProjectResolver();
    }

    // =========================================================================
    // GAP Contract Address Tests
    // =========================================================================

    function testGapContractArbitrum() public {
        vm.chainId(ARBITRUM);
        assertEq(wrapper.getGapContract(), 0x6dC1D6b864e8BEf815806f9e4677123496e12026);
    }

    function testGapContractCelo() public {
        vm.chainId(CELO);
        assertEq(wrapper.getGapContract(), 0x8791Ac8c099314bB1D1514D76de13a1E80275950);
    }

    function testGapContractRevertsForOptimism() public {
        // Optimism has project resolver but not GAP contract in this lib
        vm.chainId(OPTIMISM);
        vm.expectRevert(KarmaGAPNotSupported.selector);
        wrapper.getGapContract();
    }

    // =========================================================================
    // Schema UID Tests
    // =========================================================================

    function testProjectSchemaUIDArbitrum() public {
        vm.chainId(ARBITRUM);
        assertEq(wrapper.getProjectSchemaUID(), 0xac2a06e955a7e25e6729efe1a6532237e3435b21ccd3dc827ae3c94e624d25b3);
    }

    function testProjectSchemaUIDCelo() public {
        vm.chainId(CELO);
        assertEq(wrapper.getProjectSchemaUID(), 0xf3f753b41e04d1052b5a5ec7624d1dfdb6c2da288a985120e477ddbcac071022);
    }

    function testDetailsSchemaUIDArbitrum() public {
        vm.chainId(ARBITRUM);
        assertEq(wrapper.getDetailsSchemaUID(), 0x16bfe4783b7a9c743c401222c56a07ecb77ed42afc84b61ff1f62f5936c0b9d7);
    }

    function testMemberOfSchemaUIDArbitrum() public {
        vm.chainId(ARBITRUM);
        assertEq(wrapper.getMemberOfSchemaUID(), 0x5f430aec9d04f0dcb3729775c5dfe10752e436469a7607f8c64ae44ef996e477);
    }

    function testSchemaUIDsRevertsForUnsupported() public {
        vm.chainId(31_337);
        vm.expectRevert(KarmaGAPNotSupported.selector);
        wrapper.getProjectSchemaUID();
    }

    // =========================================================================
    // Cross-Chain Consistency
    // =========================================================================

    function testDifferentChainsReturnDifferentSchemaUIDs() public {
        vm.chainId(ARBITRUM);
        bytes32 arbProject = wrapper.getProjectSchemaUID();

        vm.chainId(CELO);
        bytes32 celoProject = wrapper.getProjectSchemaUID();

        vm.chainId(SEPOLIA);
        bytes32 sepProject = wrapper.getProjectSchemaUID();

        assertTrue(arbProject != celoProject, "Arbitrum and Celo should have different project schema UIDs");
        assertTrue(arbProject != sepProject, "Arbitrum and Sepolia should have different project schema UIDs");
    }

    function testAllSchemaUIDsNonZeroOnSupportedChains() public {
        uint256[7] memory chains = [OPTIMISM, OPTIMISM_SEPOLIA, ARBITRUM, SEPOLIA, CELO, SEI, SEI_TESTNET];

        for (uint256 i = 0; i < chains.length; i++) {
            vm.chainId(chains[i]);
            assertTrue(wrapper.getProjectSchemaUID() != bytes32(0), "Project schema UID should be non-zero");
            assertTrue(wrapper.getDetailsSchemaUID() != bytes32(0), "Details schema UID should be non-zero");
            assertTrue(wrapper.getMemberOfSchemaUID() != bytes32(0), "MemberOf schema UID should be non-zero");
        }
    }
}
