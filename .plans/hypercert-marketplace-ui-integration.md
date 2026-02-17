# Hypercert Marketplace UI Integration

> **Depends on**: Hypercert marketplace adapter contracts (DONE — plan deleted, see `HypercertMarketplaceAdapter.sol`)
>
> **Scope**: Shared hooks + types + data layer + Admin UI for marketplace listing/management
>
> **Branch**: `feature/hypercert-marketplace-ui`

---

## Context

The contract layer is complete:
- **`HypercertsModule.sol`** — orchestrates `mintAndRegister()`, `listForYield()`, `batchListForYield()`, `delistFromYield()`
- **`HypercertMarketplaceAdapter.sol`** — wraps HypercertExchange with `registerOrder()`, `buyFraction()`, `deactivateOrder()`

The minting UI is complete (4-step wizard in admin, XState machine in shared). **What's missing**: everything between the contracts and the user for marketplace operations — listing creation, order management, price display, and trade history.

### Arbitrum Exchange Addresses (from adapter plan)

| Contract | Address |
|----------|---------|
| HypercertExchange | `0xcE8fa09562f07c23B9C21b5d0A29a293F8a8BC83` |
| TransferManager | `0x658c1695DCb298E57e6144F6dA3e83DdCf5e2BaB` |
| HypercertMinterUUPS | `0x822F17A9A5EeCFd66dBAFf7946a8071C265D1d07` |
| StrategyHypercertFractionOffer | `0xecab24cade0261fc6513ca13bb3d10f760af3da8` |

---

## Implementation Phases

### Phase 1: Foundation (Types + Dependencies + Config)

#### 1.1 Install Marketplace SDK

**File**: `packages/shared/package.json`

```bash
cd packages/shared && bun add @hypercerts-org/marketplace-sdk
```

Verify compatibility with existing `@hypercerts-org/sdk@2.9.1` and `@hypercerts-org/contracts@2.0.0-alpha.0`.

#### 1.2 Add Marketplace Types

**File**: `packages/shared/src/types/hypercerts.ts` (extend existing)

```typescript
// ── Marketplace Types ────────────────────────────────────────────────

/** A signed maker ask order registered in the adapter */
export interface HypercertListing {
  orderId: number;
  hypercertId: bigint;
  fractionId: bigint;
  seller: Address;
  currency: Address;
  pricePerUnit: bigint;
  minUnitAmount: bigint;
  maxUnitAmount: bigint;
  minUnitsToKeep: bigint;
  sellLeftover: boolean;
  startTime: number;
  endTime: number;
  status: ListingStatus;
  signature: Hex;
  orderNonce: bigint;
  createdAt: number;
}

export type ListingStatus = "active" | "expired" | "cancelled" | "filled";

/** Parameters for creating a new listing */
export interface CreateListingParams {
  hypercertId: bigint;
  fractionId: bigint;
  currency: Address;
  pricePerUnit: bigint;
  minUnitAmount: bigint;
  maxUnitAmount: bigint;
  minUnitsToKeep: bigint;
  sellLeftover: boolean;
  durationDays: number;
}

/** Recommended defaults from adapter plan */
export const LISTING_DEFAULTS = {
  pricePerUnit: 1n * 10n ** 13n,     // ~$0.00001 for stables → $1 buys 100k units
  minUnitAmount: 1n,                  // No minimum
  maxUnitAmount: 2n ** 256n - 1n,     // No cap
  minUnitsToKeep: 0n,                 // Sell all
  sellLeftover: true,                 // Auto-sell remainder
  durationDays: 90,                   // Renew quarterly
} as const;

/** A completed fraction purchase */
export interface FractionTrade {
  orderId: number;
  hypercertId: bigint;
  recipient: Address;
  units: bigint;
  payment: bigint;
  currency: Address;
  timestamp: number;
  txHash: Hex;
}

/** Marketplace order status from on-chain adapter */
export interface RegisteredOrderView {
  orderId: number;
  hypercertId: bigint;
  seller: Address;
  currency: Address;
  pricePerUnit: bigint;
  minUnitAmount: bigint;
  maxUnitAmount: bigint;
  endTime: number;
  active: boolean;
}
```

Export from `packages/shared/src/types/index.ts` barrel.

#### 1.3 Add Contract Addresses to Deployment Config

**File**: `packages/shared/src/utils/blockchain/contracts.ts`

Add marketplace-related addresses to the `NetworkContracts` type and resolution:

```typescript
// Extend NetworkContracts
hypercertExchange: Address;
hypercertMinter: Address;
transferManager: Address;
marketplaceAdapter: Address;
hypercertsModule: Address;
strategyHypercertFractionOffer: Address;
```

**File**: `packages/contracts/deployments/{chainId}-latest.json`

Add the deployed addresses for each chain. Zero addresses for undeployed chains (normal per CLAUDE.md).

#### 1.4 Add Marketplace Adapter ABI

**File**: `packages/shared/src/hooks/hypercerts/hypercert-abis.ts` (extend)

Add ABIs for:
- `HypercertMarketplaceAdapter` (registerOrder, deactivateOrder, orders, activeOrders, sellerOrders, previewPurchase, getMinPrice)
- `HypercertsModule` (listForYield, batchListForYield, delistFromYield, getGardenHypercerts)

Extract from `packages/contracts/out/` build artifacts.

---

### Phase 2: SDK Integration Layer

#### 2.1 Marketplace SDK Client

**File**: `packages/shared/src/modules/marketplace/client.ts` (new)

```typescript
/**
 * Initialize and cache the HypercertExchange client from the marketplace SDK.
 * Handles chain-specific configuration and wallet signer injection.
 */
export function getMarketplaceClient(chainId: number): HypercertExchangeClient;
export function getOrderValidator(chainId: number): OrderValidator;
```

Key responsibilities:
- Lazy-init SDK client per chain (singleton pattern)
- Inject wallet signer for EIP-712 signing
- Expose order creation helpers

#### 2.2 Order Signing Utilities

**File**: `packages/shared/src/modules/marketplace/signing.ts` (new)

```typescript
/**
 * Build a maker ask order struct from CreateListingParams.
 * Handles: strategy ID resolution, collection type, additional parameters encoding,
 * nonce management, and EIP-712 domain separator.
 */
export async function buildMakerAsk(params: CreateListingParams, signer: Address, chainId: number): Promise<MakerAsk>;

/**
 * Sign a maker ask order using EIP-712 typed data.
 * Returns the signature for on-chain registration.
 */
export async function signMakerAsk(makerAsk: MakerAsk, walletClient: WalletClient): Promise<Hex>;

/**
 * Validate a maker ask order before signing (check nonces, approvals, balances).
 */
export async function validateOrder(makerAsk: MakerAsk, chainId: number): Promise<ValidationResult>;
```

#### 2.3 Approval Management

**File**: `packages/shared/src/modules/marketplace/approvals.ts` (new)

```typescript
/**
 * Check if operator has granted required approvals:
 * 1. transferManager.grantApprovals([exchange]) — one-time
 * 2. hypercertMinter.setApprovalForAll(transferManager, true) — one-time
 *
 * Returns which approvals are missing so the UI can prompt.
 */
export async function checkMarketplaceApprovals(
  operator: Address,
  chainId: number
): Promise<{ exchangeApproved: boolean; minterApproved: boolean }>;

export async function buildApprovalTransactions(
  operator: Address,
  chainId: number
): Promise<{ grantExchange?: EncodedCall; approveMinter?: EncodedCall }>;
```

#### 2.4 Module Barrel

**File**: `packages/shared/src/modules/marketplace/index.ts` (new)

Export all marketplace module functions. Register in `packages/shared/src/modules/index.ts`.

---

### Phase 3: Data Functions

#### 3.1 On-Chain Order Queries

**File**: `packages/shared/src/modules/data/marketplace.ts` (new)

```typescript
/**
 * Read registered orders from the HypercertMarketplaceAdapter contract.
 * Uses multicall for batch reads.
 */
export async function getRegisteredOrders(gardenAddress: Address, chainId: number): Promise<RegisteredOrderView[]>;

/**
 * Get the active order for a hypercert+currency pair.
 */
export async function getActiveOrder(hypercertId: bigint, currency: Address, chainId: number): Promise<RegisteredOrderView | null>;

/**
 * Preview how many units a given payment amount would purchase.
 */
export async function previewPurchase(hypercertId: bigint, amount: bigint, currency: Address, chainId: number): Promise<bigint>;

/**
 * Get minimum price per unit for a hypercert+currency.
 */
export async function getMinPrice(hypercertId: bigint, currency: Address, chainId: number): Promise<bigint>;

/**
 * Get all orders registered by a seller (operator).
 */
export async function getSellerOrders(seller: Address, chainId: number): Promise<RegisteredOrderView[]>;
```

#### 3.2 Event-Based Trade History

**File**: `packages/shared/src/modules/data/marketplace.ts` (extend)

```typescript
/**
 * Fetch FractionPurchased events from the adapter to build trade history.
 * Uses viem getLogs with the FractionPurchased event signature.
 */
export async function getTradeHistory(hypercertId: bigint, chainId: number): Promise<FractionTrade[]>;

/**
 * Fetch OrderRegistered and OrderDeactivated events for listing history.
 */
export async function getListingHistory(gardenAddress: Address, chainId: number): Promise<HypercertListing[]>;
```

#### 3.3 Query Keys

**File**: `packages/shared/src/hooks/query-keys.ts` (extend)

```typescript
// Add to queryKeys object
marketplace: {
  orders: (gardenAddress: Address, chainId: number) => ["marketplace", "orders", gardenAddress, chainId],
  activeOrder: (hypercertId: string, currency: Address, chainId: number) => ["marketplace", "active-order", hypercertId, currency, chainId],
  sellerOrders: (seller: Address, chainId: number) => ["marketplace", "seller-orders", seller, chainId],
  preview: (hypercertId: string, amount: string, currency: Address, chainId: number) => ["marketplace", "preview", hypercertId, amount, currency, chainId],
  tradeHistory: (hypercertId: string, chainId: number) => ["marketplace", "trades", hypercertId, chainId],
  approvals: (operator: Address, chainId: number) => ["marketplace", "approvals", operator, chainId],
},

// Add to queryInvalidation
marketplace: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: ["marketplace"] }),
```

---

### Phase 4: React Hooks

#### 4.1 Read Hooks

**File**: `packages/shared/src/hooks/hypercerts/useHypercertListings.ts` (new)

```typescript
/**
 * Fetch all registered marketplace orders for a garden's hypercerts.
 * Combines on-chain adapter reads with indexer data for enrichment.
 *
 * @returns { listings, isLoading, error }
 */
export function useHypercertListings(gardenAddress: Address): UseHypercertListingsResult;
```

**File**: `packages/shared/src/hooks/hypercerts/useMarketplaceApprovals.ts` (new)

```typescript
/**
 * Check if the connected operator has the required marketplace approvals.
 * Returns approval status + mutation functions to grant missing approvals.
 *
 * Two one-time approvals needed:
 * 1. transferManager.grantApprovals([exchange])
 * 2. hypercertMinter.setApprovalForAll(transferManager, true)
 */
export function useMarketplaceApprovals(): UseMarketplaceApprovalsResult;
```

**File**: `packages/shared/src/hooks/hypercerts/useTradeHistory.ts` (new)

```typescript
/**
 * Fetch FractionPurchased events for a hypercert to display trade history.
 */
export function useTradeHistory(hypercertId: bigint): UseTradeHistoryResult;
```

#### 4.2 Mutation Hooks

**File**: `packages/shared/src/hooks/hypercerts/useCreateListing.ts` (new)

```typescript
/**
 * Two-phase listing creation:
 * 1. Build maker ask from CreateListingParams
 * 2. Sign via EIP-712 (gasless — wallet popup)
 * 3. Call HypercertsModule.listForYield(garden, hypercertId, makerAsk, signature)
 *
 * The module internally calls marketplaceAdapter.registerOrder().
 *
 * @returns { createListing, isCreating, signingState }
 */
export function useCreateListing(gardenAddress: Address): UseCreateListingResult;
```

**File**: `packages/shared/src/hooks/hypercerts/useCancelListing.ts` (new)

```typescript
/**
 * Cancel an active listing via HypercertsModule.delistFromYield(garden, orderId).
 *
 * @returns { cancelListing, isCancelling }
 */
export function useCancelListing(gardenAddress: Address): UseCancelListingResult;
```

**File**: `packages/shared/src/hooks/hypercerts/useBatchListForYield.ts` (new)

```typescript
/**
 * Batch list multiple hypercerts for yield in a single transaction.
 * Signs all maker asks, then calls HypercertsModule.batchListForYield().
 *
 * @returns { batchList, isBatching, progress }
 */
export function useBatchListForYield(gardenAddress: Address): UseBatchListForYieldResult;
```

#### 4.3 Barrel Exports

**File**: `packages/shared/src/hooks/index.ts` (extend HYPERCERTS section)

Add all new hook exports under the existing HYPERCERTS section.

**File**: `packages/shared/src/index.ts` (extend)

Re-export new types, hooks, data functions, and marketplace module from barrel.

---

### Phase 5: Admin UI Components

#### 5.1 Approval Gate

**File**: `packages/admin/src/components/hypercerts/MarketplaceApprovalGate.tsx` (new)

```
┌─────────────────────────────────────────────┐
│  ⚠ Marketplace Setup Required               │
│                                              │
│  Two one-time approvals are needed before    │
│  you can list hypercerts for yield:          │
│                                              │
│  ☐ Grant exchange approval (1 tx)            │
│  ☐ Approve transfer manager (1 tx)           │
│                                              │
│  [ Approve All ]                             │
└─────────────────────────────────────────────┘
```

Wraps listing UI — if approvals missing, show gate instead of listing form. Uses `useMarketplaceApprovals()`.

#### 5.2 Create Listing Dialog

**File**: `packages/admin/src/components/hypercerts/CreateListingDialog.tsx` (new)

Two-step dialog (inside Radix Dialog):

**Step 1: Configure Pricing**
```
┌─────────────────────────────────────────────┐
│  List Hypercert #1234 for Yield              │
│                                              │
│  Currency:     [ WETH ▾ ]                    │
│  Price/Unit:   [ 0.00001 ] (≈ $0.00001)     │
│  Min Units:    [ 1 ]                         │
│  Max Units:    [ unlimited ]                 │
│  Keep Min:     [ 0 ]                         │
│  Duration:     [ 90 days ▾ ]                 │
│  Sell Leftover: [✓]                          │
│                                              │
│  Est. yield capture: $1 → 100,000 units      │
│                                              │
│  [ Cancel ]              [ Sign & List → ]   │
└─────────────────────────────────────────────┘
```

**Step 2: Sign & Submit**
```
┌─────────────────────────────────────────────┐
│  Signing Order...                            │
│                                              │
│  ◉ Building order         ✓                  │
│  ◉ Signing (wallet)       ⟳ Waiting...      │
│  ○ Registering on-chain   Pending            │
│  ○ Confirming             Pending            │
│                                              │
│  [ Cancel ]                                  │
└─────────────────────────────────────────────┘
```

Uses `useCreateListing()` + Radix Dialog + React Hook Form + Zod validation.

Pre-fills with `LISTING_DEFAULTS` from types.

#### 5.3 Active Listings Table

**File**: `packages/admin/src/components/hypercerts/ActiveListingsTable.tsx` (new)

```
┌────────────────────────────────────────────────────────────────┐
│  Active Listings                                    [ Batch ] │
├──────────┬────────┬──────────┬───────────┬──────────┬─────────┤
│ Hypercert│ Price  │ Currency │ Expires   │ Trades   │ Actions │
├──────────┼────────┼──────────┼───────────┼──────────┼─────────┤
│ #1234    │ 0.00001│ WETH     │ in 45d    │ 12       │ [Cancel]│
│ #1235    │ 0.00001│ USDC     │ in 89d    │ 3        │ [Cancel]│
│ #1236    │ 0.00002│ WETH     │ Expired ⚠ │ 0        │ [Renew] │
└──────────┴────────┴──────────┴───────────┴──────────┴─────────┘
```

Uses `useHypercertListings()`. Supports:
- Cancel via `useCancelListing()`
- Renew expired (pre-fills CreateListingDialog with previous params)
- Status badges (active/expired/cancelled)

#### 5.4 Trade History Table

**File**: `packages/admin/src/components/hypercerts/TradeHistoryTable.tsx` (new)

```
┌────────────────────────────────────────────────────────────────┐
│  Recent Yield Purchases                                        │
├──────────┬──────────┬────────┬──────────┬──────────┬──────────┤
│ Date     │ Hypercert│ Units  │ Payment  │ Recipient│ Tx       │
├──────────┼──────────┼────────┼──────────┼──────────┼──────────┤
│ Feb 15   │ #1234    │ 340k   │ $3.40    │ 0xabc... │ [↗]      │
│ Feb 14   │ #1234    │ 280k   │ $2.80    │ 0xabc... │ [↗]      │
└──────────┴──────────┴────────┴──────────┴──────────┴──────────┘
```

Uses `useTradeHistory()`. Links to block explorer.

#### 5.5 Batch Listing Dialog

**File**: `packages/admin/src/components/hypercerts/BatchListingDialog.tsx` (new)

For operators with multiple unlisted hypercerts. Select which to list, apply uniform pricing, sign all, submit in one tx via `useBatchListForYield()`.

---

### Phase 6: Admin View Integration

#### 6.1 Update HypercertDetail View

**File**: `packages/admin/src/views/Gardens/Garden/HypercertDetail.tsx` (modify)

Add a "Marketplace" section below existing metadata:

```
┌─────────────────────────────────────────────┐
│  Hypercert #1234 — Forest Restoration       │
│  ─────────────────────────────────────────── │
│  [Existing: metadata, claims, sync status]   │
│                                              │
│  ── Marketplace ──────────────────────────── │
│                                              │
│  Status: 🟢 Listed for Yield                │
│  Price: 0.00001 WETH/unit                    │
│  Expires: Mar 15, 2026 (45 days)             │
│  Total Purchases: 12 (3.4M units)            │
│                                              │
│  [ Cancel Listing ]  [ Renew Listing ]       │
│                                              │
│  ── Trade History ───────────────────────── │
│  [TradeHistoryTable]                         │
│                                              │
│  OR (if not listed):                         │
│  [ List for Yield ]                          │
└─────────────────────────────────────────────┘
```

#### 6.2 Update Hypercerts List View

**File**: `packages/admin/src/views/Gardens/Garden/Hypercerts.tsx` (modify)

- Add listing status badge to each card (🟢 Listed | ⚪ Not Listed | 🟡 Expired)
- Add filter: "All | Listed | Not Listed"
- Add "Batch List" button in header (opens BatchListingDialog)

#### 6.3 New Marketplace Overview Tab

**File**: `packages/admin/src/views/Gardens/Garden/Marketplace.tsx` (new, optional)

A dedicated tab under Garden showing:
- Active listings table
- Recent trades table
- Yield capture summary (total units purchased, total yield spent)
- Quick actions: batch list, batch renew expired

This may be integrated into the existing garden view as a tab rather than a standalone route.

---

### Phase 7: Testing

#### 7.1 Unit Tests — Shared Hooks

**File**: `packages/shared/src/__tests__/hooks/hypercerts/useHypercertListings.test.ts`
**File**: `packages/shared/src/__tests__/hooks/hypercerts/useCreateListing.test.ts`
**File**: `packages/shared/src/__tests__/hooks/hypercerts/useCancelListing.test.ts`
**File**: `packages/shared/src/__tests__/hooks/hypercerts/useMarketplaceApprovals.test.ts`
**File**: `packages/shared/src/__tests__/hooks/hypercerts/useTradeHistory.test.ts`

Test patterns:
- Mock contract reads via `vi.mock('wagmi')` (existing pattern)
- Mock marketplace SDK client
- Test loading/error/success states
- Test cache invalidation after mutations
- Test approval gating logic

#### 7.2 Unit Tests — Shared Modules

**File**: `packages/shared/src/__tests__/modules/marketplace/signing.test.ts`
**File**: `packages/shared/src/__tests__/modules/marketplace/approvals.test.ts`
**File**: `packages/shared/src/__tests__/modules/data/marketplace.test.ts`

#### 7.3 Component Tests — Admin

**File**: `packages/admin/src/__tests__/components/hypercerts/CreateListingDialog.test.tsx`
**File**: `packages/admin/src/__tests__/components/hypercerts/ActiveListingsTable.test.tsx`
**File**: `packages/admin/src/__tests__/components/hypercerts/MarketplaceApprovalGate.test.tsx`

Test patterns:
- Render with mock providers (existing test utils)
- Verify approval gate shows/hides correctly
- Verify form validation with Zod schema
- Verify mutation calls with correct parameters

---

## Implementation Sequence (Recommended Order)

```
Phase 1 ─── Foundation
  1.1 Install @hypercerts-org/marketplace-sdk
  1.2 Add marketplace types to types/hypercerts.ts
  1.3 Add contract addresses to deployment config
  1.4 Add adapter + module ABIs
       │
Phase 2 ─── SDK Integration Layer
  2.1 Marketplace SDK client (singleton)
  2.2 Order signing utilities (buildMakerAsk, signMakerAsk)
  2.3 Approval management (check + build txns)
       │
Phase 3 ─── Data Functions
  3.1 On-chain order queries (multicall reads)
  3.2 Event-based trade history (getLogs)
  3.3 Query keys + invalidation
       │
Phase 4 ─── React Hooks
  4.1 Read hooks (useHypercertListings, useMarketplaceApprovals, useTradeHistory)
  4.2 Mutation hooks (useCreateListing, useCancelListing, useBatchListForYield)
  4.3 Barrel exports
       │
Phase 5 ─── Admin Components
  5.1 MarketplaceApprovalGate
  5.2 CreateListingDialog (2-step: configure → sign+submit)
  5.3 ActiveListingsTable
  5.4 TradeHistoryTable
  5.5 BatchListingDialog
       │
Phase 6 ─── View Integration
  6.1 HypercertDetail — add marketplace section
  6.2 Hypercerts list — add status badges + filters
  6.3 (Optional) Marketplace overview tab
       │
Phase 7 ─── Testing
  7.1 Hook unit tests
  7.2 Module unit tests
  7.3 Component tests
```

Each phase is independently mergeable if needed, but Phases 1-3 are prerequisites for 4+.

---

## Verification

```bash
# After each phase:
cd packages/shared && bun run test
cd packages/admin && bun run test

# Full validation before PR:
bun format && bun lint && bun run test && bun build
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Marketplace SDK version incompatibility with existing @hypercerts-org/sdk | Pin compatible version, test import side-effects |
| EIP-712 domain separator differs per chain | Use SDK's built-in chain config, test on Sepolia first |
| Nonce management for maker orders | Use SDK's `getNonce()`, handle nonce conflicts gracefully |
| Exchange contract not deployed on Sepolia | Check deployment, may need testnet-specific mock strategy |
| Large bundle impact from marketplace SDK | Lazy-load SDK module, measure bundle delta |

---

## Out of Scope (Future PRs)

- Client PWA marketplace views (gardener-facing, read-only)
- Marketplace SDK server-side order book queries
- Advanced pricing strategies (dynamic pricing, time-weighted)
- Multi-currency support beyond WETH/USDC
- Order analytics dashboard
- Indexer event handlers for marketplace events
