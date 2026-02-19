// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IGardensV2
/// @notice Minimal interfaces for Gardens V2 contracts (Sepolia, Arbitrum, Celo)
/// @dev Only the functions Green Goods calls are included. Full contracts at:
///      https://github.com/1Hive/gardens-v2

// ═══════════════════════════════════════════════════════════════════════════
// Shared Types (Allo Protocol)
// ═══════════════════════════════════════════════════════════════════════════

/// @notice Allo Protocol metadata struct
/// @dev Matches allo-v2-contracts/core/interfaces/IRegistry.sol Metadata
struct Metadata {
    uint256 protocol; // 1 = IPFS
    string pointer; // Content hash
}

// ═══════════════════════════════════════════════════════════════════════════
// Registry Factory
// ═══════════════════════════════════════════════════════════════════════════

/// @notice Parameters for creating a RegistryCommunity
/// @dev Must match gardens-v2 RegistryCommunityInitializeParams exactly (12 fields).
///      _nonce and _registryFactory are set by the factory itself during createRegistry().
struct RegistryCommunityInitializeParamsV2 {
    address _allo; // Allo protocol address
    address _gardenToken; // GOODS ERC-20 for member staking (cast to IERC20 by factory)
    uint256 _registerStakeAmount; // Amount of tokens to stake (e.g., 1e18)
    uint256 _communityFee; // Fee percentage (0 = no fee)
    uint256 _nonce; // Set by factory — pass 0
    address _registryFactory; // Set by factory — pass address(0)
    address _feeReceiver; // Address to receive fees
    Metadata _metadata; // Community metadata
    address payable _councilSafe; // Gnosis Safe for council governance
    string _communityName; // Human-readable community name
    bool _isKickEnabled; // Whether members can be kicked
    string covenantIpfsHash; // IPFS hash for community covenant
}

/// @notice Creates RegistryCommunity instances
/// @dev Deployed on Sepolia, Arbitrum, and Celo. See test/fork/helpers/GardensV2Addresses.sol.
interface IRegistryFactory {
    /// @notice Create a new RegistryCommunity
    /// @dev Matches gardens-v2 RegistryFactory.createRegistry() signature.
    ///      The factory sets _nonce and _registryFactory fields internally.
    /// @param params Community creation parameters
    /// @return community The created community address
    function createRegistry(RegistryCommunityInitializeParamsV2 memory params) external returns (address community);
}

// ═══════════════════════════════════════════════════════════════════════════
// CV Strategy Types
// ═══════════════════════════════════════════════════════════════════════════

/// @notice Proposal types for conviction pools
/// @dev Ordinals MUST match Gardens V2 ICVStrategy.ProposalType
enum ProposalType {
    Signaling,
    Funding,
    Streaming
}

/// @notice Point system types for conviction pools
/// @dev Ordinals MUST match Gardens V2 ICVStrategy.PointSystem:
///      Fixed=0, Capped=1, Unlimited=2, Quadratic=3, Custom=4
enum PointSystem {
    Fixed,
    Capped,
    Unlimited,
    Quadratic,
    Custom // Uses external IVotingPowerRegistry

}

/// @notice Parameters for conviction voting
/// @dev Matches Gardens V2 ICVStrategy.CVParams
struct CVParams {
    uint256 maxRatio; // Maximum allocation ratio (scaled by D)
    uint256 weight; // Weight for conviction calculation (scaled by D)
    uint256 decay; // Decay factor for conviction (scaled by D)
    uint256 minThresholdPoints; // Minimum threshold points
}

/// @notice Capped point system configuration
/// @dev Matches Gardens V2 ICVStrategy.PointSystemConfig
struct PointSystemConfig {
    uint256 maxAmount; // Maximum amount for capped point system
}

/// @notice Arbitration configuration for conviction pools
/// @dev Matches Gardens V2 ICVStrategy.ArbitrableConfig. Use address(0) for all fields
///      when arbitration is not needed (signaling pools).
struct ArbitrableConfig {
    address arbitrator; // IArbitrator — address(0) for none
    address tribunalSafe; // Tribunal Safe — address(0) for none
    uint256 submitterCollateralAmount; // Submitter collateral (0 for signaling)
    uint256 challengerCollateralAmount; // Challenger collateral (0 for signaling)
    uint256 defaultRuling; // Default ruling (0 for signaling)
    uint256 defaultRulingTimeout; // Timeout in seconds (0 for signaling)
}

/// @notice V0.3 strategy initialization parameters
/// @dev Matches gardens-v2 ICVStrategy.CVStrategyInitializeParamsV0_3 exactly (12 fields).
struct CVStrategyInitializeParamsV0_3 {
    CVParams cvParams;
    ProposalType proposalType;
    PointSystem pointSystem;
    PointSystemConfig pointConfig;
    ArbitrableConfig arbitrableConfig;
    address registryCommunity; // The community this pool belongs to
    address votingPowerRegistry; // External registry for Custom point system
    address sybilScorer; // Sybil resistance scorer — address(0) for none
    uint256 sybilScorerThreshold; // Threshold for sybil scorer (0 if no scorer)
    address[] initialAllowlist; // Initial allowlisted addresses
    address superfluidToken; // Superfluid token — address(0) for none
    uint256 streamingRatePerSecond; // Streaming rate (0 for non-streaming)
}

// ═══════════════════════════════════════════════════════════════════════════
// Registry Community
// ═══════════════════════════════════════════════════════════════════════════

/// @notice A Gardens V2 community that manages conviction voting pools
interface IRegistryCommunity {
    /// @notice Create a new conviction voting pool
    /// @dev Matches gardens-v2 CommunityPoolFacet.createPool(address, CVStrategyInitializeParamsV0_3, Metadata).
    ///      The _token argument is the pool's funding token (use address(0) for native / signaling).
    /// @param _token Pool funding token (address(0) for native/signaling)
    /// @param _params Strategy initialization parameters
    /// @param _metadata Pool metadata
    /// @return poolId The Allo pool ID
    /// @return strategy The deployed CVStrategy address
    function createPool(
        address _token,
        CVStrategyInitializeParamsV0_3 memory _params,
        Metadata memory _metadata
    )
        external
        returns (uint256 poolId, address strategy);

    /// @notice Get the community's staking token
    function gardenToken() external view returns (address);

    /// @notice Get the community's council Safe
    function councilSafe() external view returns (address);

    /// @notice Stake GOODS and register a member in the community
    /// @param member The address to register
    function stakeAndRegisterMember(address member) external;
}

// ═══════════════════════════════════════════════════════════════════════════
// NFT Power Registry
// ═══════════════════════════════════════════════════════════════════════════

/// @notice NFT type for power source balance resolution
/// @dev Ordering MUST match vendor NFTPowerRegistry.NFTType: ERC721=0, ERC1155=1, HAT=2
enum NFTType {
    ERC721, // balanceOf(account) count
    ERC1155, // balanceOf(account, tokenId) count
    HAT // isWearerOfHat(account, hatId) binary (0 or 1)

}

/// @notice Configuration for a voting power source in NFTPowerRegistry
/// @dev 1:1 with vendor NFTPowerRegistry.NFTPowerSource (5 fields).
///      For HAT sources: token = hatsProtocol address, tokenId is ignored.
///      For ERC721 sources: hatId is ignored.
///      For ERC1155 sources: hatId is ignored, tokenId selects the token.
struct NFTPowerSource {
    address token; // NFT contract or Hats Protocol address
    NFTType nftType; // How to read the balance
    uint256 weight; // Basis points multiplier (10000 = 1x)
    uint256 tokenId; // ERC1155 token ID (ignored for ERC721/HAT)
    uint256 hatId; // Hats Protocol hat ID (ignored for ERC721/ERC1155)
}

/// @notice Unified registry storing per-garden voting power configurations
/// @dev Single UUPS-upgradeable contract replacing per-garden NFTPowerRegistry deployments
interface IUnifiedPowerRegistry {
    /// @notice Register power sources for a garden (immutable after registration)
    function registerGarden(address garden, NFTPowerSource[] calldata sources) external;

    /// @notice Map a pool/strategy to its garden
    function registerPool(address pool, address garden) external;

    /// @notice Get the power sources for a garden
    function getGardenSources(address garden) external view returns (NFTPowerSource[] memory);

    /// @notice Get the number of power sources for a garden
    function getGardenSourceCount(address garden) external view returns (uint256);

    /// @notice Get the garden for a pool
    function getPoolGarden(address pool) external view returns (address);

    /// @notice Check if a garden has been registered
    function isGardenRegistered(address garden) external view returns (bool);

    /// @notice Remove a garden's power sources and pool mappings (for reset flows)
    function deregisterGarden(address garden, address[] calldata pools) external;
}
