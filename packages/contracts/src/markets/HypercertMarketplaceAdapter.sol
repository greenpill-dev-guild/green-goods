// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { OrderStructs, IHypercertExchange } from "../interfaces/IHypercertExchange.sol";
import { IHypercertMarketplace } from "../interfaces/IHypercertMarketplace.sol";

/// @title HypercertMarketplaceAdapter
/// @notice Wraps the deployed HypercertExchange for the YieldResolver, storing signed maker orders
///         and exposing a simple buyFraction interface for conviction-weighted fraction purchasing.
/// @dev Registered orders are reusable — the same maker ask can be used for multiple taker bids
///      until deactivated or expired.
contract HypercertMarketplaceAdapter is
    IHypercertMarketplace,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════════
    // Types
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice A registered maker order stored on-chain for reuse
    struct RegisteredOrder {
        uint256 hypercertId;
        bytes encodedMakerAsk;
        bytes signature;
        uint256 pricePerUnit;
        uint256 minUnitAmount;
        uint256 maxUnitAmount;
        address seller;
        address currency;
        uint256 endTime;
        bool active;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════════

    event OrderRegistered(
        uint256 indexed orderId,
        uint256 indexed hypercertId,
        address indexed seller,
        address currency,
        uint256 pricePerUnit,
        uint256 endTime
    );

    event OrderDeactivated(uint256 indexed orderId, address indexed deactivatedBy);

    event FractionPurchased(
        uint256 indexed orderId, uint256 indexed hypercertId, address indexed recipient, uint256 units, uint256 payment
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // Errors
    // ═══════════════════════════════════════════════════════════════════════════

    error NotPaused();
    error InvalidOrder();
    error OrderExpired();
    error DuplicateActiveOrder();
    error InsufficientUnits();
    error ExchangeExecutionFailed(bytes reason);
    error Unauthorized();
    error ArrayLengthMismatch();
    error BatchTooLarge();
    error ContractPaused();
    error NoActiveOrder();

    // ═══════════════════════════════════════════════════════════════════════════
    // Storage
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice The HypercertExchange contract
    IHypercertExchange public exchange;

    /// @notice The HypercertMinter contract address (used for order validation)
    address public hypercertMinter;

    /// @notice Maximum number of orders in a batch registration
    uint256 public maxBatchSize;

    /// @notice Auto-incrementing order ID counter (starts at 1)
    uint256 public nextOrderId;

    /// @notice All registered orders by ID
    mapping(uint256 orderId => RegisteredOrder) public orders;

    /// @notice Active order ID per hypercertId+currency pair
    mapping(uint256 hypercertId => mapping(address currency => uint256 orderId)) public activeOrders;

    /// @notice Order IDs per seller
    mapping(address seller => uint256[]) public sellerOrders;

    /// @notice Whether the contract is paused
    bool public paused;

    /// @notice Allowed currencies for order registration
    mapping(address currency => bool allowed) public allowedCurrencies;

    /// @notice Storage gap for future upgrades
    /// @dev 10 storage vars + 40 gap = 50 slots total
    uint256[40] private __gap;

    // ═══════════════════════════════════════════════════════════════════════════
    // Constructor & Initializer
    // ═══════════════════════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the adapter
    /// @param _owner The owner address
    /// @param _exchange The HypercertExchange address
    /// @param _hypercertMinter The HypercertMinter address
    function initialize(address _owner, address _exchange, address _hypercertMinter) external initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        _transferOwnership(_owner);

        exchange = IHypercertExchange(_exchange);
        hypercertMinter = _hypercertMinter;
        maxBatchSize = 10;
        nextOrderId = 1;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Order Registration
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Register a signed maker ask order for later execution
    /// @param makerAsk The maker ask order signed off-chain by the seller
    /// @param signature The EIP-712 signature of the maker order
    /// @param hypercertId The hypercert token ID this order sells fractions of
    /// @return orderId The assigned order ID
    function registerOrder(
        OrderStructs.Maker calldata makerAsk,
        bytes calldata signature,
        uint256 hypercertId
    )
        external
        returns (uint256 orderId)
    {
        if (paused) revert ContractPaused();
        orderId = _registerOrder(makerAsk, signature, hypercertId);
    }

    /// @notice Register multiple orders in a single transaction
    /// @param makerAsks Array of maker ask orders
    /// @param signatures Array of signatures corresponding to each order
    /// @param hypercertIds Array of hypercert IDs for each order
    /// @return orderIds Array of assigned order IDs
    function batchRegisterOrders(
        OrderStructs.Maker[] calldata makerAsks,
        bytes[] calldata signatures,
        uint256[] calldata hypercertIds
    )
        external
        returns (uint256[] memory orderIds)
    {
        if (paused) revert ContractPaused();
        if (makerAsks.length != signatures.length || makerAsks.length != hypercertIds.length) {
            revert ArrayLengthMismatch();
        }
        if (makerAsks.length > maxBatchSize) revert BatchTooLarge();

        orderIds = new uint256[](makerAsks.length);
        for (uint256 i = 0; i < makerAsks.length; i++) {
            orderIds[i] = _registerOrder(makerAsks[i], signatures[i], hypercertIds[i]);
        }
    }

    /// @dev Internal order registration logic
    function _registerOrder(
        OrderStructs.Maker calldata makerAsk,
        bytes calldata signature,
        uint256 hypercertId
    )
        internal
        returns (uint256 orderId)
    {
        // Validate order type
        if (makerAsk.quoteType != OrderStructs.QuoteType.MakerAsk) revert InvalidOrder();
        if (makerAsk.collection != hypercertMinter) revert InvalidOrder();
        if (makerAsk.endTime <= block.timestamp) revert OrderExpired();

        // Decode additional parameters
        (uint256 minUnitAmount, uint256 maxUnitAmount,,) =
            abi.decode(makerAsk.additionalParameters, (uint256, uint256, uint256, bool));

        // Check for duplicate active order (auto-deactivate if expired)
        uint256 existingOrderId = activeOrders[hypercertId][makerAsk.currency];
        if (existingOrderId != 0) {
            RegisteredOrder storage existing = orders[existingOrderId];
            if (existing.active) {
                if (existing.endTime > block.timestamp) {
                    revert DuplicateActiveOrder();
                }
                // Auto-deactivate expired order
                existing.active = false;
                emit OrderDeactivated(existingOrderId, address(this));
            }
        }

        // Assign order ID and store
        orderId = nextOrderId++;
        orders[orderId] = RegisteredOrder({
            hypercertId: hypercertId,
            encodedMakerAsk: abi.encode(makerAsk),
            signature: signature,
            pricePerUnit: makerAsk.price,
            minUnitAmount: minUnitAmount,
            maxUnitAmount: maxUnitAmount,
            seller: makerAsk.signer,
            currency: makerAsk.currency,
            endTime: makerAsk.endTime,
            active: true
        });

        activeOrders[hypercertId][makerAsk.currency] = orderId;
        sellerOrders[makerAsk.signer].push(orderId);

        emit OrderRegistered(orderId, hypercertId, makerAsk.signer, makerAsk.currency, makerAsk.price, makerAsk.endTime);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Order Deactivation
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Deactivate an order (only seller or owner)
    /// @param orderId The order ID to deactivate
    function deactivateOrder(uint256 orderId) external {
        RegisteredOrder storage order = orders[orderId];
        if (!order.active) revert InvalidOrder();
        if (msg.sender != order.seller && msg.sender != owner()) revert Unauthorized();

        order.active = false;
        // Clear the active order mapping
        if (activeOrders[order.hypercertId][order.currency] == orderId) {
            activeOrders[order.hypercertId][order.currency] = 0;
        }

        emit OrderDeactivated(orderId, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // IHypercertMarketplace — Buy Fraction
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IHypercertMarketplace
    function buyFraction(
        uint256 hypercertId,
        uint256 amount,
        address asset,
        address recipient
    )
        external
        override
        nonReentrant
        returns (uint256 fractionId)
    {
        if (paused) revert ContractPaused();

        // Look up active order
        uint256 orderId = activeOrders[hypercertId][asset];
        if (orderId == 0) revert NoActiveOrder();

        RegisteredOrder storage order = orders[orderId];
        if (!order.active) revert NoActiveOrder();
        if (order.endTime <= block.timestamp) revert OrderExpired();

        // Calculate units from payment amount
        uint256 units = amount / order.pricePerUnit;
        if (units == 0) revert InsufficientUnits();

        // Cap to maxUnitAmount
        if (units > order.maxUnitAmount) {
            units = order.maxUnitAmount;
        }
        if (units < order.minUnitAmount) revert InsufficientUnits();

        uint256 actualPayment = units * order.pricePerUnit;

        // Pull payment from caller (YieldResolver)
        IERC20(asset).safeTransferFrom(msg.sender, address(this), actualPayment);

        // Approve exchange to spend the payment
        IERC20(asset).forceApprove(address(exchange), actualPayment);

        // Decode the stored maker ask
        OrderStructs.Maker memory maker = abi.decode(order.encodedMakerAsk, (OrderStructs.Maker));

        // Construct taker bid
        OrderStructs.Taker memory taker =
            OrderStructs.Taker({ recipient: recipient, additionalParameters: abi.encode(units, order.pricePerUnit) });

        // Empty merkle tree for single orders
        OrderStructs.MerkleTree memory merkleTree;

        // Execute the trade
        try exchange.executeTakerBid(taker, maker, order.signature, merkleTree) {
            fractionId = hypercertId; // Use hypercertId as placeholder
            emit FractionPurchased(orderId, hypercertId, recipient, units, actualPayment);
        } catch (bytes memory reason) {
            // Reset approval on failure
            IERC20(asset).forceApprove(address(exchange), 0);
            revert ExchangeExecutionFailed(reason);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // IHypercertMarketplace — View Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// @inheritdoc IHypercertMarketplace
    function previewPurchase(uint256 hypercertId, uint256 amount, address asset) external view override returns (uint256) {
        uint256 orderId = activeOrders[hypercertId][asset];
        if (orderId == 0) return 0;

        RegisteredOrder storage order = orders[orderId];
        if (!order.active || order.endTime <= block.timestamp) return 0;

        return amount / order.pricePerUnit;
    }

    /// @inheritdoc IHypercertMarketplace
    function getMinPrice(uint256 hypercertId, address asset) external view override returns (uint256) {
        uint256 orderId = activeOrders[hypercertId][asset];
        if (orderId == 0) return 0;

        RegisteredOrder storage order = orders[orderId];
        if (!order.active || order.endTime <= block.timestamp) return 0;

        return order.pricePerUnit;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Admin Functions
    // ═══════════════════════════════════════════════════════════════════════════

    function setExchange(address _exchange) external onlyOwner {
        exchange = IHypercertExchange(_exchange);
    }

    function setHypercertMinter(address _hypercertMinter) external onlyOwner {
        hypercertMinter = _hypercertMinter;
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    function setMaxBatchSize(uint256 _maxBatchSize) external onlyOwner {
        maxBatchSize = _maxBatchSize;
    }

    function setAllowedCurrency(address currency, bool allowed) external onlyOwner {
        allowedCurrencies[currency] = allowed;
    }

    /// @notice Get the number of orders registered by a seller
    function getSellerOrderCount(address seller) external view returns (uint256) {
        return sellerOrders[seller].length;
    }

    /// @notice Get a seller's order ID at a given index
    function getSellerOrderId(address seller, uint256 index) external view returns (uint256) {
        return sellerOrders[seller][index];
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UUPS Upgrade
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Authorizes an upgrade to a new implementation
    // solhint-disable-next-line no-empty-blocks
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner { }
}
