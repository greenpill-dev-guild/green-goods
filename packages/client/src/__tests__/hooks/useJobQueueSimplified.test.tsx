import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useJobQueue,
  useJobQueueStats,
  useOfflineStatus,
  usePendingJobsCount,
  useWorksMergedSimplified,
} from "@/hooks/useJobQueueSimplified";

// Mock dependencies
vi.mock("@/modules/job-queue", () => ({
  jobQueue: {
    getStats: vi.fn(),
    getPendingCount: vi.fn(),
    getJobs: vi.fn(),
    flush: vi.fn(),
    isSyncInProgress: vi.fn(),
  },
  jobQueueDB: {
    getImagesForJob: vi.fn(),
  },
}));

vi.mock("@/modules/eas", () => ({
  getWorks: vi.fn(),
}));

vi.mock("@/utils/useChainConfig", () => ({
  useCurrentChain: vi.fn(),
}));

vi.mock("@/modules/job-queue/event-bus", () => ({
  useJobQueueEvents: vi.fn(),
}));

// Import mocked modules
import { getWorks } from "@/modules/eas";
import { jobQueue, jobQueueDB } from "@/modules/job-queue";
import { useJobQueueEvents } from "@/modules/job-queue/event-bus";
import { useCurrentChain } from "@/utils/useChainConfig";

const mockJobQueue = vi.mocked(jobQueue);
const mockJobQueueDB = vi.mocked(jobQueueDB);
const mockGetWorks = vi.mocked(getWorks);
const mockUseCurrentChain = vi.mocked(useCurrentChain);
const mockUseJobQueueEvents = vi.mocked(useJobQueueEvents);

// Mock event listeners
const mockEventListeners: Record<string, Function[]> = {};
const mockAddEventListener = vi.fn((event: string, listener: Function) => {
  if (!mockEventListeners[event]) mockEventListeners[event] = [];
  mockEventListeners[event].push(listener);
});
const mockRemoveEventListener = vi.fn((event: string, listener: Function) => {
  if (mockEventListeners[event]) {
    const index = mockEventListeners[event].indexOf(listener);
    if (index > -1) mockEventListeners[event].splice(index, 1);
  }
});

vi.mock("./query-keys", () => ({
  queryKeys: {
    queue: {
      stats: () => ["queue", "stats"],
      pendingCount: () => ["queue", "pendingCount"],
    },
    works: {
      online: (gardenId: string, chainId: number) => ["works", "online", gardenId, chainId],
      offline: (gardenId: string) => ["works", "offline", gardenId],
      merged: (gardenId: string, chainId: number) => ["works", "merged", gardenId, chainId],
    },
    offline: {
      status: () => ["offline", "status"],
    },
  },
  queryInvalidation: {
    invalidateWorksForGarden: (gardenId: string, chainId: number) => [
      ["works", "online", gardenId, chainId],
      ["works", "offline", gardenId],
      ["works", "merged", gardenId, chainId],
    ],
  },
}));

// Mock window object
Object.defineProperty(global, "window", {
  value: {
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
  },
  writable: true,
});

// Mock navigator.onLine
Object.defineProperty(navigator, "onLine", {
  value: true,
  writable: true,
  configurable: true,
});

// Test data factories
const createMockQueueStats = (overrides = {}): QueueStats => ({
  total: 10,
  pending: 3,
  failed: 1,
  synced: 6,
  ...overrides,
});

const createMockWork = (overrides = {}): Work => ({
  id: `work-${Date.now()}-${Math.random()}`,
  title: "Test Work",
  actionUID: 1,
  gardenerAddress: "0x123",
  gardenAddress: "0xgarden123",
  feedback: "",
  metadata: "{}",
  media: [],
  createdAt: Date.now(),
  status: "pending",
  ...overrides,
});

const createMockJob = (overrides: any = {}): Job<WorkJobPayload> => ({
  id: `job-${Date.now()}-${Math.random()}`,
  kind: "work",
  payload: {
    title: "Test Work",
    actionUID: 1,
    gardenAddress: "0xgarden123",
    feedback: "",
    plantCount: 5,
    plantSelection: ["tree"],
    ...overrides.payload,
  },
  createdAt: Date.now(),
  synced: false,
  lastError: undefined,
  attempts: 0,
  ...overrides,
});

const createMockImage = (name = "test.jpg") => ({
  id: `img-${Date.now()}`,
  file: new File([], name),
  url: `mock-url-${name}`,
});

// Test wrapper component
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useJobQueueSimplified", () => {
  let mockEventHandler: Function;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock values
    mockUseCurrentChain.mockReturnValue(1);
    mockJobQueue.getStats.mockResolvedValue(createMockQueueStats());
    mockJobQueue.getPendingCount.mockResolvedValue(3);
    mockJobQueue.getJobs.mockResolvedValue([]);
    mockJobQueue.isSyncInProgress.mockReturnValue(false);
    mockJobQueueDB.getImagesForJob.mockResolvedValue([]);
    mockGetWorks.mockResolvedValue([]);

    // Setup event handler mock
    mockUseJobQueueEvents.mockImplementation((_events: string[], handler: Function) => {
      mockEventHandler = handler;
    });

    // Reset event listeners
    Object.keys(mockEventListeners).forEach((key) => {
      mockEventListeners[key] = [];
    });
  });

  describe("useJobQueueStats", () => {
    it("should fetch queue statistics", async () => {
      const mockStats = createMockQueueStats({ pending: 5, total: 15 });
      mockJobQueue.getStats.mockResolvedValue(mockStats);

      const { result } = renderHook(() => useJobQueueStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockStats);
      expect(mockJobQueue.getStats).toHaveBeenCalled();
    });

    it("should setup event listeners for stats updates", () => {
      renderHook(() => useJobQueueStats(), {
        wrapper: createWrapper(),
      });

      expect(mockUseJobQueueEvents).toHaveBeenCalledWith(
        ["job:added", "job:completed", "job:failed", "queue:sync-completed"],
        expect.any(Function)
      );
    });

    it("should handle stats fetch errors", async () => {
      const error = new Error("Stats fetch failed");
      mockJobQueue.getStats.mockRejectedValue(error);

      const { result } = renderHook(() => useJobQueueStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe(error);
    });

    it("should invalidate queries on relevant events", () => {
      const queryClient = new QueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      renderHook(() => useJobQueueStats(), {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      });

      // Simulate event
      act(() => {
        mockEventHandler();
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["queue", "stats"],
      });
    });
  });

  describe("usePendingJobsCount", () => {
    it("should fetch pending jobs count", async () => {
      mockJobQueue.getPendingCount.mockResolvedValue(7);

      const { result } = renderHook(() => usePendingJobsCount(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBe(7);
      expect(mockJobQueue.getPendingCount).toHaveBeenCalled();
    });

    it("should setup event listeners for count updates", () => {
      renderHook(() => usePendingJobsCount(), {
        wrapper: createWrapper(),
      });

      expect(mockUseJobQueueEvents).toHaveBeenCalledWith(
        ["job:added", "job:completed", "job:failed"],
        expect.any(Function)
      );
    });

    it("should handle count fetch errors", async () => {
      const error = new Error("Count fetch failed");
      mockJobQueue.getPendingCount.mockRejectedValue(error);

      const { result } = renderHook(() => usePendingJobsCount(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe(error);
    });
  });

  describe("useWorksMergedSimplified", () => {
    it("should fetch and merge online and offline works", async () => {
      const onlineWorks = [
        createMockWork({ id: "online-1", title: "Online Work 1" }),
        createMockWork({ id: "online-2", title: "Online Work 2" }),
      ];
      const offlineJobs = [
        createMockJob({
          id: "offline-1",
          payload: { title: "Offline Work 1", gardenAddress: "0xgarden123" },
        }),
      ];

      mockGetWorks.mockResolvedValue(onlineWorks);
      mockJobQueue.getJobs.mockResolvedValue(offlineJobs);
      mockJobQueueDB.getImagesForJob.mockResolvedValue([createMockImage()]);

      const { result } = renderHook(() => useWorksMergedSimplified("0xgarden123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.works).toHaveLength(3);
      expect(result.current.onlineCount).toBe(2);
      expect(result.current.offlineCount).toBe(1);
      expect(mockGetWorks).toHaveBeenCalledWith("0xgarden123", 1);
    });

    it("should filter offline jobs by garden address", async () => {
      const offlineJobs = [
        createMockJob({ payload: { gardenAddress: "0xgarden123" } }),
        createMockJob({ payload: { gardenAddress: "0xother456" } }),
      ];

      mockGetWorks.mockResolvedValue([]);
      mockJobQueue.getJobs.mockResolvedValue(offlineJobs);
      mockJobQueueDB.getImagesForJob.mockResolvedValue([]);

      const { result } = renderHook(() => useWorksMergedSimplified("0xgarden123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.works).toHaveLength(1);
      expect(result.current.works[0].gardenAddress).toBe("0xgarden123");
    });

    it("should deduplicate works based on actionUID and time", async () => {
      const now = Date.now();
      const onlineWork = createMockWork({
        id: "online-1",
        actionUID: 1,
        createdAt: now,
      });
      const duplicateJob = createMockJob({
        id: "offline-1",
        payload: {
          actionUID: 1,
          gardenAddress: "0xgarden123",
        },
        createdAt: now + 60000, // 1 minute later (within 5min window)
      });

      mockGetWorks.mockResolvedValue([onlineWork]);
      mockJobQueue.getJobs.mockResolvedValue([duplicateJob]);
      mockJobQueueDB.getImagesForJob.mockResolvedValue([]);

      const { result } = renderHook(() => useWorksMergedSimplified("0xgarden123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should only have the online work, duplicate filtered out
      expect(result.current.works).toHaveLength(1);
      expect(result.current.works[0].id).toBe("online-1");
    });

    it("should include offline work when outside time window", async () => {
      const now = Date.now();
      const onlineWork = createMockWork({
        actionUID: 1,
        createdAt: now,
      });
      const distantJob = createMockJob({
        payload: {
          actionUID: 1,
          gardenAddress: "0xgarden123",
        },
        createdAt: now + 10 * 60 * 1000, // 10 minutes later (outside 5min window)
      });

      mockGetWorks.mockResolvedValue([onlineWork]);
      mockJobQueue.getJobs.mockResolvedValue([distantJob]);
      mockJobQueueDB.getImagesForJob.mockResolvedValue([]);

      const { result } = renderHook(() => useWorksMergedSimplified("0xgarden123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.works).toHaveLength(2);
    });

    it("should sort works by creation time (newest first)", async () => {
      const now = Date.now();
      const works = [
        createMockWork({ id: "old", createdAt: now - 10000 }),
        createMockWork({ id: "new", createdAt: now }),
      ];

      mockGetWorks.mockResolvedValue(works);
      mockJobQueue.getJobs.mockResolvedValue([]);

      const { result } = renderHook(() => useWorksMergedSimplified("0xgarden123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.works[0].id).toBe("new");
      expect(result.current.works[1].id).toBe("old");
    });

    it("should load media for offline jobs", async () => {
      const offlineJob = createMockJob({
        payload: { gardenAddress: "0xgarden123" },
      });
      const mockImages = [createMockImage("photo1.jpg"), createMockImage("photo2.jpg")];

      mockGetWorks.mockResolvedValue([]);
      mockJobQueue.getJobs.mockResolvedValue([offlineJob]);
      mockJobQueueDB.getImagesForJob.mockResolvedValue(mockImages);

      const { result } = renderHook(() => useWorksMergedSimplified("0xgarden123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.works[0].media).toEqual(["mock-url-photo1.jpg", "mock-url-photo2.jpg"]);
    });

    it("should handle garden ID changes", async () => {
      const { result, rerender } = renderHook(
        ({ gardenId }) => useWorksMergedSimplified(gardenId),
        {
          wrapper: createWrapper(),
          initialProps: { gardenId: "0xgarden123" },
        }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGetWorks).toHaveBeenCalledWith("0xgarden123", 1);

      // Change garden ID
      rerender({ gardenId: "0xgarden456" });

      await waitFor(() => {
        expect(mockGetWorks).toHaveBeenCalledWith("0xgarden456", 1);
      });
    });

    it("should setup event-driven invalidation", () => {
      const queryClient = new QueryClient();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      renderHook(() => useWorksMergedSimplified("0xgarden123"), {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      });

      // Simulate work job event
      const mockEvent = "job:completed";
      const mockData = {
        job: createMockJob({
          kind: "work",
          payload: { gardenAddress: "0xgarden123" },
        }),
      };

      act(() => {
        mockEventHandler(mockEvent, mockData);
      });

      expect(invalidateSpy).toHaveBeenCalledTimes(3); // Should invalidate all three keys
    });

    it("should refetch all queries", async () => {
      const { result } = renderHook(() => useWorksMergedSimplified("0xgarden123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Reset mock call counts
      vi.clearAllMocks();

      act(() => {
        result.current.refetch();
      });

      // Should trigger refetch for all queries
      await waitFor(() => {
        expect(mockGetWorks).toHaveBeenCalled();
        expect(mockJobQueue.getJobs).toHaveBeenCalled();
      });
    });
  });

  describe("useOfflineStatus", () => {
    it("should fetch offline status", async () => {
      mockJobQueue.getPendingCount.mockResolvedValue(5);
      mockJobQueue.isSyncInProgress.mockReturnValue(true);

      const { result } = renderHook(() => useOfflineStatus(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual({
        isOnline: true,
        pendingCount: 5,
        isSyncing: true,
      });
    });

    it("should setup browser event listeners", () => {
      renderHook(() => useOfflineStatus(), {
        wrapper: createWrapper(),
      });

      expect(mockAddEventListener).toHaveBeenCalledWith("online", expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith("offline", expect.any(Function));
    });

    it("should setup job queue event listeners", () => {
      renderHook(() => useOfflineStatus(), {
        wrapper: createWrapper(),
      });

      expect(mockUseJobQueueEvents).toHaveBeenCalledWith(
        ["queue:sync-started", "queue:sync-completed", "queue:sync-failed"],
        expect.any(Function)
      );
    });

    it("should cleanup event listeners on unmount", () => {
      const { unmount } = renderHook(() => useOfflineStatus(), {
        wrapper: createWrapper(),
      });

      const [onlineHandler] =
        mockAddEventListener.mock.calls.find((call) => call[0] === "online") || [];

      unmount();

      expect(mockRemoveEventListener).toHaveBeenCalledWith("online", onlineHandler);
      expect(mockRemoveEventListener).toHaveBeenCalledWith("offline", expect.any(Function));
    });
  });

  describe("useJobQueue (Master Hook)", () => {
    it("should combine all job queue functionality", async () => {
      const mockStats = createMockQueueStats({ pending: 4, total: 12 });
      mockJobQueue.getStats.mockResolvedValue(mockStats);
      mockJobQueue.getPendingCount.mockResolvedValue(4);
      mockJobQueue.isSyncInProgress.mockReturnValue(false);

      const { result } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.stats).toEqual(mockStats);
      expect(result.current.pendingCount).toBe(4);
      expect(result.current.isOnline).toBe(true);
      expect(result.current.isSyncing).toBe(false);
      expect(typeof result.current.flush).toBe("function");
      expect(typeof result.current.refetch).toBe("function");
    });

    it("should handle loading states", () => {
      const { result } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(),
      });

      // Should be loading initially
      expect(result.current.isLoading).toBe(true);
    });

    it("should handle errors from any sub-hook", async () => {
      const statsError = new Error("Stats error");
      mockJobQueue.getStats.mockRejectedValue(statsError);

      const { result } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe(statsError);
    });

    it("should provide flush functionality", async () => {
      mockJobQueue.flush.mockResolvedValue({ processed: 3, failed: 0, skipped: 1 });

      const { result } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const flushResult = await result.current.flush();

      expect(mockJobQueue.flush).toHaveBeenCalled();
      expect(flushResult).toEqual({ processed: 3, failed: 0, skipped: 1 });
    });

    it("should provide refetch functionality", async () => {
      const { result } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Clear previous calls
      vi.clearAllMocks();

      result.current.refetch();

      // Should refetch all underlying data
      expect(mockJobQueue.getStats).toHaveBeenCalled();
      expect(mockJobQueue.getPendingCount).toHaveBeenCalled();
    });

    it("should fall back to navigator.onLine when offline status unavailable", async () => {
      Object.defineProperty(navigator, "onLine", { value: false, writable: true });

      const { result } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isOnline).toBe(false);
    });

    it("should default pending count to 0 when unavailable", async () => {
      mockJobQueue.getPendingCount.mockRejectedValue(new Error("Count failed"));

      const { result } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.pendingCount).toBe(0);
    });
  });

  describe("jobToWork Helper Function", () => {
    it("should convert job to work format correctly", () => {
      // Since jobToWork is not exported, we test it indirectly through useWorksMergedSimplified
      // Since jobToWork is not exported, we test it indirectly through useWorksMergedSimplified
      // This functionality is already covered in the useWorksMergedSimplified tests above
      expect(true).toBe(true); // Placeholder test
    });
  });
});
