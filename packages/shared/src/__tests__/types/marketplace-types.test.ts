/**
 * Marketplace Type Shape Tests
 *
 * Validates that hypercert marketplace types have the correct shape
 * for listing, trading, and order management.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";

import type {
  CreateListingParams,
  FractionTrade,
  HypercertListing,
  ListingStatus,
  RegisteredOrderView,
} from "../../types/hypercerts";

import { LISTING_DEFAULTS } from "../../types/hypercerts";

describe("types/hypercerts marketplace types", () => {
  describe("HypercertListing", () => {
    it("has all required fields for a maker ask order", () => {
      const listing: HypercertListing = {
        orderId: 1,
        hypercertId: 42n,
        fractionId: 100n,
        seller: "0x1234567890abcdef1234567890abcdef12345678",
        currency: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        pricePerUnit: 10000000000000n,
        minUnitAmount: 1n,
        maxUnitAmount: 2n ** 256n - 1n,
        minUnitsToKeep: 0n,
        sellLeftover: true,
        startTime: 1704067200,
        endTime: 1711929600,
        status: "active",
        signature: "0xdeadbeef",
        orderNonce: 0n,
        createdAt: 1704067200,
      };

      expect(listing.orderId).toBe(1);
      expect(listing.hypercertId).toBe(42n);
      expect(listing.fractionId).toBe(100n);
      expect(listing.seller).toBe("0x1234567890abcdef1234567890abcdef12345678");
      expect(listing.status).toBe("active");
      expect(listing.sellLeftover).toBe(true);
    });

    it("supports all listing statuses", () => {
      const statuses: ListingStatus[] = ["active", "expired", "cancelled", "filled"];
      expect(statuses).toHaveLength(4);
    });
  });

  describe("CreateListingParams", () => {
    it("has parameters for creating a new listing", () => {
      const params: CreateListingParams = {
        hypercertId: 42n,
        fractionId: 100n,
        currency: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        pricePerUnit: 10000000000000n,
        minUnitAmount: 1n,
        maxUnitAmount: 2n ** 256n - 1n,
        minUnitsToKeep: 0n,
        sellLeftover: true,
        durationDays: 90,
      };

      expect(params.durationDays).toBe(90);
      expect(params.hypercertId).toBe(42n);
    });
  });

  describe("LISTING_DEFAULTS", () => {
    it("provides recommended default values", () => {
      expect(LISTING_DEFAULTS.pricePerUnit).toBe(1n * 10n ** 13n);
      expect(LISTING_DEFAULTS.minUnitAmount).toBe(1n);
      expect(LISTING_DEFAULTS.maxUnitAmount).toBe(2n ** 256n - 1n);
      expect(LISTING_DEFAULTS.minUnitsToKeep).toBe(0n);
      expect(LISTING_DEFAULTS.sellLeftover).toBe(true);
      expect(LISTING_DEFAULTS.durationDays).toBe(90);
    });
  });

  describe("FractionTrade", () => {
    it("has fields for a completed fraction purchase", () => {
      const trade: FractionTrade = {
        orderId: 1,
        hypercertId: 42n,
        recipient: "0xBuyerAddress0000000000000000000000000000",
        units: 500n,
        payment: 5000000000000000n,
        currency: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        timestamp: 1704067200,
        txHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      };

      expect(trade.orderId).toBe(1);
      expect(trade.units).toBe(500n);
      expect(trade.payment).toBe(5000000000000000n);
      expect(trade.txHash).toMatch(/^0x/);
    });
  });

  describe("RegisteredOrderView", () => {
    it("has on-chain order state fields", () => {
      const order: RegisteredOrderView = {
        orderId: 1,
        hypercertId: 42n,
        seller: "0x1234567890abcdef1234567890abcdef12345678",
        currency: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        pricePerUnit: 10000000000000n,
        minUnitAmount: 1n,
        maxUnitAmount: 2n ** 256n - 1n,
        endTime: 1711929600,
        active: true,
      };

      expect(order.active).toBe(true);
      expect(order.endTime).toBe(1711929600);
    });
  });
});
