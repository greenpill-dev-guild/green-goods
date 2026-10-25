/**
 * usePublicImpactEvidence Hook Tests
 * @vitest-environment happy-dom
 */

import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "../../../types/domain";
import {
  approveEveryWork,
  createMockGarden,
  createMockWork,
  createMockWorkApproval,
} from "../../test-utils/mock-factories";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

const mockGetGardens = vi.fn();
const mockIndexerQuery = vi.fn();
vi.mock("../../../modules/data/graphql-client", () => ({
  greenGoodsIndexer: { query: (...args: unknown[]) => mockIndexerQuery(...args) },
}));
const mockGetActions = vi.fn();
vi.mock("../../../modules/data/greengoods", () => ({
  getGardens: (...args: unknown[]) => mockGetGardens(...args),
  getActions: (...args: unknown[]) => mockGetActions(...args),
}));

const mockGetWorks = vi.fn();
const mockGetGardenAssessments = vi.fn();
const mockReadWorkApprovalsForWorks = vi.fn();
vi.mock("../../../modules/data/eas", () => ({
  getWorks: (...args: unknown[]) => mockGetWorks(...args),
  getGardenAssessments: (...args: unknown[]) => mockGetGardenAssessments(...args),
  readWorkApprovalsForWorks: (...args: unknown[]) => mockReadWorkApprovalsForWorks(...args),
}));

const mockGetGardenHypercerts = vi.fn();
vi.mock("../../../modules/data/hypercerts-fetch", () => ({
  getGardenHypercerts: (...args: unknown[]) => mockGetGardenHypercerts(...args),
}));

vi.mock("../../../config/default-chain", () => ({ DEFAULT_CHAIN_ID: 11155111 }));

import { usePublicImpactEvidence } from "../../../hooks/public/usePublicImpactEvidence";
import { PUBLIC_IMPACT_CERTIFICATE_FETCH_CAP } from "../../../public-contracts/public-impact";

describe("usePublicImpactEvidence", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
    mockGetActions.mockResolvedValue([]);
    mockGetGardenAssessments.mockResolvedValue([]);
    mockGetGardenHypercerts.mockResolvedValue([]);
    mockReadWorkApprovalsForWorks.mockImplementation(async (workUIDs: string[]) =>
      approveEveryWork(workUIDs)
    );
  });

  it("shares one fresh eligibility read across the 50-garden Arbitrum evidence slice", async () => {
    const gardens = Array.from({ length: 50 }, (_, index) =>
      createMockGarden({ id: `0x${(1000 + index).toString(16).padStart(40, "0")}` })
    );
    mockGetGardens.mockResolvedValue(gardens);
    mockGetWorks.mockResolvedValue(
      gardens.map((garden, index) =>
        createMockWork({
          id: `0x${(1000 + index).toString(16).padStart(64, "0")}`,
          gardenAddress: garden.id,
        })
      )
    );
    mockIndexerQuery.mockImplementation(async (_query, _variables, operation) =>
      operation === "getPublicCommitmentExclusions"
        ? {
            data: {
              Commitment: [
                { id: "42161-99", poolId: "1", cycleId: "1", workUIDs: [], assessmentUID: null },
              ],
            },
          }
        : { data: { CommitmentEvent: [] } }
    );
    const { result } = renderHookWithQueryClient(
      () => usePublicImpactEvidence({ chainId: 42161 }),
      { queryClient }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetGardenHypercerts).toHaveBeenCalledTimes(50);
    expect(mockGetGardenAssessments).toHaveBeenCalledTimes(50);
    expect(
      mockIndexerQuery.mock.calls.filter((call) => call[2] === "getPublicCommitmentExclusions")
    ).toHaveLength(1);
    expect(
      mockIndexerQuery.mock.calls.filter((call) => call[2] === "getPublicRehearsalWorkHistory")
    ).toHaveLength(1);
  });

  it("records only approved work as evidence", async () => {
    const garden = createMockGarden({ id: "0x1111111111111111111111111111111111111111" });
    mockGetGardens.mockResolvedValue([garden]);
    mockGetWorks.mockResolvedValue(
      ["approved", "pending", "rejected"].map((id) =>
        createMockWork({ id, gardenAddress: garden.id })
      )
    );
    mockReadWorkApprovalsForWorks.mockResolvedValue({
      approvals: [
        createMockWorkApproval({ id: "a-1", workUID: "approved", approved: true }),
        createMockWorkApproval({ id: "a-2", workUID: "rejected", approved: false }),
      ],
      failedWorkUIDs: [],
    });

    const { result } = renderHookWithQueryClient(() => usePublicImpactEvidence(), { queryClient });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.records.map((record) => record.id)).toEqual(["work:approved"]);
    expect(result.current.data?.partialData).toBe(false);
  });

  it.each([
    ["the works read fails", () => mockGetWorks.mockRejectedValue(new Error("EAS down"))],
    [
      "a decision read fails",
      () =>
        mockReadWorkApprovalsForWorks.mockResolvedValue({
          approvals: [],
          failedWorkUIDs: ["work"],
        }),
    ],
  ])("says the ledger is partial when %s", async (_case, fail) => {
    const garden = createMockGarden({ id: "0x1111111111111111111111111111111111111111" });
    mockGetGardens.mockResolvedValue([garden]);
    mockGetWorks.mockResolvedValue([createMockWork({ id: "work", gardenAddress: garden.id })]);
    fail();

    const { result } = renderHookWithQueryClient(() => usePublicImpactEvidence(), { queryClient });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.records).toEqual([]);
    expect(result.current.data?.partialData).toBe(true);
  });

  // A certificate total read short would undercount /impact's proof row, so it is unknown:
  // after a failed read, and when a Garden holds more certificates than one read takes.
  it.each([
    [
      "a certificate read fails",
      () => mockGetGardenHypercerts.mockRejectedValue(new Error("Hypercerts down")),
      { partialData: true },
    ],
    [
      "a Garden holds more certificates than one read takes",
      () =>
        mockGetGardenHypercerts.mockResolvedValue(
          Array.from({ length: PUBLIC_IMPACT_CERTIFICATE_FETCH_CAP + 1 }, (_, index) => ({
            id: `certificate-${index}`,
            tokenId: BigInt(index),
            metadataUri: "ipfs://certificate",
            mintedAt: 1_700_000_000 + index,
            title: `Certificate ${index}`,
          }))
        ),
      { partialData: true, sourceLimitReached: true },
    ],
  ])("leaves the certificate count unknown when %s", async (_case, arrange, flags) => {
    const garden = createMockGarden({ id: "0x1111111111111111111111111111111111111111" });
    mockGetGardens.mockResolvedValue([garden]);
    mockGetWorks.mockResolvedValue([createMockWork({ id: "work", gardenAddress: garden.id })]);
    arrange();

    const { result } = renderHookWithQueryClient(() => usePublicImpactEvidence(), { queryClient });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({ certificateCount: null, ...flags });
  });

  it("joins checksummed Work recipients to lowercase Garden identifiers", async () => {
    const checksummedGarden: Address = "0x04D60647836bcA09c37B379550038BdaaFD82503";
    const lowercaseGarden = checksummedGarden.toLowerCase();
    mockGetGardens.mockResolvedValue([
      createMockGarden({ id: lowercaseGarden, name: "Case-safe Garden" }),
    ]);
    mockGetWorks.mockResolvedValue([
      createMockWork({ id: "case-work", gardenAddress: checksummedGarden }),
    ]);

    const { result } = renderHookWithQueryClient(() => usePublicImpactEvidence(), { queryClient });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "work:case-work", gardenId: lowercaseGarden }),
      ])
    );
  });
});
