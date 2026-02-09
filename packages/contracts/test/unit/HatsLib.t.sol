// SPDX-License-Identifier: MIT
pragma solidity >=0.8.25;

import { Test } from "forge-std/Test.sol";
import { HatsLib, HatsProtocolNotSupported } from "../../src/lib/Hats.sol";

/// @title HatsLibWrapper
/// @notice Wrapper contract to expose HatsLib internal functions for testing
contract HatsLibWrapper {
    function getHatsProtocol() external pure returns (address) {
        return HatsLib.getHatsProtocol();
    }

    function getGardensHatId() external view returns (uint256) {
        return HatsLib.getGardensHatId();
    }

    function getCommunityHatId() external view returns (uint256) {
        return HatsLib.getCommunityHatId();
    }

    function getProtocolGardenersHatId() external view returns (uint256) {
        return HatsLib.getProtocolGardenersHatId();
    }

    function getAllowlistEligibilityModule() external view returns (address) {
        return HatsLib.getAllowlistEligibilityModule();
    }

    function getERC20EligibilityModule() external view returns (address) {
        return HatsLib.getERC20EligibilityModule();
    }

    function isSupported() external view returns (bool) {
        return HatsLib.isSupported();
    }
}

/// @title HatsLibTest
/// @notice Unit tests for HatsLib chain constant lookups
/// @dev Uses vm.chainId() to simulate different chains and verify correct constants
contract HatsLibTest is Test {
    HatsLibWrapper private wrapper;

    function setUp() public {
        wrapper = new HatsLibWrapper();
    }

    // =========================================================================
    // Universal Constants
    // =========================================================================

    function testHatsProtocolAddress() public {
        assertEq(
            wrapper.getHatsProtocol(),
            0x3bc1A0Ad72417f2d411118085256fC53CBdDd137,
            "Hats Protocol address should be universal CREATE2 address"
        );
    }

    // =========================================================================
    // isSupported Tests
    // =========================================================================

    function testIsSupportedArbitrum() public {
        vm.chainId(42_161);
        assertTrue(wrapper.isSupported(), "Arbitrum should be supported");
    }

    function testIsSupportedSepolia() public {
        vm.chainId(11_155_111);
        assertTrue(wrapper.isSupported(), "Sepolia should be supported");
    }

    function testIsSupportedBaseSepolia() public {
        vm.chainId(84_532);
        assertTrue(wrapper.isSupported(), "Base Sepolia should be supported");
    }

    function testIsSupportedCelo() public {
        vm.chainId(42_220);
        assertTrue(wrapper.isSupported(), "Celo should be supported");
    }

    function testIsNotSupportedLocalhost() public {
        vm.chainId(31_337);
        assertFalse(wrapper.isSupported(), "Localhost should NOT be supported");
    }

    function testIsNotSupportedMainnet() public {
        vm.chainId(1);
        assertFalse(wrapper.isSupported(), "Ethereum mainnet should NOT be supported");
    }

    function testIsNotSupportedOptimism() public {
        vm.chainId(10);
        assertFalse(wrapper.isSupported(), "Optimism should NOT be supported for Hats");
    }

    // =========================================================================
    // Arbitrum Chain Constants
    // =========================================================================

    function testArbitrumGardensHat() public {
        vm.chainId(42_161);
        uint256 hatId = wrapper.getGardensHatId();
        assertEq(hatId, 0x0000005c00020001000000000000000000000000000000000000000000000000);
    }

    function testArbitrumCommunityHat() public {
        vm.chainId(42_161);
        uint256 hatId = wrapper.getCommunityHatId();
        assertEq(hatId, 0x0000005c00020000000000000000000000000000000000000000000000000000);
    }

    function testArbitrumProtocolGardenersHat() public {
        vm.chainId(42_161);
        uint256 hatId = wrapper.getProtocolGardenersHatId();
        assertEq(hatId, 0x0000005c00020002000000000000000000000000000000000000000000000000);
    }

    // =========================================================================
    // Sepolia Chain Constants
    // =========================================================================

    function testSepoliaGardensHat() public {
        vm.chainId(11_155_111);
        uint256 hatId = wrapper.getGardensHatId();
        assertEq(hatId, 0x000007e600020001000000000000000000000000000000000000000000000000);
    }

    function testSepoliaCommunityHat() public {
        vm.chainId(11_155_111);
        uint256 hatId = wrapper.getCommunityHatId();
        assertEq(hatId, 0x000007e600020000000000000000000000000000000000000000000000000000);
    }

    // =========================================================================
    // Celo Chain Constants
    // =========================================================================

    function testCeloGardensHat() public {
        vm.chainId(42_220);
        uint256 hatId = wrapper.getGardensHatId();
        assertEq(hatId, 0x0000001f00020001000000000000000000000000000000000000000000000000);
    }

    function testCeloCommunityHat() public {
        vm.chainId(42_220);
        uint256 hatId = wrapper.getCommunityHatId();
        assertEq(hatId, 0x0000001f00020000000000000000000000000000000000000000000000000000);
    }

    // =========================================================================
    // Base Sepolia Constants (Placeholders = 0)
    // =========================================================================

    function testBaseSepoliaGardensHatIsZero() public {
        vm.chainId(84_532);
        uint256 hatId = wrapper.getGardensHatId();
        assertEq(hatId, 0, "Base Sepolia gardens hat should be zero (placeholder)");
    }

    function testBaseSepolicaCommunityHatIsZero() public {
        vm.chainId(84_532);
        uint256 hatId = wrapper.getCommunityHatId();
        assertEq(hatId, 0, "Base Sepolia community hat should be zero (placeholder)");
    }

    // =========================================================================
    // Unsupported Chain Reverts
    // =========================================================================

    function testRevertsOnUnsupportedChainForGardensHat() public {
        vm.chainId(31_337);
        vm.expectRevert(HatsProtocolNotSupported.selector);
        wrapper.getGardensHatId();
    }

    function testRevertsOnUnsupportedChainForCommunityHat() public {
        vm.chainId(31_337);
        vm.expectRevert(HatsProtocolNotSupported.selector);
        wrapper.getCommunityHatId();
    }

    function testRevertsOnUnsupportedChainForProtocolGardenersHat() public {
        vm.chainId(31_337);
        vm.expectRevert(HatsProtocolNotSupported.selector);
        wrapper.getProtocolGardenersHatId();
    }

    // =========================================================================
    // Eligibility Module Tests (All currently address(0) placeholders)
    // =========================================================================

    function testAllowlistEligibilityModulesAreZero() public {
        uint256[4] memory chains = [uint256(42_161), uint256(11_155_111), uint256(84_532), uint256(42_220)];
        for (uint256 i = 0; i < chains.length; i++) {
            vm.chainId(chains[i]);
            assertEq(
                wrapper.getAllowlistEligibilityModule(), address(0), "Allowlist eligibility should be zero (placeholder)"
            );
        }
    }

    function testERC20EligibilityModulesAreZero() public {
        uint256[4] memory chains = [uint256(42_161), uint256(11_155_111), uint256(84_532), uint256(42_220)];
        for (uint256 i = 0; i < chains.length; i++) {
            vm.chainId(chains[i]);
            assertEq(wrapper.getERC20EligibilityModule(), address(0), "ERC20 eligibility should be zero (placeholder)");
        }
    }

    function testEligibilityModulesReturnZeroForUnsupportedChain() public {
        vm.chainId(31_337);
        assertEq(wrapper.getAllowlistEligibilityModule(), address(0));
        assertEq(wrapper.getERC20EligibilityModule(), address(0));
    }

    // =========================================================================
    // Cross-Chain Consistency
    // =========================================================================

    function testDifferentChainsReturnDifferentHats() public {
        vm.chainId(42_161);
        uint256 arbGardens = wrapper.getGardensHatId();

        vm.chainId(11_155_111);
        uint256 sepGardens = wrapper.getGardensHatId();

        vm.chainId(42_220);
        uint256 celoGardens = wrapper.getGardensHatId();

        assertTrue(arbGardens != sepGardens, "Arbitrum and Sepolia should have different hat IDs");
        assertTrue(arbGardens != celoGardens, "Arbitrum and Celo should have different hat IDs");
        assertTrue(sepGardens != celoGardens, "Sepolia and Celo should have different hat IDs");
    }

    function testNonZeroHatIdsOnProductionChains() public {
        uint256[3] memory productionChains = [uint256(42_161), uint256(11_155_111), uint256(42_220)];
        for (uint256 i = 0; i < productionChains.length; i++) {
            vm.chainId(productionChains[i]);
            assertTrue(wrapper.getGardensHatId() != 0, "Production chain should have non-zero gardens hat");
            assertTrue(wrapper.getCommunityHatId() != 0, "Production chain should have non-zero community hat");
            assertTrue(wrapper.getProtocolGardenersHatId() != 0, "Production chain should have non-zero gardeners hat");
        }
    }
}
