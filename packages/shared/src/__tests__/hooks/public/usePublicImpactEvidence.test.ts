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
