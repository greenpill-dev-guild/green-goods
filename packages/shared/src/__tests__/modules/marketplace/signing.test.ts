/**
 * Marketplace Order Signing Tests
 *
 * Tests for building, signing, and validating maker ask orders.
 *
 * @vitest-environment node
 */

import type { Address, Hex, WalletClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildMakerAsk, signMakerAsk, validateOrder } from "../../../modules/marketplace/signing";
import type { CreateListingParams } from "../../../types/hypercerts";

// Mock the marketplace SDK
vi.mock("@hypercerts-org/marketplace-sdk", () => ({
  addressesByNetwork: {
    11155111: {
      EXCHANGE_V2: "0x1111111111111111111111111111111111111111",
      TRANSFER_MANAGER_V2: "0x2222222222222222222222222222222222222222",
      ORDER_VALIDATOR_V2: "0x3333333333333333333333333333333333333333",
      MINTER: "0x4444444444444444444444444444444444444444",
    },
  },
  ChainId: {
    SEPOLIA: 11155111,
    OPTIMISM: 10,
    CELO: 42220,
    ARBITRUM: 42161,
    BASE_SEPOLIA: 84532,
    ARBITRUM_SEPOLIA: 421614,
    HARDHAT: 31337,
  },
  CollectionType: { ERC721: 0, ERC1155: 1, HYPERCERT: 2 },
  QuoteType: { Bid: 0, Ask: 1 },
  StrategyType: {
    standard: 0,
    hypercertFractionOffer: 1,
    hypercertFractionOfferWithAllowlist: 2,
  },
}));

// Mock the client module
vi.mock("../../../modules/marketplace/client", () => ({
  getMarketplaceAddresses: vi.fn().mockReturnValue({
    EXCHANGE_V2: "0x1111111111111111111111111111111111111111",
    TRANSFER_MANAGER_V2: "0x2222222222222222222222222222222222222222",
    ORDER_VALIDATOR_V2: "0x3333333333333333333333333333333333333333",
    MINTER: "0x4444444444444444444444444444444444444444",
  }),
  isMarketplaceSupported: vi.fn().mockReturnValue(true),
}));

const TEST_SIGNER = "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF" as Address;
const CHAIN_ID = 11155111;

function makeTestParams(overrides?: Partial<CreateListingParams>): CreateListingParams {
  const now = Math.floor(Date.now() / 1000);
  return {
    hypercertId: 1001n,
    fractionId: 2001n,
    currency: "0x0000000000000000000000000000000000000000" as Address,
    pricePerUnit: 10n ** 13n,
    minUnitAmount: 1n,
    maxUnitAmount: 2n ** 256n - 1n,
    minUnitsToKeep: 0n,
    sellLeftover: true,
    durationDays: 90,
    ...overrides,
  };
}

describe("marketplace/signing", () => {
  describe("buildMakerAsk", () => {
    it("builds a valid MakerAskOrder from CreateListingParams", () => {
      const params = makeTestParams();
      const order = buildMakerAsk(params, TEST_SIGNER, CHAIN_ID);

      expect(order.quoteType).toBe(1); // Ask
      expect(order.signer).toBe(TEST_SIGNER);
      expect(order.collection).toBe("0x4444444444444444444444444444444444444444");
      expect(order.currency).toBe(params.currency);
      expect(order.price).toBe(params.pricePerUnit);
      expect(order.itemIds).toEqual([params.fractionId]);
      expect(order.amounts).toEqual([1n]);
      expect(order.collectionType).toBe(2); // HYPERCERT
      expect(order.strategyId).toBe(1n); // hypercertFractionOffer
    });

    it("sets correct start and end times", () => {
      const params = makeTestParams({ durationDays: 30 });
      const order = buildMakerAsk(params, TEST_SIGNER, CHAIN_ID);

      const now = Math.floor(Date.now() / 1000);
      // startTime should be around now (within 5 seconds)
      expect(Number(order.startTime)).toBeGreaterThanOrEqual(now - 5);
      expect(Number(order.startTime)).toBeLessThanOrEqual(now + 5);

      // endTime should be ~30 days from now
      const expectedEnd = now + 30 * 24 * 3600;
      expect(Number(order.endTime)).toBeGreaterThanOrEqual(expectedEnd - 5);
      expect(Number(order.endTime)).toBeLessThanOrEqual(expectedEnd + 5);
    });

    it("encodes additionalParameters correctly", () => {
      const params = makeTestParams({
        minUnitAmount: 100n,
        maxUnitAmount: 10000n,
        minUnitsToKeep: 50n,
        sellLeftover: false,
      });
      const order = buildMakerAsk(params, TEST_SIGNER, CHAIN_ID);

      // additionalParameters should be a hex-encoded bytes string
      expect(order.additionalParameters).toMatch(/^0x/);
      expect(order.additionalParameters.length).toBeGreaterThan(2);
    });

    it("initializes nonces to zero", () => {
      const params = makeTestParams();
      const order = buildMakerAsk(params, TEST_SIGNER, CHAIN_ID);

      expect(order.globalNonce).toBe(0n);
      expect(order.subsetNonce).toBe(0n);
      expect(order.orderNonce).toBe(0n);
    });
  });

  describe("signMakerAsk", () => {
    it("calls walletClient.signTypedData with correct domain and types", async () => {
      const params = makeTestParams();
      const order = buildMakerAsk(params, TEST_SIGNER, CHAIN_ID);

      const mockSignature = "0xabcdef1234567890" as Hex;
      const mockWalletClient = {
        signTypedData: vi.fn().mockResolvedValue(mockSignature),
      } as unknown as WalletClient;

      const signature = await signMakerAsk(order, mockWalletClient, CHAIN_ID);

      expect(signature).toBe(mockSignature);
      expect(mockWalletClient.signTypedData).toHaveBeenCalledOnce();

      // Verify the domain was passed correctly
      const callArgs = (mockWalletClient.signTypedData as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(callArgs.domain.name).toBe("LooksRareProtocol");
      expect(callArgs.domain.version).toBe("2");
      expect(callArgs.domain.chainId).toBe(CHAIN_ID);
      expect(callArgs.domain.verifyingContract).toBe("0x1111111111111111111111111111111111111111");
    });
  });

  describe("validateOrder", () => {
    it("validates a correct order", () => {
      const params = makeTestParams();
      const order = buildMakerAsk(params, TEST_SIGNER, CHAIN_ID);
      const result = validateOrder(order, CHAIN_ID);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects order with endTime in the past", () => {
      const params = makeTestParams();
      const order = buildMakerAsk(params, TEST_SIGNER, CHAIN_ID);
      // Override endTime to be in the past
      order.endTime = BigInt(Math.floor(Date.now() / 1000) - 3600);

      const result = validateOrder(order, CHAIN_ID);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("endTime must be in the future");
    });

    it("rejects order with zero price", () => {
      const params = makeTestParams({ pricePerUnit: 0n });
      const order = buildMakerAsk(params, TEST_SIGNER, CHAIN_ID);

      const result = validateOrder(order, CHAIN_ID);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("price must be greater than zero");
    });

    it("rejects order with empty itemIds", () => {
      const params = makeTestParams();
      const order = buildMakerAsk(params, TEST_SIGNER, CHAIN_ID);
      order.itemIds = [];

      const result = validateOrder(order, CHAIN_ID);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("itemIds must not be empty");
    });

    it("rejects order with startTime >= endTime", () => {
      const params = makeTestParams();
      const order = buildMakerAsk(params, TEST_SIGNER, CHAIN_ID);
      const futureTime = BigInt(Math.floor(Date.now() / 1000) + 7200);
      order.startTime = futureTime;
      order.endTime = futureTime;

      const result = validateOrder(order, CHAIN_ID);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("startTime must be before endTime");
    });
  });
});
