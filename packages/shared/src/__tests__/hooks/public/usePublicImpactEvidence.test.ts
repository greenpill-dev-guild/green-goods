/**
 * usePublicImpactEvidence Hook Tests
 * @vitest-environment jsdom
 */

import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "../../../types/domain";
import { createMockGarden, createMockWork } from "../../test-utils/mock-factories";
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
vi.mock("../../../modules/data/eas", () => ({
  getWorks: (...args: unknown[]) => mockGetWorks(...args),
  getGardenAssessments: (...args: unknown[]) => mockGetGardenAssessments(...args),
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
