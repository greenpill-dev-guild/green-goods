/**
 * usePublicImpactEvidence Hook Tests
 * @vitest-environment jsdom
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Address } from "../../../types/domain";
import { createMockGarden, createMockWork } from "../../test-utils/mock-factories";

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

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("usePublicImpactEvidence", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
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

    const { result } = renderHook(() => usePublicImpactEvidence(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "work:case-work", gardenId: lowercaseGarden }),
      ])
    );
  });
});
