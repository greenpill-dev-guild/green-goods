// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title ICookieJarFactory
/// @notice Minimal interface for the 1Hive CookieJarFactory (sibling repo)
/// @dev Only includes createCookieJar() and the struct types needed by CookieJarModule.
///      Full source: https://github.com/1Hive/cookie-jar
interface ICookieJarFactory {
    // ═══════════════════════════════════════════════════════════════════════════
    // Structs (mirrors CookieJarLib)
    // ═══════════════════════════════════════════════════════════════════════════

    enum AccessType {
        Allowlist,
        ERC721,
        ERC1155
    }

    enum WithdrawalTypeOptions {
        Fixed,
        Variable
    }

    struct MultiTokenConfig {
        bool enabled;
        uint256 maxSlippagePercent;
        uint256 minSwapAmount;
        uint24 defaultFee;
    }

    struct NftRequirement {
        address nftContract;
        uint256 tokenId;
        uint256 minBalance;
        bool isPoapEventGate;
    }

    struct JarConfig {
        address jarOwner;
        address supportedCurrency;
        address feeCollector;
        AccessType accessType;
        WithdrawalTypeOptions withdrawalOption;
        bool strictPurpose;
        bool emergencyWithdrawalEnabled;
        bool oneTimeWithdrawal;
        uint256 fixedAmount;
        uint256 maxWithdrawal;
        uint256 withdrawalInterval;
        uint256 minDeposit;
        uint256 feePercentageOnDeposit;
        uint256 maxWithdrawalPerPeriod;
        string metadata;
        MultiTokenConfig multiTokenConfig;
    }

    struct AccessConfig {
        address[] allowlist;
        NftRequirement nftRequirement;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Factory Function
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Creates a new CookieJar with the given configuration
    /// @param params Basic jar parameters
    /// @param accessConfig Access control configuration
    /// @param multiTokenConfig Multi-token configuration
    /// @return jarAddress Address of the created jar
    function createCookieJar(
        JarConfig calldata params,
        AccessConfig calldata accessConfig,
        MultiTokenConfig calldata multiTokenConfig
    )
        external
        returns (address jarAddress);
}
