// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import { IHypercertMinter } from "../interfaces/IHypercertExchange.sol";
import { OrderStructs } from "../interfaces/IHypercertExchange.sol";
import { IGardensModule } from "../interfaces/IGardensModule.sol";
import { IHatsModule } from "../interfaces/IHatsModule.sol";

/// @notice Minimal interface for HypercertMarketplaceAdapter (avoids circular import)
interface IMarketplaceAdapter {
    function registerOrder(
        OrderStructs.Maker calldata makerAsk,
        bytes calldata signature,
        uint256 hypercertId
    )
        external
        returns (uint256 orderId);

    function batchRegisterOrders(
        OrderStructs.Maker[] calldata makerAsks,
        bytes[] calldata signatures,
        uint256[] calldata hypercertIds
    )
        external
        returns (uint256[] memory orderIds);

    function deactivateOrder(uint256 orderId) external;
}

/// @title HypercertsModule
/// @notice Orchestrates hypercert minting, garden tracking, and marketplace listing for yield
/// @dev UUPS upgradeable module that bridges hypercert minting with signal pool registration
///      and marketplace listing. Access controlled via Hats Protocol roles.
contract HypercertsModule is OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    // ═══════════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════════

    event HypercertMintedAndRegistered(address indexed garden, uint256 indexed hypercertId, address pool);
    event HypercertListedForYield(address indexed garden, uint256 indexed hypercertId, uint256 orderId);
    event HypercertDelistedFromYield(address indexed garden, uint256 orderId);

    // ═══════════════════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════════════════

    error Unauthorized(address caller);
    error NotActive();
    error InvalidHypercert(uint256 hypercertId);
    error HypercertNotTracked(uint256 hypercertId);
    error ArrayLengthMismatch();
    error ZeroAddress();

    // ═══════════════════════════════════════════════════════════════════════════
    // Storage
    // ═══════════════════════════════════════════════════════════════════════════

    address public hypercertMinter;
    IMarketplaceAdapter public marketplaceAdapter;
    IGardensModule public gardensModule;
    IHatsModule public hatsModule;
    address public gardenToken;
    bool public paused;

    mapping(address garden => uint256[] hypercertIds) internal _gardenHypercerts;
    mapping(uint256 hypercertId => address garden) public hypercertGarden;

    /// @dev 8 storage slots + 1 reentrancy guard slot + 41 gap = 50 total slots
    uint256[41] private __gap;

    // ═══════════════════════════════════════════════════════════════════════════
    // Constructor & Initializer
    // ═══════════════════════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _owner,
        address _hypercertMinter,
        address _marketplaceAdapter,
        address _gardensModule,
        address _hatsModule,
        address _gardenToken
    )
        external
        initializer
    {
        if (_owner == address(0)) revert Unauthorized(address(0));

        __Ownable_init();
        __ReentrancyGuard_init();
        _transferOwnership(_owner);

        hypercertMinter = _hypercertMinter;
        marketplaceAdapter = IMarketplaceAdapter(_marketplaceAdapter);
        gardensModule = IGardensModule(_gardensModule);
        hatsModule = IHatsModule(_hatsModule);
        gardenToken = _gardenToken;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Core Operations
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Mint a hypercert and register it for the garden
    /// @param garden The garden account address
    /// @param totalUnits Total units for the hypercert
    /// @param merkleRoot Merkle root for the allowlist (0 for open)
    /// @param metadataUri IPFS URI for hypercert metadata
    /// @return hypercertId The newly minted hypercert ID
    function mintAndRegister(
        address garden,
        uint256 totalUnits,
        bytes32 merkleRoot,
        string calldata metadataUri
    )
        external
        nonReentrant
        returns (uint256 hypercertId)
    {
        _requireOperator(garden);
        if (paused) revert NotActive();

        // Mint the hypercert via the minter contract
        hypercertId = IHypercertMinter(hypercertMinter).createAllowlist(garden, totalUnits, merkleRoot, metadataUri, 0);

        // Look up signal pool for this garden (graceful — pool may not exist)
        address pool;
        if (address(gardensModule) != address(0)) {
            // solhint-disable-next-line no-empty-blocks
            try gardensModule.getGardenSignalPools(garden) returns (address[] memory pools) {
                if (pools.length > 0) {
                    pool = pools[0];
                }
            } catch { }
        }

        // Track the hypercert for this garden
        _gardenHypercerts[garden].push(hypercertId);
        hypercertGarden[hypercertId] = garden;

        emit HypercertMintedAndRegistered(garden, hypercertId, pool);
    }

    /// @notice List a garden's hypercert for yield on the marketplace
    /// @param garden The garden account address
    /// @param hypercertId The hypercert to list
    /// @param makerAsk The maker ask order
    /// @param signature The EIP-712 signature for the order
    /// @return orderId The marketplace order ID
    function listForYield(
        address garden,
        uint256 hypercertId,
        OrderStructs.Maker calldata makerAsk,
        bytes calldata signature
    )
        external
        returns (uint256 orderId)
    {
        _requireOperator(garden);
        if (paused) revert NotActive();
        if (hypercertGarden[hypercertId] != garden) revert InvalidHypercert(hypercertId);

        orderId = marketplaceAdapter.registerOrder(makerAsk, signature, hypercertId);

        emit HypercertListedForYield(garden, hypercertId, orderId);
    }

    /// @notice Batch list multiple hypercerts for yield
    /// @param garden The garden account address
    /// @param hypercertIds The hypercerts to list
    /// @param makerAsks The maker ask orders
    /// @param signatures The EIP-712 signatures
    /// @return orderIds The marketplace order IDs
    function batchListForYield(
        address garden,
        uint256[] calldata hypercertIds,
        OrderStructs.Maker[] calldata makerAsks,
        bytes[] calldata signatures
    )
        external
        returns (uint256[] memory orderIds)
    {
        _requireOperator(garden);
        if (paused) revert NotActive();
        if (hypercertIds.length != makerAsks.length || makerAsks.length != signatures.length) {
            revert ArrayLengthMismatch();
        }

        // Validate all hypercerts belong to this garden
        for (uint256 i = 0; i < hypercertIds.length; i++) {
            if (hypercertGarden[hypercertIds[i]] != garden) revert InvalidHypercert(hypercertIds[i]);
        }

        orderIds = marketplaceAdapter.batchRegisterOrders(makerAsks, signatures, hypercertIds);
    }

    /// @notice Delist a hypercert from the marketplace
    /// @param garden The garden account address
    /// @param orderId The order to deactivate
    function delistFromYield(address garden, uint256 orderId) external {
        _requireOperator(garden);

        marketplaceAdapter.deactivateOrder(orderId);

        emit HypercertDelistedFromYield(garden, orderId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // View Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Get all hypercert IDs tracked for a garden
    function getGardenHypercerts(address garden) external view returns (uint256[] memory) {
        return _gardenHypercerts[garden];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Admin Functions
    // ═══════════════════════════════════════════════════════════════════════════

    function setHypercertMinter(address _hypercertMinter) external onlyOwner {
        if (_hypercertMinter == address(0)) revert ZeroAddress();
        hypercertMinter = _hypercertMinter;
    }

    function setMarketplaceAdapter(address _marketplaceAdapter) external onlyOwner {
        if (_marketplaceAdapter == address(0)) revert ZeroAddress();
        marketplaceAdapter = IMarketplaceAdapter(_marketplaceAdapter);
    }

    function setGardensModule(address _gardensModule) external onlyOwner {
        if (_gardensModule == address(0)) revert ZeroAddress();
        gardensModule = IGardensModule(_gardensModule);
    }

    function setHatsModule(address _hatsModule) external onlyOwner {
        if (_hatsModule == address(0)) revert ZeroAddress();
        hatsModule = IHatsModule(_hatsModule);
    }

    function setGardenToken(address _gardenToken) external onlyOwner {
        if (_gardenToken == address(0)) revert ZeroAddress();
        gardenToken = _gardenToken;
    }

    /// @notice Remove a tracked hypercert from a garden mapping
    /// @dev Maintains dense array via swap-and-pop and clears reverse mapping.
    function untrackGardenHypercert(address garden, uint256 hypercertId) external {
        _requireOperator(garden);
        if (hypercertGarden[hypercertId] != garden) revert InvalidHypercert(hypercertId);

        uint256[] storage ids = _gardenHypercerts[garden];
        uint256 len = ids.length;
        for (uint256 i = 0; i < len; i++) {
            if (ids[i] == hypercertId) {
                ids[i] = ids[len - 1];
                ids.pop();
                delete hypercertGarden[hypercertId];
                return;
            }
        }

        revert HypercertNotTracked(hypercertId);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Internal
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Require the caller is an operator or owner of the garden, or the module owner
    function _requireOperator(address garden) internal view {
        if (garden == address(0) || gardenToken == address(0)) revert Unauthorized(msg.sender);
        if (IERC721(gardenToken).balanceOf(garden) == 0) revert Unauthorized(msg.sender);
        if (address(hatsModule) == address(0)) revert Unauthorized(msg.sender);
        if (!hatsModule.isOperatorOf(garden, msg.sender) && !hatsModule.isOwnerOf(garden, msg.sender)) {
            if (msg.sender != owner()) revert Unauthorized(msg.sender);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UUPS Upgrade
    // ═══════════════════════════════════════════════════════════════════════════

    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner { }
}
