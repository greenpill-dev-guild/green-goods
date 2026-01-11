/**
 * EAS Module Tests
 *
 * Tests for Ethereum Attestation Service data fetching functions.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock GraphQL client
const mockQuery = vi.fn();
vi.mock("../../modules/data/graphql-client", () => ({
  createEasClient: vi.fn(() => ({
    query: mockQuery,
  })),
  greenGoodsIndexer: {
    query: vi.fn(),
  },
  GQLClient: vi.fn(),
}));

// Mock config
vi.mock("../../config", () => ({
  getEASConfig: vi.fn(() => ({
    ASSESSMENT: { uid: "0xAssessmentSchemaUID" },
    WORK: { uid: "0xWorkSchemaUID" },
    WORK_APPROVAL: { uid: "0xApprovalSchemaUID" },
  })),
  DEFAULT_CHAIN_ID: 84532,
}));

// Mock IPFS (Storacha)
vi.mock("../../modules/data/ipfs", () => ({
  resolveIPFSUrl: vi.fn((cid) => `https://ipfs.io/ipfs/${cid}`),
  getFileByHash: vi.fn(async () => ({ data: new Blob(["x"]) })),
}));

// Mock graphql
vi.mock("../../modules/data/graphql", () => ({
  easGraphQL: vi.fn((query) => query),
}));

import { getGardenAssessments, getWorkApprovals, getWorks } from "../../modules/data/eas";

describe("modules/data/eas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getGardenAssessments", () => {
    it("returns parsed assessments on success", async () => {
      const mockAttestations = [
        {
          id: "0xAssessment1",
          attester: "0xAttester",
          recipient: "0xGarden",
          time: 1700000000,
          decodedDataJson: JSON.stringify([
            { name: "title", value: { value: "Test Assessment" } },
            { name: "description", value: { value: "Test Description" } },
            { name: "assessmentType", value: { value: "impact" } },
            { name: "capitals", value: { value: ["social", "living"] } },
            { name: "evidenceMedia", value: { value: ["QmHash1"] } },
            { name: "tags", value: { value: ["community", "green"] } },
          ]),
        },
      ];

      mockQuery.mockResolvedValue({
        data: { attestations: mockAttestations },
      });

      const result = await getGardenAssessments();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("throws EASFetchError on GraphQL error", async () => {
      mockQuery.mockResolvedValue({
        error: { message: "Network error" },
      });

      await expect(getGardenAssessments()).rejects.toThrow(
        "Failed to fetch garden assessments: Network error"
      );
    });

    it("returns empty array when no attestations", async () => {
      mockQuery.mockResolvedValue({
        data: { attestations: [] },
      });

      const result = await getGardenAssessments();

      expect(result).toEqual([]);
    });
  });

  describe("getWorks", () => {
    it("filters works by garden address", async () => {
      const gardenAddress = "0xGardenAddress";
      const mockAttestations = [
        {
          id: "0xWork1",
          attester: "0xGardener",
          recipient: gardenAddress,
          time: 1700000000,
          decodedDataJson: JSON.stringify([
            { name: "feedback", value: { value: "Great work" } },
            { name: "media", value: { value: ["QmWorkImage"] } },
            { name: "actionUID", value: { value: { hex: "0x1" } } },
          ]),
        },
      ];

      mockQuery.mockResolvedValue({
        data: { attestations: mockAttestations },
      });

      const result = await getWorks(gardenAddress, 84532);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("throws EASFetchError on error", async () => {
      mockQuery.mockResolvedValue({
        error: { message: "Query failed" },
      });

      await expect(getWorks("0xGarden", 84532)).rejects.toThrow(
        "Failed to fetch works: Query failed"
      );
    });
  });

  describe("getWorkApprovals", () => {
    it("fetches work approvals for a garden", async () => {
      const mockAttestations = [
        {
          id: "0xApproval1",
          attester: "0xOperator",
          recipient: "0xGardener",
          time: 1700000000,
          decodedDataJson: JSON.stringify([
            { name: "workUID", value: { value: "0xWork1" } },
            { name: "approved", value: { value: true } },
            { name: "feedback", value: { value: "Approved!" } },
            { name: "actionUID", value: { value: { hex: "0x1" } } },
          ]),
        },
      ];

      mockQuery.mockResolvedValue({
        data: { attestations: mockAttestations },
      });

      const result = await getWorkApprovals("0xGarden", 84532);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("handles empty approval list", async () => {
      mockQuery.mockResolvedValue({
        data: { attestations: [] },
      });

      const result = await getWorkApprovals("0xGarden", 84532);

      expect(result).toEqual([]);
    });
  });
});
