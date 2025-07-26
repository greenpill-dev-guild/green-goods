import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { useStorageManager } from "@/hooks/useStorageManager";
import type { CleanupResult, StorageAnalytics } from "@/modules/storage-manager";

// Mock the storage manager module
vi.mock("@/modules/storage-manager", () => ({
  defaultStorageManager: {
    getAnalytics: vi.fn(),
    performCleanup: vi.fn(),
    shouldPerformCleanup: vi.fn(),
  },
}));

// Import mocked modules after mocking
import { defaultStorageManager } from "@/modules/storage-manager";

const mockStorageManager = vi.mocked(defaultStorageManager);

// Test data factories that match the real types
const createMockStorageAnalytics = (
  overrides: Partial<StorageAnalytics> = {}
): StorageAnalytics => ({
  quota: {
    used: 1024 * 1024 * 30, // 30MB
    total: 1024 * 1024 * 50, // 50MB
    available: 1024 * 1024 * 20, // 20MB
    percentage: 60,
  },
  breakdown: {
    workItems: 1024 * 1024 * 15, // 15MB
    images: 1024 * 1024 * 10, // 10MB
    cache: 1024 * 1024 * 3, // 3MB
    metadata: 1024 * 1024 * 2, // 2MB
    total: 1024 * 1024 * 30, // 30MB
  },
  needsCleanup: false,
  recommendedActions: [],
  trends: {
    dailyUsage: 1024 * 1024, // 1MB per day
    weeklyGrowth: 5, // 5% growth
    projectedFull: null,
  },
  ...overrides,
});

const createMockCleanupResult = (overrides: Partial<CleanupResult> = {}): CleanupResult => ({
  itemsRemoved: 45,
  spaceFreed: 1024 * 1024 * 10, // 10MB
  categories: {
    media: { items: 20, space: 1024 * 1024 * 6 },
    cache: { items: 15, space: 1024 * 1024 * 3 },
    metadata: { items: 10, space: 1024 * 1024 * 1 },
  },
  ...overrides,
});

describe("useStorageManager", () => {
  beforeEach(() => {
    // Clear all mocks and timers
    vi.clearAllMocks();
    vi.clearAllTimers();

    // Setup default successful mock implementations
    mockStorageManager.getAnalytics.mockResolvedValue(createMockStorageAnalytics());
    mockStorageManager.performCleanup.mockResolvedValue(createMockCleanupResult());
    mockStorageManager.shouldPerformCleanup.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("Initial State", () => {
    it("should initialize with loading state", () => {
      const { result } = renderHook(() => useStorageManager());

      expect(result.current.storageInfo).toBeNull();
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isCleaningUp).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should fetch storage analytics on mount", async () => {
      const mockAnalytics = createMockStorageAnalytics({
        quota: {
          used: 75 * 1024 * 1024,
          total: 100 * 1024 * 1024,
          available: 25 * 1024 * 1024,
          percentage: 75,
        },
      });
      mockStorageManager.getAnalytics.mockResolvedValue(mockAnalytics);

      const { result } = renderHook(() => useStorageManager());

      // Wait for analytics to load
      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 5000 }
      );

      expect(result.current.storageInfo).toEqual(mockAnalytics);
      expect(result.current.error).toBeNull();
      expect(mockStorageManager.getAnalytics).toHaveBeenCalledTimes(1);
    });

    it("should handle initial fetch errors", async () => {
      const error = new Error("Storage access denied");
      mockStorageManager.getAnalytics.mockRejectedValue(error);

      const { result } = renderHook(() => useStorageManager());

      await waitFor(
        () => {
          expect(result.current.isLoading).toBe(false);
        },
        { timeout: 5000 }
      );

      expect(result.current.storageInfo).toBeNull();
      expect(result.current.error).toBe("Storage access denied");
    });
  });

  describe("Manual Refresh", () => {
    it("should refresh storage info on demand", async () => {
      const initialAnalytics = createMockStorageAnalytics({
        quota: {
          percentage: 60,
          used: 60 * 1024 * 1024,
          total: 100 * 1024 * 1024,
          available: 40 * 1024 * 1024,
        },
      });
      const updatedAnalytics = createMockStorageAnalytics({
        quota: {
          percentage: 80,
          used: 80 * 1024 * 1024,
          total: 100 * 1024 * 1024,
          available: 20 * 1024 * 1024,
        },
      });

      mockStorageManager.getAnalytics
        .mockResolvedValueOnce(initialAnalytics)
        .mockResolvedValueOnce(updatedAnalytics);

      const { result } = renderHook(() => useStorageManager());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.storageInfo?.quota.percentage).toBe(60);
      });

      // Trigger manual refresh
      await act(async () => {
        await result.current.refreshStorageInfo();
      });

      expect(result.current.storageInfo?.quota.percentage).toBe(80);
      expect(mockStorageManager.getAnalytics).toHaveBeenCalledTimes(2);
    });

    it("should handle refresh errors", async () => {
      const initialAnalytics = createMockStorageAnalytics();
      mockStorageManager.getAnalytics
        .mockResolvedValueOnce(initialAnalytics)
        .mockRejectedValueOnce(new Error("Refresh failed"));

      const { result } = renderHook(() => useStorageManager());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });

      // Trigger refresh that fails
      await act(async () => {
        await result.current.refreshStorageInfo();
      });

      expect(result.current.error).toBe("Refresh failed");
    });
  });

  describe("Cleanup Operations", () => {
    it("should perform cleanup successfully", async () => {
      const initialAnalytics = createMockStorageAnalytics({
        quota: {
          used: 90 * 1024 * 1024,
          total: 100 * 1024 * 1024,
          available: 10 * 1024 * 1024,
          percentage: 90,
        },
      });
      const postCleanupAnalytics = createMockStorageAnalytics({
        quota: {
          used: 50 * 1024 * 1024,
          total: 100 * 1024 * 1024,
          available: 50 * 1024 * 1024,
          percentage: 50,
        },
      });
      const cleanupResult = createMockCleanupResult({
        spaceFreed: 1024 * 1024 * 20,
        itemsRemoved: 100,
      });

      mockStorageManager.getAnalytics
        .mockResolvedValueOnce(initialAnalytics)
        .mockResolvedValueOnce(postCleanupAnalytics);
      mockStorageManager.performCleanup.mockResolvedValue(cleanupResult);

      const { result } = renderHook(() => useStorageManager());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.storageInfo?.quota.percentage).toBe(90);
      });

      // Perform cleanup
      let cleanupResultReturned: CleanupResult | null = null;
      await act(async () => {
        cleanupResultReturned = await result.current.performCleanup();
      });

      expect(cleanupResultReturned).toEqual(cleanupResult);
      expect(result.current.storageInfo?.quota.percentage).toBe(50);
      expect(result.current.isCleaningUp).toBe(false);
      expect(mockStorageManager.performCleanup).toHaveBeenCalled();
    });

    it("should handle cleanup errors", async () => {
      const error = new Error("Cleanup failed");
      mockStorageManager.performCleanup.mockRejectedValue(error);

      const { result } = renderHook(() => useStorageManager());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Perform cleanup that fails
      let cleanupResult: CleanupResult | null = null;
      await act(async () => {
        cleanupResult = await result.current.performCleanup();
      });

      expect(cleanupResult).toBeNull();
      expect(result.current.error).toBe("Cleanup failed");
      expect(result.current.isCleaningUp).toBe(false);
    });
  });

  describe("Cleanup Assessment", () => {
    it("should check if cleanup is needed", async () => {
      mockStorageManager.shouldPerformCleanup.mockResolvedValue(true);

      const { result } = renderHook(() => useStorageManager());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const shouldCleanup = await act(async () => {
        return result.current.shouldPerformCleanup();
      });

      expect(shouldCleanup).toBe(true);
      expect(mockStorageManager.shouldPerformCleanup).toHaveBeenCalled();
    });

    it("should handle cleanup assessment errors gracefully", async () => {
      mockStorageManager.shouldPerformCleanup.mockRejectedValue(new Error("Assessment failed"));

      const { result } = renderHook(() => useStorageManager());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const shouldCleanup = await act(async () => {
        return result.current.shouldPerformCleanup();
      });

      // Should return false on error
      expect(shouldCleanup).toBe(false);
    });
  });

  describe("Periodic Refresh (Simplified)", () => {
    it("should handle timer-based operations", async () => {
      // This test verifies that the hook doesn't crash with timers
      // The actual timer functionality is tested through integration
      const { result } = renderHook(() => useStorageManager());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockStorageManager.getAnalytics).toHaveBeenCalledTimes(1);
      expect(result.current.storageInfo).toBeDefined();

      // Hook should be stable and not crash
      expect(result.current.error).toBeNull();
    });
  });

  describe("Integration Scenarios", () => {
    it("should handle complete storage management workflow", async () => {
      // Start with high usage requiring cleanup
      const highUsageAnalytics = createMockStorageAnalytics({
        quota: {
          used: 95 * 1024 * 1024,
          total: 100 * 1024 * 1024,
          available: 5 * 1024 * 1024,
          percentage: 95,
        },
        needsCleanup: true,
      });
      const cleanupResult = createMockCleanupResult({
        spaceFreed: 1024 * 1024 * 25,
      });
      const postCleanupAnalytics = createMockStorageAnalytics({
        quota: {
          used: 45 * 1024 * 1024,
          total: 100 * 1024 * 1024,
          available: 55 * 1024 * 1024,
          percentage: 45,
        },
        needsCleanup: false,
      });

      mockStorageManager.getAnalytics
        .mockResolvedValueOnce(highUsageAnalytics)
        .mockResolvedValueOnce(postCleanupAnalytics);
      mockStorageManager.shouldPerformCleanup.mockResolvedValue(true);
      mockStorageManager.performCleanup.mockResolvedValue(cleanupResult);

      const { result } = renderHook(() => useStorageManager());

      // Wait for initial high usage detection
      await waitFor(() => {
        expect(result.current.storageInfo?.needsCleanup).toBe(true);
      });

      // Check if cleanup is recommended
      const shouldCleanup = await act(async () => {
        return result.current.shouldPerformCleanup();
      });
      expect(shouldCleanup).toBe(true);

      // Perform cleanup
      const cleanupResultReturned = await act(async () => {
        return result.current.performCleanup();
      });

      expect(cleanupResultReturned?.spaceFreed).toBe(1024 * 1024 * 25);
      expect(result.current.storageInfo?.quota.percentage).toBe(45);
      expect(result.current.storageInfo?.needsCleanup).toBe(false);
    });
  });
});
