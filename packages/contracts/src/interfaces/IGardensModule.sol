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
    /// @dev Operator selects at mint time; immutable per garden.
    ///      Weights are in basis points (10_000 = 1x) and must be >= 10_000 for HAT sources.
    enum WeightScheme {
        Linear, // (10_000, 20_000, 30_000) — flat, 3x operator influence
        Exponential, // (20_000, 40_000, 160_000) — moderate, 8x operator influence
        Power // (30_000, 90_000, 810_000) — steep, 27x operator influence

    }

    /// @notice Pool types created for each garden
    enum PoolType {
        ActionSignal, // Signal pool for prioritizing garden actions
        HypercertSignal // Signal pool for curating hypercerts

    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Emitted when a Gardens V2 community is created for a garden
    event CommunityCreated(
        address indexed garden, address indexed community, WeightScheme weightScheme, address goodsToken
    );

    /// @notice Emitted when a signal pool is created for a garden
    event SignalPoolCreated(address indexed garden, address indexed pool, PoolType poolType, address indexed community);

    /// @notice Emitted when power sources are registered for a garden in the unified registry
    event GardenPowerRegistered(address indexed garden, WeightScheme weightScheme, uint256 sourceCount);

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

    /// @notice Emitted when pool registration in PowerRegistry or HatsModule fails (non-blocking)
    event PoolRegistrationFailed(address indexed garden, address indexed target, string reason);

    /// @notice Emitted when an admin configuration value is updated
    event ConfigUpdated(string indexed key, address indexed oldValue, address indexed newValue);

    /// @notice Emitted when the stake amount per member is updated
    event StakeAmountUpdated(uint256 oldAmount, uint256 newAmount);

    /// @notice Emitted when the require-full-setup flag is toggled
    event RequireFullSetupUpdated(bool newValue);

    // ═══════════════════════════════════════════════════════════════════════════
    // Garden Mint Callback
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Called by GardenToken during mint to create Gardens V2 infrastructure
    /// @param garden The garden account address
    /// @param scheme The weight scheme selected by the operator
    /// @param gardenName The garden name (passed explicitly since the account is not yet initialized)
    /// @return community The created RegistryCommunity address
    /// @return pools Array of created signal pool addresses [action, hypercert]
    function onGardenMinted(
        address garden,
        WeightScheme scheme,
        string calldata gardenName
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

    /// @notice Seed a garden treasury with GOODS for community member staking.
    /// @dev Owner-only recovery hook for gardens initialized before community creation succeeded.
    /// @param garden The garden account address
    function seedGardenTreasury(address garden) external;

    // ═══════════════════════════════════════════════════════════════════════════
    // View Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Get the RegistryCommunity for a garden
    function getGardenCommunity(address garden) external view returns (address);

    /// @notice Get the signal pools for a garden
    function getGardenSignalPools(address garden) external view returns (address[] memory);

    /// @notice Get the weight scheme for a garden
    function getGardenWeightScheme(address garden) external view returns (WeightScheme);

    /// @notice Get the power registry address for a garden
    function getGardenPowerRegistry(address garden) external view returns (address);

    /// @notice Check if a garden has been initialized with Gardens V2
    function isGardenInitialized(address garden) external view returns (bool);

    /// @notice Get the GOODS stake amount required per community member
    function stakeAmountPerMember() external view returns (uint256);

    /// @notice Get the GOODS token
    function goodsToken() external view returns (IERC20);
}
