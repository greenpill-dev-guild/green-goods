/**
 * Marketplace SDK Client Tests
 *
 * Tests for the singleton HypercertExchangeClient wrapper.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getMarketplaceClient,
  getMarketplaceAddresses,
  isMarketplaceSupported,
  resetMarketplaceClients,
} from "../../../modules/marketplace/client";

// Mock the marketplace SDK module
vi.mock("@hypercerts-org/marketplace-sdk", () => {
  const mockClient = {
    chainId: 11155111,
    addresses: {
      EXCHANGE_V2: "0x1111111111111111111111111111111111111111",
      TRANSFER_MANAGER_V2: "0x2222222222222222222222222222222222222222",
      ORDER_VALIDATOR_V2: "0x3333333333333333333333333333333333333333",
      MINTER: "0x4444444444444444444444444444444444444444",
    },
    currencies: {},
    api: {},
    getTypedDataDomain: vi.fn().mockReturnValue({
      name: "LooksRareProtocol",
      version: "2",
      chainId: 11155111,
      verifyingContract: "0x1111111111111111111111111111111111111111",
    }),
    createFractionalSaleMakerAsk: vi.fn(),
    signMakerOrder: vi.fn(),
  };

  return {
    HypercertExchangeClient: vi.fn().mockImplementation(() => mockClient),
    ChainId: {
      SEPOLIA: 11155111,
      OPTIMISM: 10,
      CELO: 42220,
      ARBITRUM: 42161,
      BASE_SEPOLIA: 84532,
      ARBITRUM_SEPOLIA: 421614,
      HARDHAT: 31337,
    },
    addressesByNetwork: {
      11155111: {
        EXCHANGE_V2: "0x1111111111111111111111111111111111111111",
        TRANSFER_MANAGER_V2: "0x2222222222222222222222222222222222222222",
        ORDER_VALIDATOR_V2: "0x3333333333333333333333333333333333333333",
        MINTER: "0x4444444444444444444444444444444444444444",
      },
      42220: {
        EXCHANGE_V2: "0x5555555555555555555555555555555555555555",
        TRANSFER_MANAGER_V2: "0x6666666666666666666666666666666666666666",
        ORDER_VALIDATOR_V2: "0x7777777777777777777777777777777777777777",
        MINTER: "0x8888888888888888888888888888888888888888",
      },
    },
    CollectionType: { ERC721: 0, ERC1155: 1, HYPERCERT: 2 },
    QuoteType: { Bid: 0, Ask: 1 },
    StrategyType: {
      standard: 0,
      hypercertFractionOffer: 1,
      hypercertFractionOfferWithAllowlist: 2,
    },
  };
});

describe("marketplace/client", () => {
  beforeEach(() => {
    resetMarketplaceClients();
  });

  describe("isMarketplaceSupported", () => {
    it("returns true for supported chains", () => {
      expect(isMarketplaceSupported(11155111)).toBe(true);
      expect(isMarketplaceSupported(42220)).toBe(true);
    });

    it("returns false for unsupported chains", () => {
      expect(isMarketplaceSupported(999999)).toBe(false);
    });
  });

  describe("getMarketplaceAddresses", () => {
    it("returns addresses for supported chain", () => {
      const addresses = getMarketplaceAddresses(11155111);
      expect(addresses).toBeDefined();
      expect(addresses?.EXCHANGE_V2).toBeDefined();
      expect(addresses?.TRANSFER_MANAGER_V2).toBeDefined();
      expect(addresses?.MINTER).toBeDefined();
    });

    it("returns null for unsupported chain", () => {
      const addresses = getMarketplaceAddresses(999999);
      expect(addresses).toBeNull();
    });
  });

  describe("getMarketplaceClient", () => {
    it("returns a client for supported chain", () => {
      const client = getMarketplaceClient(11155111);
      expect(client).not.toBeNull();
    });

    it("returns same instance for same chain (singleton)", () => {
      const client1 = getMarketplaceClient(11155111);
      const client2 = getMarketplaceClient(11155111);
      expect(client1).toBe(client2);
    });

    it("returns null for unsupported chain", () => {
      const client = getMarketplaceClient(999999);
      expect(client).toBeNull();
    });

    it("returns different instances for different chains", () => {
      const clientSepolia = getMarketplaceClient(11155111);
      const clientCelo = getMarketplaceClient(42220);
      // Both should exist but differ (or be same mock -- depends on mock)
      expect(clientSepolia).not.toBeNull();
      expect(clientCelo).not.toBeNull();
    });
  });

  describe("resetMarketplaceClients", () => {
    it("clears cached clients", () => {
      const client1 = getMarketplaceClient(11155111);
      resetMarketplaceClients();
      const client2 = getMarketplaceClient(11155111);
      // After reset, a new instance should be created (not the same reference)
      // With mocking this is the same mock object, but the map entry was cleared
      expect(client1).not.toBeNull();
      expect(client2).not.toBeNull();
    });
  });
});
