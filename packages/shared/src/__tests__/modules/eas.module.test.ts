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
vi.mock("../../config/blockchain", () => ({
  getEASConfig: vi.fn(() => mockEASConfig),
  DEFAULT_CHAIN_ID: 11155111,
}));

const mockGetJsonByHash = vi.fn();
const mockResolveIPFSUrl = vi.fn((cid: string) =>
  /^https?:\/\//.test(cid) ? cid : `https://ipfs.local/${cid.replace(/^ipfs:\/\//, "")}`
);

// Mock IPFS helpers
vi.mock("../../modules/data/ipfs", () => ({
  canonicalizeIPFSIdentifier: vi.fn((value: string) => value.replace(/^ipfs:\/\//, "")),
  getFileByHash: vi.fn(async () => ({ data: new Blob(["x"]) })),
  getJsonByHash: (...args: unknown[]) => mockGetJsonByHash(...args),
  resolveIPFSUrl: (...args: unknown[]) => mockResolveIPFSUrl(...args),
  tryParseJson: vi.fn((value: string) => {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }),
}));

// Mock graphql
vi.mock("../../modules/data/graphql", () => ({
  easGraphQL: vi.fn((query) => query),
}));

import { CynefinPhase, Domain } from "../../types/domain";
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
            { name: "assessmentConfigCID", value: { value: "bafyConfigCID123" } },
            { name: "domain", value: { value: { hex: "0x03" } } },
            { name: "startDate", value: { value: { hex: "0x65B8D800" } } },
            { name: "endDate", value: { value: { hex: "0x660D5800" } } },
            { name: "location", value: { value: "Austin TX" } },
          ]),
        },
      ];

      mockQuery.mockResolvedValue({
        data: {
          attestations: [
            {
              id: "0xAssessment1",
              attester: "0xAttester",
              recipient: "0xGarden",
              timeCreated: 1700000000,
              decodedDataJson: JSON.stringify([
                { name: "title", value: { value: "Test Assessment" } },
                { name: "description", value: { value: "Test Description" } },
                { name: "assessmentConfigCID", value: { value: "bafyConfigCID123" } },
                { name: "domain", value: { value: { hex: "0x03" } } },
                { name: "startDate", value: { value: { hex: "0x65B8D800" } } },
                { name: "endDate", value: { value: { hex: "0x660D5800" } } },
                { name: "location", value: { value: "Austin TX" } },
              ]),
            },
          ],
        },
      });
      mockGetJsonByHash.mockImplementation(async (cid: string) => {
        if (cid === "bafyConfigCID123") {
          return {
            assessmentType: "Seasonal",
            capitals: ["social", "living"],
            metricsCid: "bafyMetricsCID123",
            evidenceMediaCids: ["bafyEvidenceCID123"],
            reportDocuments: ["ipfs://bafyReportCID123/report.pdf", "https://example.com/report"],
            impactAttestations: ["0xABCDEF"],
            tags: ["soil"],
          };
        }
        if (cid === "bafyMetricsCID123") {
          return { treesPlanted: 42 };
        }
        throw new Error(`unexpected cid ${cid}`);
      });

      const result = await getGardenAssessments("0xGarden", 11155111);

      expect(result).toEqual([
        expect.objectContaining({
          id: "0xAssessment1",
          schemaVersion: "assessment_v2",
          title: "Test Assessment",
          description: "Test Description",
          diagnosis: "Test Description",
          domain: Domain.WASTE,
          startDate: 1706612736,
          endDate: 1712150528,
          reportingPeriod: {
            start: 1706612736,
            end: 1712150528,
          },
          assessmentType: "Seasonal",
          capitals: ["social", "living"],
          tags: ["soil"],
          metrics: { treesPlanted: 42 },
          evidenceMedia: ["https://ipfs.local/bafyEvidenceCID123"],
          reportDocuments: [
            "https://ipfs.local/bafyReportCID123/report.pdf",
            "https://example.com/report",
          ],
          impactAttestations: ["0xabcdef"],
          location: "Austin TX",
        }),
      ]);
      expect(mockGetJsonByHash).toHaveBeenCalledWith("bafyConfigCID123");
      expect(mockGetJsonByHash).toHaveBeenCalledWith("bafyMetricsCID123");
    });

    it("hydrates canonical assessment configs without throwing on missing legacy fields", async () => {
      mockQuery.mockResolvedValue({
        data: {
          attestations: [
            {
              id: "0xAssessment2",
              attester: "0xAttester",
              recipient: "0xGarden",
              timeCreated: 1700000000,
              decodedDataJson: JSON.stringify([
                { name: "title", value: { value: "Canonical Assessment" } },
                { name: "description", value: { value: "Canonical Description" } },
                { name: "assessmentConfigCID", value: { value: "bafyConfigCID456" } },
                { name: "domain", value: { value: 1 } },
                { name: "startDate", value: { value: 1700000000 } },
                { name: "endDate", value: { value: 1701000000 } },
                { name: "location", value: { value: "Community Hub" } },
              ]),
            },
          ],
        },
      });
      mockGetJsonByHash.mockResolvedValue({
        schemaVersion: "assessment_v2",
        diagnosis: "Root cause",
        smartOutcomes: [{ description: "Grow food", metric: "yield_kg", target: 15 }],
        cynefinPhase: CynefinPhase.COMPLEX,
        domain: Domain.AGRO,
        selectedActionUIDs: ["action-1"],
        reportingPeriod: { start: 1700000000, end: 1701000000 },
        sdgTargets: [2],
        attachments: [{ name: "photo.png", cid: "bafyImage", mimeType: "image/png" }],
      });

      const [assessment] = await getGardenAssessments("0xGarden", 11155111);

      expect(assessment).toEqual(
        expect.objectContaining({
          id: "0xAssessment2",
          diagnosis: "Root cause",
          smartOutcomes: [{ description: "Grow food", metric: "yield_kg", target: 15 }],
          cynefinPhase: CynefinPhase.COMPLEX,
          domain: Domain.AGRO,
          selectedActionUIDs: ["action-1"],
          sdgTargets: [2],
          attachments: [{ name: "photo.png", cid: "bafyImage", mimeType: "image/png" }],
          evidenceMedia: ["https://ipfs.local/bafyImage"],
          metrics: {
            yield_kg: {
              target: 15,
              description: "Grow food",
            },
          },
        })
      );
    });

    it("returns safe defaults when config hydration fails", async () => {
      mockQuery.mockResolvedValue({
        data: {
          attestations: [
            {
              id: "0xAssessment3",
              attester: "0xAttester",
              recipient: "0xGarden",
              timeCreated: 1700000000,
              decodedDataJson: JSON.stringify([
                { name: "title", value: { value: "Broken Assessment" } },
                { name: "description", value: { value: "Description" } },
                { name: "assessmentConfigCID", value: { value: "bafyBrokenConfig" } },
              ]),
            },
          ],
        },
      });
      mockGetJsonByHash.mockRejectedValue(new Error("boom"));

      const [assessment] = await getGardenAssessments("0xGarden", 11155111);

      expect(assessment).toEqual(
        expect.objectContaining({
          title: "Broken Assessment",
          diagnosis: "Description",
          smartOutcomes: [],
          capitals: [],
          tags: [],
          evidenceMedia: [],
          reportDocuments: [],
          impactAttestations: [],
        })
      );
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
      mockQuery.mockResolvedValue({
        data: {
          attestations: [
            {
              id: "0xWork1",
              attester: "0xGardener",
              recipient: gardenAddress,
              timeCreated: 1700000000,
              decodedDataJson: JSON.stringify([
                { name: "feedback", value: { value: "Great work" } },
                { name: "metadata", value: { value: "ipfs://bafyMetadata" } },
                { name: "media", value: { value: ["QmWorkImage"] } },
                { name: "actionUID", value: { value: { hex: "0x1" } } },
              ]),
            },
          ],
        },
      });

      const result = await getWorks(gardenAddress, 11155111);

      expect(result).toEqual([
        expect.objectContaining({
          id: "0xWork1",
          metadata: "bafyMetadata",
          media: ["https://ipfs.local/QmWorkImage"],
        }),
      ]);
    });

    it("returns safe defaults when decoded work data is malformed", async () => {
      mockQuery.mockResolvedValue({
        data: {
          attestations: [
            {
              id: "0xWorkMalformed",
              attester: "0xGardener",
              recipient: "0xGarden",
              timeCreated: 1700000000,
              decodedDataJson: JSON.stringify({ title: "not-an-array" }),
            },
          ],
        },
      });

      const [work] = await getWorks("0xGarden", 11155111);

      expect(work).toEqual(
        expect.objectContaining({
          id: "0xWorkMalformed",
          gardenerAddress: "0xGardener",
          gardenAddress: "0xGarden",
          actionUID: 0,
          title: "Untitled Work",
          media: [],
          metadata: "",
        })
      );
    });

    it("throws EASFetchError on error", async () => {
      mockQuery.mockResolvedValue({
        error: { message: "Query failed" },
      });

      await expect(getWorks("0xGarden", 11155111)).rejects.toThrow(
        "Failed to fetch works: Query failed"
      );
    });
  });

  describe("getWorkApprovals", () => {
    it("fetches work approvals for a garden", async () => {
      mockQuery.mockResolvedValue({
        data: {
          attestations: [
            {
              id: "0xApproval1",
              attester: "0xOperator",
              recipient: "0xGardener",
              timeCreated: 1700000000,
              decodedDataJson: JSON.stringify([
                { name: "workUID", value: { value: "0xWork1" } },
                { name: "approved", value: { value: true } },
                { name: "feedback", value: { value: "Approved!" } },
                { name: "actionUID", value: { value: { hex: "0x1" } } },
              ]),
            },
          ],
        },
      });

      const result = await getWorkApprovals("0xGarden", 11155111);

      expect(result).toEqual([
        expect.objectContaining({
          id: "0xApproval1",
          approved: true,
          workUID: "0xWork1",
        }),
      ]);
    });

    it("handles empty approval list", async () => {
      mockQuery.mockResolvedValue({
        data: { attestations: [] },
      });

      const result = await getWorkApprovals("0xGarden", 11155111);

      expect(result).toEqual([]);
    });
  });
});
