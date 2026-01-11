/**
 * Greengoods Module Tests
 *
 * Tests for Green Goods indexer data fetching functions.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock GraphQL client - use vi.hoisted to ensure mockQuery is available before vi.mock hoisting
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock("../../modules/data/graphql-client", () => ({
  greenGoodsIndexer: {
    query: mockQuery,
  },
}));

// Mock config
vi.mock("../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 84532,
}));

// Mock IPFS (Storacha)
vi.mock("../../modules/data/ipfs", () => ({
  resolveIPFSUrl: vi.fn((cid) => `https://ipfs.io/ipfs/${cid}`),
  getFileByHash: vi.fn(async () => ({
    data: JSON.stringify({
      description: "Test action description",
      uiConfig: {
        media: { title: "Photos", maxImageCount: 5, required: true },
        details: { title: "Details", inputs: [] },
        review: { title: "Review" },
      },
    }),
  })),
}));

// Mock graphql
vi.mock("../../modules/data/graphql", () => ({
  greenGoodsGraphQL: vi.fn((query) => query),
}));

import { getActions, getGardens } from "../../modules/data/greengoods";

describe("modules/data/greengoods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getGardens", () => {
    it("returns parsed garden list on success", async () => {
      const mockGardens = [
        {
          id: "84532-1",
          chainId: 84532,
          tokenAddress: "0xGarden123",
          tokenID: "1",
          name: "Test Garden",
          description: "A test garden",
          location: "Test City",
          bannerImage: "QmBanner",
          gardeners: ["0xGardener1"],
          operators: ["0xOperator1"],
          openJoining: true,
          createdAt: "1700000000",
        },
      ];

      mockQuery.mockResolvedValue({
        data: { Garden: mockGardens },
      });

      const result = await getGardens();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
    });

    it("includes openJoining field from indexer", async () => {
      const mockGardens = [
        {
          id: "84532-1",
          chainId: 84532,
          tokenAddress: "0xGarden123",
          tokenID: "1",
          name: "Open Garden",
          description: "A garden with open joining",
          location: "Test City",
          bannerImage: "QmBanner",
          gardeners: [],
          operators: [],
          openJoining: true,
          createdAt: "1700000000",
        },
        {
          id: "84532-2",
          chainId: 84532,
          tokenAddress: "0xGarden456",
          tokenID: "2",
          name: "Closed Garden",
          description: "A garden with closed joining",
          location: "Test City",
          bannerImage: "QmBanner",
          gardeners: [],
          operators: [],
          openJoining: false,
          createdAt: "1700000000",
        },
      ];

      mockQuery.mockResolvedValue({
        data: { Garden: mockGardens },
      });

      const result = await getGardens();

      expect(result).toHaveLength(2);
      expect(result[0].openJoining).toBe(true);
      expect(result[1].openJoining).toBe(false);
    });

    it("defaults openJoining to false when missing", async () => {
      const mockGardens = [
        {
          id: "84532-1",
          chainId: 84532,
          tokenAddress: "0xGarden123",
          tokenID: "1",
          name: "Legacy Garden",
          description: "A garden without openJoining field",
          location: "Test City",
          bannerImage: "QmBanner",
          gardeners: [],
          operators: [],
          // openJoining missing - should default to false
          createdAt: "1700000000",
        },
      ];

      mockQuery.mockResolvedValue({
        data: { Garden: mockGardens },
      });

      const result = await getGardens();

      expect(result).toHaveLength(1);
      expect(result[0].openJoining).toBe(false);
    });

    it("returns empty array on GraphQL error", async () => {
      mockQuery.mockResolvedValue({
        error: { message: "Indexer unavailable" },
      });

      const result = await getGardens();

      expect(result).toEqual([]);
    });

    it("returns empty array when no gardens exist", async () => {
      mockQuery.mockResolvedValue({
        data: { Garden: [] },
      });

      const result = await getGardens();

      expect(result).toEqual([]);
    });
  });

  describe("getActions", () => {
    it("returns parsed action list on success", async () => {
      const mockActions = [
        {
          id: "84532-1",
          chainId: 84532,
          startTime: "1700000000",
          endTime: "1800000000",
          title: "Planting Trees",
          instructions: "QmInstructions",
          capitals: [0, 3], // SOCIAL, LIVING
          media: ["QmMedia1"],
          createdAt: "1700000000",
        },
      ];

      mockQuery.mockResolvedValue({
        data: { Action: mockActions },
      });

      const result = await getActions();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].title).toBe("Planting Trees");
    });

    it("handles indexer unavailable gracefully", async () => {
      mockQuery.mockResolvedValue({
        error: { message: "Connection refused" },
      });

      const result = await getActions();

      expect(result).toEqual([]);
    });

    it("handles action without instructions gracefully", async () => {
      const mockActions = [
        {
          id: "84532-2",
          chainId: 84532,
          startTime: "1700000000",
          endTime: "1800000000",
          title: "Simple Action",
          instructions: null, // No instructions CID
          capitals: [],
          media: [],
          createdAt: "1700000000",
        },
      ];

      mockQuery.mockResolvedValue({
        data: { Action: mockActions },
      });

      const result = await getActions();

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      // Should use default mediaInfo when no instructions
      expect(result[0].mediaInfo).toBeDefined();
    });
  });
});
