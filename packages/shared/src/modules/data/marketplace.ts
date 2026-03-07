/**
 * Marketplace Data Functions
 *
 * On-chain read functions and event log queries for the
 * HypercertMarketplaceAdapter and HypercertsModule contracts.
 *
 * All functions return graceful defaults (empty arrays, null, 0n) on failure
 * and never throw — errors are logged via the structured logger.
 *
 * @module modules/data/marketplace
 */

import { type Address, parseAbiItem } from "viem";
import type { RegisteredOrderView, FractionTrade } from "../../types/hypercerts";
import { logger } from "../app/logger";
import { createPublicClientForChain } from "../../config/pimlico";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { isZeroAddress } from "../../utils/blockchain/address";
import { ZERO_ADDRESS } from "../../utils/blockchain/vaults";
import {
  MARKETPLACE_ADAPTER_ABI,
  HYPERCERTS_MODULE_ABI,
} from "../../hooks/hypercerts/hypercert-abis";

/** Parse an order tuple returned by the adapter's orders() view function. */
function parseOrderTuple(orderId: number, tuple: readonly unknown[]): RegisteredOrderView {
  return {
    orderId,
    hypercertId: tuple[0] as bigint,
    seller: tuple[6] as Address,
    currency: tuple[7] as Address,
    pricePerUnit: tuple[3] as bigint,
    minUnitAmount: tuple[4] as bigint,
    maxUnitAmount: tuple[5] as bigint,
    endTime: Number(tuple[8] as bigint),
    active: tuple[9] as boolean,
  };
}

// =============================================================================
// On-Chain Order Queries
// =============================================================================

/**
 * Read registered orders from the HypercertMarketplaceAdapter contract.
 * Uses HypercertsModule.getGardenHypercerts() to find all hypercert IDs,
 * then queries activeOrders for each.
 */
export async function getRegisteredOrders(
  gardenAddress: Address,
  chainId: number
): Promise<RegisteredOrderView[]> {
  const contracts = getNetworkContracts(chainId);

  if (isZeroAddress(contracts.marketplaceAdapter) || isZeroAddress(contracts.hypercertsModule)) {
    return [];
  }

  try {
    const client = createPublicClientForChain(chainId);
    const adapterAddress = contracts.marketplaceAdapter as Address;
    const moduleAddress = contracts.hypercertsModule as Address;

    // 1. Get garden's hypercert IDs via HypercertsModule
    const hypercertIds = (await client.readContract({
      address: moduleAddress,
      abi: HYPERCERTS_MODULE_ABI,
      functionName: "getGardenHypercerts",
      args: [gardenAddress],
    })) as bigint[];

    if (!hypercertIds || hypercertIds.length === 0) {
      return [];
    }

    // 2. For each hypercert, check active orders using multicall.
    // We use a default currency of ZERO_ADDRESS — the adapter maps (hypercertId, currency) -> orderId.
    // In practice a single "default" currency lookup suffices for garden-level views.
    const activeOrderCalls = hypercertIds.map((id) => ({
      address: adapterAddress,
      abi: MARKETPLACE_ADAPTER_ABI,
      functionName: "activeOrders" as const,
      args: [id, ZERO_ADDRESS],
    }));

    const activeOrderResults = await client.multicall({ contracts: activeOrderCalls });

    // Collect non-zero order IDs
    const orderIds: number[] = [];
    for (const result of activeOrderResults) {
      if (result.status === "success") {
        const orderId = result.result as bigint;
        if (orderId > 0n) {
          orderIds.push(Number(orderId));
        }
      }
    }

    if (orderIds.length === 0) {
      return [];
    }

    // 3. Batch read order details
    const orderCalls = orderIds.map((id) => ({
      address: adapterAddress,
      abi: MARKETPLACE_ADAPTER_ABI,
      functionName: "orders" as const,
      args: [BigInt(id)],
    }));

    const orderResults = await client.multicall({ contracts: orderCalls });

    const orders: RegisteredOrderView[] = [];
    for (let i = 0; i < orderResults.length; i++) {
      const res = orderResults[i];
      if (res.status === "success" && res.result) {
        orders.push(parseOrderTuple(orderIds[i], res.result as readonly unknown[]));
      }
    }

    return orders;
  } catch (error) {
    logger.error("Failed to fetch registered orders", {
      source: "getRegisteredOrders",
      gardenAddress,
      chainId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Get the active order for a specific hypercert+currency pair.
 */
export async function getActiveOrder(
  hypercertId: bigint,
  currency: Address,
  chainId: number
): Promise<RegisteredOrderView | null> {
  const contracts = getNetworkContracts(chainId);

  if (isZeroAddress(contracts.marketplaceAdapter)) {
    return null;
  }

  try {
    const client = createPublicClientForChain(chainId);
    const adapterAddress = contracts.marketplaceAdapter as Address;

    // Look up the active order ID for this (hypercertId, currency) pair
    const orderId = (await client.readContract({
      address: adapterAddress,
      abi: MARKETPLACE_ADAPTER_ABI,
      functionName: "activeOrders",
      args: [hypercertId, currency],
    })) as bigint;

    if (orderId === 0n) {
      return null;
    }

    // Read full order details
    const orderTuple = (await client.readContract({
      address: adapterAddress,
      abi: MARKETPLACE_ADAPTER_ABI,
      functionName: "orders",
      args: [orderId],
    })) as readonly unknown[];

    return parseOrderTuple(Number(orderId), orderTuple);
  } catch (error) {
    logger.error("Failed to fetch active order", {
      source: "getActiveOrder",
      hypercertId: hypercertId.toString(),
      currency,
      chainId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Preview how many units a given payment amount would purchase.
 * Calls adapter.previewPurchase().
 */
export async function previewPurchase(
  hypercertId: bigint,
  amount: bigint,
  currency: Address,
  chainId: number
): Promise<bigint> {
  const contracts = getNetworkContracts(chainId);

  if (isZeroAddress(contracts.marketplaceAdapter)) {
    return 0n;
  }

  try {
    const client = createPublicClientForChain(chainId);
    const adapterAddress = contracts.marketplaceAdapter as Address;

    const units = (await client.readContract({
      address: adapterAddress,
      abi: MARKETPLACE_ADAPTER_ABI,
      functionName: "previewPurchase",
      args: [hypercertId, amount, currency],
    })) as bigint;

    return units;
  } catch (error) {
    logger.error("Failed to preview purchase", {
      source: "previewPurchase",
      hypercertId: hypercertId.toString(),
      amount: amount.toString(),
      currency,
      chainId,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0n;
  }
}

/**
 * Get minimum price per unit for a hypercert+currency pair.
 * Calls adapter.getMinPrice().
 */
export async function getMinPrice(
  hypercertId: bigint,
  currency: Address,
  chainId: number
): Promise<bigint> {
  const contracts = getNetworkContracts(chainId);

  if (isZeroAddress(contracts.marketplaceAdapter)) {
    return 0n;
  }

  try {
    const client = createPublicClientForChain(chainId);
    const adapterAddress = contracts.marketplaceAdapter as Address;

    const price = (await client.readContract({
      address: adapterAddress,
      abi: MARKETPLACE_ADAPTER_ABI,
      functionName: "getMinPrice",
      args: [hypercertId, currency],
    })) as bigint;

    return price;
  } catch (error) {
    logger.error("Failed to fetch min price", {
      source: "getMinPrice",
      hypercertId: hypercertId.toString(),
      currency,
      chainId,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0n;
  }
}

/**
 * Get all orders registered by a seller (operator).
 * Reads sellerOrderCount, then batch reads sellerOrderId for each index,
 * then batch reads orders for each orderId.
 */
export async function getSellerOrders(
  seller: Address,
  chainId: number
): Promise<RegisteredOrderView[]> {
  const contracts = getNetworkContracts(chainId);

  if (isZeroAddress(contracts.marketplaceAdapter)) {
    return [];
  }

  try {
    const client = createPublicClientForChain(chainId);
    const adapterAddress = contracts.marketplaceAdapter as Address;

    // 1. Get seller's total order count
    const count = (await client.readContract({
      address: adapterAddress,
      abi: MARKETPLACE_ADAPTER_ABI,
      functionName: "getSellerOrderCount",
      args: [seller],
    })) as bigint;

    if (count === 0n) {
      return [];
    }

    // 2. Batch read all seller order IDs
    const indexCalls = Array.from({ length: Number(count) }, (_, i) => ({
      address: adapterAddress,
      abi: MARKETPLACE_ADAPTER_ABI,
      functionName: "getSellerOrderId" as const,
      args: [seller, BigInt(i)],
    }));

    const indexResults = await client.multicall({ contracts: indexCalls });

    const orderIds: number[] = [];
    for (const res of indexResults) {
      if (res.status === "success") {
        orderIds.push(Number(res.result as bigint));
      }
    }

    if (orderIds.length === 0) {
      return [];
    }

    // 3. Batch read order details
    const orderCalls = orderIds.map((id) => ({
      address: adapterAddress,
      abi: MARKETPLACE_ADAPTER_ABI,
      functionName: "orders" as const,
      args: [BigInt(id)],
    }));

    const orderResults = await client.multicall({ contracts: orderCalls });

    const orders: RegisteredOrderView[] = [];
    for (let i = 0; i < orderResults.length; i++) {
      const res = orderResults[i];
      if (res.status === "success" && res.result) {
        orders.push(parseOrderTuple(orderIds[i], res.result as readonly unknown[]));
      }
    }

    return orders;
  } catch (error) {
    logger.error("Failed to fetch seller orders", {
      source: "getSellerOrders",
      seller,
      chainId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

// =============================================================================
// Event-Based Trade History
// =============================================================================

/**
 * Fetch FractionPurchased events from the adapter to build trade history.
 * Uses viem getLogs with the FractionPurchased event signature.
 */
export async function getTradeHistory(
  hypercertId: bigint,
  chainId: number
): Promise<FractionTrade[]> {
  const contracts = getNetworkContracts(chainId);

  if (isZeroAddress(contracts.marketplaceAdapter)) {
    return [];
  }

  try {
    const client = createPublicClientForChain(chainId);
    const adapterAddress = contracts.marketplaceAdapter as Address;

    const logs = await client.getLogs({
      address: adapterAddress,
      event: parseAbiItem(
        "event FractionPurchased(uint256 indexed orderId, uint256 indexed hypercertId, address indexed recipient, uint256 units, uint256 payment)"
      ),
      args: {
        hypercertId,
      },
      fromBlock: "earliest",
      toBlock: "latest",
    });

    if (logs.length === 0) {
      return [];
    }

    // Resolve block timestamps for each log
    const trades: FractionTrade[] = [];
    for (const log of logs) {
      let timestamp = 0;
      try {
        const block = await client.getBlock({ blockNumber: log.blockNumber });
        timestamp = Number(block.timestamp);
      } catch (error) {
        logger.debug("Failed to fetch block timestamp for trade event", {
          error,
          blockNumber: log.blockNumber,
        });
      }

      const args = log.args as {
        orderId: bigint;
        hypercertId: bigint;
        recipient: Address;
        units: bigint;
        payment: bigint;
      };

      trades.push({
        orderId: Number(args.orderId),
        hypercertId: args.hypercertId,
        recipient: args.recipient,
        units: args.units,
        payment: args.payment,
        currency: ZERO_ADDRESS as Address, // Currency not in event — caller must resolve
        timestamp,
        txHash: log.transactionHash as `0x${string}`,
      });
    }

    return trades;
  } catch (error) {
    logger.error("Failed to fetch trade history", {
      source: "getTradeHistory",
      hypercertId: hypercertId.toString(),
      chainId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Fetch OrderRegistered and OrderDeactivated events for listing history.
 * Returns events sorted by timestamp descending (most recent first).
 */
export async function getListingHistory(
  gardenAddress: Address,
  chainId: number
): Promise<
  Array<{
    type: "registered" | "deactivated";
    orderId: number;
    timestamp: number;
    txHash: string;
  }>
> {
  const contracts = getNetworkContracts(chainId);

  if (isZeroAddress(contracts.marketplaceAdapter)) {
    return [];
  }

  try {
    const client = createPublicClientForChain(chainId);
    const adapterAddress = contracts.marketplaceAdapter as Address;

    // Fetch both event types in parallel
    const [registeredLogs, deactivatedLogs] = await Promise.all([
      client.getLogs({
        address: adapterAddress,
        event: parseAbiItem(
          "event OrderRegistered(uint256 indexed orderId, uint256 indexed hypercertId, address indexed seller, address currency, uint256 pricePerUnit, uint256 endTime)"
        ),
        args: {
          seller: gardenAddress,
        },
        fromBlock: "earliest",
        toBlock: "latest",
      }),
      client.getLogs({
        address: adapterAddress,
        event: parseAbiItem(
          "event OrderDeactivated(uint256 indexed orderId, address indexed deactivatedBy)"
        ),
        args: {
          deactivatedBy: gardenAddress,
        },
        fromBlock: "earliest",
        toBlock: "latest",
      }),
    ]);

    type ListingEvent = {
      type: "registered" | "deactivated";
      orderId: number;
      timestamp: number;
      txHash: string;
    };

    const events: ListingEvent[] = [];

    // Process registered events
    for (const log of registeredLogs) {
      let timestamp = 0;
      try {
        const block = await client.getBlock({ blockNumber: log.blockNumber });
        timestamp = Number(block.timestamp);
      } catch (error) {
        logger.debug("Failed to fetch block timestamp for registered event", {
          error,
          blockNumber: log.blockNumber,
        });
      }

      const args = log.args as { orderId: bigint };
      events.push({
        type: "registered",
        orderId: Number(args.orderId),
        timestamp,
        txHash: log.transactionHash as string,
      });
    }

    // Process deactivated events
    for (const log of deactivatedLogs) {
      let timestamp = 0;
      try {
        const block = await client.getBlock({ blockNumber: log.blockNumber });
        timestamp = Number(block.timestamp);
      } catch (error) {
        logger.debug("Failed to fetch block timestamp for deactivated event", {
          error,
          blockNumber: log.blockNumber,
        });
      }

      const args = log.args as { orderId: bigint };
      events.push({
        type: "deactivated",
        orderId: Number(args.orderId),
        timestamp,
        txHash: log.transactionHash as string,
      });
    }

    // Sort by timestamp descending (most recent first)
    events.sort((a, b) => b.timestamp - a.timestamp);

    return events;
  } catch (error) {
    logger.error("Failed to fetch listing history", {
      source: "getListingHistory",
      gardenAddress,
      chainId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
