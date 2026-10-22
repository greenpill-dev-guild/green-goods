import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockWork } from "./test-utils/mock-factories";

const mocks = vi.hoisted(() => ({ query: vi.fn(), assessments: vi.fn(), approve: vi.fn() }));
vi.mock("../modules/data/graphql-client", () => ({
  greenGoodsIndexer: { query: (...args: unknown[]) => mocks.query(...args) },
}));
vi.mock("../modules/data/eas", () => ({
  getGardenAssessments: (...args: unknown[]) => mocks.assessments(...args),
}));
vi.mock("../modules/work/work-list", () => ({
  readApprovedWorks: (...args: unknown[]) => mocks.approve(...args),
}));

import {
  publicRehearsalRecordLinks,
  readPublicCommitmentExclusions,
  createPublicReportingRead,
} from "../modules/commitment-pooling/public-record-exclusions";
import {
  getPublicGardenAssessments,
  getPublicGardenHypercerts,
  readPublicApprovedWorks,
} from "../hooks/public/publicReportingRecords";
import { getGardenHypercerts } from "../modules/data/hypercerts-fetch";

const QA_WORK = "0x" + "a".repeat(64);
const QA_ASSESSMENT = "0x" + "b".repeat(64);
const REAL = "0x" + "c".repeat(64);
const GARDEN = "0xf401f34378384713222d1d21f63359cc4e8a858a" as const;
const QA = {
  id: "42161-99",
  commitmentId: "99",
  poolId: "1",
  cycleId: "1",
  workUIDs: [QA_WORK.toUpperCase()],
  assessmentUID: QA_ASSESSMENT,
};

describe("rehearsal cycle reporting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.approve.mockImplementation(async (works) => ({ works, partial: false }));
    mocks.query.mockImplementation(async (_document, _variables, operation) =>
      operation === "getPublicRehearsalWorkHistory"
        ? { data: { CommitmentEvent: [] } }
        : { data: { Commitment: [QA] } }
    );
  });

  it("finds later commitments by cycle, not a frozen list of five IDs", async () => {
    const rows = await readPublicCommitmentExclusions(42161, 1n);
    expect(rows.map((row) => row.id)).toEqual(["42161-99"]);
    const [document, variables] = mocks.query.mock.calls[0]!;
    expect(document).toContain("poolId: { _eq: 1 }, cycleId: { _eq: 1 }");
    expect(variables).toEqual({ chainId: 42161, after: "" });
    expect(await readPublicCommitmentExclusions(42161, 2n)).toEqual([]);
    expect(await readPublicCommitmentExclusions(11155111, 1n)).toEqual([]);
    expect(mocks.query).toHaveBeenCalledOnce();
  });

  it("reads every page and refuses a non-advancing history", async () => {
    const page = Array.from({ length: 100 }, (_, index) => ({
      ...QA,
      id: `42161-${1000 + index}`,
    }));
    mocks.query
      .mockResolvedValueOnce({ data: { Commitment: page } })
      .mockResolvedValueOnce({ data: { Commitment: [{ ...QA, id: "42161-1100" }] } });
    expect(await readPublicCommitmentExclusions(42161)).toHaveLength(101);
    expect(mocks.query.mock.calls[1]![1].after).toBe("42161-1099");
    mocks.query.mockReset().mockResolvedValue({ data: { Commitment: page } });
    await expect(readPublicCommitmentExclusions(42161)).rejects.toThrow("did not advance");
  });

  it("accepts empty rehearsal cycles and surfaces source failures", async () => {
    mocks.query.mockResolvedValueOnce({ data: { Commitment: [] } });
    expect(await readPublicCommitmentExclusions(42161)).toEqual([]);
    mocks.query.mockResolvedValueOnce({ error: new Error("indexer offline") });
    await expect(readPublicCommitmentExclusions(42161)).rejects.toThrow("indexer offline");
  });

  it("withholds linked work across gardens, preserving unlinked real community work", async () => {
    const qaWork = createMockWork({
      id: QA_WORK,
      gardenAddress: "0x1111111111111111111111111111111111111111",
    });
    const realWork = createMockWork({
      id: REAL,
      gardenAddress: GARDEN,
      title: "Rehearsal is part of this real workshop title",
    });
    const result = await readPublicApprovedWorks([qaWork, realWork], 42161);
    expect(result.works).toEqual([realWork]);
    expect(result.partial).toBe(false);
  });

  it("filters directly linked assessments without hiding the whole community garden", async () => {
    const real = { id: REAL, gardenAddress: GARDEN };
    mocks.assessments.mockResolvedValue([{ id: QA_ASSESSMENT, gardenAddress: GARDEN }, real]);
    expect(await getPublicGardenAssessments(GARDEN, 42161)).toEqual([real]);
    const links = publicRehearsalRecordLinks(42161, [QA]);
    expect(links.workUIDs.has(QA_WORK)).toBe(true);
    expect(links.assessmentUIDs.has(QA_ASSESSMENT)).toBe(true);
  });

  it("keeps approved QA Work excluded after unlinking or relinking to production", async () => {
    mocks.query.mockImplementation(async (_document, _variables, operation) =>
      operation === "getPublicRehearsalWorkHistory"
        ? { data: { CommitmentEvent: [{ id: "42161-link-1", data: QA_WORK }] } }
        : { data: { Commitment: [{ ...QA, workUIDs: [] }] } }
    );
    const qaWork = createMockWork({ id: QA_WORK, gardenAddress: GARDEN });
    const realWork = createMockWork({ id: REAL, gardenAddress: GARDEN });
    expect((await readPublicApprovedWorks([qaWork, realWork], 42161)).works).toEqual([realWork]);
  });

  it("withholds public Work when historical QA link provenance is incomplete", async () => {
    mocks.query.mockImplementation(async (_document, _variables, operation) =>
      operation === "getPublicRehearsalWorkHistory"
        ? { data: { CommitmentEvent: [{ id: "42161-link-1", data: null }] } }
        : { data: { Commitment: [{ ...QA, workUIDs: [] }] } }
    );
    await expect(readPublicApprovedWorks([createMockWork({ id: QA_WORK })], 42161)).rejects.toThrow(
      "history is incomplete"
    );
  });

  it("filters mixed certificates by either commitment or attestation before the public page limit", async () => {
    const certificates = [
      { id: "42161-1", commitmentEntityIds: [QA.id], attestationUIDs: [REAL] },
      { id: "42161-2", commitmentEntityIds: [], attestationUIDs: [REAL, QA_WORK] },
      { id: "42161-3", commitmentEntityIds: ["42161-100"], attestationUIDs: [REAL] },
    ].map((cert, index) => ({
      ...cert,
      tokenId: String(index + 1),
      metadataUri: "ipfs://real",
      metadataReconciliationRequired: false,
    }));
    mocks.query.mockImplementation(async (_document, variables, operation) => {
      if (operation === "getPublicCommitmentExclusions") return { data: { Commitment: [QA] } };
      if (operation === "getPublicRehearsalWorkHistory") return { data: { CommitmentEvent: [] } };
      return {
        data: {
          Hypercert: certificates
            .filter(
              (cert) =>
                !variables.excludedRecords.some(
                  (clause: {
                    commitmentEntityIds?: { _contains: string[] };
                    attestationUIDs?: { _contains: string[] };
                  }) =>
                    clause.commitmentEntityIds?._contains.some((id) =>
                      cert.commitmentEntityIds.includes(id)
                    ) ||
                    clause.attestationUIDs?._contains.some((id) =>
                      cert.attestationUIDs.includes(id)
                    )
                )
            )
            .slice(0, variables.limit),
        },
      };
    });
    const result = await getPublicGardenHypercerts(GARDEN, 42161, 1);
    expect(result.map((cert) => cert.id)).toEqual(["42161-3"]);
    const [document, variables] = mocks.query.mock.calls.find(
      (args) => args[2] === "getGardenHypercerts"
    )!;
    expect(document).toContain("_not: { _or:");
    expect(document).toContain("$excludedRecords: [Hypercert_bool_exp!]!");
    expect(variables.metadataStates).toEqual([false]);
    expect(variables.excludedRecords).toContainEqual({
      commitmentEntityIds: { _contains: [QA.id] },
    });
    expect(variables.excludedRecords).toContainEqual({ attestationUIDs: { _contains: [QA_WORK] } });
    // Operational readers keep the same underlying history, including QA certificates.
    expect(await getGardenHypercerts(GARDEN, 42161)).toHaveLength(3);
    expect(mocks.query.mock.calls.at(-1)![1].metadataStates).toEqual([false, true]);
  });

  it("shares classification across 50 gardens and refreshes it for the next reporting operation", async () => {
    mocks.assessments.mockResolvedValue([]);
    mocks.query.mockImplementation(async (_document, _variables, operation) => {
      if (operation === "getPublicCommitmentExclusions") return { data: { Commitment: [QA] } };
      if (operation === "getPublicRehearsalWorkHistory") return { data: { CommitmentEvent: [] } };
      return { data: { Hypercert: [] } };
    });
    const reporting = createPublicReportingRead(42161);
    await Promise.all(
      Array.from({ length: 50 }, () =>
        Promise.all([
          getPublicGardenAssessments(GARDEN, 42161, reporting),
          getPublicGardenHypercerts(GARDEN, 42161, 50, reporting),
        ])
      )
    );
    const calls = (operation: string) =>
      mocks.query.mock.calls.filter((call) => call[2] === operation);
    expect(calls("getPublicCommitmentExclusions")).toHaveLength(1);
    expect(calls("getPublicRehearsalWorkHistory")).toHaveLength(1);
    await getPublicGardenHypercerts(GARDEN, 42161, 50, createPublicReportingRead(42161));
    expect(calls("getPublicCommitmentExclusions")).toHaveLength(2);
    expect(calls("getPublicRehearsalWorkHistory")).toHaveLength(2);
  });

  it("does not carry a failed eligibility read into the next operation", async () => {
    mocks.query.mockRejectedValueOnce(new Error("source offline"));
    const reporting = createPublicReportingRead(42161);
    await expect(reporting.links()).rejects.toThrow("source offline");
    await expect(reporting.links()).rejects.toThrow("source offline");
    expect(mocks.query).toHaveBeenCalledOnce();
    expect((await createPublicReportingRead(42161).links()).workUIDs.has(QA_WORK)).toBe(true);
  });

  it("reads all immutable link-history pages and rejects a non-advancing page", async () => {
    const page = Array.from({ length: 100 }, (_, index) => ({
      id: `42161-link-${1000 + index}`,
      data: QA_WORK,
    }));
    const normal = mocks.query.getMockImplementation();
    mocks.query.mockImplementation(async (...args) =>
      args[2] === "getPublicRehearsalWorkHistory"
        ? {
            data: {
              CommitmentEvent: args[1].after ? [{ id: "42161-link-1100", data: REAL }] : page,
            },
          }
        : normal?.(...args)
    );
    expect((await createPublicReportingRead(42161).links()).workUIDs.has(REAL)).toBe(true);
    expect(
      mocks.query.mock.calls.find((call) => call[1].after === "42161-link-1099")
    ).toBeDefined();
    mocks.query.mockImplementation(async (...args) =>
      args[2] === "getPublicRehearsalWorkHistory"
        ? { data: { CommitmentEvent: page } }
        : normal?.(...args)
    );
    await expect(createPublicReportingRead(42161).links()).rejects.toThrow("did not advance");
  });
});
