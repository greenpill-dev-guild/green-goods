/**
 * usePublicFieldNotes Hook Tests
 * @vitest-environment happy-dom
 */

import { type QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveEveryWork,
  createMockGarden,
  createMockWork,
  MOCK_ADDRESSES,
} from "../../test-utils/mock-factories";
import { createTestQueryClient } from "../../test-utils/query-client";
import { renderHookWithQueryClient } from "../../test-utils/query-client-render";

// ============================================
// Mocks
// ============================================

const mockGetGardens = vi.fn();
vi.mock("../../../modules/data/greengoods", () => ({
  getGardens: (...args: unknown[]) => mockGetGardens(...args),
}));

const mockGetWorks = vi.fn();
const mockReadWorkApprovalsForWorks = vi.fn();
vi.mock("../../../modules/data/eas", () => ({
  getWorks: (...args: unknown[]) => mockGetWorks(...args),
  readWorkApprovalsForWorks: (...args: unknown[]) => mockReadWorkApprovalsForWorks(...args),
}));

vi.mock("../../../config/blockchain", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../config/blockchain")>()),
  DEFAULT_CHAIN_ID: 11155111,
}));

vi.mock("../../../config/default-chain", () => ({
  DEFAULT_CHAIN_ID: 11155111,
}));

import { usePublicFieldNotes } from "../../../hooks/public/usePublicFieldNotes";

// ============================================
// Helpers
// ============================================

// ============================================
// Tests
// ============================================

describe("usePublicFieldNotes", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
    mockGetGardens.mockResolvedValue([]);
    mockGetWorks.mockResolvedValue([]);
    mockReadWorkApprovalsForWorks.mockImplementation(async (workUIDs: string[]) =>
      approveEveryWork(workUIDs)
    );
  });

  it("leaves unapproved work out of the feed and its total", async () => {
    const garden = createMockGarden({ id: MOCK_ADDRESSES.garden, name: "Garden" });
    mockGetGardens.mockResolvedValue([garden]);
    mockGetWorks.mockResolvedValue([
      createMockWork({ id: "approved", gardenAddress: garden.id }),
      createMockWork({ id: "pending", gardenAddress: garden.id }),
    ]);
    mockReadWorkApprovalsForWorks.mockResolvedValue(approveEveryWork(["approved"]));

    const { result } = renderHookWithQueryClient(() => usePublicFieldNotes(), { queryClient });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.fieldNotes.map((note) => note.id)).toEqual(["approved"]);
    expect(result.current.data?.total).toBe(1);
    expect(result.current.data?.partialData).toBe(false);
  });

  it("says the feed may be missing work when a decision cannot be read", async () => {
    const garden = createMockGarden({ id: MOCK_ADDRESSES.garden, name: "Garden" });
    mockGetGardens.mockResolvedValue([garden]);
    mockGetWorks.mockResolvedValue([createMockWork({ id: "unread", gardenAddress: garden.id })]);
    mockReadWorkApprovalsForWorks.mockResolvedValue({ approvals: [], failedWorkUIDs: ["unread"] });

    const { result } = renderHookWithQueryClient(() => usePublicFieldNotes(), { queryClient });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toMatchObject({ fieldNotes: [], total: 0, partialData: true });
  });

  it("returns empty page when no works exist", async () => {
    mockGetGardens.mockResolvedValue([
      createMockGarden({ id: MOCK_ADDRESSES.garden, name: "Garden" }),
    ]);
    mockGetWorks.mockResolvedValue([]);

    const { result } = renderHookWithQueryClient(() => usePublicFieldNotes(), {
      queryClient,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.fieldNotes).toEqual([]);
    expect(result.current.data?.hasMore).toBe(false);
  });

  it("fetches works for all gardens when no gardenAddress filter is provided", async () => {
    const garden = createMockGarden({ id: MOCK_ADDRESSES.garden, name: "Garden A" });
    const otherGarden = createMockGarden({
      id: "0xOther1234567890abcdef1234567890abcdef1234",
      name: "Garden B",
    });

    mockGetGardens.mockResolvedValue([garden, otherGarden]);
    mockGetWorks.mockImplementation(async (gardens: string[] | string | undefined) => {
      // Hook should pass an array of all garden IDs when gardenAddress is undefined
      if (!Array.isArray(gardens)) return [];
      return [
        createMockWork({
          id: "w-a",
          gardenAddress: garden.id as `0x${string}`,
          createdAt: 1_700_000_000,
        }),
        createMockWork({
          id: "w-b",
          gardenAddress: otherGarden.id as `0x${string}`,
          createdAt: 1_700_000_500,
          metadata: '{"details":{"participants":4}}',
        }),
      ];
    });

    const { result } = renderHookWithQueryClient(() => usePublicFieldNotes(), {
      queryClient,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGetWorks).toHaveBeenCalled();
    expect(result.current.data?.fieldNotes).toHaveLength(2);
    expect(result.current.data?.fieldNotes[0]?.metadata).toBe('{"details":{"participants":4}}');
  });

  it("filters by garden address when provided", async () => {
    const garden = createMockGarden({ id: MOCK_ADDRESSES.garden, name: "Garden" });
    mockGetGardens.mockResolvedValue([garden]);
    mockGetWorks.mockResolvedValue([
      createMockWork({
        id: "w-1",
        gardenAddress: garden.id as `0x${string}`,
        createdAt: 1_700_000_000,
      }),
    ]);

    const { result } = renderHookWithQueryClient(
      () => usePublicFieldNotes({ gardenAddress: garden.id }),
      {
        queryClient,
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // The eas getWorks helper accepts a single address — hook should forward it
    expect(mockGetWorks).toHaveBeenCalledWith(garden.id, expect.anything());
    expect(result.current.data?.fieldNotes).toHaveLength(1);
  });

  it("paginates results using limit and cursor", async () => {
    const garden = createMockGarden({ id: MOCK_ADDRESSES.garden, name: "Garden" });
    mockGetGardens.mockResolvedValue([garden]);

    // 25 works in descending createdAt — hook should sort newest-first then page
    const works = Array.from({ length: 25 }, (_, i) =>
      createMockWork({
        id: `work-${i}`,
        gardenAddress: garden.id as `0x${string}`,
        createdAt: 1_700_000_000 + i,
      })
    );
    mockGetWorks.mockResolvedValue(works);

    const { result } = renderHookWithQueryClient(() => usePublicFieldNotes({ limit: 10 }), {
      queryClient,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const page = result.current.data;
    expect(page?.fieldNotes).toHaveLength(10);
    // Newest first: work-24 → work-15
    expect(page?.fieldNotes[0]?.id).toBe("work-24");
    expect(page?.hasMore).toBe(true);
    expect(typeof page?.nextCursor).toBe("number");
  });

  it("respects cursor offset for subsequent pages", async () => {
    const garden = createMockGarden({ id: MOCK_ADDRESSES.garden, name: "Garden" });
    mockGetGardens.mockResolvedValue([garden]);

    const works = Array.from({ length: 25 }, (_, i) =>
      createMockWork({
        id: `work-${i}`,
        gardenAddress: garden.id as `0x${string}`,
        createdAt: 1_700_000_000 + i,
      })
    );
    mockGetWorks.mockResolvedValue(works);

    const { result } = renderHookWithQueryClient(
      () => usePublicFieldNotes({ limit: 10, cursor: 10 }),
      {
        queryClient,
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const page = result.current.data;
    expect(page?.fieldNotes).toHaveLength(10);
    // Skipping the first 10 of the sorted-desc list
    expect(page?.fieldNotes[0]?.id).toBe("work-14");
  });

  it("propagates EAS fetch errors so the page can render an error state", async () => {
    const garden = createMockGarden({ id: MOCK_ADDRESSES.garden, name: "Garden" });
    mockGetGardens.mockResolvedValue([garden]);
    mockGetWorks.mockRejectedValue(new Error("EAS down"));

    const { result } = renderHookWithQueryClient(() => usePublicFieldNotes(), {
      queryClient,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe("EAS down");
  });
});
