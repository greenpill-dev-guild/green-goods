# HypercertMarketplaceAdapter: Exchange Wrapper for Yield-to-Fractions

## Context

The YieldResolver splits Aave V3 yield three ways: Cookie Jar (48.65%), Fractions (48.65%), Juicebox (2.70%). The fractions portion calls `IHypercertMarketplace.buyFraction()` weighted by conviction — but no real marketplace implementation exists.

We build an **adapter that wraps the deployed HypercertExchange** (LooksRare-based) on Arbitrum. Operators sign fractional sale orders off-chain (gasless), register them in the adapter (1 tx, batchable). The yield flow calls `buyFraction()` → adapter constructs a taker bid → calls `exchange.executeTakerBid()`. The exchange handles fraction splitting, transfers, and fees natively.

**Arbitrum Contracts:**
| Contract | Address |
|----------|---------|
| HypercertExchange | `0xcE8fa09562f07c23B9C21b5d0A29a293F8a8BC83` |
| TransferManager | `0x658c1695DCb298E57e6144F6dA3e83DdCF5e2BaB` |
| HypercertMinterUUPS | `0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07` |
| StrategyHypercertFractionOffer | `0xecab24cade0261fc6513ca13bb3d10f760af3da8` |

**Operator UX:**
1. One-time: `transferManager.grantApprovals([exchange])` (1 tx)
2. One-time: `hypercertMinter.setApprovalForAll(transferManager, true)` (1 tx)
3. Sign fractional sale maker order (gasless EIP-712 — via marketplace SDK)
4. Register order + signature in adapter (1 tx, batchable for N orders)
5. Yield auto-purchases via `splitYield()` → permissionless

---

## Exchange Mechanics (from source code analysis)

**executeTakerBid signature:**
```solidity
function executeTakerBid(
    OrderStructs.Taker calldata takerBid,
    OrderStructs.Maker calldata makerAsk,
    bytes calldata makerSignature,
    OrderStructs.MerkleTree calldata merkleTree
) external payable nonReentrant;
```

**Maker struct** (seller's signed order):
- `quoteType` (1 = MakerAsk), `globalNonce`, `subsetNonce`, `orderNonce`
- `strategyId` (for StrategyHypercertFractionOffer), `collectionType` (2 = Hypercert)
- `collection` (minter address), `currency` (ERC-20), `signer` (seller)
- `startTime`, `endTime`, `price` (price per unit)
- `itemIds[]` (fraction token IDs), `amounts[]` ([1])
- `additionalParameters`: `abi.encode(minUnitAmount, maxUnitAmount, minUnitsToKeep, sellLeftover)`

**Taker struct** (buyer — our adapter):
- `recipient` (who gets the fraction — garden treasury)
- `additionalParameters`: `abi.encode(unitAmount, pricePerUnit)`

**Key behavior**: StrategyHypercertFractionOffer supports **reusable partial fills**. The order nonce is only invalidated when `remaining_units == minUnitsToKeep`. One maker order serves many yield purchases.

**Payment flow**: Exchange calls `transferFrom(msg.sender, seller, proceeds)` + `transferFrom(msg.sender, feeRecipient, fee)`. Total pulled from taker = `unitAmount * pricePerUnit`.

---

## Files to Create

### 1. `packages/contracts/src/interfaces/IHypercertExchange.sol`
Minimal interfaces for the exchange contracts + order struct library.

```solidity
library OrderStructs {
    enum QuoteType { MakerBid, MakerAsk }
    enum CollectionType { ERC721, ERC1155, Hypercert }

    struct Maker {
        QuoteType quoteType;
        uint256 globalNonce;
        uint256 subsetNonce;
        uint256 orderNonce;
        uint256 strategyId;
        CollectionType collectionType;
        address collection;
        address currency;
        address signer;
        uint256 startTime;
        uint256 endTime;
        uint256 price;           // price per unit for fractional sales
        uint256[] itemIds;
        uint256[] amounts;
        bytes additionalParameters;
    }

    struct Taker {
        address recipient;
        bytes additionalParameters;
    }

    struct MerkleTreeNode {
        bytes32 value;
        uint8 position;          // 0 = Left, 1 = Right
    }

    struct MerkleTree {
        bytes32 root;
        MerkleTreeNode[] proof;
    }
}

interface IHypercertExchange {
    function executeTakerBid(
        OrderStructs.Taker calldata takerBid,
        OrderStructs.Maker calldata makerAsk,
        bytes calldata makerSignature,
        OrderStructs.MerkleTree calldata merkleTree
    ) external payable;
}
```

### 2. `packages/contracts/src/markets/HypercertMarketplaceAdapter.sol`
Core adapter. Inherits: `IHypercertMarketplace`, `OwnableUpgradeable`, `ReentrancyGuardUpgradeable`, `UUPSUpgradeable`.

**Storage** (10 vars + 40 gap = 50 slots):
```solidity
IHypercertExchange public exchange;
address public hypercertMinter;  // for validation

uint256 public maxBatchSize;     // default 10
uint256 public nextOrderId;      // starts at 1

// Registered maker orders
mapping(uint256 orderId => RegisteredOrder) public orders;

// Quick lookup: hypercertId => currency => orderId (one active per pair)
mapping(uint256 => mapping(address => uint256)) public activeOrders;

// Seller => orderId[] (for management)
mapping(address => uint256[]) public sellerOrders;

bool public paused;

// Allowed currencies
mapping(address => bool) public allowedCurrencies;
```

**RegisteredOrder struct** (stored per order):
```solidity
struct RegisteredOrder {
    uint256 hypercertId;      // proposal/claim mapping
    bytes encodedMakerAsk;    // full abi.encode(Maker)
    bytes signature;           // EIP-712 signature from seller
    uint256 pricePerUnit;      // from Maker.price (for quick access)
    uint256 minUnitAmount;     // from additionalParameters
    uint256 maxUnitAmount;     // from additionalParameters
    address seller;            // Maker.signer
    address currency;          // Maker.currency
    uint256 endTime;           // Maker.endTime
    bool active;
}
```

**Key functions:**

`registerOrder(Maker calldata makerAsk, bytes calldata signature, uint256 hypercertId)`:
1. Validate: `makerAsk.quoteType == MakerAsk`, `makerAsk.collection == hypercertMinter`, `makerAsk.endTime > block.timestamp`
2. Decode `additionalParameters` → extract `minUnitAmount`, `maxUnitAmount`
3. Check no existing active order for this hypercertId + currency (or deactivate expired)
4. Store: full encoded maker + signature + extracted fields
5. Map: `activeOrders[hypercertId][currency] = orderId`

`batchRegisterOrders(Maker[] calldata, bytes[] calldata, uint256[] calldata)`:
- Loop with `maxBatchSize` cap (default 10)

`buyFraction(uint256 hypercertId, uint256 amount, address asset, address recipient) returns (uint256)`:
1. Find active order for `hypercertId + asset`
2. Calculate `units = amount / order.pricePerUnit`
3. Cap to `order.maxUnitAmount`, check `>= order.minUnitAmount`
4. If 0 units → **revert** (YieldResolver catches and escrows)
5. `actualPayment = units * order.pricePerUnit`
6. Pull `actualPayment` from caller via `transferFrom`
7. Approve exchange for `actualPayment`
8. Decode stored `encodedMakerAsk` → `Maker` struct
9. Construct `Taker`: `{ recipient: recipient, additionalParameters: abi.encode(units, order.pricePerUnit) }`
10. Construct empty `MerkleTree`: `{ root: 0, proof: [] }`
11. Call `exchange.executeTakerBid(taker, maker, signature, merkleTree)`
12. Exchange transfers fraction to `recipient`, pulls payment from adapter → seller
13. Return `fractionId` (= maker's itemIds[0] or emit from exchange event)

**Graceful degradation**: If `executeTakerBid` reverts (e.g., order exhausted, nonce invalidated), the adapter reverts too. The YieldResolver's try/catch in `_purchaseFraction` catches this and escrows the amount. Reset exchange approval to 0 in a catch block.

`deactivateOrder(uint256 orderId)`: Seller or owner deactivates a registered order.

`previewPurchase(hypercertId, amount, asset)`: View — returns units based on stored price.

`getMinPrice(hypercertId, asset)`: View — returns stored pricePerUnit or 0.

**Admin**: `setExchange`, `setHypercertMinter`, `setPaused`, `setMaxBatchSize`, `setAllowedCurrency`.

### 3. `packages/contracts/src/mocks/HypercertExchange.sol`
Mock exchange that simulates `executeTakerBid`:
- Decodes taker additionalParameters → `(unitAmount, pricePerUnit)`
- Pulls `unitAmount * pricePerUnit` from `msg.sender` via `transferFrom`
- Transfers payment to maker's signer (seller)
- Tracks calls for test assertions
- `setShouldRevert(bool)` for degradation testing

### 4. `packages/contracts/test/unit/HypercertMarketplaceAdapter.t.sol`
Three test contracts (~35 tests):

**HypercertMarketplaceAdapterTest** — init, register orders:
- Initialize sets exchange/minter correctly
- Register order stores full data, emits event
- Batch register multiple orders in one tx
- Revert on invalid quoteType, expired order, duplicate active order
- Deactivate order by seller or owner

**HypercertMarketplaceAdapterPurchaseTest** — buy flows via exchange:
- Full unit purchase via exchange.executeTakerBid
- Partial purchase (buy fewer than maxUnitAmount)
- Payment flows correctly: adapter → exchange → seller
- Recipient receives fraction (exchange transfers to taker.recipient)
- Revert if 0 units purchasable (amount < pricePerUnit)
- Revert propagation when exchange reverts (order exhausted)
- Multiple purchases from same registered order (reusable)

**HypercertMarketplaceAdapterViewTest** — view functions + edge cases:
- previewPurchase returns correct units
- getMinPrice returns stored price
- Both return 0 for expired/inactive orders
- Dust amounts handled correctly

---

## Files to Modify

### 5. `packages/contracts/src/interfaces/IHypercertMarketplace.sol`
Add two view functions after `buyFraction`:
```solidity
function previewPurchase(uint256 hypercertId, uint256 amount, address asset)
    external view returns (uint256 units);
function getMinPrice(uint256 hypercertId, address asset)
    external view returns (uint256 pricePerUnit);
```

### 6. `packages/contracts/src/mocks/YieldDeps.sol`
Add `previewPurchase` (returns `amount`) and `getMinPrice` (returns `1`) to `MockHypercertMarketplace` for interface compatibility.

### 7. `packages/contracts/test/helpers/DeploymentBase.sol`
- Import `HypercertMarketplaceAdapter`
- Add `HypercertMarketplaceAdapter public marketplaceAdapter` state variable
- Deploy after YieldResolver (step 11): `_deployMarketplaceAdapter(owner, exchange, minter, salt, factory)`
- Wire: `yieldSplitter.setHypercertMarketplace(address(marketplaceAdapter))`

### 8. `packages/contracts/test/unit/YieldSplitter.t.sol`
Add `YieldResolverWithExchangeTest` integration test:
- Deploy real adapter + mock exchange + mock CVStrategy
- Register a maker order in adapter
- Wire YieldResolver → adapter → mock exchange
- Trigger splitYield → verify exchange.executeTakerBid was called with correct taker params
- Verify 0 escrowed fractions

---

## Payment Flow

```
YieldResolver._purchaseFraction(garden, WETH, hypercertId=1, allocation=$3.40):
  1. forceApprove(adapter, $3.40)
  2. adapter.buyFraction(1, $3.40, WETH, treasury)

HypercertMarketplaceAdapter.buyFraction(1, $3.40, WETH, treasury):
  1. Look up registered order: pricePerUnit = $0.00001
  2. units = $3.40 / $0.00001 = 340,000 units
  3. actualPayment = 340,000 * $0.00001 = $3.40
  4. WETH.transferFrom(yieldResolver, adapter, $3.40)
  5. WETH.approve(exchange, $3.40)
  6. Decode stored maker order
  7. Construct taker: { recipient: treasury, params: encode(340000, $0.00001) }
  8. exchange.executeTakerBid(taker, maker, signature, emptyMerkle)
     ↓ Exchange internally:
     - Validates maker signature ✓
     - Runs StrategyHypercertFractionOffer ✓
     - Splits fraction: 340k units → treasury, rest stays with seller
     - Pulls $3.40 from adapter → $3.38 to seller, $0.02 protocol fee
  9. Return fractionId
```

---

## Implementation Sequence

1. **Interfaces**: `IHypercertExchange.sol` (OrderStructs + exchange interface) + update `IHypercertMarketplace.sol`
2. **Mock compatibility**: Update `MockHypercertMarketplace` in `YieldDeps.sol`
3. **Mock exchange**: `MockHypercertExchange.sol` for testing
4. **Core adapter**: `HypercertMarketplaceAdapter.sol` — incrementally:
   - Storage + init
   - registerOrder + batchRegisterOrders
   - buyFraction (construct taker, call exchange)
   - View functions + admin
5. **Unit tests**: `HypercertMarketplaceAdapter.t.sol`
6. **Deployment wiring**: `DeploymentBase.sol`
7. **Integration test**: in `YieldSplitter.t.sol`

---

## Recommended Pricing Defaults (for operators creating maker orders)

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `price` (per unit) | `1e13` (~$0.00001 for stables) | $1 buys 100k units |
| `minUnitAmount` | `1` | No minimum |
| `maxUnitAmount` | `type(uint256).max` | No cap — yield should never be blocked |
| `minUnitsToKeep` | `0` | Sell all units |
| `sellLeftover` | `true` | Auto-sell remainder |
| `currency` | Vault's underlying asset | Match the yield asset |
| `endTime` | `block.timestamp + 90 days` | Long-lived, renew quarterly |

---

## Verification

```bash
cd packages/contracts && bun build
cd packages/contracts && bun run test --match-contract HypercertMarketplaceAdapter
cd packages/contracts && bun run test --match-test endToEnd_yieldSplitViaExchange
cd packages/contracts && bun run test --match-contract YieldResolver
cd packages/contracts && bun run test
cd packages/contracts && bun lint
```

---

## Follow-up (not in this PR)

- Admin UI: integrate `@hypercerts-org/marketplace-sdk` for order signing + registration
- Shared hooks: `useRegisterFractionOrder`, `useBatchRegisterOrders`
- Deploy script: add adapter to `deploy.ts` + deployment JSON
- Fork test: verify executeTakerBid works against real HypercertExchange on Arbitrum
- Chain config: store exchange/transferManager/strategy addresses per chain in deployment JSON
