// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { HypercertsModule } from "../../src/modules/Hypercerts.sol";
import { OrderStructs } from "../../src/interfaces/IHypercertExchange.sol";
import { MockHypercertMinter } from "../../src/mocks/HypercertExchange.sol";
import { MockHatsModule } from "../helpers/MockHatsModule.sol";

/// @title MockMarketplaceAdapter — Tracks registerOrder / deactivateOrder calls
contract MockMarketplaceAdapter {
    uint256 private _nextOrderId = 1;

    struct RegisterCall {
        uint256 hypercertId;
        uint256 orderId;
    }

    RegisterCall[] public registerCalls;
    uint256[] public deactivatedOrders;

    function registerOrder(
        OrderStructs.Maker calldata,
        bytes calldata,
        uint256 hypercertId
    )
        external
        returns (uint256 orderId)
    {
        orderId = _nextOrderId++;
        registerCalls.push(RegisterCall({ hypercertId: hypercertId, orderId: orderId }));
    }

    function batchRegisterOrders(
        OrderStructs.Maker[] calldata,
        bytes[] calldata,
        uint256[] calldata hypercertIds
    )
        external
        returns (uint256[] memory orderIds)
    {
        orderIds = new uint256[](hypercertIds.length);
        for (uint256 i = 0; i < hypercertIds.length; i++) {
            uint256 orderId = _nextOrderId++;
            orderIds[i] = orderId;
            registerCalls.push(RegisterCall({ hypercertId: hypercertIds[i], orderId: orderId }));
        }
    }

    function deactivateOrder(uint256 orderId) external {
        deactivatedOrders.push(orderId);
    }

    function getRegisterCallCount() external view returns (uint256) {
        return registerCalls.length;
    }

    function getDeactivatedCount() external view returns (uint256) {
        return deactivatedOrders.length;
    }
}

/// @title HypercertsIntegrationTest
/// @notice Integration tests for HypercertsModule + MarketplaceAdapter flows.
///         Verifies mint→register, list→delist, batch operations, paused state, and
///         per-garden tracking isolation.
/// @dev Uses mocks only — NO fork required.
contract HypercertsIntegrationTest is Test {
    // ═══════════════════════════════════════════════════════════════════════════
    // Events
    // ═══════════════════════════════════════════════════════════════════════════

    event HypercertMintedAndRegistered(address indexed garden, uint256 indexed hypercertId, address pool);
    event HypercertListedForYield(address indexed garden, uint256 indexed hypercertId, uint256 orderId);
    event HypercertDelistedFromYield(address indexed garden, uint256 orderId);

    // ═══════════════════════════════════════════════════════════════════════════
    // State
    // ═══════════════════════════════════════════════════════════════════════════

    HypercertsModule internal module;
    MockHatsModule internal hatsModule;
    MockHypercertMinter internal minter;
    MockMarketplaceAdapter internal adapter;

    address internal constant OWNER = address(0xA1);
    address internal constant OPERATOR = address(0xA2);
    address internal constant GARDEN_A = address(0xA3);
    address internal constant GARDEN_B = address(0xA4);
    address internal constant GARDEN_TOKEN = address(0xA5);

    function setUp() public {
        hatsModule = new MockHatsModule();
        minter = new MockHypercertMinter();
        adapter = new MockMarketplaceAdapter();

        // Deploy HypercertsModule via proxy
        HypercertsModule impl = new HypercertsModule();
        bytes memory initData = abi.encodeWithSelector(
            HypercertsModule.initialize.selector,
            OWNER,
            address(minter),
            address(adapter),
            address(0), // gardensModule (not needed for these tests)
            address(hatsModule),
            GARDEN_TOKEN
        );
        module = HypercertsModule(address(new ERC1967Proxy(address(impl), initData)));

        // Configure operator roles
        hatsModule.setOperator(GARDEN_A, OPERATOR, true);
        hatsModule.setOperator(GARDEN_B, OPERATOR, true);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Helper: Build a minimal MakerAsk for listing tests
    // ═══════════════════════════════════════════════════════════════════════════

    function _buildMakerAsk() internal view returns (OrderStructs.Maker memory) {
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
            collectionType: OrderStructs.CollectionType.ERC721,
            collection: address(minter),
            currency: address(0xBEEF),
            signer: OPERATOR,
            startTime: block.timestamp,
            endTime: block.timestamp + 30 days,
            price: 1e18,
            itemIds: itemIds,
            amounts: amounts,
            additionalParameters: abi.encode(uint256(1), uint256(100), uint256(0), false)
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Mint and register calls adapter
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice mintAndRegister mints via HypercertMinter and tracks in garden
    function test_mintAndRegisterCallsAdapter() public {
        vm.prank(OPERATOR);
        uint256 hypercertId = module.mintAndRegister(GARDEN_A, 1000, bytes32(0), "ipfs://QmTest");

        // Verify minter was called
        assertEq(minter.getMintCount(), 1, "Minter should have 1 create call");
        (address account, uint256 units,,,) = minter.mints(0);
        assertEq(account, GARDEN_A, "Minter account should be garden");
        assertEq(units, 1000, "Minter totalUnits should match");

        // Verify garden tracking
        uint256[] memory gardenHypercerts = module.getGardenHypercerts(GARDEN_A);
        assertEq(gardenHypercerts.length, 1, "Garden should have 1 hypercert");
        assertEq(gardenHypercerts[0], hypercertId, "Tracked ID should match");
        assertEq(module.hypercertGarden(hypercertId), GARDEN_A, "Reverse mapping should point to garden");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: List for yield registers order
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice listForYield calls adapter.registerOrder and emits event
    function test_listForYieldRegistersOrder() public {
        // First mint a hypercert
        vm.prank(OPERATOR);
        uint256 hypercertId = module.mintAndRegister(GARDEN_A, 1000, bytes32(0), "ipfs://QmList");

        // List for yield
        OrderStructs.Maker memory makerAsk = _buildMakerAsk();
        bytes memory sig = hex"deadbeef";

        vm.prank(OPERATOR);
        vm.expectEmit(true, true, false, true);
        emit HypercertListedForYield(GARDEN_A, hypercertId, 1);
        uint256 orderId = module.listForYield(GARDEN_A, hypercertId, makerAsk, sig);

        // Verify adapter received the call
        assertEq(adapter.getRegisterCallCount(), 1, "Adapter should have 1 register call");
        (uint256 registeredHypercertId,) = adapter.registerCalls(0);
        assertEq(registeredHypercertId, hypercertId, "Registered hypercert should match");
        assertTrue(orderId > 0, "Order ID should be non-zero");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Delist cancels order
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice delistFromYield calls adapter.deactivateOrder
    function test_delistCancelsOrder() public {
        // Mint + list
        vm.prank(OPERATOR);
        uint256 hypercertId = module.mintAndRegister(GARDEN_A, 1000, bytes32(0), "ipfs://QmDelist");

        OrderStructs.Maker memory makerAsk = _buildMakerAsk();
        vm.prank(OPERATOR);
        uint256 orderId = module.listForYield(GARDEN_A, hypercertId, makerAsk, hex"deadbeef");

        // Delist
        vm.prank(OPERATOR);
        vm.expectEmit(true, false, false, true);
        emit HypercertDelistedFromYield(GARDEN_A, orderId);
        module.delistFromYield(GARDEN_A, orderId);

        // Verify deactivation
        assertEq(adapter.getDeactivatedCount(), 1, "Adapter should have 1 deactivation");
        assertEq(adapter.deactivatedOrders(0), orderId, "Deactivated order should match");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Batch mint and register
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Multiple mintAndRegister calls track all hypercerts per garden
    function test_batchMintAndRegister() public {
        vm.startPrank(OPERATOR);
        uint256 id1 = module.mintAndRegister(GARDEN_A, 500, bytes32(0), "ipfs://QmBatch1");
        uint256 id2 = module.mintAndRegister(GARDEN_A, 1000, bytes32(0), "ipfs://QmBatch2");
        uint256 id3 = module.mintAndRegister(GARDEN_A, 2000, bytes32(0), "ipfs://QmBatch3");
        vm.stopPrank();

        // Verify all tracked
        uint256[] memory gardenHypercerts = module.getGardenHypercerts(GARDEN_A);
        assertEq(gardenHypercerts.length, 3, "Garden should have 3 hypercerts");
        assertEq(gardenHypercerts[0], id1, "First ID should match");
        assertEq(gardenHypercerts[1], id2, "Second ID should match");
        assertEq(gardenHypercerts[2], id3, "Third ID should match");

        // Verify minter received 3 calls
        assertEq(minter.getMintCount(), 3, "Minter should have 3 create calls");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 5: Paused module blocks mint
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Paused state reverts on mintAndRegister
    function test_pausedModuleBlocksMint() public {
        // Pause the module (owner only)
        vm.prank(OWNER);
        module.setPaused(true);

        // Operator tries to mint — should revert with NotActive
        vm.prank(OPERATOR);
        vm.expectRevert(HypercertsModule.NotActive.selector);
        module.mintAndRegister(GARDEN_A, 1000, bytes32(0), "ipfs://QmPaused");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 6: Garden tracking across gardens (isolation)
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Hypercerts in garden A are not visible in garden B tracking
    function test_gardenTrackingAcrossGardens() public {
        // Mint for garden A
        vm.prank(OPERATOR);
        uint256 idA = module.mintAndRegister(GARDEN_A, 500, bytes32(0), "ipfs://QmGardenA");

        // Mint for garden B
        vm.prank(OPERATOR);
        uint256 idB = module.mintAndRegister(GARDEN_B, 1000, bytes32(0), "ipfs://QmGardenB");

        // Verify isolation
        uint256[] memory gardenAHypercerts = module.getGardenHypercerts(GARDEN_A);
        uint256[] memory gardenBHypercerts = module.getGardenHypercerts(GARDEN_B);

        assertEq(gardenAHypercerts.length, 1, "Garden A should have 1 hypercert");
        assertEq(gardenBHypercerts.length, 1, "Garden B should have 1 hypercert");
        assertEq(gardenAHypercerts[0], idA, "Garden A hypercert ID should match");
        assertEq(gardenBHypercerts[0], idB, "Garden B hypercert ID should match");

        // Reverse mappings
        assertEq(module.hypercertGarden(idA), GARDEN_A, "ID A should map to garden A");
        assertEq(module.hypercertGarden(idB), GARDEN_B, "ID B should map to garden B");

        // Cross-garden listing should fail (garden B operator cannot list garden A's hypercert)
        OrderStructs.Maker memory makerAsk = _buildMakerAsk();
        vm.prank(OPERATOR);
        vm.expectRevert(abi.encodeWithSelector(HypercertsModule.InvalidHypercert.selector, idA));
        module.listForYield(GARDEN_B, idA, makerAsk, hex"deadbeef");
    }
}
