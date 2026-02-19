/**
 * Marketplace Approvals Tests
 *
 * Tests for checking and building marketplace approval transactions.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Address } from "viem";
import {
  checkMarketplaceApprovals,
  buildApprovalTransactions,
} from "../../../modules/marketplace/approvals";

const TEST_OPERATOR = "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF" as Address;
const CHAIN_ID = 11155111;

// Mock createPublicClientForChain
const mockReadContract = vi.fn();
vi.mock("../../../config", () => ({
  createPublicClientForChain: vi.fn().mockReturnValue({
    readContract: (...args: unknown[]) => mockReadContract(...args),
  }),
}));

// Mock getNetworkContracts
vi.mock("../../../utils/blockchain/contracts", () => ({
  getNetworkContracts: vi.fn().mockReturnValue({
    hypercertExchange: "0x1111111111111111111111111111111111111111",
    hypercertMinter: "0x4444444444444444444444444444444444444444",
    transferManager: "0x2222222222222222222222222222222222222222",
    marketplaceAdapter: "0x5555555555555555555555555555555555555555",
  }),
}));

// Mock marketplace SDK
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
  },
}));

describe("marketplace/approvals", () => {
  beforeEach(() => {
    mockReadContract.mockReset();
  });

  describe("checkMarketplaceApprovals", () => {
    it("returns both approvals as true when already approved", async () => {
      // hasUserApprovedOperator returns true
      mockReadContract.mockResolvedValueOnce(true);
      // isApprovedForAll returns true
      mockReadContract.mockResolvedValueOnce(true);

      const result = await checkMarketplaceApprovals(TEST_OPERATOR, CHAIN_ID);

      expect(result.exchangeApproved).toBe(true);
      expect(result.minterApproved).toBe(true);
    });

    it("returns both approvals as false when not approved", async () => {
      mockReadContract.mockResolvedValueOnce(false);
      mockReadContract.mockResolvedValueOnce(false);

      const result = await checkMarketplaceApprovals(TEST_OPERATOR, CHAIN_ID);

      expect(result.exchangeApproved).toBe(false);
      expect(result.minterApproved).toBe(false);
    });

    it("returns mixed approval status correctly", async () => {
      // Exchange approved, minter not approved
      mockReadContract.mockResolvedValueOnce(true);
      mockReadContract.mockResolvedValueOnce(false);

      const result = await checkMarketplaceApprovals(TEST_OPERATOR, CHAIN_ID);

      expect(result.exchangeApproved).toBe(true);
      expect(result.minterApproved).toBe(false);
    });

    it("checks transfer manager for exchange approval", async () => {
      mockReadContract.mockResolvedValueOnce(true);
      mockReadContract.mockResolvedValueOnce(true);

      await checkMarketplaceApprovals(TEST_OPERATOR, CHAIN_ID);

      // First call: hasUserApprovedOperator on transferManager
      expect(mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: "0x2222222222222222222222222222222222222222",
          functionName: "hasUserApprovedOperator",
          args: [TEST_OPERATOR, "0x1111111111111111111111111111111111111111"],
        })
      );
    });

    it("checks minter for collection approval", async () => {
      mockReadContract.mockResolvedValueOnce(true);
      mockReadContract.mockResolvedValueOnce(true);

      await checkMarketplaceApprovals(TEST_OPERATOR, CHAIN_ID);

      // Second call: isApprovedForAll on minter
      expect(mockReadContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: "0x4444444444444444444444444444444444444444",
          functionName: "isApprovedForAll",
          args: [TEST_OPERATOR, "0x2222222222222222222222222222222222222222"],
        })
      );
    });
  });

  describe("buildApprovalTransactions", () => {
    it("returns both approval calls when neither is approved", async () => {
      mockReadContract.mockResolvedValueOnce(false);
      mockReadContract.mockResolvedValueOnce(false);

      const result = await buildApprovalTransactions(TEST_OPERATOR, CHAIN_ID);

      expect(result.grantExchange).toBeDefined();
      expect(result.grantExchange?.to).toBe("0x2222222222222222222222222222222222222222");
      expect(result.grantExchange?.data).toMatch(/^0x/);

      expect(result.approveMinter).toBeDefined();
      expect(result.approveMinter?.to).toBe("0x4444444444444444444444444444444444444444");
      expect(result.approveMinter?.data).toMatch(/^0x/);
    });

    it("omits grantExchange when already approved", async () => {
      mockReadContract.mockResolvedValueOnce(true);
      mockReadContract.mockResolvedValueOnce(false);

      const result = await buildApprovalTransactions(TEST_OPERATOR, CHAIN_ID);

      expect(result.grantExchange).toBeUndefined();
      expect(result.approveMinter).toBeDefined();
    });

    it("omits approveMinter when already approved", async () => {
      mockReadContract.mockResolvedValueOnce(false);
      mockReadContract.mockResolvedValueOnce(true);

      const result = await buildApprovalTransactions(TEST_OPERATOR, CHAIN_ID);

      expect(result.grantExchange).toBeDefined();
      expect(result.approveMinter).toBeUndefined();
    });

    it("returns empty object when both are already approved", async () => {
      mockReadContract.mockResolvedValueOnce(true);
      mockReadContract.mockResolvedValueOnce(true);

      const result = await buildApprovalTransactions(TEST_OPERATOR, CHAIN_ID);

      expect(result.grantExchange).toBeUndefined();
      expect(result.approveMinter).toBeUndefined();
    });
  });
});
