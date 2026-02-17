// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { HypercertsModule, IMarketplaceAdapter } from "../../src/modules/Hypercerts.sol";
import { OrderStructs } from "../../src/interfaces/IHypercertExchange.sol";
import { MockHypercertMinter } from "../../src/mocks/HypercertExchange.sol";
import { MockHatsModule } from "../helpers/MockHatsModule.sol";

// ═══════════════════════════════════════════════════════════════════════════
// Test Mocks
// ═══════════════════════════════════════════════════════════════════════════

/// @title MockMarketplaceAdapter
/// @notice Simple mock for IMarketplaceAdapter that tracks calls
contract MockMarketplaceAdapter {
    uint256 public nextOrderId = 1;
    bool public shouldRevert;
    uint256[] public deactivatedOrders;
    uint256 public registerCallCount;

    function registerOrder(OrderStructs.Maker calldata, bytes calldata, uint256) external returns (uint256) {
        require(!shouldRevert, "mock revert");
        registerCallCount++;
        return nextOrderId++;
    }

    function batchRegisterOrders(
        OrderStructs.Maker[] calldata,
        bytes[] calldata,
        uint256[] calldata hypercertIds
    )
        external
        returns (uint256[] memory orderIds)
    {
        require(!shouldRevert, "mock revert");
        orderIds = new uint256[](hypercertIds.length);
        for (uint256 i = 0; i < hypercertIds.length; i++) {
            orderIds[i] = nextOrderId++;
        }
    }

    function deactivateOrder(uint256 orderId) external {
        require(!shouldRevert, "mock revert");
        deactivatedOrders.push(orderId);
    }

    function getDeactivatedCount() external view returns (uint256) {
        return deactivatedOrders.length;
    }

    function setShouldRevert(bool v) external {
        shouldRevert = v;
    }
}

/// @title MockGardensModule
/// @notice Simple mock for IGardensModule.getGardenSignalPools

contract MockGardenToken {
    mapping(address account => uint256 balance) private _balances;

    function setBalance(address account, uint256 balance) external {
        _balances[account] = balance;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }
}

contract MockGardensModule {
    mapping(address garden => address[] pools) internal _pools;

    function setGardenSignalPools(address garden, address[] calldata pools) external {
        _pools[garden] = pools;
    }

    function getGardenSignalPools(address garden) external view returns (address[] memory) {
        return _pools[garden];
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Test Contract
// ═══════════════════════════════════════════════════════════════════════════

/// @title HypercertsModuleTest
/// @notice Unit tests for the HypercertsModule contract
contract HypercertsModuleTest is Test {
    HypercertsModule public hypercertsModule;
    MockHypercertMinter public minter;
    MockMarketplaceAdapter public adapter;
    MockGardensModule public gardensModule;
    MockHatsModule public hatsModule;

    address public owner = address(0x1);
    address public garden = address(0x100);
    MockGardenToken public gardenToken;
    address public gardenTokenAddr;
    address public operator = address(0x300);
    address public stranger = address(0x400);
    address public signalPool = address(0x500);

    function setUp() public {
        // Deploy mocks
        minter = new MockHypercertMinter();
        adapter = new MockMarketplaceAdapter();
        gardensModule = new MockGardensModule();
        hatsModule = new MockHatsModule();
        gardenToken = new MockGardenToken();
        gardenTokenAddr = address(gardenToken);
        gardenToken.setBalance(garden, 1);

        // Deploy HypercertsModule behind UUPS proxy
        HypercertsModule impl = new HypercertsModule();
        bytes memory initData = abi.encodeWithSelector(
            HypercertsModule.initialize.selector,
            owner,
            address(minter),
            address(adapter),
            address(gardensModule),
            address(hatsModule),
            gardenTokenAddr
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        hypercertsModule = HypercertsModule(address(proxy));

        // Set up operator role
        hatsModule.setOperator(garden, operator, true);

        // Set up signal pool for the garden
        address[] memory pools = new address[](1);
        pools[0] = signalPool;
        gardensModule.setGardenSignalPools(garden, pools);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Initialization
    // ═══════════════════════════════════════════════════════════════════════════

    function test_initialize_setsFields() public {
        assertEq(hypercertsModule.owner(), owner, "Owner should be set");
        assertEq(hypercertsModule.hypercertMinter(), address(minter), "Minter should be set");
        assertEq(address(hypercertsModule.marketplaceAdapter()), address(adapter), "Adapter should be set");
        assertEq(address(hypercertsModule.gardensModule()), address(gardensModule), "GardensModule should be set");
        assertEq(address(hypercertsModule.hatsModule()), address(hatsModule), "HatsModule should be set");
        assertEq(hypercertsModule.gardenToken(), gardenTokenAddr, "GardenToken should be set");
        assertEq(hypercertsModule.paused(), false, "Should not be paused");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // mintAndRegister
    // ═══════════════════════════════════════════════════════════════════════════

    function test_mintAndRegister_success() public {
        vm.prank(operator);
        uint256 hypercertId = hypercertsModule.mintAndRegister(garden, 1000, bytes32(0), "ipfs://metadata");

        // Verify hypercert was minted (mock returns 1 for first mint)
        assertEq(hypercertId, 1, "Should return first hypercert ID");

        // Verify tracking
        uint256[] memory ids = hypercertsModule.getGardenHypercerts(garden);
        assertEq(ids.length, 1, "Garden should have 1 hypercert");
        assertEq(ids[0], 1, "Should track the hypercert ID");
        assertEq(hypercertsModule.hypercertGarden(1), garden, "Hypercert should map to garden");
    }

    function test_mintAndRegister_onlyOperator() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(HypercertsModule.Unauthorized.selector, stranger));
        hypercertsModule.mintAndRegister(garden, 1000, bytes32(0), "ipfs://metadata");
    }

    function test_mintAndRegister_whenPaused() public {
        vm.prank(owner);
        hypercertsModule.setPaused(true);

        vm.prank(operator);
        vm.expectRevert(HypercertsModule.NotActive.selector);
        hypercertsModule.mintAndRegister(garden, 1000, bytes32(0), "ipfs://metadata");
    }

    function test_mintAndRegister_ownerCanCall() public {
        vm.prank(owner);
        uint256 hypercertId = hypercertsModule.mintAndRegister(garden, 500, bytes32(0), "ipfs://owner-mint");

        assertEq(hypercertId, 1, "Owner should be able to mint");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // listForYield
    // ═══════════════════════════════════════════════════════════════════════════

    function test_listForYield_success() public {
        // First mint a hypercert for the garden
        vm.prank(operator);
        uint256 hypercertId = hypercertsModule.mintAndRegister(garden, 1000, bytes32(0), "ipfs://metadata");

        // Build a maker ask order
        OrderStructs.Maker memory makerAsk = _buildMakerAsk(hypercertId);

        vm.prank(operator);
        uint256 orderId = hypercertsModule.listForYield(garden, hypercertId, makerAsk, "sig");

        assertEq(orderId, 1, "Should return first order ID");
        assertEq(adapter.registerCallCount(), 1, "Should have called registerOrder once");
    }

    function test_listForYield_onlyOperator() public {
        // Mint first
        vm.prank(operator);
        uint256 hypercertId = hypercertsModule.mintAndRegister(garden, 1000, bytes32(0), "ipfs://metadata");

        OrderStructs.Maker memory makerAsk = _buildMakerAsk(hypercertId);

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(HypercertsModule.Unauthorized.selector, stranger));
        hypercertsModule.listForYield(garden, hypercertId, makerAsk, "sig");
    }

    function test_listForYield_revertsInvalidHypercert() public {
        // Try to list a hypercert that doesn't belong to the garden
        OrderStructs.Maker memory makerAsk = _buildMakerAsk(999);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(HypercertsModule.InvalidHypercert.selector, 999));
        hypercertsModule.listForYield(garden, 999, makerAsk, "sig");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // batchListForYield
    // ═══════════════════════════════════════════════════════════════════════════

    function test_batchListForYield_success() public {
        // Mint two hypercerts
        vm.startPrank(operator);
        uint256 id1 = hypercertsModule.mintAndRegister(garden, 1000, bytes32(0), "ipfs://1");
        uint256 id2 = hypercertsModule.mintAndRegister(garden, 2000, bytes32(0), "ipfs://2");

        uint256[] memory ids = new uint256[](2);
        ids[0] = id1;
        ids[1] = id2;

        OrderStructs.Maker[] memory asks = new OrderStructs.Maker[](2);
        asks[0] = _buildMakerAsk(id1);
        asks[1] = _buildMakerAsk(id2);

        bytes[] memory sigs = new bytes[](2);
        sigs[0] = "sig1";
        sigs[1] = "sig2";

        uint256[] memory orderIds = hypercertsModule.batchListForYield(garden, ids, asks, sigs);
        vm.stopPrank();

        assertEq(orderIds.length, 2, "Should return 2 order IDs");
        assertEq(orderIds[0], 1, "First order ID");
        assertEq(orderIds[1], 2, "Second order ID");
    }

    function test_batchListForYield_revertsArrayMismatch() public {
        vm.prank(operator);
        uint256 id1 = hypercertsModule.mintAndRegister(garden, 1000, bytes32(0), "ipfs://1");

        uint256[] memory ids = new uint256[](1);
        ids[0] = id1;

        // Empty asks array — length mismatch
        OrderStructs.Maker[] memory asks = new OrderStructs.Maker[](0);
        bytes[] memory sigs = new bytes[](1);
        sigs[0] = "sig1";

        vm.prank(operator);
        vm.expectRevert(HypercertsModule.ArrayLengthMismatch.selector);
        hypercertsModule.batchListForYield(garden, ids, asks, sigs);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // delistFromYield
    // ═══════════════════════════════════════════════════════════════════════════

    function test_delistFromYield_success() public {
        // Mint and list first
        vm.startPrank(operator);
        uint256 hypercertId = hypercertsModule.mintAndRegister(garden, 1000, bytes32(0), "ipfs://metadata");
        OrderStructs.Maker memory makerAsk = _buildMakerAsk(hypercertId);
        uint256 orderId = hypercertsModule.listForYield(garden, hypercertId, makerAsk, "sig");

        // Delist
        hypercertsModule.delistFromYield(garden, orderId);
        vm.stopPrank();

        assertEq(adapter.getDeactivatedCount(), 1, "Should have deactivated 1 order");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // getGardenHypercerts
    // ═══════════════════════════════════════════════════════════════════════════

    function test_getGardenHypercerts_returnsTracked() public {
        vm.startPrank(operator);
        hypercertsModule.mintAndRegister(garden, 100, bytes32(0), "ipfs://a");
        hypercertsModule.mintAndRegister(garden, 200, bytes32(0), "ipfs://b");
        hypercertsModule.mintAndRegister(garden, 300, bytes32(0), "ipfs://c");
        vm.stopPrank();

        uint256[] memory ids = hypercertsModule.getGardenHypercerts(garden);
        assertEq(ids.length, 3, "Should have 3 hypercerts");
        assertEq(ids[0], 1, "First hypercert ID");
        assertEq(ids[1], 2, "Second hypercert ID");
        assertEq(ids[2], 3, "Third hypercert ID");
    }

    function test_getGardenHypercerts_emptyForUnknownGarden() public {
        uint256[] memory ids = hypercertsModule.getGardenHypercerts(address(0xDEAD));
        assertEq(ids.length, 0, "Unknown garden should have no hypercerts");
    }


    function test_untrackGardenHypercert_removesTrackedId() public {
        vm.startPrank(operator);
        uint256 id1 = hypercertsModule.mintAndRegister(garden, 100, bytes32(0), "ipfs://a");
        uint256 id2 = hypercertsModule.mintAndRegister(garden, 200, bytes32(0), "ipfs://b");

        hypercertsModule.untrackGardenHypercert(garden, id1);
        vm.stopPrank();

        uint256[] memory ids = hypercertsModule.getGardenHypercerts(garden);
        assertEq(ids.length, 1, "Should keep one hypercert after removal");
        assertEq(ids[0], id2, "Remaining hypercert should be second ID");
        assertEq(hypercertsModule.hypercertGarden(id1), address(0), "Reverse mapping should be cleared");
    }

    function test_setters_revertOnZeroAddress() public {
        vm.startPrank(owner);

        vm.expectRevert(HypercertsModule.ZeroAddress.selector);
        hypercertsModule.setHypercertMinter(address(0));

        vm.expectRevert(HypercertsModule.ZeroAddress.selector);
        hypercertsModule.setMarketplaceAdapter(address(0));

        vm.expectRevert(HypercertsModule.ZeroAddress.selector);
        hypercertsModule.setGardensModule(address(0));

        vm.expectRevert(HypercertsModule.ZeroAddress.selector);
        hypercertsModule.setHatsModule(address(0));

        vm.expectRevert(HypercertsModule.ZeroAddress.selector);
        hypercertsModule.setGardenToken(address(0));

        vm.stopPrank();
    }

    function test_mintAndRegister_revertsWhenGardenNotBackedByGardenToken() public {
        address orphanGarden = address(0x999);
        hatsModule.setOperator(orphanGarden, operator, true);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(HypercertsModule.Unauthorized.selector, operator));
        hypercertsModule.mintAndRegister(orphanGarden, 1000, bytes32(0), "ipfs://metadata");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    function _buildMakerAsk(uint256 hypercertId) internal view returns (OrderStructs.Maker memory) {
        uint256[] memory itemIds = new uint256[](1);
        itemIds[0] = hypercertId;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;

        return OrderStructs.Maker({
            quoteType: OrderStructs.QuoteType.MakerAsk,
            globalNonce: 0,
            subsetNonce: 0,
            orderNonce: 0,
            strategyId: 0,
            collectionType: OrderStructs.CollectionType.Hypercert,
            collection: address(minter),
            currency: address(0),
            signer: operator,
            startTime: block.timestamp,
            endTime: block.timestamp + 1 days,
            price: 1 ether,
            itemIds: itemIds,
            amounts: amounts,
            additionalParameters: ""
        });
    }
}
