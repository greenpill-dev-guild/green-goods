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
  ASSESSMENT_V3: { uid: "0xAssessmentV3SchemaUID" },
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

import { getEASConfig } from "../../config/blockchain";
import {
  getGardenAssessments,
  getWorkApprovals,
  getWorkApprovalsForWork,
  getWorks,
  getWorksByGardener,
  parseWorkApprovalAttestation,
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
    mockQuery.mockReset();
  });

  describe("getGardenAssessments", () => {
    it.each([42161, 11155111])("reads every registered schema on chain %s", async (chainId) => {
      const { getEASConfig: realConfig } =
        await vi.importActual<typeof import("../../config/blockchain")>("../../config/blockchain");
      const config = realConfig(chainId);
      vi.mocked(getEASConfig).mockReturnValueOnce(config);
      const expectedUIDs =
        chainId === 42161
          ? [config.ASSESSMENT_V3.uid, config.ASSESSMENT.uid]
          : [config.ASSESSMENT.uid];
      const v3 = {
        ...gardenAssessmentAttestation,
        id: "0xAssessmentV3",
        decodedDataJson: JSON.stringify([
          ...JSON.parse(gardenAssessmentAttestation.decodedDataJson),
          { name: "assessmentKind", value: { value: 0 } },
          { name: "cycleId", value: { value: 0 } },
          { name: "baselineUID", value: { value: `0x${"00".repeat(32)}` } },
        ]),
      };
      mockQuery.mockImplementationOnce(async (_query, { where }) => ({
        data: {
          attestations: [
            ...(where.schemaId.in?.includes(config.ASSESSMENT.uid)
              ? [gardenAssessmentAttestation]
              : []),
            ...(chainId === 42161 && where.schemaId.in?.includes(config.ASSESSMENT_V3.uid)
              ? [v3]
              : []),
          ],
        },
      }));
      const result = await getGardenAssessments(
        gardenAssessmentAttestation.recipient,
        chainId,
        undefined,
        reader
      );
      expect(mockQuery).toHaveBeenCalledExactlyOnceWith(
        expect.anything(),
        {
          take: 100,
          skip: 0,
          where: {
            schemaId: { in: expectedUIDs },
            revoked: { equals: false },
            recipient: { equals: gardenAssessmentAttestation.recipient },
          },
        },
        "getGardenAssessments"
      );
      expect(result.map((row) => row.id)).toEqual(
        chainId === 42161
          ? [gardenAssessmentAttestation.id, v3.id]
          : [gardenAssessmentAttestation.id]
      );
      expect(result.every((row) => row.title === "Test Assessment")).toBe(true);
    });

    it.each([100, 201])("reads all %i assessments across page boundaries", async (count) => {
      const rows = Array.from({ length: count }, (_, index) => ({
        ...gardenAssessmentAttestation,
        id: `0x${index.toString(16).padStart(64, "0")}`,
        schemaId: index < 100 ? mockEASConfig.ASSESSMENT.uid : mockEASConfig.ASSESSMENT_V3.uid,
      }));
      mockQuery.mockImplementation(async (query, { where, take = 100, skip = 0 }) => {
        expect(query).toContain("orderBy: [{ id: asc }]");
        const matching = rows.filter((row) => where.schemaId.in.includes(row.schemaId));
        return { data: { attestations: matching.slice(skip, skip + take) } };
      });
      const result = await getGardenAssessments(undefined, 42161, undefined, reader);
      expect(result.map((row) => row.id)).toEqual(rows.map((row) => row.id));
      expect(mockQuery).toHaveBeenCalledTimes(Math.floor(count / 100) + 1);
      for (const [index, call] of mockQuery.mock.calls.entries()) {
        expect(call[1]).toEqual({
          take: 100,
          skip: index * 100,
          where: {
            schemaId: { in: [mockEASConfig.ASSESSMENT_V3.uid, mockEASConfig.ASSESSMENT.uid] },
            revoked: { equals: false },
          },
        });
      }
    });

    it("continues past a full page containing a malformed record", async () => {
      mockQuery
        .mockResolvedValueOnce({
          data: {
            attestations: [
              { ...gardenAssessmentAttestation, decodedDataJson: "{" },
              ...Array.from({ length: 99 }, (_, index) => ({
                ...gardenAssessmentAttestation,
                id: `page1-${index}`,
              })),
            ],
          },
        })
        .mockResolvedValueOnce({
          data: { attestations: [{ ...gardenAssessmentAttestation, id: "page2" }] },
        });
      const result = await getGardenAssessments(undefined, 42161, undefined, reader);
      expect(result).toHaveLength(100);
      expect(result.at(-1)?.id).toBe("page2");
    });

    it.each([
      "error",
      "missing data",
    ])("rejects a later-page %s instead of returning partial history", async (failure) => {
      mockQuery
        .mockResolvedValueOnce({
          data: { attestations: Array.from({ length: 100 }, () => gardenAssessmentAttestation) },
        })
        .mockResolvedValueOnce(
          failure === "error" ? { error: { message: "Page unavailable" } } : { data: {} }
        );
      await expect(getGardenAssessments(undefined, 42161, undefined, reader)).rejects.toThrow(
        "Failed to fetch garden assessments"
      );
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it.each(["zero", "duplicate"])("excludes a %s v2 UID while retaining v3", async (kind) => {
      const config = getEASConfig(42161);
      vi.mocked(getEASConfig).mockReturnValueOnce({
        ...config,
        ASSESSMENT: {
          uid: kind === "zero" ? `0x${"00".repeat(32)}` : config.ASSESSMENT_V3.uid,
          schema: "",
        },
      });
      mockQuery.mockResolvedValueOnce({ data: { attestations: [] } });
      await getGardenAssessments(undefined, 42161, undefined, reader);
      expect(mockQuery.mock.calls[0][1].where.schemaId).toEqual({ in: [config.ASSESSMENT_V3.uid] });
    });

    it("skips queries when no schema is registered", async () => {
      const config = getEASConfig(11155111);
      vi.mocked(getEASConfig).mockReturnValueOnce({
        ...config,
        ASSESSMENT: { uid: `0x${"00".repeat(32)}`, schema: "" },
        ASSESSMENT_V3: { uid: `0x${"00".repeat(32)}`, schema: "" },
      });
      await expect(getGardenAssessments(undefined, 11155111, undefined, reader)).resolves.toEqual(
        []
      );
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("allows an explicit schema without including other versions", async () => {
      mockQuery.mockResolvedValueOnce({ data: { attestations: [] } });
      await getGardenAssessments(undefined, 42161, "0xExplicitSchema", reader);
      expect(mockQuery.mock.calls[0][1].where.schemaId).toEqual({ in: ["0xExplicitSchema"] });
    });

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

    it.each([
      ["malformed JSON", "{"],
      ["invalid decoded payload", JSON.stringify({ name: "title" })],
    ])("skips %s without rejecting valid records", async (_label, decodedDataJson) => {
      mockQuery.mockResolvedValue({
        data: {
          attestations: [
            { ...workAttestation, id: "0xMalformed", decodedDataJson },
            workAttestation,
          ],
        },
      });

      await expect(getWorks(undefined, 11155111, reader)).resolves.toMatchObject([
        { id: workAttestation.id },
      ]);
    });

    it.each([
      "",
      "not-a-time",
      "Infinity",
    ])("skips invalid creation time %j without rejecting valid records", async (timeCreated) => {
      mockQuery.mockResolvedValue({
        data: {
          attestations: [{ ...workAttestation, id: "0xMalformed", timeCreated }, workAttestation],
        },
      });

      await expect(getWorks(undefined, 11155111, reader)).resolves.toMatchObject([
        { id: workAttestation.id },
      ]);
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

    it("skips attestations with invalid GraphQL addresses", async () => {
      mockQuery.mockResolvedValue({
        data: {
          attestations: [{ ...workApprovalAttestation, recipient: "not-an-address" }],
        },
      });

      await expect(getWorkApprovals(undefined, 11155111, reader)).resolves.toEqual([]);
    });

    it("rejects invalid creation times in direct approval parsing", () => {
      expect(() =>
        parseWorkApprovalAttestation({
          ...workApprovalAttestation,
          timeCreated: "not-a-time",
        })
      ).toThrow("EAS attestation has an invalid creation time");
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
        recipient: "0x9999999999999999999999999999999999999999",
      };
      mockQuery.mockResolvedValue({ data: { attestations: [historical] } });

      const [approval] = await getWorkApprovalsForWork("0xWork1", 11155111, reader);

      expect(approval.gardenerAddress).toBe("0x9999999999999999999999999999999999999999");
    });
  });
});
