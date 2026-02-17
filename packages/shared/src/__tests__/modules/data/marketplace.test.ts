/**
 * Marketplace Data Functions Tests
 *
 * Tests for on-chain read functions and event log queries
 * for the HypercertMarketplaceAdapter and HypercertsModule contracts.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import type { Address } from "viem";

// We mock the dependencies before importing the module under test
vi.mock("../../../config/pimlico", () => ({
  createPublicClientForChain: vi.fn(),
}));

vi.mock("../../../utils/blockchain/contracts", () => ({
  getNetworkContracts: vi.fn(),
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  getRegisteredOrders,
  getActiveOrder,
  previewPurchase,
  getMinPrice,
  getSellerOrders,
  getTradeHistory,
  getListingHistory,
} from "../../../modules/data/marketplace";

import { createPublicClientForChain } from "../../../config/pimlico";
import { getNetworkContracts } from "../../../utils/blockchain/contracts";
import { logger } from "../../../modules/app/logger";

// ============================================
// Test Constants
// ============================================

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const MOCK_ADAPTER_ADDRESS = "0xAdapterAddress000000000000000000000000000" as Address;
const MOCK_MODULE_ADDRESS = "0xModuleAddress0000000000000000000000000000" as Address;
const MOCK_GARDEN_ADDRESS = "0xGardenAddress0000000000000000000000000000" as Address;
const MOCK_SELLER_ADDRESS = "0xSellerAddress0000000000000000000000000000" as Address;
const MOCK_CURRENCY_ADDRESS = "0xCurrencyAddress00000000000000000000000000" as Address;
const MOCK_RECIPIENT_ADDRESS = "0xRecipientAddr0000000000000000000000000000" as Address;
const CHAIN_ID = 11155111;

// ============================================
// Test Helpers
// ============================================

function createMockContracts(overrides: Partial<Record<string, string>> = {}) {
  return {
    marketplaceAdapter: MOCK_ADAPTER_ADDRESS,
    hypercertsModule: MOCK_MODULE_ADDRESS,
    gardenToken: "0x1111111111111111111111111111111111111111",
    actionRegistry: "0x2222222222222222222222222222222222222222",
    ...overrides,
  };
}

function createMockPublicClient() {
  return {
    readContract: vi.fn(),
    getLogs: vi.fn(),
    multicall: vi.fn(),
  };
}

// ============================================
// getRegisteredOrders Tests
// ============================================

describe("getRegisteredOrders", () => {
  let mockClient: ReturnType<typeof createMockPublicClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockPublicClient();
    (createPublicClientForChain as Mock).mockReturnValue(mockClient);
    (getNetworkContracts as Mock).mockReturnValue(createMockContracts());
  });

  it("returns empty array when marketplaceAdapter is zero address", async () => {
    (getNetworkContracts as Mock).mockReturnValue(
      createMockContracts({ marketplaceAdapter: ZERO_ADDRESS })
    );

    const result = await getRegisteredOrders(MOCK_GARDEN_ADDRESS, CHAIN_ID);
    expect(result).toEqual([]);
    expect(mockClient.readContract).not.toHaveBeenCalled();
  });

  it("returns empty array when hypercertsModule is zero address", async () => {
    (getNetworkContracts as Mock).mockReturnValue(
      createMockContracts({ hypercertsModule: ZERO_ADDRESS })
    );

    const result = await getRegisteredOrders(MOCK_GARDEN_ADDRESS, CHAIN_ID);
    expect(result).toEqual([]);
  });

  it("returns empty array when garden has no hypercerts", async () => {
    mockClient.readContract.mockResolvedValueOnce([]); // getGardenHypercerts returns empty

    const result = await getRegisteredOrders(MOCK_GARDEN_ADDRESS, CHAIN_ID);
    expect(result).toEqual([]);
  });

  it("queries activeOrders for each hypercert ID and returns matching orders", async () => {
    // getGardenHypercerts returns two hypercert IDs
    mockClient.readContract.mockResolvedValueOnce([42n, 43n]);

    // multicall: activeOrders returns order IDs [1n, 0n] (second has no active order)
    mockClient.multicall.mockResolvedValueOnce([
      { result: 1n, status: "success" },
      { result: 0n, status: "success" },
    ]);

    // multicall: orders(1) returns order details
    mockClient.multicall.mockResolvedValueOnce([
      {
        result: [
          42n, // hypercertId
          "0x", // encodedMakerAsk
          "0x", // signature
          10000000000000n, // pricePerUnit
          1n, // minUnitAmount
          2n ** 256n - 1n, // maxUnitAmount
          MOCK_SELLER_ADDRESS, // seller
          MOCK_CURRENCY_ADDRESS, // currency
          1711929600n, // endTime
          true, // active
        ],
        status: "success",
      },
    ]);

    const result = await getRegisteredOrders(MOCK_GARDEN_ADDRESS, CHAIN_ID);
    expect(result).toHaveLength(1);
    expect(result[0].orderId).toBe(1);
    expect(result[0].hypercertId).toBe(42n);
    expect(result[0].active).toBe(true);
    expect(result[0].seller).toBe(MOCK_SELLER_ADDRESS);
  });

  it("returns empty array and logs error on contract read failure", async () => {
    mockClient.readContract.mockRejectedValueOnce(new Error("RPC timeout"));

    const result = await getRegisteredOrders(MOCK_GARDEN_ADDRESS, CHAIN_ID);
    expect(result).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Failed to fetch registered orders"),
      expect.objectContaining({ source: "getRegisteredOrders" })
    );
  });
});

// ============================================
// getActiveOrder Tests
// ============================================

describe("getActiveOrder", () => {
  let mockClient: ReturnType<typeof createMockPublicClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockPublicClient();
    (createPublicClientForChain as Mock).mockReturnValue(mockClient);
    (getNetworkContracts as Mock).mockReturnValue(createMockContracts());
  });

  it("returns null when marketplaceAdapter is zero address", async () => {
    (getNetworkContracts as Mock).mockReturnValue(
      createMockContracts({ marketplaceAdapter: ZERO_ADDRESS })
    );

    const result = await getActiveOrder(42n, MOCK_CURRENCY_ADDRESS, CHAIN_ID);
    expect(result).toBeNull();
  });

  it("returns null when activeOrders returns 0 (no active order)", async () => {
    mockClient.readContract.mockResolvedValueOnce(0n); // activeOrders returns 0

    const result = await getActiveOrder(42n, MOCK_CURRENCY_ADDRESS, CHAIN_ID);
    expect(result).toBeNull();
  });

  it("returns the order when activeOrders returns a valid orderId", async () => {
    // activeOrders returns orderId 5
    mockClient.readContract.mockResolvedValueOnce(5n);
    // orders(5) returns order details
    mockClient.readContract.mockResolvedValueOnce([
      42n, // hypercertId
      "0x", // encodedMakerAsk
      "0x", // signature
      10000000000000n, // pricePerUnit
      1n, // minUnitAmount
      2n ** 256n - 1n, // maxUnitAmount
      MOCK_SELLER_ADDRESS, // seller
      MOCK_CURRENCY_ADDRESS, // currency
      1711929600n, // endTime
      true, // active
    ]);

    const result = await getActiveOrder(42n, MOCK_CURRENCY_ADDRESS, CHAIN_ID);
    expect(result).not.toBeNull();
    expect(result!.orderId).toBe(5);
    expect(result!.hypercertId).toBe(42n);
    expect(result!.active).toBe(true);
  });

  it("returns null and logs error on failure", async () => {
    mockClient.readContract.mockRejectedValueOnce(new Error("revert"));

    const result = await getActiveOrder(42n, MOCK_CURRENCY_ADDRESS, CHAIN_ID);
    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });
});

// ============================================
// previewPurchase Tests
// ============================================

describe("previewPurchase", () => {
  let mockClient: ReturnType<typeof createMockPublicClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockPublicClient();
    (createPublicClientForChain as Mock).mockReturnValue(mockClient);
    (getNetworkContracts as Mock).mockReturnValue(createMockContracts());
  });

  it("returns 0n when marketplaceAdapter is zero address", async () => {
    (getNetworkContracts as Mock).mockReturnValue(
      createMockContracts({ marketplaceAdapter: ZERO_ADDRESS })
    );

    const result = await previewPurchase(42n, 1000n, MOCK_CURRENCY_ADDRESS, CHAIN_ID);
    expect(result).toBe(0n);
  });

  it("calls adapter previewPurchase and returns units", async () => {
    mockClient.readContract.mockResolvedValueOnce(500n);

    const result = await previewPurchase(42n, 1000n, MOCK_CURRENCY_ADDRESS, CHAIN_ID);
    expect(result).toBe(500n);
    expect(mockClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "previewPurchase",
        args: [42n, 1000n, MOCK_CURRENCY_ADDRESS],
      })
    );
  });

  it("returns 0n on failure", async () => {
    mockClient.readContract.mockRejectedValueOnce(new Error("revert"));

    const result = await previewPurchase(42n, 1000n, MOCK_CURRENCY_ADDRESS, CHAIN_ID);
    expect(result).toBe(0n);
    expect(logger.error).toHaveBeenCalled();
  });
});

// ============================================
// getMinPrice Tests
// ============================================

describe("getMinPrice", () => {
  let mockClient: ReturnType<typeof createMockPublicClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockPublicClient();
    (createPublicClientForChain as Mock).mockReturnValue(mockClient);
    (getNetworkContracts as Mock).mockReturnValue(createMockContracts());
  });

  it("returns 0n when marketplaceAdapter is zero address", async () => {
    (getNetworkContracts as Mock).mockReturnValue(
      createMockContracts({ marketplaceAdapter: ZERO_ADDRESS })
    );

    const result = await getMinPrice(42n, MOCK_CURRENCY_ADDRESS, CHAIN_ID);
    expect(result).toBe(0n);
  });

  it("calls adapter getMinPrice and returns the price", async () => {
    mockClient.readContract.mockResolvedValueOnce(10000000000000n);

    const result = await getMinPrice(42n, MOCK_CURRENCY_ADDRESS, CHAIN_ID);
    expect(result).toBe(10000000000000n);
  });

  it("returns 0n on failure", async () => {
    mockClient.readContract.mockRejectedValueOnce(new Error("revert"));

    const result = await getMinPrice(42n, MOCK_CURRENCY_ADDRESS, CHAIN_ID);
    expect(result).toBe(0n);
  });
});

// ============================================
// getSellerOrders Tests
// ============================================

describe("getSellerOrders", () => {
  let mockClient: ReturnType<typeof createMockPublicClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockPublicClient();
    (createPublicClientForChain as Mock).mockReturnValue(mockClient);
    (getNetworkContracts as Mock).mockReturnValue(createMockContracts());
  });

  it("returns empty array when marketplaceAdapter is zero address", async () => {
    (getNetworkContracts as Mock).mockReturnValue(
      createMockContracts({ marketplaceAdapter: ZERO_ADDRESS })
    );

    const result = await getSellerOrders(MOCK_SELLER_ADDRESS, CHAIN_ID);
    expect(result).toEqual([]);
  });

  it("returns empty array when seller has zero orders", async () => {
    mockClient.readContract.mockResolvedValueOnce(0n); // getSellerOrderCount returns 0

    const result = await getSellerOrders(MOCK_SELLER_ADDRESS, CHAIN_ID);
    expect(result).toEqual([]);
  });

  it("batch reads seller order IDs then order details", async () => {
    // getSellerOrderCount returns 2
    mockClient.readContract.mockResolvedValueOnce(2n);

    // multicall: getSellerOrderId for indices 0 and 1
    mockClient.multicall.mockResolvedValueOnce([
      { result: 10n, status: "success" },
      { result: 20n, status: "success" },
    ]);

    // multicall: orders(10) and orders(20)
    mockClient.multicall.mockResolvedValueOnce([
      {
        result: [
          42n,
          "0x",
          "0x",
          10000000000000n,
          1n,
          2n ** 256n - 1n,
          MOCK_SELLER_ADDRESS,
          MOCK_CURRENCY_ADDRESS,
          1711929600n,
          true,
        ],
        status: "success",
      },
      {
        result: [
          43n,
          "0x",
          "0x",
          20000000000000n,
          1n,
          2n ** 256n - 1n,
          MOCK_SELLER_ADDRESS,
          MOCK_CURRENCY_ADDRESS,
          1711929600n,
          false,
        ],
        status: "success",
      },
    ]);

    const result = await getSellerOrders(MOCK_SELLER_ADDRESS, CHAIN_ID);
    expect(result).toHaveLength(2);
    expect(result[0].orderId).toBe(10);
    expect(result[0].active).toBe(true);
    expect(result[1].orderId).toBe(20);
    expect(result[1].active).toBe(false);
  });

  it("returns empty array and logs error on failure", async () => {
    mockClient.readContract.mockRejectedValueOnce(new Error("RPC error"));

    const result = await getSellerOrders(MOCK_SELLER_ADDRESS, CHAIN_ID);
    expect(result).toEqual([]);
    expect(logger.error).toHaveBeenCalled();
  });
});

// ============================================
// getTradeHistory Tests
// ============================================

describe("getTradeHistory", () => {
  let mockClient: ReturnType<typeof createMockPublicClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockPublicClient();
    (createPublicClientForChain as Mock).mockReturnValue(mockClient);
    (getNetworkContracts as Mock).mockReturnValue(createMockContracts());
  });

  it("returns empty array when marketplaceAdapter is zero address", async () => {
    (getNetworkContracts as Mock).mockReturnValue(
      createMockContracts({ marketplaceAdapter: ZERO_ADDRESS })
    );

    const result = await getTradeHistory(42n, CHAIN_ID);
    expect(result).toEqual([]);
  });

  it("parses FractionPurchased event logs into FractionTrade objects", async () => {
    mockClient.getLogs.mockResolvedValueOnce([
      {
        args: {
          orderId: 1n,
          hypercertId: 42n,
          recipient: MOCK_RECIPIENT_ADDRESS,
          units: 500n,
          payment: 5000000000000000n,
        },
        blockNumber: 100n,
        transactionHash: "0xabc123" as `0x${string}`,
      },
    ]);

    // getBlock for timestamp
    mockClient.getBlock = vi.fn().mockResolvedValueOnce({ timestamp: 1704067200n });

    const result = await getTradeHistory(42n, CHAIN_ID);
    expect(result).toHaveLength(1);
    expect(result[0].orderId).toBe(1);
    expect(result[0].hypercertId).toBe(42n);
    expect(result[0].recipient).toBe(MOCK_RECIPIENT_ADDRESS);
    expect(result[0].units).toBe(500n);
    expect(result[0].payment).toBe(5000000000000000n);
    expect(result[0].txHash).toBe("0xabc123");
  });

  it("returns empty array when no events found", async () => {
    mockClient.getLogs.mockResolvedValueOnce([]);

    const result = await getTradeHistory(42n, CHAIN_ID);
    expect(result).toEqual([]);
  });

  it("returns empty array and logs error on failure", async () => {
    mockClient.getLogs.mockRejectedValueOnce(new Error("getLogs failed"));

    const result = await getTradeHistory(42n, CHAIN_ID);
    expect(result).toEqual([]);
    expect(logger.error).toHaveBeenCalled();
  });
});

// ============================================
// getListingHistory Tests
// ============================================

describe("getListingHistory", () => {
  let mockClient: ReturnType<typeof createMockPublicClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockPublicClient();
    (createPublicClientForChain as Mock).mockReturnValue(mockClient);
    (getNetworkContracts as Mock).mockReturnValue(createMockContracts());
  });

  it("returns empty array when marketplaceAdapter is zero address", async () => {
    (getNetworkContracts as Mock).mockReturnValue(
      createMockContracts({ marketplaceAdapter: ZERO_ADDRESS })
    );

    const result = await getListingHistory(MOCK_GARDEN_ADDRESS, CHAIN_ID);
    expect(result).toEqual([]);
  });

  it("combines OrderRegistered and OrderDeactivated events sorted by timestamp", async () => {
    // First getLogs call: OrderRegistered events
    mockClient.getLogs.mockResolvedValueOnce([
      {
        args: {
          orderId: 1n,
          hypercertId: 42n,
          seller: MOCK_SELLER_ADDRESS,
          currency: MOCK_CURRENCY_ADDRESS,
          pricePerUnit: 10000000000000n,
          endTime: 1711929600n,
        },
        blockNumber: 100n,
        transactionHash: "0xreg1" as `0x${string}`,
      },
    ]);

    // Second getLogs call: OrderDeactivated events
    mockClient.getLogs.mockResolvedValueOnce([
      {
        args: {
          orderId: 1n,
          deactivatedBy: MOCK_SELLER_ADDRESS,
        },
        blockNumber: 200n,
        transactionHash: "0xdeact1" as `0x${string}`,
      },
    ]);

    // getBlock calls for timestamps
    mockClient.getBlock = vi
      .fn()
      .mockResolvedValueOnce({ timestamp: 1704067200n })
      .mockResolvedValueOnce({ timestamp: 1704153600n });

    const result = await getListingHistory(MOCK_GARDEN_ADDRESS, CHAIN_ID);
    expect(result).toHaveLength(2);
    // Should be sorted by timestamp descending (most recent first)
    expect(result[0].type).toBe("deactivated");
    expect(result[0].timestamp).toBe(1704153600);
    expect(result[1].type).toBe("registered");
    expect(result[1].timestamp).toBe(1704067200);
  });

  it("returns empty array when no events found", async () => {
    mockClient.getLogs.mockResolvedValueOnce([]);
    mockClient.getLogs.mockResolvedValueOnce([]);

    const result = await getListingHistory(MOCK_GARDEN_ADDRESS, CHAIN_ID);
    expect(result).toEqual([]);
  });

  it("returns empty array and logs error on failure", async () => {
    mockClient.getLogs.mockRejectedValueOnce(new Error("getLogs failed"));

    const result = await getListingHistory(MOCK_GARDEN_ADDRESS, CHAIN_ID);
    expect(result).toEqual([]);
    expect(logger.error).toHaveBeenCalled();
  });
});
