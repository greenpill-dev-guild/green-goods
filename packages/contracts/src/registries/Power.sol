// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC1155 } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import { IVotingPowerRegistry } from "../vendor/gardens/IVotingPowerRegistry.sol";
import { NFTPowerSource, NFTType } from "../interfaces/IGardensV2.sol";

/// @notice Minimal Hats Protocol interface for hat wearer checks
interface IHatsMinimal {
    function isWearerOfHat(address _user, uint256 _hatId) external view returns (bool);
}

/// @title UnifiedPowerRegistry
/// @notice Single UUPS-upgradeable registry storing per-garden voting power configurations
/// @dev Replaces per-garden NFTPowerRegistry deployments. All CVStrategy pools query this contract.
///      Power = sum of (balance * weight / 10000) across all configured power sources for a garden.
///      Pool → garden mapping enables getMemberPowerInStrategy to route via the strategy address.
contract UnifiedPowerRegistry is IVotingPowerRegistry, OwnableUpgradeable, UUPSUpgradeable {
    // ═══════════════════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════════════════

    error ZeroAddress();
    error NoPowerSources();
    error GardenAlreadyRegistered(address garden);
    error PoolAlreadyRegistered(address pool);
    error NotGardensModule(address caller);
    error ZeroTokenAddress();
    error HatsProtocolRequired();

    // ═══════════════════════════════════════════════════════════════════════════
    // Storage
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Power sources configured per garden (immutable after registration)
    mapping(address garden => NFTPowerSource[] sources) internal gardenSources;

    /// @notice Maps pool/strategy address to its garden
    mapping(address pool => address garden) public poolGarden;

    /// @notice Hats Protocol address (used for HAT type sources)
    address public hatsProtocol;

    /// @notice GardensModule — the only contract authorized to register gardens/pools
    address public gardensModule;

    /// @notice Storage gap for future upgrades
    /// @dev 4 storage vars + 46 gap = 50 slots total
    uint256[46] private __gap;

    // ═══════════════════════════════════════════════════════════════════════════
    // Modifiers
    // ═══════════════════════════════════════════════════════════════════════════

    modifier onlyGardensModule() {
        if (msg.sender != gardensModule) revert NotGardensModule(msg.sender);
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Constructor & Initializer
    // ═══════════════════════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the UnifiedPowerRegistry
    /// @param _owner The owner address
    /// @param _hatsProtocol Hats Protocol address
    /// @param _gardensModule GardensModule address (authorized caller)
    function initialize(address _owner, address _hatsProtocol, address _gardensModule) external initializer {
        if (_owner == address(0)) revert ZeroAddress();

        __Ownable_init();
        _transferOwnership(_owner);

        hatsProtocol = _hatsProtocol;
        gardensModule = _gardensModule;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Garden Registration (GardensModule only)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Register power sources for a garden. Immutable after registration.
    /// @param garden The garden address
    /// @param sources Array of power source configurations
    function registerGarden(address garden, NFTPowerSource[] calldata sources) external onlyGardensModule {
        if (garden == address(0)) revert ZeroAddress();
        if (sources.length == 0) revert NoPowerSources();
        if (gardenSources[garden].length > 0) revert GardenAlreadyRegistered(garden);

        for (uint256 i = 0; i < sources.length; i++) {
            if (sources[i].token == address(0)) revert ZeroTokenAddress();
            if (sources[i].nftType == NFTType.HAT && hatsProtocol == address(0)) {
                revert HatsProtocolRequired();
            }
            gardenSources[garden].push(sources[i]);
        }
    }

    /// @notice Map a pool/strategy to its garden
    /// @param pool The pool/strategy address
    /// @param garden The garden address
    function registerPool(address pool, address garden) external onlyGardensModule {
        if (pool == address(0) || garden == address(0)) revert ZeroAddress();
        if (poolGarden[pool] != address(0)) revert PoolAlreadyRegistered(pool);
        poolGarden[pool] = garden;
    }

    /// @notice Remove a garden's power sources and pool mappings (for reset flows)
    /// @param garden The garden address to deregister
    /// @param pools Pool addresses to unmap from this garden
    function deregisterGarden(address garden, address[] calldata pools) external onlyGardensModule {
        if (garden == address(0)) revert ZeroAddress();

        // Clear pool → garden mappings
        uint256 poolsCleared = 0;
        for (uint256 i = 0; i < pools.length; i++) {
            if (poolGarden[pools[i]] == garden) {
                delete poolGarden[pools[i]];
                poolsCleared++;
            }
        }

        // Clear garden sources
        delete gardenSources[garden];

        emit GardenDeregistered(garden, poolsCleared);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // IVotingPowerRegistry Implementation
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Get member voting power for a strategy by looking up pool → garden → sources
    /// @dev CVStrategy calls this with the pool address as `_strategy`.
    ///      Returns 0 for unknown pools (no revert).
    /// @param _member The member address
    /// @param _strategy The pool/strategy address (used to resolve garden)
    /// @return power The total voting power (weighted sum)
    function getMemberPowerInStrategy(address _member, address _strategy) external view override returns (uint256 power) {
        address garden = poolGarden[_strategy];
        if (garden == address(0)) return 0;

        NFTPowerSource[] storage sources = gardenSources[garden];
        for (uint256 i = 0; i < sources.length; i++) {
            NFTPowerSource storage source = sources[i];
            uint256 balance;

            if (source.nftType == NFTType.ERC721) {
                balance = IERC721(source.token).balanceOf(_member);
            } else if (source.nftType == NFTType.ERC1155) {
                balance = IERC1155(source.token).balanceOf(_member, source.tokenId);
            } else if (source.nftType == NFTType.HAT) {
                balance = IHatsMinimal(hatsProtocol).isWearerOfHat(_member, source.hatId) ? 1 : 0;
            }

            // Apply weight (basis points: 10000 = 1x)
            power += (balance * source.weight) / 10_000;
        }
    }

    /// @notice Returns 0 for NFT-based registries (no staking)
    function getMemberStakedAmount(address /* _member */ ) external pure override returns (uint256) {
        return 0;
    }

    /// @notice Returns the Hats Protocol address (first source token for compatibility)
    function ercAddress() external view override returns (address) {
        return hatsProtocol;
    }

    /// @notice Check if a member has any voting power in the calling pool/strategy
    /// @dev Uses msg.sender as the strategy address. In the real call flow, CVStrategy
    ///      calls this method, so msg.sender IS the pool address that maps to a garden.
    ///      External callers without a pool mapping will get false (safe default).
    function isMember(address _member) external view override returns (bool) {
        return this.getMemberPowerInStrategy(_member, msg.sender) > 0;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // View Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Get the power sources for a garden
    function getGardenSources(address garden) external view returns (NFTPowerSource[] memory) {
        return gardenSources[garden];
    }

    /// @notice Get the number of power sources for a garden
    function getGardenSourceCount(address garden) external view returns (uint256) {
        return gardenSources[garden].length;
    }

    /// @notice Get the garden for a pool
    function getPoolGarden(address pool) external view returns (address) {
        return poolGarden[pool];
    }

    /// @notice Check if a garden has been registered
    function isGardenRegistered(address garden) external view returns (bool) {
        return gardenSources[garden].length > 0;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════════

    event ConfigUpdated(string indexed key, address indexed oldValue, address indexed newValue);
    event GardenDeregistered(address indexed garden, uint256 poolsCleared);

    // ═══════════════════════════════════════════════════════════════════════════
    // Admin Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Set the GardensModule address
    function setGardensModule(address _gardensModule) external onlyOwner {
        if (_gardensModule == address(0)) revert ZeroAddress();
        emit ConfigUpdated("gardensModule", gardensModule, _gardensModule);
        gardensModule = _gardensModule;
    }

    /// @notice Set the Hats Protocol address
    function setHatsProtocol(address _hatsProtocol) external onlyOwner {
        if (_hatsProtocol == address(0)) revert ZeroAddress();
        emit ConfigUpdated("hatsProtocol", hatsProtocol, _hatsProtocol);
        hatsProtocol = _hatsProtocol;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UUPS Upgrade
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Authorizes an upgrade to a new implementation
    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner { }
}
