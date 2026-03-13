// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import { Test } from "forge-std/Test.sol";
import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import { HypercertMarketplaceAdapter } from "../../src/markets/HypercertMarketplaceAdapter.sol";
import { HypercertsModule } from "../../src/modules/Hypercerts.sol";
import { OrderStructs } from "../../src/interfaces/IHypercertExchange.sol";

/// @title ArbitrumHypercertsForkTest
/// @notice Fork tests verifying HypercertMarketplaceAdapter against real HypercertExchange on Arbitrum.
/// @dev Standalone test (like ArbitrumYieldSplitter.t.sol). Deploys our adapter wired to the
/// real HypercertExchange at the known Arbitrum address. Tests adapter-local operations
/// (order registration, deactivation, batch ops) and validates that buyFraction correctly
/// attempts the real exchange (which rejects invalid signatures — testing error handling).
contract ArbitrumHypercertsForkTest is Test {
    /// @notice Real HypercertExchange on Arbitrum (from 42161-latest.json)
    address internal constant HYPERCERT_EXCHANGE = 0xcE8fa09562f07c23B9C21b5d0A29a293F8a8BC83;

    /// @notice Real HypercertMinter on Arbitrum
    address internal constant HYPERCERT_MINTER = 0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07;

    /// @notice Real TransferManager on Arbitrum
    address internal constant TRANSFER_MANAGER = 0x658c1695DCb298E57e6144F6dA3e83DdCF5e2BaB;

    /// @notice Real HypercertFractionOffer strategy on Arbitrum
    address internal constant STRATEGY_FRACTION = 0xECaB24CADe0261fc6513ca13bb3d10f760AF3da8;

    /// @notice Real WETH on Arbitrum
    address internal constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;

    HypercertMarketplaceAdapter public adapter;
    HypercertsModule public hypercertsModule;

    address public owner = address(this);
    address public seller = makeAddr("seller");

    // ═══════════════════════════════════════════════════════════════════════════
    // Fork Helper
    // ═══════════════════════════════════════════════════════════════════════════

    function _tryFork() internal returns (bool) {
        string memory rpc;
        try vm.envString("ARBITRUM_RPC_URL") returns (string memory value) {
            rpc = value;
        } catch {
            try vm.envString("ARBITRUM_RPC") returns (string memory fallback_) {
                rpc = fallback_;
            } catch {
                return false;
            }
        }
        if (bytes(rpc).length == 0) return false;

        uint256 forkId = vm.createFork(rpc);
        vm.selectFork(forkId);
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Deployment Helpers
    // ═══════════════════════════════════════════════════════════════════════════

    /// @notice Deploy adapter via UUPS proxy pointing to real exchange
    function _deployAdapterOnFork() internal {
        HypercertMarketplaceAdapter impl = new HypercertMarketplaceAdapter();
        bytes memory initData = abi.encodeWithSelector(
            HypercertMarketplaceAdapter.initialize.selector, owner, HYPERCERT_EXCHANGE, HYPERCERT_MINTER
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        adapter = HypercertMarketplaceAdapter(address(proxy));
    }

    /// @notice Build a test MakerAsk order with configurable parameters
    function _createTestMakerAsk(
        uint256 hypercertId,
        address currency,
        uint256 pricePerUnit,
        uint256 endTime
    )
        internal
        view
        returns (OrderStructs.Maker memory)
    {
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
            collection: HYPERCERT_MINTER,
            currency: currency,
            signer: seller,
            startTime: block.timestamp,
            endTime: endTime,
            price: pricePerUnit,
            itemIds: itemIds,
            amounts: amounts,
            additionalParameters: abi.encode(
                uint256(1), // minUnitAmount
                uint256(1000), // maxUnitAmount
                uint256(1000), // totalUnits
                false // sellLeftover
            )
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 1: Real Exchange Is Deployed
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_realExchangeIsDeployed() public {
        if (!_tryFork()) {
            return;
        }

        assertGt(HYPERCERT_EXCHANGE.code.length, 0, "HypercertExchange should be deployed on Arbitrum");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 2: Real Minter Is Deployed
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_realMinterIsDeployed() public {
        if (!_tryFork()) {
            return;
        }

        assertGt(HYPERCERT_MINTER.code.length, 0, "HypercertMinter should be deployed on Arbitrum");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 3: Transfer Manager Is Deployed
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_transferManagerIsDeployed() public {
        if (!_tryFork()) {
            return;
        }

        assertGt(TRANSFER_MANAGER.code.length, 0, "TransferManager should be deployed on Arbitrum");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 4: Strategy Is Deployed
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_strategyIsDeployed() public {
        if (!_tryFork()) {
            return;
        }

        assertGt(STRATEGY_FRACTION.code.length, 0, "HypercertFractionOffer strategy should be deployed on Arbitrum");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 5: Adapter Initializes With Real Addresses
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_adapterInitializesWithRealAddresses() public {
        if (!_tryFork()) {
            return;
        }

        _deployAdapterOnFork();

        assertEq(address(adapter.exchange()), HYPERCERT_EXCHANGE, "exchange should be real HypercertExchange");
        assertEq(adapter.hypercertMinter(), HYPERCERT_MINTER, "minter should be real HypercertMinter");
        assertEq(adapter.owner(), owner, "owner should be set");
        assertEq(adapter.nextOrderId(), 1, "nextOrderId should start at 1");
        assertFalse(adapter.paused(), "adapter should not be paused");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 6: Module Initializes With Adapter
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkDeploy_moduleInitializesWithAdapter() public {
        if (!_tryFork()) {
            return;
        }

        _deployAdapterOnFork();

        // Deploy HypercertsModule wired to adapter
        HypercertsModule impl = new HypercertsModule();
        bytes memory initData = abi.encodeWithSelector(
            HypercertsModule.initialize.selector,
            owner,
            HYPERCERT_MINTER,
            address(adapter),
            address(0), // gardensModule (not needed for this test)
            address(0), // hatsModule (not needed for this test)
            address(0) // gardenToken (not needed for this test)
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        hypercertsModule = HypercertsModule(address(proxy));

        assertEq(hypercertsModule.hypercertMinter(), HYPERCERT_MINTER, "module minter should match");
        assertEq(address(hypercertsModule.marketplaceAdapter()), address(adapter), "module adapter should match");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 7: Register Order Stores Correctly
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkAdapter_registerOrderStoresCorrectly() public {
        if (!_tryFork()) {
            return;
        }

        _deployAdapterOnFork();

        uint256 hypercertId = 42;
        uint256 pricePerUnit = 0.001 ether;
        uint256 endTime = block.timestamp + 7 days;

        OrderStructs.Maker memory makerAsk = _createTestMakerAsk(hypercertId, WETH, pricePerUnit, endTime);
        bytes memory signature = abi.encodePacked(bytes32("dummy-sig"), bytes32("part-2"), uint8(27));

        uint256 orderId = adapter.registerOrder(makerAsk, signature, hypercertId);
        assertEq(orderId, 1, "first order should have ID 1");

        // Verify stored fields (scoped to reduce stack depth)
        {
            (
                uint256 storedHypercertId,
                ,
                ,
                uint256 storedPrice,
                uint256 storedMinUnits,
                uint256 storedMaxUnits,
                address storedSeller,
                address storedCurrency,
                uint256 storedEndTime,
                bool active
            ) = adapter.orders(orderId);

            assertEq(storedHypercertId, hypercertId, "hypercertId mismatch");
            assertEq(storedPrice, pricePerUnit, "pricePerUnit mismatch");
            assertEq(storedMinUnits, 1, "minUnitAmount mismatch");
            assertEq(storedMaxUnits, 1000, "maxUnitAmount mismatch");
            assertEq(storedSeller, seller, "seller mismatch");
            assertEq(storedCurrency, WETH, "currency mismatch");
            assertEq(storedEndTime, endTime, "endTime mismatch");
            assertTrue(active, "order should be active");
        }

        // Verify active order mapping
        assertEq(adapter.activeOrders(hypercertId, WETH), orderId, "active order mapping mismatch");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 8: Deactivate Order Clears State
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkAdapter_deactivateOrderClearsState() public {
        if (!_tryFork()) {
            return;
        }

        _deployAdapterOnFork();

        uint256 hypercertId = 100;
        OrderStructs.Maker memory makerAsk = _createTestMakerAsk(hypercertId, WETH, 0.01 ether, block.timestamp + 7 days);
        bytes memory signature = abi.encodePacked(bytes32("sig"), bytes32("data"), uint8(27));

        uint256 orderId = adapter.registerOrder(makerAsk, signature, hypercertId);

        // Deactivate as seller
        vm.prank(seller);
        adapter.deactivateOrder(orderId);

        // Verify deactivated
        (,,,,,,,,, bool active) = adapter.orders(orderId);
        assertFalse(active, "order should be deactivated");

        // Active order mapping should be cleared
        assertEq(adapter.activeOrders(hypercertId, WETH), 0, "active order should be cleared");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 9: Batch Register Orders
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkAdapter_batchRegisterOrders() public {
        if (!_tryFork()) {
            return;
        }

        _deployAdapterOnFork();

        uint256 endTime = block.timestamp + 7 days;

        OrderStructs.Maker[] memory makerAsks = new OrderStructs.Maker[](3);
        bytes[] memory signatures = new bytes[](3);
        uint256[] memory hypercertIds = new uint256[](3);

        for (uint256 i = 0; i < 3; i++) {
            hypercertIds[i] = 200 + i;
            makerAsks[i] = _createTestMakerAsk(hypercertIds[i], WETH, 0.001 ether * (i + 1), endTime);
            signatures[i] = abi.encodePacked(bytes32(bytes32(uint256(i))), bytes32("sig"), uint8(27));
        }

        uint256[] memory orderIds = adapter.batchRegisterOrders(makerAsks, signatures, hypercertIds);

        assertEq(orderIds.length, 3, "should return 3 order IDs");
        assertEq(orderIds[0], 1, "first order ID should be 1");
        assertEq(orderIds[1], 2, "second order ID should be 2");
        assertEq(orderIds[2], 3, "third order ID should be 3");

        // Verify all are stored and active
        for (uint256 i = 0; i < 3; i++) {
            (uint256 storedHypercertId,,,,,,,,, bool active) = adapter.orders(orderIds[i]);
            assertEq(storedHypercertId, hypercertIds[i], string.concat("hypercertId mismatch at ", vm.toString(i)));
            assertTrue(active, string.concat("order ", vm.toString(i), " should be active"));
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 10: Buy Fraction Fails With Invalid Signature (Error Path)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkAdapter_buyFractionFailsWithInvalidSignature() public {
        if (!_tryFork()) {
            return;
        }

        _deployAdapterOnFork();

        uint256 hypercertId = 500;
        uint256 pricePerUnit = 0.001 ether;
        OrderStructs.Maker memory makerAsk = _createTestMakerAsk(hypercertId, WETH, pricePerUnit, block.timestamp + 7 days);
        bytes memory dummySignature = abi.encodePacked(bytes32("bad"), bytes32("sig"), uint8(27));

        adapter.registerOrder(makerAsk, dummySignature, hypercertId);

        // Fund buyer with WETH and approve adapter
        address buyer = makeAddr("buyer");
        deal(WETH, buyer, 1 ether);
        vm.prank(buyer);
        (bool success,) = WETH.call(abi.encodeWithSignature("approve(address,uint256)", address(adapter), 1 ether));
        assertTrue(success, "WETH approve should succeed");

        // buyFraction should revert with ExchangeExecutionFailed (real exchange rejects dummy signature)
        vm.prank(buyer);
        vm.expectRevert(HypercertMarketplaceAdapter.ExchangeExecutionFailed.selector);
        adapter.buyFraction(hypercertId, pricePerUnit, WETH, buyer);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 11: Duplicate Active Order Reverts (Error Path)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkAdapter_duplicateActiveOrderReverts() public {
        if (!_tryFork()) {
            return;
        }

        _deployAdapterOnFork();

        uint256 hypercertId = 600;
        uint256 endTime = block.timestamp + 7 days;
        OrderStructs.Maker memory makerAsk = _createTestMakerAsk(hypercertId, WETH, 0.001 ether, endTime);
        bytes memory sig = abi.encodePacked(bytes32("sig"), bytes32("data"), uint8(27));

        // First registration succeeds
        adapter.registerOrder(makerAsk, sig, hypercertId);

        // Second registration with same hypercert+currency should revert
        vm.expectRevert(HypercertMarketplaceAdapter.DuplicateActiveOrder.selector);
        adapter.registerOrder(makerAsk, sig, hypercertId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Test 12: Paused Contract Reverts (Error Path)
    // ═══════════════════════════════════════════════════════════════════════════

    function test_forkAdapter_pausedContractReverts() public {
        if (!_tryFork()) {
            return;
        }

        _deployAdapterOnFork();

        // Pause the adapter
        adapter.setPaused(true);

        uint256 hypercertId = 700;
        OrderStructs.Maker memory makerAsk = _createTestMakerAsk(hypercertId, WETH, 0.001 ether, block.timestamp + 7 days);
        bytes memory sig = abi.encodePacked(bytes32("sig"), bytes32("data"), uint8(27));

        // registerOrder should revert when paused
        vm.expectRevert(HypercertMarketplaceAdapter.ContractPaused.selector);
        adapter.registerOrder(makerAsk, sig, hypercertId);

        // buyFraction should also revert when paused
        vm.expectRevert(HypercertMarketplaceAdapter.ContractPaused.selector);
        adapter.buyFraction(hypercertId, 0.001 ether, WETH, address(this));
    }
}
