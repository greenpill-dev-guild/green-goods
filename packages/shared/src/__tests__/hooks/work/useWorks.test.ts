/**
 * useWorks Hook Tests
 * @vitest-environment jsdom
 *
 * Tests the work fetching hook in online-only mode plus the jobToWork pure function.
 * Offline mode tests are lighter since the merge logic (useMerged) is tested separately.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Job, WorkJobPayload } from "../../../types/job-queue";

// ── Constants ───────────────────────────────────────────────────────────────
const TEST_CHAIN_ID = 11155111;
const TEST_GARDEN = "0x2222222222222222222222222222222222222222";
const TEST_PRIMARY_ADDRESS = "0x1111111111111111111111111111111111111111";

// ── Mock data ───────────────────────────────────────────────────────────────
const mockGetWorks = vi.fn();
const mockGetWorkApprovals = vi.fn();
const mockGetJobs = vi.fn();
const mockGetImagesForJob = vi.fn();
const mockOnMultiple = vi.fn().mockReturnValue(() => {});

vi.mock("../../../config/blockchain", () => ({
  DEFAULT_CHAIN_ID: TEST_CHAIN_ID,
}));

vi.mock("../../../modules/data/eas", () => ({
  getWorks: (...args: unknown[]) => mockGetWorks(...args),
  getWorkApprovals: (...args: unknown[]) => mockGetWorkApprovals(...args),
}));

vi.mock("../../../modules/job-queue", () => ({
  jobQueue: {
    getJobs: (...args: unknown[]) => mockGetJobs(...args),
    getStats: vi.fn().mockResolvedValue({ total: 0, pending: 0, failed: 0, synced: 0 }),
  },
  jobQueueDB: {
    getImagesForJob: (...args: unknown[]) => mockGetImagesForJob(...args),
  },
}));

vi.mock("../../../modules/job-queue/event-bus", () => ({
  jobQueueEventBus: {
    onMultiple: mockOnMultiple,
  },
  useJobQueueEvents: vi.fn(),
}));

vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => TEST_PRIMARY_ADDRESS,
}));

vi.mock("../../../hooks/app/useMerged", () => ({
  useMerged: (config: Record<string, unknown>) => ({
    online: { data: null, isFetching: false, isError: false, error: null, refetch: vi.fn() },
    offline: { data: [], refetch: vi.fn() },
    merged: {
      data: null,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    },
  }),
}));

vi.mock("../../../config/react-query", () => ({
  STALE_TIMES: { works: 30_000, merged: 15_000, queue: 10_000 },
  GC_TIMES: { works: 300_000, queue: 60_000 },
}));

vi.mock("../../../modules/app/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("../../../hooks/query-keys", () => ({
  queryKeys: {
    works: {
      online: (gardenId: string, chainId: number) => ["works", "online", gardenId, chainId],
      offline: (gardenId: string) => ["works", "offline", gardenId],
      merged: (gardenId: string, chainId: number) => ["works", "merged", gardenId, chainId],
    },
    queue: {
      pendingCount: () => ["queue", "pendingCount"],
      stats: () => ["queue", "stats"],
    },
  },
}));

const { useWorks, jobToWork } = await import("../../../hooks/work/useWorks");

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(IntlProvider, { locale: "en", messages: {} }, children)
    );
  };
}

describe("hooks/work/useWorks", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0, staleTime: 0 },
        mutations: { retry: false },
      },
    });
    mockGetWorks.mockResolvedValue([]);
    mockGetWorkApprovals.mockResolvedValue([]);
    mockGetJobs.mockResolvedValue([]);
    mockGetImagesForJob.mockResolvedValue([]);
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("returns empty works when gardenId is empty", () => {
    const { result } = renderHook(() => useWorks(""), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.works).toEqual([]);
    expect(result.current.offlineCount).toBe(0);
  });

  it("fetches works from EAS subgraph in online mode", async () => {
    const onlineWorks = [
      {
        id: "work-1",
        title: "Test Work",
        actionUID: 1,
        gardenerAddress: "0xgardener",
        gardenAddress: TEST_GARDEN,
        feedback: "Good",
        metadata: "{}",
        media: [],
        createdAt: 1000,
        status: "pending" as const,
      },
    ];
    mockGetWorks.mockResolvedValue(onlineWorks);
    mockGetWorkApprovals.mockResolvedValue([]);

    const { result } = renderHook(() => useWorks(TEST_GARDEN), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.works).toHaveLength(1);
    });
    expect(mockGetWorks).toHaveBeenCalledWith(TEST_GARDEN, TEST_CHAIN_ID);
  });

  it("computes work status from approvals (approved/rejected/pending)", async () => {
    const works = [
      {
        id: "w1",
        title: "W1",
        actionUID: 1,
        gardenerAddress: "0x1",
        gardenAddress: TEST_GARDEN,
        feedback: "",
        metadata: "{}",
        media: [],
        createdAt: 1000,
        status: "pending" as const,
      },
      {
        id: "w2",
        title: "W2",
        actionUID: 1,
        gardenerAddress: "0x1",
        gardenAddress: TEST_GARDEN,
        feedback: "",
        metadata: "{}",
        media: [],
        createdAt: 1001,
        status: "pending" as const,
      },
      {
        id: "w3",
        title: "W3",
        actionUID: 1,
        gardenerAddress: "0x1",
        gardenAddress: TEST_GARDEN,
        feedback: "",
        metadata: "{}",
        media: [],
        createdAt: 1002,
        status: "pending" as const,
      },
    ];
    const approvals = [
      { workUID: "w1", approved: true },
      { workUID: "w2", approved: false },
      // w3 has no approval -> stays pending
    ];
    mockGetWorks.mockResolvedValue(works);
    mockGetWorkApprovals.mockResolvedValue(approvals);

    const { result } = renderHook(() => useWorks(TEST_GARDEN), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.works).toHaveLength(3);
    });

    const statusMap = new Map(result.current.works.map((w) => [w.id, w.status]));
    expect(statusMap.get("w1")).toBe("approved");
    expect(statusMap.get("w2")).toBe("rejected");
    expect(statusMap.get("w3")).toBe("pending");
  });

  it("handles approval fetch failure gracefully", async () => {
    const works = [
      {
        id: "w1",
        title: "W1",
        actionUID: 1,
        gardenerAddress: "0x1",
        gardenAddress: TEST_GARDEN,
        feedback: "",
        metadata: "{}",
        media: [],
        createdAt: 1000,
        status: "pending" as const,
      },
    ];
    mockGetWorks.mockResolvedValue(works);
    mockGetWorkApprovals.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useWorks(TEST_GARDEN), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.works).toHaveLength(1);
    });
    // Should still return works even if approvals fail
    expect(result.current.works[0].status).toBe("pending");
  });

  it("marks work as rejected when approval.approved is false", async () => {
    const works = [
      {
        id: "w1",
        title: "W1",
        actionUID: 1,
        gardenerAddress: "0x1",
        gardenAddress: TEST_GARDEN,
        feedback: "",
        metadata: "{}",
        media: [],
        createdAt: 1000,
        status: "pending" as const,
      },
    ];
    mockGetWorks.mockResolvedValue(works);
    mockGetWorkApprovals.mockResolvedValue([{ workUID: "w1", approved: false }]);

    const { result } = renderHook(() => useWorks(TEST_GARDEN), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.works[0]?.status).toBe("rejected");
    });
  });

  it("returns offlineCount 0 in online-only mode", async () => {
    mockGetWorks.mockResolvedValue([]);

    const { result } = renderHook(() => useWorks(TEST_GARDEN), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.offlineCount).toBe(0);
  });

  describe("jobToWork", () => {
    it("converts job payload to Work model", () => {
      const job: Job<WorkJobPayload> = {
        id: "job-123",
        kind: "work",
        payload: {
          gardenAddress: TEST_GARDEN,
          actionUID: 42,
          title: "Plant Trees",
          feedback: "Planted 50 oaks",
          details: { location: "north field" },
          timeSpentMinutes: 120,
          tags: ["planting"],
          media: [],
        },
        userAddress: TEST_PRIMARY_ADDRESS,
        createdAt: 1700000000000, // ms timestamp
        retryCount: 0,
        synced: false,
        lastError: null,
      };

      const work = jobToWork(job);

      expect(work.id).toBe("job-123");
      expect(work.title).toBe("Plant Trees");
      expect(work.actionUID).toBe(42);
      expect(work.gardenAddress).toBe(TEST_GARDEN);
      expect(work.feedback).toBe("Planted 50 oaks");
      expect(work.gardenerAddress).toBe("pending");
      expect(work.media).toEqual([]);
      // createdAt should be converted from ms to seconds (EAS format)
      expect(work.createdAt).toBe(Math.floor(1700000000000 / 1000));
      expect(work.status).toBe("syncing");
    });

    it("uses action UID as fallback title when title is empty", () => {
      const job: Job<WorkJobPayload> = {
        id: "job-456",
        kind: "work",
        payload: {
          gardenAddress: TEST_GARDEN,
          actionUID: 7,
          title: "",
          feedback: "",
          details: {},
          timeSpentMinutes: 30,
          tags: [],
          media: [],
        },
        userAddress: TEST_PRIMARY_ADDRESS,
        createdAt: Date.now(),
        retryCount: 0,
        synced: false,
        lastError: null,
      };

      const work = jobToWork(job);
      expect(work.title).toBe("Action 7");
    });

    it("marks synced job as pending (awaiting approval)", () => {
      const job: Job<WorkJobPayload> = {
        id: "job-789",
        kind: "work",
        payload: {
          gardenAddress: TEST_GARDEN,
          actionUID: 1,
          title: "Synced Work",
          feedback: "",
          details: {},
          timeSpentMinutes: 60,
          tags: [],
          media: [],
        },
        userAddress: TEST_PRIMARY_ADDRESS,
        createdAt: Date.now(),
        retryCount: 0,
        synced: true,
        lastError: null,
      };

      const work = jobToWork(job);
      expect(work.status).toBe("pending");
    });

    it("marks failed job as sync_failed", () => {
      const job: Job<WorkJobPayload> = {
        id: "job-failed",
        kind: "work",
        payload: {
          gardenAddress: TEST_GARDEN,
          actionUID: 1,
          title: "Failed Work",
          feedback: "",
          details: {},
          timeSpentMinutes: 60,
          tags: [],
          media: [],
        },
        userAddress: TEST_PRIMARY_ADDRESS,
        createdAt: Date.now(),
        retryCount: 3,
        synced: false,
        lastError: "Transaction reverted",
      };

      const work = jobToWork(job);
      expect(work.status).toBe("sync_failed");
    });

    it("serializes details and tags into metadata JSON", () => {
      const job: Job<WorkJobPayload> = {
        id: "job-meta",
        kind: "work",
        payload: {
          gardenAddress: TEST_GARDEN,
          actionUID: 1,
          title: "Work with Meta",
          feedback: "",
          details: { soilType: "clay", depth: "30cm" },
          timeSpentMinutes: 90,
          tags: ["planting", "soil-prep"],
          media: [],
        },
        userAddress: TEST_PRIMARY_ADDRESS,
        createdAt: Date.now(),
        retryCount: 0,
        synced: false,
        lastError: null,
      };

      const work = jobToWork(job);
      const parsed = JSON.parse(work.metadata);
      expect(parsed.details).toEqual({ soilType: "clay", depth: "30cm" });
      expect(parsed.timeSpentMinutes).toBe(90);
      expect(parsed.tags).toEqual(["planting", "soil-prep"]);
    });
  });
});
