/**
 * Greengoods Module Tests
 *
 * Tests for Green Goods indexer data fetching functions.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock URQL client
const mockQuery = vi.fn();
vi.mock("../../modules/data/urql", () => ({
  greenGoodsIndexer: {
    query: () => mockQuery(),
  },
}));

// Mock config
vi.mock("../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 84532,
}));

// Mock pinata
vi.mock("../../modules/data/pinata", () => ({
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
          createdAt: "1700000000",
        },
      ];

      mockQuery.mockReturnValue({
        toPromise: vi.fn().mockResolvedValue({
          data: { Garden: mockGardens },
          error: null,
        }),
      });

      const result = await getGardens();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
    });

    it("returns empty array on GraphQL error", async () => {
      mockQuery.mockReturnValue({
        toPromise: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Indexer unavailable" },
        }),
      });

      const result = await getGardens();

      expect(result).toEqual([]);
    });

    it("returns empty array when no gardens exist", async () => {
      mockQuery.mockReturnValue({
        toPromise: vi.fn().mockResolvedValue({
          data: { Garden: [] },
          error: null,
        }),
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

      mockQuery.mockReturnValue({
        toPromise: vi.fn().mockResolvedValue({
          data: { Action: mockActions },
          error: null,
        }),
      });

      const result = await getActions();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].title).toBe("Planting Trees");
    });

    it("handles indexer unavailable gracefully", async () => {
      mockQuery.mockReturnValue({
        toPromise: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Connection refused" },
        }),
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

      mockQuery.mockReturnValue({
        toPromise: vi.fn().mockResolvedValue({
          data: { Action: mockActions },
          error: null,
        }),
      });

      const result = await getActions();

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      // Should use default mediaInfo when no instructions
      expect(result[0].mediaInfo).toBeDefined();
    });
  });
});
