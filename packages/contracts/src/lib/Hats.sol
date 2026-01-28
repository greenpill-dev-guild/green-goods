// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

error HatsProtocolNotSupported();

/// @title HatsLib
/// @notice Library for Hats Protocol integration across supported chains
/// @dev All Hats Protocol constants and helper functions centralized here
/// @dev Hats Protocol Docs: https://docs.hatsprotocol.xyz/
library HatsLib {
    // ============================================================================
    // HATS PROTOCOL CONTRACT (Same address on all chains)
    // ============================================================================

    /// @notice Hats Protocol v1 contract address (universal across all chains)
    /// @dev Deployed via CREATE2, same address on all networks
    address internal constant HATS_PROTOCOL = 0x3bc1A0Ad72417f2d411118085256fC53CBdDd137;

    // ============================================================================
    // GREEN GOODS HAT TREE - ARBITRUM (Tree 92)
    // ============================================================================

    /// @notice Green Goods Community Top Hat on Arbitrum (Tree 92)
    /// @dev Admin of Gardens Hat and Protocol Gardeners Hat
    uint256 internal constant ARBITRUM_COMMUNITY_HAT = 0x0000005c00020000000000000000000000000000000000000000000000000000;

    /// @notice Green Goods Gardens Hat on Arbitrum - parent for all per-garden hats
    /// @dev Under this hat, each garden gets its own root hat with role children
    uint256 internal constant ARBITRUM_GARDENS_HAT = 0x0000005c00020001000000000000000000000000000000000000000000000000;

    /// @notice Green Goods Protocol Gardeners Hat on Arbitrum
    /// @dev Protocol-wide gardener role (not garden-specific)
    uint256 internal constant ARBITRUM_PROTOCOL_GARDENERS_HAT =
        0x0000005c00020002000000000000000000000000000000000000000000000000;

    // ============================================================================
    // GREEN GOODS HAT TREE - BASE SEPOLIA (Testnet)
    // ============================================================================

    /// @notice Green Goods Community Top Hat on Base Sepolia
    /// @dev Placeholder - needs to be created for testnet
    uint256 internal constant BASE_SEPOLIA_COMMUNITY_HAT = 0;

    /// @notice Green Goods Gardens Hat on Base Sepolia
    /// @dev Placeholder - needs to be created for testnet
    uint256 internal constant BASE_SEPOLIA_GARDENS_HAT = 0;

    /// @notice Green Goods Protocol Gardeners Hat on Base Sepolia
    /// @dev Placeholder - needs to be created for testnet
    uint256 internal constant BASE_SEPOLIA_PROTOCOL_GARDENERS_HAT = 0;

    // ============================================================================
    // HELPER FUNCTIONS
    // ============================================================================

    /// @notice Returns Hats Protocol contract address (universal)
    /// @return Hats Protocol contract address
    function getHatsProtocol() internal pure returns (address) {
        return HATS_PROTOCOL;
    }

    /// @notice Returns Gardens Hat ID for current chain
    /// @dev This is the parent hat under which per-garden root hats are created
    /// @return Gardens Hat ID
    function getGardensHatId() internal view returns (uint256) {
        uint256 chainId = block.chainid;
        if (chainId == 42_161) return ARBITRUM_GARDENS_HAT;
        if (chainId == 84_532) return BASE_SEPOLIA_GARDENS_HAT;
        _revertUnsupported();
    }

    /// @notice Returns Community Hat ID for current chain
    /// @dev Top-level admin hat for the Green Goods hat tree
    /// @return Community Hat ID
    function getCommunityHatId() internal view returns (uint256) {
        uint256 chainId = block.chainid;
        if (chainId == 42_161) return ARBITRUM_COMMUNITY_HAT;
        if (chainId == 84_532) return BASE_SEPOLIA_COMMUNITY_HAT;
        _revertUnsupported();
    }

    /// @notice Returns Protocol Gardeners Hat ID for current chain
    /// @dev Protocol-wide gardener role (not per-garden)
    /// @return Protocol Gardeners Hat ID
    function getProtocolGardenersHatId() internal view returns (uint256) {
        uint256 chainId = block.chainid;
        if (chainId == 42_161) return ARBITRUM_PROTOCOL_GARDENERS_HAT;
        if (chainId == 84_532) return BASE_SEPOLIA_PROTOCOL_GARDENERS_HAT;
        _revertUnsupported();
    }

    /// @notice Internal helper to revert with HatsProtocolNotSupported error
    /// @dev Extracted to reduce cyclomatic complexity of chain lookup functions
    function _revertUnsupported() private pure {
        revert HatsProtocolNotSupported();
    }

    /// @notice Checks if Hats Protocol is supported on current chain
    /// @dev Currently Arbitrum mainnet and Base Sepolia (testnet)
    /// @return True if supported
    function isSupported() internal view returns (bool) {
        uint256 chainId = block.chainid;
        return chainId == 42_161 || chainId == 84_532;
    }
}
