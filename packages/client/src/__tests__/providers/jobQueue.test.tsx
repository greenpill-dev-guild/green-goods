import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JobQueueProvider, useJobQueue, useQueueFlush, useQueueStats } from "@/providers/jobQueue";

// Mock dependencies
vi.mock("@/modules/job-queue", () => ({
  jobQueue: {
    setSmartAccountClient: vi.fn(),
    startPeriodicSync: vi.fn(),
    stopPeriodicSync: vi.fn(),
    getStats: vi.fn(),
    subscribe: vi.fn(),
    flush: vi.fn(),
    hasPendingJobs: vi.fn(),
    getPendingCount: vi.fn(),
  },
}));

vi.mock("@/modules/react-query", () => ({
  queryClient: {
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
    setQueriesData: vi.fn(),
  },
}));

vi.mock("@/hooks/useWorksMerged", () => ({
  jobToWork: vi.fn(),
}));

vi.mock("@/providers/user", () => ({
  useUser: vi.fn(),
}));

import { jobToWork } from "@/hooks/useWorksMerged";
// Import mocked modules
import { jobQueue } from "@/modules/job-queue";
import { queryClient } from "@/modules/react-query";
import { useUser } from "@/providers/user";

const mockJobQueue = vi.mocked(jobQueue);
const mockQueryClient = vi.mocked(queryClient);
const mockJobToWork = vi.mocked(jobToWork);
const mockUseUser = vi.mocked(useUser);

// Test data factories
const createMockQueueStats = (overrides = {}): QueueStats => ({
  total: 10,
  pending: 3,
  failed: 1,
  synced: 6,
  ...overrides,
});

const createMockJob = (overrides = {}): Job<any> => ({
  id: `job-${Date.now()}-${Math.random()}`,
  kind: "work",
  payload: {
    title: "Test Work",
    actionUID: 1,
    gardenAddress: "0xgarden123",
    feedback: "Test feedback",
    plantCount: 5,
    plantSelection: ["tree"],
  },
  createdAt: Date.now(),
  synced: false,
  lastError: undefined,
  attempts: 0,
  ...overrides,
});

const createMockQueueEvent = (type: string, overrides = {}): QueueEvent => ({
  type: type as any,
  jobId: "mock-job-id",
  job: createMockJob(),
  txHash: type === "job_completed" ? "0x123abc" : undefined,
  error: type === "job_failed" ? "Test error" : undefined,
  ...overrides,
});

// Helper to create mock smart account client
const createMockSmartAccountClient = (overrides = {}) =>
  ({
    address: "0x123",
    sendTransaction: vi.fn(),
    ...overrides,
  }) as any; // Use any for external library type

// Helper to create mock user interface
const createMockUserInterface = (overrides = {}): any => ({
  ready: true,
  user: { id: "user-123" },
  smartAccountClient: createMockSmartAccountClient(),
  ...overrides,
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
    <QueryClientProvider client={queryClient}>
      <JobQueueProvider>{children}</JobQueueProvider>
    </QueryClientProvider>
  );
};

describe("JobQueueProvider", () => {
  let mockEventHandler: (event: QueueEvent) => void;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock values
    mockUseUser.mockReturnValue(createMockUserInterface());

    mockJobQueue.getStats.mockResolvedValue(createMockQueueStats());
    mockJobQueue.subscribe.mockImplementation((handler) => {
      mockEventHandler = handler;
      return vi.fn(); // unsubscribe function
    });
    mockJobQueue.flush.mockResolvedValue({ processed: 2, failed: 0, skipped: 1 });
    mockJobQueue.hasPendingJobs.mockResolvedValue(false);
    mockJobQueue.getPendingCount.mockResolvedValue(0);

    mockJobToWork.mockImplementation((job) => ({
      id: job.id,
      title: job.payload?.title || "Default Title", // Handle optional title
      actionUID: job.payload.actionUID,
      gardenAddress: job.payload.gardenAddress,
      gardenerAddress: "pending",
      feedback: "",
      metadata: "{}",
      media: [],
      createdAt: job.createdAt,
      status: "pending",
    }));
  });

  describe("Provider Setup and Cleanup", () => {
    it("should set smart account client on mount", () => {
      const smartAccountClient = createMockSmartAccountClient({ address: "0x456" });
      mockUseUser.mockReturnValue(createMockUserInterface({ smartAccountClient }));

      render(
        <JobQueueProvider>
          <div>Test</div>
        </JobQueueProvider>
      );

      expect(mockJobQueue.setSmartAccountClient).toHaveBeenCalledWith(smartAccountClient);
    });

    it("should handle null smart account client", () => {
      mockUseUser.mockReturnValue(createMockUserInterface({ smartAccountClient: null }));

      render(
        <JobQueueProvider>
          <div>Test</div>
        </JobQueueProvider>
      );

      expect(mockJobQueue.setSmartAccountClient).toHaveBeenCalledWith(null);
    });

    it("should start periodic sync on mount", () => {
      render(
        <JobQueueProvider>
          <div>Test</div>
        </JobQueueProvider>
      );

      expect(mockJobQueue.startPeriodicSync).toHaveBeenCalled();
    });

    it("should subscribe to queue events on mount", () => {
      render(
        <JobQueueProvider>
          <div>Test</div>
        </JobQueueProvider>
      );

      expect(mockJobQueue.subscribe).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should load initial stats on mount", () => {
      render(
        <JobQueueProvider>
          <div>Test</div>
        </JobQueueProvider>
      );

      expect(mockJobQueue.getStats).toHaveBeenCalled();
    });
  });

  describe("Context Value Provision", () => {
    it("should provide correct context value", async () => {
      const { result } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.stats).toEqual(createMockQueueStats());
      });

      expect(result.current.isProcessing).toBe(false);
      expect(result.current.lastEvent).toBeNull();
      expect(typeof result.current.flush).toBe("function");
      expect(typeof result.current.hasPendingJobs).toBe("function");
      expect(typeof result.current.getPendingCount).toBe("function");
    });

    it("should handle usage outside provider gracefully", () => {
      // useJobQueue might return undefined or handle gracefully rather than throw
      const { result } = renderHook(() => useJobQueue());
      expect(result.current).toBeDefined();
    });

    it("should provide stats through useQueueStats hook", async () => {
      const { result } = renderHook(() => useQueueStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current).toEqual(createMockQueueStats());
      });
    });

    it("should provide flush function through useQueueFlush hook", () => {
      const { result } = renderHook(() => useQueueFlush(), {
        wrapper: createWrapper(),
      });

      expect(typeof result.current).toBe("function");
    });
  });

  describe("Smart Account Client Updates", () => {
    it("should update smart account client when it changes", () => {
      const initialClient = createMockSmartAccountClient({ address: "0x123" });
      const newClient = createMockSmartAccountClient({ address: "0x456" });

      mockUseUser.mockReturnValue(createMockUserInterface({ smartAccountClient: initialClient }));

      const { rerender } = render(
        <JobQueueProvider>
          <div>Test</div>
        </JobQueueProvider>
      );

      expect(mockJobQueue.setSmartAccountClient).toHaveBeenCalledWith(initialClient);

      // Change smart account client
      mockUseUser.mockReturnValue(createMockUserInterface({ smartAccountClient: newClient }));
      rerender(
        <JobQueueProvider>
          <div>Test</div>
        </JobQueueProvider>
      );

      expect(mockJobQueue.setSmartAccountClient).toHaveBeenCalledWith(newClient);
      expect(mockJobQueue.setSmartAccountClient).toHaveBeenCalledTimes(2);
    });

    it("should handle smart account client becoming null", () => {
      const initialClient = createMockSmartAccountClient({ address: "0x123" });

      mockUseUser.mockReturnValue(createMockUserInterface({ smartAccountClient: initialClient }));

      const { rerender } = render(
        <JobQueueProvider>
          <div>Test</div>
        </JobQueueProvider>
      );

      expect(mockJobQueue.setSmartAccountClient).toHaveBeenCalledWith(initialClient);

      // Client becomes null
      mockUseUser.mockReturnValue(createMockUserInterface({ smartAccountClient: null }));
      rerender(
        <JobQueueProvider>
          <div>Test</div>
        </JobQueueProvider>
      );

      expect(mockJobQueue.setSmartAccountClient).toHaveBeenCalledWith(null);
    });
  });

  describe("Event Handling", () => {
    it("should handle job_processing event", async () => {
      const { result } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(),
      });

      const job = createMockJob();
      const event = createMockQueueEvent("job_processing", { job });

      await act(async () => {
        mockEventHandler(event);
      });

      expect(result.current.isProcessing).toBe(true);
      expect(result.current.lastEvent).toEqual(event);
    });

    it("should handle job_completed event for work jobs", async () => {
      const { result } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(),
      });

      const job = createMockJob({
        kind: "work",
        payload: { gardenAddress: "0xgarden123", title: "Test Work", actionUID: 1 },
      });
      const event = createMockQueueEvent("job_completed", {
        job,
        txHash: "0x123abc",
      });

      // Mock updated stats after completion
      mockJobQueue.getStats.mockResolvedValue(createMockQueueStats({ pending: 2 }));

      await act(async () => {
        mockEventHandler(event);
      });

      expect(result.current.isProcessing).toBe(false);
      expect(result.current.lastEvent).toEqual(event);

      // Should update optimistic cache for work
      expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(
        ["works", "0xgarden123"],
        expect.any(Function)
      );

      // Should invalidate specific garden queries
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["mergedWorks", "0xgarden123"],
      });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["offlineWorks", "0xgarden123"],
      });
    });

    it("should handle job_completed event for approval jobs", async () => {
      const { result } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(),
      });

      const job = createMockJob({
        kind: "approval",
        payload: { workUID: "work-123", approved: true },
      });
      const event = createMockQueueEvent("job_completed", {
        job,
        txHash: "0x123abc",
      });

      mockJobQueue.getStats.mockResolvedValue(createMockQueueStats({ pending: 2 }));

      await act(async () => {
        mockEventHandler(event);
      });

      expect(result.current.isProcessing).toBe(false);

      // Should invalidate work approvals
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["workApprovals"],
      });

      // Should update work status in cache
      expect(mockQueryClient.setQueriesData).toHaveBeenCalledWith(
        { queryKey: ["works"] },
        expect.any(Function)
      );
    });

    it("should handle job_failed event", async () => {
      const { result } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(),
      });

      const job = createMockJob({
        kind: "work",
        payload: { gardenAddress: "0xgarden123" },
      });
      const event = createMockQueueEvent("job_failed", {
        job,
        error: "Network timeout",
      });

      mockJobQueue.getStats.mockResolvedValue(createMockQueueStats({ failed: 2 }));

      await act(async () => {
        mockEventHandler(event);
      });

      expect(result.current.isProcessing).toBe(false);
      expect(result.current.lastEvent).toEqual(event);

      // Should remove optimistic entries and invalidate queries
      expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(
        ["works", "0xgarden123"],
        expect.any(Function)
      );
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["offlineWorks", "0xgarden123"],
      });
    });

    it("should handle job_added event", async () => {
      const { result } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(),
      });

      const job = createMockJob({
        kind: "work",
        payload: { gardenAddress: "0xgarden123" },
      });
      const event = createMockQueueEvent("job_added", { job });

      mockJobQueue.getStats.mockResolvedValue(createMockQueueStats({ pending: 4 }));

      await act(async () => {
        mockEventHandler(event);
      });

      expect(result.current.lastEvent).toEqual(event);

      // Should invalidate garden-specific queries
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["offlineWorks", "0xgarden123"],
      });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["mergedWorks", "0xgarden123"],
      });

      // Should invalidate global counts
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["pendingWorksCount"],
      });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["queueStats"],
      });
    });

    it("should handle job_retrying event", async () => {
      const { result } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(),
      });

      const job = createMockJob();
      const event = createMockQueueEvent("job_retrying", { job, attempt: 2 });

      mockJobQueue.getStats.mockResolvedValue(createMockQueueStats({ pending: 3 }));

      await act(async () => {
        mockEventHandler(event);
      });

      expect(result.current.lastEvent).toEqual(event);
      // Should update stats when retrying
      expect(mockJobQueue.getStats).toHaveBeenCalled();
    });

    it("should handle events without txHash gracefully", async () => {
      const { result } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(),
      });

      const job = createMockJob({ kind: "work" });
      const event = createMockQueueEvent("job_completed", {
        job,
        txHash: undefined,
      });

      await act(async () => {
        mockEventHandler(event);
      });

      expect(result.current.isProcessing).toBe(false);
      // Should not crash when txHash is missing
    });
  });

  describe("Optimistic Updates", () => {
    it("should add optimistic work to cache on job completion", async () => {
      renderHook(() => useJobQueue(), { wrapper: createWrapper() });

      const job = createMockJob({
        kind: "work",
        payload: {
          title: "Optimistic Work",
          gardenAddress: "0xgarden123",
          actionUID: 5,
        },
      });
      const event = createMockQueueEvent("job_completed", {
        job,
        txHash: "0xoptimistic",
      });

      await act(async () => {
        mockEventHandler(event);
      });

      // Verify setQueryData was called with correct parameters
      expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(
        ["works", "0xgarden123"],
        expect.any(Function)
      );

      // Test the update function
      const updateFunction = mockQueryClient.setQueryData.mock.calls[0][1] as (
        oldData: any[]
      ) => any[];
      const oldWorks = [{ id: "existing-work" }];
      const newWorks = updateFunction(oldWorks);

      expect(newWorks).toHaveLength(2);
      expect(newWorks[0].id).toBe("0xoptimistic");
      expect(newWorks[0].title).toBe("Optimistic Work");
      expect(newWorks[0].status).toBe("pending");
    });

    it("should not add duplicate optimistic works", async () => {
      renderHook(() => useJobQueue(), { wrapper: createWrapper() });

      const job = createMockJob({ kind: "work" });
      const event = createMockQueueEvent("job_completed", {
        job,
        txHash: "0xduplicate",
      });

      await act(async () => {
        mockEventHandler(event);
      });

      // Test the update function with existing work
      const updateFunction = mockQueryClient.setQueryData.mock.calls[0][1] as (
        oldData: any[]
      ) => any[];
      const oldWorks = [{ id: "0xduplicate", title: "Existing" }];
      const newWorks = updateFunction(oldWorks);

      // Should not add duplicate
      expect(newWorks).toHaveLength(1);
      expect(newWorks[0].id).toBe("0xduplicate");
    });

    it("should update work status for approval events", async () => {
      renderHook(() => useJobQueue(), { wrapper: createWrapper() });

      const job = createMockJob({
        kind: "approval",
        payload: { workUID: "work-123", approved: true },
      });
      const event = createMockQueueEvent("job_completed", { job, txHash: "0x123" });

      await act(async () => {
        mockEventHandler(event);
      });

      // Test the queries update function
      expect(mockQueryClient.setQueriesData).toHaveBeenCalledWith(
        { queryKey: ["works"] },
        expect.any(Function)
      );

      const updateFunction = mockQueryClient.setQueriesData.mock.calls[0][1] as (
        oldData: any[]
      ) => any[];
      const oldWorks = [
        { id: "work-123", status: "pending" },
        { id: "work-456", status: "pending" },
      ];
      const newWorks = updateFunction(oldWorks);

      expect(newWorks[0].status).toBe("approved");
      expect(newWorks[1].status).toBe("pending"); // unchanged
    });

    it("should remove failed optimistic entries", async () => {
      renderHook(() => useJobQueue(), { wrapper: createWrapper() });

      const job = createMockJob({
        id: "failed-job",
        kind: "work",
        payload: { gardenAddress: "0xgarden123" },
      });
      const event = createMockQueueEvent("job_failed", { job });

      await act(async () => {
        mockEventHandler(event);
      });

      // Test the update function
      const updateFunction = mockQueryClient.setQueryData.mock.calls[0][1] as (
        oldData: any[]
      ) => any[];
      const oldWorks = [
        { id: "failed-job", title: "Failed Work" },
        { id: "other-work", title: "Other Work" },
      ];
      const newWorks = updateFunction(oldWorks);

      // Should remove the failed job
      expect(newWorks).toHaveLength(1);
      expect(newWorks[0].id).toBe("other-work");
    });
  });

  describe("Flush Operations", () => {
    it("should flush queue and update stats", async () => {
      const { result } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(),
      });

      mockJobQueue.flush.mockResolvedValue({ processed: 3, failed: 1, skipped: 0 });
      mockJobQueue.getStats.mockResolvedValue(createMockQueueStats({ pending: 0 }));

      await act(async () => {
        await result.current.flush();
      });

      expect(mockJobQueue.flush).toHaveBeenCalled();
      expect(mockJobQueue.getStats).toHaveBeenCalled();

      // Should invalidate queries after successful flush
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["works"],
      });
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["workApprovals"],
      });
    });

    it("should not invalidate queries when no jobs processed", async () => {
      const { result } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(),
      });

      mockJobQueue.flush.mockResolvedValue({ processed: 0, failed: 0, skipped: 2 });
      vi.clearAllMocks(); // Clear previous calls

      await act(async () => {
        await result.current.flush();
      });

      // Should not invalidate when nothing was processed
      expect(mockQueryClient.invalidateQueries).not.toHaveBeenCalled();
    });

    it("should handle flush errors gracefully", async () => {
      const { result } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(),
      });

      mockJobQueue.flush.mockRejectedValue(new Error("Flush failed"));

      await act(async () => {
        await expect(result.current.flush()).rejects.toThrow("Flush failed");
      });
    });
  });

  describe("Helper Functions", () => {
    it("should check for pending jobs", async () => {
      const { result } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(),
      });

      mockJobQueue.hasPendingJobs.mockResolvedValue(true);

      await act(async () => {
        const hasPending = await result.current.hasPendingJobs();
        expect(hasPending).toBe(true);
      });

      expect(mockJobQueue.hasPendingJobs).toHaveBeenCalled();
    });

    it("should get pending count", async () => {
      const { result } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(),
      });

      mockJobQueue.getPendingCount.mockResolvedValue(5);

      await act(async () => {
        const count = await result.current.getPendingCount();
        expect(count).toBe(5);
      });

      expect(mockJobQueue.getPendingCount).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle stats loading errors gracefully", async () => {
      mockJobQueue.getStats.mockRejectedValue(new Error("Stats failed"));

      // Should not crash when stats fail to load
      expect(() => {
        render(
          <JobQueueProvider>
            <div>Test</div>
          </JobQueueProvider>
        );
      }).not.toThrow();
    });

    it("should handle malformed events gracefully", async () => {
      const { result } = renderHook(() => useJobQueue(), {
        wrapper: createWrapper(),
      });

      const malformedEvent = {
        type: "unknown_event",
        invalidData: true,
      } as any;

      await act(async () => {
        // Should not crash with malformed events
        expect(() => mockEventHandler(malformedEvent)).not.toThrow();
      });

      expect(result.current.lastEvent).toEqual(malformedEvent);
    });

    it("should handle events with missing job data", async () => {
      renderHook(() => useJobQueue(), { wrapper: createWrapper() });

      const eventWithoutJob = {
        type: "job_completed",
        job: null,
        txHash: "0x123",
      } as any;

      await act(async () => {
        // Should not crash with missing job data
        expect(() => mockEventHandler(eventWithoutJob)).not.toThrow();
      });
    });
  });
});
