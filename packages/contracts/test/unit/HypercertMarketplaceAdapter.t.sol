// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { HypercertMarketplaceAdapter } from "../../src/markets/HypercertMarketplaceAdapter.sol";
import { OrderStructs } from "../../src/interfaces/IHypercertExchange.sol";
import { MockHypercertExchange, MockHypercertMinter } from "../../src/mocks/HypercertExchange.sol";

/// @title MockWETH for adapter testing
contract MockWETH is ERC20 {
    constructor() ERC20("Wrapped Ether", "WETH") { }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @title HypercertMarketplaceAdapterTest
/// @notice Unit tests for order registration, validation, and deactivation
contract HypercertMarketplaceAdapterTest is Test {
    HypercertMarketplaceAdapter public adapter;
    MockWETH public weth;
    MockHypercertExchange public mockExchange;
    MockHypercertMinter public mockMinter;

    address public owner = address(0x1);
    address public seller = address(0x10);

    function setUp() public {
        weth = new MockWETH();
        mockExchange = new MockHypercertExchange();
        mockMinter = new MockHypercertMinter();

        // Deploy adapter behind proxy
        HypercertMarketplaceAdapter impl = new HypercertMarketplaceAdapter();
        bytes memory initData = abi.encodeWithSelector(
            HypercertMarketplaceAdapter.initialize.selector, owner, address(mockExchange), address(mockMinter)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        adapter = HypercertMarketplaceAdapter(address(proxy));
    }

    /// @notice Helper: create a valid test maker ask order
    function _createTestMakerAsk(
        address _seller,
        address currency,
        uint256 pricePerUnit
    )
        internal
        view
        returns (OrderStructs.Maker memory)
    {
        uint256[] memory itemIds = new uint256[](1);
        itemIds[0] = 1;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;

        return OrderStructs.Maker({
            quoteType: OrderStructs.QuoteType.MakerAsk,
            globalNonce: 0,
            subsetNonce: 0,
            orderNonce: 0,
            strategyId: 0,
            collectionType: OrderStructs.CollectionType.Hypercert,
            collection: address(mockMinter),
            currency: currency,
            signer: _seller,
            startTime: block.timestamp,
            endTime: block.timestamp + 90 days,
            price: pricePerUnit,
            itemIds: itemIds,
            amounts: amounts,
            additionalParameters: abi.encode(uint256(1), type(uint256).max, uint256(0), true)
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Initialization
    // ═══════════════════════════════════════════════════════════════════════════

    function test_initialize_setsExchange() public {
        assertEq(address(adapter.exchange()), address(mockExchange), "Exchange should be set");
    }

    function test_initialize_setsMinter() public {
        assertEq(adapter.hypercertMinter(), address(mockMinter), "Minter should be set");
    }

    function test_initialize_setsDefaults() public {
        assertEq(adapter.maxBatchSize(), 10, "Max batch size should be 10");
        assertEq(adapter.nextOrderId(), 1, "Next order ID should be 1");
        assertEq(adapter.paused(), false, "Should not be paused");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Register Order — Success
    // ═══════════════════════════════════════════════════════════════════════════

    function test_registerOrder_storesData() public {
        OrderStructs.Maker memory makerAsk = _createTestMakerAsk(seller, address(weth), 1e18);
        bytes memory signature = "test_sig";
        uint256 hypercertId = 42;

        uint256 orderId = adapter.registerOrder(makerAsk, signature, hypercertId);

        assertEq(orderId, 1, "First order ID should be 1");
        assertEq(adapter.nextOrderId(), 2, "Next order ID should be 2");

        // Verify stored order data via public mapping accessor
        (
            uint256 storedHypercertId,
            ,
            ,
            uint256 storedPrice,
            uint256 storedMinUnits,
            ,
            address storedSeller,
            address storedCurrency,
            uint256 storedEndTime,
            bool storedActive
        ) = adapter.orders(orderId);

        assertEq(storedHypercertId, hypercertId, "Hypercert ID should match");
        assertEq(storedPrice, 1e18, "Price should match");
        assertEq(storedMinUnits, 1, "Min units should be 1");
        assertEq(storedSeller, seller, "Seller should match");
        assertEq(storedCurrency, address(weth), "Currency should match");
        assertEq(storedEndTime, block.timestamp + 90 days, "End time should match");
        assertTrue(storedActive, "Order should be active");

        // Verify active order mapping
        assertEq(adapter.activeOrders(hypercertId, address(weth)), orderId, "Active order should be set");

        // Verify seller order tracking
        assertEq(adapter.getSellerOrderCount(seller), 1, "Seller should have 1 order");
        assertEq(adapter.getSellerOrderId(seller, 0), orderId, "Seller's first order should match");
    }

    function test_registerOrder_emitsEvent() public {
        OrderStructs.Maker memory makerAsk = _createTestMakerAsk(seller, address(weth), 1e18);

        vm.expectEmit(true, true, true, true);
        emit HypercertMarketplaceAdapter.OrderRegistered(1, 42, seller, address(weth), 1e18, block.timestamp + 90 days);

        adapter.registerOrder(makerAsk, "sig", 42);
    }

    function test_batchRegisterOrders_success() public {
        OrderStructs.Maker[] memory asks = new OrderStructs.Maker[](3);
        bytes[] memory sigs = new bytes[](3);
        uint256[] memory ids = new uint256[](3);

        for (uint256 i = 0; i < 3; i++) {
            asks[i] = _createTestMakerAsk(seller, address(weth), (i + 1) * 1e18);
            // Use different currencies to avoid DuplicateActiveOrder
            if (i == 1) {
                MockWETH dai = new MockWETH();
                asks[i].currency = address(dai);
            }
            if (i == 2) {
                MockWETH usdc = new MockWETH();
                asks[i].currency = address(usdc);
            }
            sigs[i] = "sig";
            ids[i] = i + 100;
        }

        uint256[] memory orderIds = adapter.batchRegisterOrders(asks, sigs, ids);

        assertEq(orderIds.length, 3, "Should return 3 order IDs");
        assertEq(orderIds[0], 1, "First order ID should be 1");
        assertEq(orderIds[1], 2, "Second order ID should be 2");
        assertEq(orderIds[2], 3, "Third order ID should be 3");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Register Order — Validation Errors
    // ═══════════════════════════════════════════════════════════════════════════

    function test_registerOrder_revertsOnInvalidQuoteType() public {
        OrderStructs.Maker memory makerAsk = _createTestMakerAsk(seller, address(weth), 1e18);
        makerAsk.quoteType = OrderStructs.QuoteType.MakerBid; // Wrong type

        vm.expectRevert(HypercertMarketplaceAdapter.InvalidOrder.selector);
        adapter.registerOrder(makerAsk, "sig", 42);
    }

    function test_registerOrder_revertsOnWrongCollection() public {
        OrderStructs.Maker memory makerAsk = _createTestMakerAsk(seller, address(weth), 1e18);
        makerAsk.collection = address(0xDEAD); // Wrong collection

        vm.expectRevert(HypercertMarketplaceAdapter.InvalidOrder.selector);
        adapter.registerOrder(makerAsk, "sig", 42);
    }

    function test_registerOrder_revertsOnExpiredOrder() public {
        OrderStructs.Maker memory makerAsk = _createTestMakerAsk(seller, address(weth), 1e18);
        makerAsk.endTime = block.timestamp; // Already expired (endTime <= block.timestamp)

        vm.expectRevert(HypercertMarketplaceAdapter.OrderExpired.selector);
        adapter.registerOrder(makerAsk, "sig", 42);
    }

    function test_registerOrder_revertsOnDuplicateActiveOrder() public {
        OrderStructs.Maker memory makerAsk = _createTestMakerAsk(seller, address(weth), 1e18);

        adapter.registerOrder(makerAsk, "sig", 42);

        // Second order for same hypercertId+currency should revert
        vm.expectRevert(HypercertMarketplaceAdapter.DuplicateActiveOrder.selector);
        adapter.registerOrder(makerAsk, "sig2", 42);
    }

    function test_registerOrder_revertsWhenPaused() public {
        vm.prank(owner);
        adapter.setPaused(true);

        OrderStructs.Maker memory makerAsk = _createTestMakerAsk(seller, address(weth), 1e18);
        vm.expectRevert(HypercertMarketplaceAdapter.ContractPaused.selector);
        adapter.registerOrder(makerAsk, "sig", 42);
    }

    function test_registerOrder_autoDeactivatesExpired() public {
        OrderStructs.Maker memory makerAsk = _createTestMakerAsk(seller, address(weth), 1e18);
        makerAsk.endTime = block.timestamp + 1 hours; // Short-lived order

        adapter.registerOrder(makerAsk, "sig", 42);

        // Warp past expiry
        vm.warp(block.timestamp + 2 hours);

        // New order should succeed (auto-deactivates expired one)
        OrderStructs.Maker memory newMakerAsk = _createTestMakerAsk(seller, address(weth), 2e18);
        uint256 newOrderId = adapter.registerOrder(newMakerAsk, "sig2", 42);

        assertEq(newOrderId, 2, "New order should get ID 2");
        assertEq(adapter.activeOrders(42, address(weth)), 2, "Active order should be updated");

        // Old order should be deactivated
        (,,,,,,,,, bool oldActive) = adapter.orders(1);
        assertFalse(oldActive, "Old order should be deactivated");
    }

    function test_batchRegisterOrders_revertsOnArrayLengthMismatch() public {
        OrderStructs.Maker[] memory asks = new OrderStructs.Maker[](2);
        bytes[] memory sigs = new bytes[](1); // Mismatch
        uint256[] memory ids = new uint256[](2);

        vm.expectRevert(HypercertMarketplaceAdapter.ArrayLengthMismatch.selector);
        adapter.batchRegisterOrders(asks, sigs, ids);
    }

    function test_batchRegisterOrders_revertsOnBatchTooLarge() public {
        uint256 batchSize = 11; // Exceeds maxBatchSize of 10
        OrderStructs.Maker[] memory asks = new OrderStructs.Maker[](batchSize);
        bytes[] memory sigs = new bytes[](batchSize);
        uint256[] memory ids = new uint256[](batchSize);

        vm.expectRevert(HypercertMarketplaceAdapter.BatchTooLarge.selector);
        adapter.batchRegisterOrders(asks, sigs, ids);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Deactivate Order
    // ═══════════════════════════════════════════════════════════════════════════

    function test_deactivateOrder_bySeller() public {
        OrderStructs.Maker memory makerAsk = _createTestMakerAsk(seller, address(weth), 1e18);
        uint256 orderId = adapter.registerOrder(makerAsk, "sig", 42);

        vm.prank(seller);
        adapter.deactivateOrder(orderId);

        (,,,,,,,,, bool active) = adapter.orders(orderId);
        assertFalse(active, "Order should be deactivated");
        assertEq(adapter.activeOrders(42, address(weth)), 0, "Active order mapping should be cleared");
    }

    function test_deactivateOrder_byOwner() public {
        OrderStructs.Maker memory makerAsk = _createTestMakerAsk(seller, address(weth), 1e18);
        uint256 orderId = adapter.registerOrder(makerAsk, "sig", 42);

        vm.prank(owner);
        adapter.deactivateOrder(orderId);

        (,,,,,,,,, bool active) = adapter.orders(orderId);
        assertFalse(active, "Order should be deactivated by owner");
    }

    function test_deactivateOrder_emitsEvent() public {
        OrderStructs.Maker memory makerAsk = _createTestMakerAsk(seller, address(weth), 1e18);
        uint256 orderId = adapter.registerOrder(makerAsk, "sig", 42);

        vm.expectEmit(true, true, false, true);
        emit HypercertMarketplaceAdapter.OrderDeactivated(orderId, seller);

        vm.prank(seller);
        adapter.deactivateOrder(orderId);
    }

    function test_deactivateOrder_revertsUnauthorized() public {
        OrderStructs.Maker memory makerAsk = _createTestMakerAsk(seller, address(weth), 1e18);
        uint256 orderId = adapter.registerOrder(makerAsk, "sig", 42);

        vm.prank(address(0x999));
        vm.expectRevert(HypercertMarketplaceAdapter.Unauthorized.selector);
        adapter.deactivateOrder(orderId);
    }

    function test_deactivateOrder_revertsOnInactiveOrder() public {
        OrderStructs.Maker memory makerAsk = _createTestMakerAsk(seller, address(weth), 1e18);
        uint256 orderId = adapter.registerOrder(makerAsk, "sig", 42);

        vm.prank(seller);
        adapter.deactivateOrder(orderId);

        // Second deactivation should revert
        vm.prank(seller);
        vm.expectRevert(HypercertMarketplaceAdapter.InvalidOrder.selector);
        adapter.deactivateOrder(orderId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Admin Functions
    // ═══════════════════════════════════════════════════════════════════════════

    function test_setExchange_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        adapter.setExchange(address(0x42));
    }

    function test_setHypercertMinter_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        adapter.setHypercertMinter(address(0x42));
    }

    function test_setPaused_onlyOwner() public {
        vm.prank(address(0x999));
        vm.expectRevert("Ownable: caller is not the owner");
        adapter.setPaused(true);
    }

    function test_setMaxBatchSize_onlyOwner() public {
        vm.prank(owner);
        adapter.setMaxBatchSize(20);
        assertEq(adapter.maxBatchSize(), 20, "Max batch size should be updated");
    }

    function test_setAllowedCurrency_onlyOwner() public {
        vm.prank(owner);
        adapter.setAllowedCurrency(address(weth), true);
        assertTrue(adapter.allowedCurrencies(address(weth)), "Currency should be allowed");
    }
}

/// @title HypercertMarketplaceAdapterPurchaseTest
/// @notice Tests for buyFraction execution, payment flows, and error paths
contract HypercertMarketplaceAdapterPurchaseTest is Test {
    HypercertMarketplaceAdapter public adapter;
    MockWETH public weth;
    MockHypercertExchange public mockExchange;
    MockHypercertMinter public mockMinter;

    address public owner = address(0x1);
    address public seller = address(0x10);
    address public buyer = address(0x20);
    address public recipient = address(0x30);

    uint256 public constant PRICE_PER_UNIT = 1e18;
    uint256 public constant HYPERCERT_ID = 42;

    function setUp() public {
        weth = new MockWETH();
        mockExchange = new MockHypercertExchange();
        mockMinter = new MockHypercertMinter();

        // Deploy adapter behind proxy
        HypercertMarketplaceAdapter impl = new HypercertMarketplaceAdapter();
        bytes memory initData = abi.encodeWithSelector(
            HypercertMarketplaceAdapter.initialize.selector, owner, address(mockExchange), address(mockMinter)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        adapter = HypercertMarketplaceAdapter(address(proxy));
    }

    /// @notice Helper: create and register a test order, fund the buyer
    function _setupOrder(uint256 pricePerUnit, uint256 buyerFunds) internal returns (uint256 orderId) {
        uint256[] memory itemIds = new uint256[](1);
        itemIds[0] = 1;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;

        OrderStructs.Maker memory makerAsk = OrderStructs.Maker({
            quoteType: OrderStructs.QuoteType.MakerAsk,
            globalNonce: 0,
            subsetNonce: 0,
            orderNonce: 0,
            strategyId: 0,
            collectionType: OrderStructs.CollectionType.Hypercert,
            collection: address(mockMinter),
            currency: address(weth),
            signer: seller,
            startTime: block.timestamp,
            endTime: block.timestamp + 90 days,
            price: pricePerUnit,
            itemIds: itemIds,
            amounts: amounts,
            additionalParameters: abi.encode(uint256(1), type(uint256).max, uint256(0), true)
        });

        orderId = adapter.registerOrder(makerAsk, "test_signature", HYPERCERT_ID);

        // Fund the buyer and approve the adapter
        weth.mint(buyer, buyerFunds);
        vm.prank(buyer);
        weth.approve(address(adapter), buyerFunds);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Buy Fraction — Success Paths
    // ═══════════════════════════════════════════════════════════════════════════

    function test_buyFraction_fullPurchase() public {
        uint256 pricePerUnit = 1e18;
        uint256 amount = 5e18; // 5 units
        _setupOrder(pricePerUnit, amount);

        vm.prank(buyer);
        uint256 fractionId = adapter.buyFraction(HYPERCERT_ID, amount, address(weth), recipient);

        // Verify fraction ID returned
        assertEq(fractionId, HYPERCERT_ID, "Fraction ID should be hypercert ID");

        // Verify the exchange received the execution
        assertEq(mockExchange.getExecutionCount(), 1, "Should have 1 execution");

        // Verify exchange recorded correct taker params
        (address recordedRecipient, uint256 recordedUnits, uint256 recordedPrice, address recordedSeller,,) =
            mockExchange.executions(0);
        assertEq(recordedRecipient, recipient, "Recipient should match");
        assertEq(recordedUnits, 5, "Should buy 5 units");
        assertEq(recordedPrice, pricePerUnit, "Price per unit should match");
        assertEq(recordedSeller, seller, "Seller should match");
    }

    function test_buyFraction_partialPurchase() public {
        uint256 pricePerUnit = 2e18;
        uint256 amount = 3e18; // 3e18 / 2e18 = 1 unit (partial, not enough for 2)
        _setupOrder(pricePerUnit, amount);

        vm.prank(buyer);
        adapter.buyFraction(HYPERCERT_ID, amount, address(weth), recipient);

        (, uint256 recordedUnits,,,,) = mockExchange.executions(0);
        assertEq(recordedUnits, 1, "Should buy 1 unit (floor division)");

        // Only 2e18 should have been pulled (1 unit * 2e18 price)
        assertEq(weth.balanceOf(buyer), 1e18, "Buyer should have 1e18 remaining (3e18 - 2e18)");
    }

    function test_buyFraction_paymentFlowCorrect() public {
        uint256 pricePerUnit = 1e18;
        uint256 amount = 3e18;
        _setupOrder(pricePerUnit, amount);

        uint256 buyerBefore = weth.balanceOf(buyer);
        uint256 sellerBefore = weth.balanceOf(seller);

        vm.prank(buyer);
        adapter.buyFraction(HYPERCERT_ID, amount, address(weth), recipient);

        // Payment flow: buyer -> adapter -> exchange -> seller
        // MockHypercertExchange transfers from adapter to seller
        assertEq(weth.balanceOf(buyer), buyerBefore - amount, "Buyer should pay full amount");
        assertEq(weth.balanceOf(seller), sellerBefore + amount, "Seller should receive payment");
        assertEq(weth.balanceOf(address(adapter)), 0, "Adapter should not hold funds");
    }

    function test_buyFraction_recipientCorrect() public {
        _setupOrder(1e18, 5e18);

        vm.prank(buyer);
        adapter.buyFraction(HYPERCERT_ID, 5e18, address(weth), recipient);

        (address recordedRecipient,,,,,) = mockExchange.executions(0);
        assertEq(recordedRecipient, recipient, "Taker recipient should be passed through");
    }

    function test_buyFraction_emitsEvent() public {
        _setupOrder(1e18, 5e18);

        vm.expectEmit(true, true, true, true);
        emit HypercertMarketplaceAdapter.FractionPurchased(1, HYPERCERT_ID, recipient, 5, 5e18);

        vm.prank(buyer);
        adapter.buyFraction(HYPERCERT_ID, 5e18, address(weth), recipient);
    }

    function test_buyFraction_multiplePurchasesSameOrder() public {
        _setupOrder(1e18, 10e18);

        // First purchase: 3 units
        vm.prank(buyer);
        adapter.buyFraction(HYPERCERT_ID, 3e18, address(weth), recipient);

        // Second purchase: 2 units (order is still active)
        vm.prank(buyer);
        adapter.buyFraction(HYPERCERT_ID, 2e18, address(weth), recipient);

        assertEq(mockExchange.getExecutionCount(), 2, "Should have 2 executions");
        assertEq(weth.balanceOf(buyer), 5e18, "Buyer should have 5e18 remaining (10e18 - 3e18 - 2e18)");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Buy Fraction — Error Paths
    // ═══════════════════════════════════════════════════════════════════════════

    function test_buyFraction_revertsOnZeroUnits() public {
        _setupOrder(10e18, 5e18); // price=10e18, amount=5e18 -> 0 units

        vm.prank(buyer);
        vm.expectRevert(HypercertMarketplaceAdapter.InsufficientUnits.selector);
        adapter.buyFraction(HYPERCERT_ID, 5e18, address(weth), recipient);
    }

    function test_buyFraction_revertsOnExpiredOrder() public {
        _setupOrder(1e18, 5e18);

        // Warp past order expiry
        vm.warp(block.timestamp + 91 days);

        vm.prank(buyer);
        vm.expectRevert(HypercertMarketplaceAdapter.OrderExpired.selector);
        adapter.buyFraction(HYPERCERT_ID, 5e18, address(weth), recipient);
    }

    function test_buyFraction_revertsOnInactiveOrder() public {
        uint256 orderId = _setupOrder(1e18, 5e18);

        // Deactivate the order
        vm.prank(seller);
        adapter.deactivateOrder(orderId);

        vm.prank(buyer);
        vm.expectRevert(HypercertMarketplaceAdapter.NoActiveOrder.selector);
        adapter.buyFraction(HYPERCERT_ID, 5e18, address(weth), recipient);
    }

    function test_buyFraction_revertsOnNoActiveOrder() public {
        // No order registered
        weth.mint(buyer, 5e18);
        vm.prank(buyer);
        weth.approve(address(adapter), 5e18);

        vm.prank(buyer);
        vm.expectRevert(HypercertMarketplaceAdapter.NoActiveOrder.selector);
        adapter.buyFraction(99, 5e18, address(weth), recipient);
    }

    function test_buyFraction_revertsOnExchangeRevert() public {
        _setupOrder(1e18, 5e18);

        mockExchange.setShouldRevert(true);

        vm.prank(buyer);
        vm.expectRevert(); // ExchangeExecutionFailed wrapping the mock revert
        adapter.buyFraction(HYPERCERT_ID, 5e18, address(weth), recipient);
    }

    function test_buyFraction_revertsWhenPaused() public {
        _setupOrder(1e18, 5e18);

        vm.prank(owner);
        adapter.setPaused(true);

        vm.prank(buyer);
        vm.expectRevert(HypercertMarketplaceAdapter.ContractPaused.selector);
        adapter.buyFraction(HYPERCERT_ID, 5e18, address(weth), recipient);
    }

    function test_buyFraction_exchangeRevert_noFundsLost() public {
        _setupOrder(1e18, 5e18);
        mockExchange.setShouldRevert(true);

        uint256 buyerBefore = weth.balanceOf(buyer);

        vm.prank(buyer);
        vm.expectRevert();
        adapter.buyFraction(HYPERCERT_ID, 5e18, address(weth), recipient);

        // Buyer should still have all funds (revert unwound the transferFrom)
        assertEq(weth.balanceOf(buyer), buyerBefore, "Buyer should not lose funds on exchange revert");
    }
}

/// @title HypercertMarketplaceAdapterViewTest
/// @notice Tests for previewPurchase and getMinPrice view functions
contract HypercertMarketplaceAdapterViewTest is Test {
    HypercertMarketplaceAdapter public adapter;
    MockWETH public weth;
    MockHypercertExchange public mockExchange;
    MockHypercertMinter public mockMinter;

    address public owner = address(0x1);
    address public seller = address(0x10);
    uint256 public constant HYPERCERT_ID = 42;

    function setUp() public {
        weth = new MockWETH();
        mockExchange = new MockHypercertExchange();
        mockMinter = new MockHypercertMinter();

        HypercertMarketplaceAdapter impl = new HypercertMarketplaceAdapter();
        bytes memory initData = abi.encodeWithSelector(
            HypercertMarketplaceAdapter.initialize.selector, owner, address(mockExchange), address(mockMinter)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        adapter = HypercertMarketplaceAdapter(address(proxy));
    }

    function _registerTestOrder(uint256 pricePerUnit) internal returns (uint256 orderId) {
        uint256[] memory itemIds = new uint256[](1);
        itemIds[0] = 1;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;

        OrderStructs.Maker memory makerAsk = OrderStructs.Maker({
            quoteType: OrderStructs.QuoteType.MakerAsk,
            globalNonce: 0,
            subsetNonce: 0,
            orderNonce: 0,
            strategyId: 0,
            collectionType: OrderStructs.CollectionType.Hypercert,
            collection: address(mockMinter),
            currency: address(weth),
            signer: seller,
            startTime: block.timestamp,
            endTime: block.timestamp + 90 days,
            price: pricePerUnit,
            itemIds: itemIds,
            amounts: amounts,
            additionalParameters: abi.encode(uint256(1), type(uint256).max, uint256(0), true)
        });

        orderId = adapter.registerOrder(makerAsk, "sig", HYPERCERT_ID);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // previewPurchase
    // ═══════════════════════════════════════════════════════════════════════════

    function test_previewPurchase_returnsCorrectUnits() public {
        _registerTestOrder(2e18);

        uint256 units = adapter.previewPurchase(HYPERCERT_ID, 10e18, address(weth));
        assertEq(units, 5, "10e18 / 2e18 = 5 units");
    }

    function test_previewPurchase_returnsZeroForInactive() public {
        uint256 orderId = _registerTestOrder(1e18);

        vm.prank(seller);
        adapter.deactivateOrder(orderId);

        uint256 units = adapter.previewPurchase(HYPERCERT_ID, 10e18, address(weth));
        assertEq(units, 0, "Should return 0 for inactive order");
    }

    function test_previewPurchase_returnsZeroForExpired() public {
        _registerTestOrder(1e18);

        vm.warp(block.timestamp + 91 days);

        uint256 units = adapter.previewPurchase(HYPERCERT_ID, 10e18, address(weth));
        assertEq(units, 0, "Should return 0 for expired order");
    }

    function test_previewPurchase_returnsZeroForNoOrder() public {
        uint256 units = adapter.previewPurchase(99, 10e18, address(weth));
        assertEq(units, 0, "Should return 0 when no order exists");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // getMinPrice
    // ═══════════════════════════════════════════════════════════════════════════

    function test_getMinPrice_returnsPrice() public {
        _registerTestOrder(3e18);

        uint256 price = adapter.getMinPrice(HYPERCERT_ID, address(weth));
        assertEq(price, 3e18, "Should return the price per unit");
    }

    function test_getMinPrice_returnsZeroForNoOrder() public {
        uint256 price = adapter.getMinPrice(99, address(weth));
        assertEq(price, 0, "Should return 0 when no order exists");
    }

    function test_getMinPrice_returnsZeroForExpired() public {
        _registerTestOrder(3e18);

        vm.warp(block.timestamp + 91 days);

        uint256 price = adapter.getMinPrice(HYPERCERT_ID, address(weth));
        assertEq(price, 0, "Should return 0 for expired order");
    }

    function test_getMinPrice_returnsZeroForInactive() public {
        uint256 orderId = _registerTestOrder(3e18);

        vm.prank(seller);
        adapter.deactivateOrder(orderId);

        uint256 price = adapter.getMinPrice(HYPERCERT_ID, address(weth));
        assertEq(price, 0, "Should return 0 for inactive order");
    }
}
