// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title IGardensModule
/// @notice Interface for the GardensModule that orchestrates Gardens V2 community creation on garden mint
/// @dev Called by GardenToken during mintGarden() to create RegistryCommunity + signal pools
interface IGardensModule {
    // ═══════════════════════════════════════════════════════════════════════════
    // Types
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Configurable weight schemes for conviction voting power
    /// @dev Operator selects at mint time; immutable per garden
    enum WeightScheme {
        Linear, // (100, 200, 300) — flat, 3x operator influence
        Exponential, // (200, 400, 1600) — moderate, 8x operator influence
        Power // (300, 900, 8100) — steep, 27x operator influence

    }

    /// @notice Pool types created for each garden
    enum PoolType {
        HypercertSignal, // Signal pool for curating hypercerts
        ActionSignal // Signal pool for prioritizing garden actions

    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Emitted when a Gardens V2 community is created for a garden
    event CommunityCreated(
        address indexed garden,
        address indexed community,
        WeightScheme weightScheme,
        address goodsToken,
        address nftPowerRegistry
    );

    /// @notice Emitted when a signal pool is created for a garden
    event SignalPoolCreated(address indexed garden, address indexed pool, PoolType poolType, address indexed community);

    /// @notice Emitted when a power registry is deployed for a garden
    event PowerRegistryDeployed(address indexed garden, address indexed registry, WeightScheme weightScheme);

    /// @notice Emitted when GOODS tokens are airdropped to initial hat wearers
    event GoodsAirdropped(address indexed garden, uint256 totalAmount);

    /// @notice Emitted when community creation fails (non-blocking)
    event CommunityCreationFailed(address indexed garden, string reason);

    /// @notice Emitted when a garden is initialized but some steps failed (community or pools missing)
    event GardenPartiallyInitialized(address indexed garden, bool hasCommunity, bool hasPools);

    /// @notice Emitted when a garden's initialization is reset by admin
    event GardenInitializationReset(address indexed garden);

    /// @notice Emitted when a signal pool creation fails (non-blocking)
    event PoolCreationFailed(address indexed garden, address indexed community, string metadata);

    // ═══════════════════════════════════════════════════════════════════════════
    // Garden Mint Callback
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Called by GardenToken during mint to create Gardens V2 infrastructure
    /// @param garden The garden account address
    /// @param scheme The weight scheme selected by the operator
    /// @return community The created RegistryCommunity address
    /// @return pools Array of created signal pool addresses [hypercert, action]
    function onGardenMinted(
        address garden,
        WeightScheme scheme
    )
        external
        returns (address community, address[] memory pools);

    // ═══════════════════════════════════════════════════════════════════════════
    // Events (additional)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Emitted when GOODS tokens are minted to a garden treasury for member staking
    event GardenTreasurySeeded(address indexed garden, uint256 amount);

    // ═══════════════════════════════════════════════════════════════════════════
    // Pool Management
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Create signal pools for a garden. Callable by garden operators or owner.
    /// @dev Garden must have a community. Pools are created inside the community contract.
    /// @param garden The garden account address
    /// @return pools Array of created signal pool addresses
    function createGardenPools(address garden) external returns (address[] memory pools);

    // ═══════════════════════════════════════════════════════════════════════════
    // View Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Get the RegistryCommunity for a garden
    function getGardenCommunity(address garden) external view returns (address);

    /// @notice Get the signal pools for a garden
    function getGardenSignalPools(address garden) external view returns (address[] memory);

    /// @notice Get the weight scheme for a garden
    function getGardenWeightScheme(address garden) external view returns (WeightScheme);

    /// @notice Get the NFTPowerRegistry for a garden
    function getGardenPowerRegistry(address garden) external view returns (address);

    /// @notice Check if a garden has been initialized with Gardens V2
    function isGardenInitialized(address garden) external view returns (bool);

    /// @notice Get the GOODS stake amount required per community member
    function stakeAmountPerMember() external view returns (uint256);

    /// @notice Get the GOODS token
    function goodsToken() external view returns (IERC20);
}
