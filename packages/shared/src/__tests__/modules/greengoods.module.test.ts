/**
 * Greengoods Module Tests
 *
 * Tests for Green Goods indexer data fetching functions.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock GraphQL client - use vi.hoisted to ensure mockQuery is available before vi.mock hoisting
const { mockQuery, mockResolveIPFSUrl, mockGetFileByHash } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockResolveIPFSUrl: vi.fn((cid: string) => `https://ipfs.io/ipfs/${cid}`),
  mockGetFileByHash: vi.fn(async () => ({
    data: JSON.stringify({
      description: "Test action description",
      uiConfig: {
        media: { title: "Photos", maxImageCount: 5, minImageCount: 1, required: true },
        details: {
          title: "Details",
          description: "Details",
          feedbackPlaceholder: "",
          inputs: [],
        },
        review: { title: "Review", description: "Review" },
      },
    }),
  })),
}));

vi.mock("../../modules/data/graphql-client", () => ({
  greenGoodsIndexer: {
    query: mockQuery,
  },
}));

// Mock config
vi.mock("../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

// Mock IPFS (Storacha)
vi.mock("../../modules/data/ipfs", () => ({
  resolveIPFSUrl: mockResolveIPFSUrl,
  getFileByHash: mockGetFileByHash,
}));

// Mock graphql
vi.mock("../../modules/data/graphql", () => ({
  greenGoodsGraphQL: vi.fn((query) => query),
}));

import { getActions, getGardens } from "../../modules/data/greengoods";
import { instructionTemplates } from "../../utils/action/templates";

describe("modules/data/greengoods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getGardens", () => {
    it("returns parsed garden list on success", async () => {
      const mockGardens = [
        {
          id: "11155111-1",
          chainId: 11155111,
          tokenAddress: "0xGarden123",
          tokenID: "1",
          name: "Test Garden",
          description: "A test garden",
          location: "Test City",
          bannerImage: "QmBanner",
          gardeners: ["0xGardener1"],
          operators: ["0xOperator1"],
          evaluators: [],
          owners: [],
          funders: [],
          communities: [],
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
          id: "11155111-1",
          chainId: 11155111,
          tokenAddress: "0xGarden123",
          tokenID: "1",
          name: "Open Garden",
          description: "A garden with open joining",
          location: "Test City",
          bannerImage: "QmBanner",
          gardeners: [],
          operators: [],
          evaluators: [],
          owners: [],
          funders: [],
          communities: [],
          openJoining: true,
          createdAt: "1700000000",
        },
        {
          id: "11155111-2",
          chainId: 11155111,
          tokenAddress: "0xGarden456",
          tokenID: "2",
          name: "Closed Garden",
          description: "A garden with closed joining",
          location: "Test City",
          bannerImage: "QmBanner",
          gardeners: [],
          operators: [],
          evaluators: [],
          owners: [],
          funders: [],
          communities: [],
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
          id: "11155111-1",
          chainId: 11155111,
          tokenAddress: "0xGarden123",
          tokenID: "1",
          name: "Legacy Garden",
          description: "A garden without openJoining field",
          location: "Test City",
          bannerImage: "QmBanner",
          gardeners: [],
          operators: [],
          evaluators: [],
          owners: [],
          funders: [],
          communities: [],
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
          id: "11155111-1",
          chainId: 11155111,
          startTime: "1700000000",
          endTime: "1800000000",
          title: "Planting Trees",
          slug: "agro.planting_trees",
          instructions: "QmInstructions",
          capitals: [0, 3], // SOCIAL, LIVING
          media: ["QmMedia1"],
          domain: "AGRO",
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
          id: "11155111-2",
          chainId: 11155111,
          startTime: "1700000000",
          endTime: "1800000000",
          title: "Simple Action",
          slug: "solar.simple_action",
          instructions: null, // No instructions CID
          capitals: [],
          media: [],
          domain: "SOLAR",
          createdAt: "1700000000",
        },
      ];

      mockQuery.mockResolvedValue({
        data: { Action: mockActions },
      });

      const result = await getActions();

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      // Should use template/default mediaInfo when no instructions
      expect(result[0].mediaInfo).toBeDefined();
      // Media should no longer be filled with a fake placeholder URL
      expect(result[0].media).toEqual([]);
    });

    it("falls back to instruction template when instruction fetch fails", async () => {
      const mockActions = [
        {
          id: "42161-1",
          chainId: 42161,
          startTime: "1700000000",
          endTime: "1800000000",
          title: "Site Setup",
          slug: "solar.site_setup",
          instructions: "bafkMissing",
          capitals: [0],
          media: ["QmMedia1"],
          domain: "SOLAR",
          createdAt: "1700000000",
        },
      ];

      mockQuery.mockResolvedValue({
        data: { Action: mockActions },
      });
      mockGetFileByHash.mockRejectedValueOnce(new Error("timeout"));

      const result = await getActions();

      expect(result).toHaveLength(1);
      expect(result[0].description).toBe(instructionTemplates["solar.site_setup"].description);
      expect(result[0].mediaInfo?.title).toBe(
        instructionTemplates["solar.site_setup"].uiConfig.media.title
      );
    });
  });
});
