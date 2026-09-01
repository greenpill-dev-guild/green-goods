/**
 * EAS Module Tests
 *
 * Tests for Ethereum Attestation Service data fetching functions.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQuery = vi.fn();

// Mock config (barrel and direct import path — eas.ts imports from config/blockchain)
const mockEASConfig = {
  ASSESSMENT: { uid: "0xAssessmentSchemaUID" },
  WORK: { uid: "0xWorkSchemaUID" },
  WORK_APPROVAL: { uid: "0xApprovalSchemaUID" },
};
vi.mock("../../config", () => ({
  getEASConfig: vi.fn(() => mockEASConfig),
  DEFAULT_CHAIN_ID: 11155111,
}));
vi.mock("../../config/blockchain", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../config/blockchain")>()),
  getEASConfig: vi.fn(() => mockEASConfig),
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

// Mock IPFS
vi.mock("../../modules/data/ipfs", () => ({
  resolveIPFSUrl: vi.fn((cid) => `https://ipfs.io/ipfs/${cid}`),
  getFileByHash: vi.fn(async () => ({ data: new Blob(["x"]) })),
}));

// Mock graphql
vi.mock("../../modules/data/graphql", () => ({
  easGraphQL: vi.fn((query) => query),
}));

import {
  getGardenAssessments,
  getWorkApprovals,
  getWorkApprovalsForWork,
  getWorks,
  getWorksByGardener,
} from "../../modules/data/eas";
import type { GraphQLReader } from "../../modules/data/graphql-client";
import {
  gardenAssessmentAttestation,
  workApprovalAttestation,
  workAttestation,
} from "../fixtures/data/eas-attestations";

const reader = { query: mockQuery } as GraphQLReader;

describe("modules/data/eas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getGardenAssessments", () => {
    it("returns parsed assessments on success", async () => {
      mockQuery.mockResolvedValue({
        data: { attestations: [gardenAssessmentAttestation] },
      });

      const result = await getGardenAssessments(undefined, undefined, undefined, reader);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("throws EASFetchError on GraphQL error", async () => {
      mockQuery.mockResolvedValue({
        error: { message: "Network error" },
      });

      await expect(getGardenAssessments(undefined, undefined, undefined, reader)).rejects.toThrow(
        "Failed to fetch garden assessments: Network error"
      );
    });

    it("returns empty array when no attestations", async () => {
      mockQuery.mockResolvedValue({
        data: { attestations: [] },
      });

      const result = await getGardenAssessments(undefined, undefined, undefined, reader);

      expect(result).toEqual([]);
    });
  });

  describe("getWorks", () => {
    it("filters works by garden address", async () => {
      const gardenAddress = "0xGardenAddress";
      mockQuery.mockResolvedValue({
        data: { attestations: [workAttestation] },
      });

      const result = await getWorks(gardenAddress, 11155111, reader);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("throws EASFetchError on error", async () => {
      mockQuery.mockResolvedValue({
        error: { message: "Query failed" },
      });

      await expect(getWorks("0xGarden", 11155111, reader)).rejects.toThrow(
        "Failed to fetch works: Query failed"
      );
    });
  });

  describe("getWorksByGardener", () => {
    it("converts GraphQL string timestamps to numbers", async () => {
      mockQuery.mockResolvedValue({
        data: { attestations: [{ ...workAttestation, timeCreated: "1700000000" }] },
      });

      const [work] = await getWorksByGardener("0xGardener", 11155111, reader);

      expect(work.createdAt).toBe(1_700_000_000);
      expect(typeof work.createdAt).toBe("number");
    });
  });

  describe("getWorkApprovals", () => {
    it("fetches work approvals for a garden", async () => {
      mockQuery.mockResolvedValue({
        data: { attestations: [workApprovalAttestation] },
      });

      const result = await getWorkApprovals("0xGarden", 11155111, reader);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("handles empty approval list", async () => {
      mockQuery.mockResolvedValue({
        data: { attestations: [] },
      });

      const result = await getWorkApprovals("0xGarden", 11155111, reader);

      expect(result).toEqual([]);
    });
  });

  describe("getWorkApprovalsForWork", () => {
    it("bounds the production query by exact Work content without a recipient filter", async () => {
      mockQuery.mockResolvedValue({ data: { attestations: [workApprovalAttestation] } });

      const result = await getWorkApprovalsForWork("0xWork1", 11155111, reader);

      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.anything(),
        {
          where: {
            schemaId: { equals: mockEASConfig.WORK_APPROVAL.uid },
            decodedDataJson: { contains: "0xWork1" },
            revoked: { equals: false },
          },
        },
        "getWorkApprovalsForWork"
      );
      expect(mockQuery.mock.calls[0][1].where).not.toHaveProperty("recipient");
    });

    it("exact-filters false-positive decoded-content candidates", async () => {
      mockQuery.mockResolvedValue({ data: { attestations: [workApprovalAttestation] } });
      await expect(getWorkApprovalsForWork("0xWork", 11155111, reader)).resolves.toEqual([]);
    });

    it("preserves a mismatched historical recipient for the classifier to reject", async () => {
      const historical = {
        ...workApprovalAttestation,
        recipient: "0xHistoricalGardener",
      };
      mockQuery.mockResolvedValue({ data: { attestations: [historical] } });

      const [approval] = await getWorkApprovalsForWork("0xWork1", 11155111, reader);

      expect(approval.gardenerAddress).toBe("0xHistoricalGardener");
    });
  });
});
