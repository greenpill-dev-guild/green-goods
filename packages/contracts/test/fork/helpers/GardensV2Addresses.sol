// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title GardensV2Addresses
/// @notice Deployed addresses for Gardens V2 contracts across supported chains.
/// @dev Only Sepolia (11155111), Arbitrum (42161), and Celo (42220) are supported.
///      Source: https://github.com/1Hive/gardens-v2 deployment artifacts.
library GardensV2Addresses {
    // ═══════════════════════════════════════════════════════════════════════════
    // Shared (Same on All Chains)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Allo V2 proxy (same address across all chains)
    address internal constant ALLO_PROXY = 0x1133eA7Af70876e64665ecD07C0A0476d09465a1;

    /// @notice Allo V2 registry (same address across all chains)
    address internal constant ALLO_REGISTRY = 0x4AAcca72145e1dF2aeC137E1f3C5E3D75DB8b5f3;

    // ═══════════════════════════════════════════════════════════════════════════
    // Sepolia (11155111)
    // ═══════════════════════════════════════════════════════════════════════════

    address internal constant SEPOLIA_REGISTRY_FACTORY = 0x4177f64568e90fd58884579864923aa0345248F0;
    address internal constant SEPOLIA_CV_STRATEGY_IMPL = 0xdc627C4B80ca90e43Cdb217587A206bE52E7e9AC;
    address internal constant SEPOLIA_REGISTRY_COMMUNITY_IMPL = 0xCcbAc15Eb0D8C241D4b6A74E650dE089c292D131;

    // ═══════════════════════════════════════════════════════════════════════════
    // Arbitrum (42161)
    // ═══════════════════════════════════════════════════════════════════════════

    address internal constant ARBITRUM_REGISTRY_FACTORY = 0xc1c2E092b7DbC8413E1aC02e92C161b0BDA783f6;
    address internal constant ARBITRUM_CV_STRATEGY_IMPL = 0xee99DBf0BFFfc9C811d109a3e4a1eED857463127;
    address internal constant ARBITRUM_REGISTRY_COMMUNITY_IMPL = 0xc895e3075EBB4B0899979da5D51E112f858605B3;

    // ═══════════════════════════════════════════════════════════════════════════
    // Celo (42220)
    // ═══════════════════════════════════════════════════════════════════════════

    address internal constant CELO_REGISTRY_FACTORY = 0xA71023bc64c9711C2037ab491DE80fd74504bd55;
    address internal constant CELO_CV_STRATEGY_IMPL = 0xAAad85FA09360364a265D583D43fA87e8CAd0A0B;
    address internal constant CELO_REGISTRY_COMMUNITY_IMPL = 0x6e18eB1E1EFa858fc2314C6F1B19c18Bb8dDF5a3;

    // ═══════════════════════════════════════════════════════════════════════════
    // Lookup Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Get the RegistryFactory address for a given chain ID
    /// @param chainId The chain ID to look up
    /// @return factory The RegistryFactory address, or address(0) if unsupported
    function getRegistryFactory(uint256 chainId) internal pure returns (address factory) {
        if (chainId == 11_155_111) return SEPOLIA_REGISTRY_FACTORY;
        if (chainId == 42_161) return ARBITRUM_REGISTRY_FACTORY;
        if (chainId == 42_220) return CELO_REGISTRY_FACTORY;
        return address(0);
    }

    /// @notice Get the CVStrategy implementation address for a given chain ID
    /// @param chainId The chain ID to look up
    /// @return impl The CVStrategy implementation address, or address(0) if unsupported
    function getCVStrategyImpl(uint256 chainId) internal pure returns (address impl) {
        if (chainId == 11_155_111) return SEPOLIA_CV_STRATEGY_IMPL;
        if (chainId == 42_161) return ARBITRUM_CV_STRATEGY_IMPL;
        if (chainId == 42_220) return CELO_CV_STRATEGY_IMPL;
        return address(0);
    }

    /// @notice Get the RegistryCommunity implementation address for a given chain ID
    /// @param chainId The chain ID to look up
    /// @return impl The RegistryCommunity implementation address, or address(0) if unsupported
    function getRegistryCommunityImpl(uint256 chainId) internal pure returns (address impl) {
        if (chainId == 11_155_111) return SEPOLIA_REGISTRY_COMMUNITY_IMPL;
        if (chainId == 42_161) return ARBITRUM_REGISTRY_COMMUNITY_IMPL;
        if (chainId == 42_220) return CELO_REGISTRY_COMMUNITY_IMPL;
        return address(0);
    }
}
