// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IGardensV2
/// @notice Minimal interfaces for Gardens V2 contracts on Arbitrum Sepolia
/// @dev Only the functions Green Goods calls are included. Full contracts at:
///      https://github.com/1Hive/gardens-v2

// ═══════════════════════════════════════════════════════════════════════════
// Registry Factory
// ═══════════════════════════════════════════════════════════════════════════

/// @notice Creates RegistryCommunity instances
/// @dev Deployed on Arb Sepolia at 0xf42f88c13804147b2fdda13c093ce14219aea395
interface IRegistryFactory {
    /// @notice Parameters for creating a RegistryCommunity
    struct CreateCommunityParams {
        address gardenToken; // GOODS ERC-20 for member staking
        uint256 registerStakeAmount; // Amount of GOODS to stake (e.g., 1e18)
        uint256 communityFee; // Fee percentage (0 = no fee)
        address feeReceiver; // Address to receive fees
        address councilSafe; // Gnosis Safe for council governance
        string communityName; // Human-readable community name
        bool isKickEnabled; // Whether members can be kicked
        string covenantIpfsHash; // IPFS hash for community covenant
    }

    /// @notice Create a new RegistryCommunity
    /// @param params Community creation parameters
    /// @return community The created community address
    function createRegistryCommunity(CreateCommunityParams calldata params) external returns (address community);
}

// ═══════════════════════════════════════════════════════════════════════════
// Registry Community
// ═══════════════════════════════════════════════════════════════════════════

/// @notice A Gardens V2 community that manages conviction voting pools
interface IRegistryCommunity {
    /// @notice Point system types for conviction pools
    enum PointSystem {
        Fixed,
        Capped,
        Unlimited,
        Custom // Uses external IVotingPowerRegistry

    }

    /// @notice Parameters for conviction voting
    struct CVParams {
        uint256 maxRatio; // Maximum allocation ratio (scaled by D)
        uint256 weight; // Weight for conviction calculation (scaled by D)
        uint256 decay; // Decay factor for conviction (scaled by D)
        uint256 minThresholdPoints; // Minimum threshold points
    }

    /// @notice Parameters for creating a conviction pool
    struct CreatePoolParams {
        PointSystem pointSystem; // Which point system to use
        CVParams cvParams; // Conviction voting parameters
        address votingPowerRegistry; // External registry for Custom point system
        address[] initialMembers; // Members to add on creation
        string metadata; // IPFS metadata
    }

    /// @notice Create a new conviction voting pool
    /// @param params Pool creation parameters
    /// @return poolId The pool ID
    /// @return strategy The deployed CVStrategy address
    function createPool(CreatePoolParams calldata params) external returns (uint256 poolId, address strategy);

    /// @notice Get the community's staking token
    function gardenToken() external view returns (address);

    /// @notice Get the community's council Safe
    function councilSafe() external view returns (address);
}

// ═══════════════════════════════════════════════════════════════════════════
// NFT Power Registry
// ═══════════════════════════════════════════════════════════════════════════

/// @notice Configuration for a voting power source in NFTPowerRegistry
struct NFTPowerSource {
    address hatsProtocol; // Hats Protocol contract
    uint256 hatId; // The specific hat ID
    uint256 weight; // Weight in basis points (100 = 1x, 200 = 2x, etc.)
}

/// @notice Registry that maps Hats roles to conviction voting power
/// @dev One per garden, immutable after deployment
interface INFTPowerRegistry {
    /// @notice Get the voting power for an address
    /// @param member The address to check
    /// @return power The total voting power (sum of weights for all hats worn)
    function getVotingPower(address member) external view returns (uint256 power);

    /// @notice Get the number of configured power sources
    function getSourceCount() external view returns (uint256);
}

/// @notice Factory for deploying NFTPowerRegistry instances
interface INFTPowerRegistryFactory {
    /// @notice Deploy a new NFTPowerRegistry with the given power sources
    /// @param sources Array of power source configurations
    /// @return registry The deployed registry address
    function deploy(NFTPowerSource[] calldata sources) external returns (address registry);
}
