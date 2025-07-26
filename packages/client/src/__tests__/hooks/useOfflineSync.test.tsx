import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOfflineSync } from "@/hooks/useOfflineSync";

// Mock all dependencies
const mockUsePrivy = vi.fn();
const mockUseOffline = vi.fn();
const mockUseConflictResolver = vi.fn();
const mockUseStorageManager = vi.fn();
const mockUseOfflineStore = vi.fn();
const mockUseUser = vi.fn();

// Mock store actions
const mockSetOnlineStatus = vi.fn();
const mockSetSyncStatus = vi.fn();
const mockSetPendingCount = vi.fn();
const mockSetConflictCount = vi.fn();
const mockSetNeedsCleanup = vi.fn();

vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => mockUsePrivy(),
}));

vi.mock("@/hooks/useOffline", () => ({
  useOffline: () => mockUseOffline(),
}));

vi.mock("@/hooks/useConflictResolver", () => ({
  useConflictResolver: () => mockUseConflictResolver(),
}));

vi.mock("@/hooks/useStorageManager", () => ({
  useStorageManager: () => mockUseStorageManager(),
}));

vi.mock("@/stores/offlineStore", () => ({
  useOfflineStore: () => mockUseOfflineStore(),
}));

vi.mock("@/providers/user", () => ({
  useUser: () => mockUseUser(),
}));

describe("useOfflineSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock return values
    mockUsePrivy.mockReturnValue({
      authenticated: true,
    });

    mockUseUser.mockReturnValue({
      smartAccountAddress: "0x123456789",
    });

    mockUseOffline.mockReturnValue({
      isOnline: true,
      pendingCount: 0,
      syncStatus: "idle",
    });

    mockUseConflictResolver.mockReturnValue({
      conflicts: [],
    });

    mockUseStorageManager.mockReturnValue({
      storageInfo: {
        needsCleanup: false,
      },
    });

    mockUseOfflineStore.mockReturnValue({
      setOnlineStatus: mockSetOnlineStatus,
      setSyncStatus: mockSetSyncStatus,
      setPendingCount: mockSetPendingCount,
      setConflictCount: mockSetConflictCount,
      setNeedsCleanup: mockSetNeedsCleanup,
    });
  });

  describe("Online Status Synchronization", () => {
    it("should sync online status regardless of authentication", () => {
      mockUsePrivy.mockReturnValue({ authenticated: false });
      mockUseUser.mockReturnValue({ smartAccountAddress: null });
      mockUseOffline.mockReturnValue({
        isOnline: false,
        pendingCount: 5,
        syncStatus: "syncing",
      });

      renderHook(() => useOfflineSync());

      // Online status should always be synced
      expect(mockSetOnlineStatus).toHaveBeenCalledWith(false);
      expect(mockSetOnlineStatus).toHaveBeenCalledTimes(1);
    });

    it("should update online status when it changes", () => {
      const { rerender } = renderHook(() => useOfflineSync());

      expect(mockSetOnlineStatus).toHaveBeenCalledWith(true);

      // Change online status
      mockUseOffline.mockReturnValue({
        isOnline: false,
        pendingCount: 0,
        syncStatus: "idle",
      });

      rerender();

      expect(mockSetOnlineStatus).toHaveBeenCalledWith(false);
      expect(mockSetOnlineStatus).toHaveBeenCalledTimes(2);
    });
  });

  describe("Authentication-Based State Sync", () => {
    it("should sync all state when user is authenticated", () => {
      mockUseOffline.mockReturnValue({
        isOnline: true,
        pendingCount: 3,
        syncStatus: "syncing",
      });

      mockUseConflictResolver.mockReturnValue({
        conflicts: [{ workId: "work-1" }, { workId: "work-2" }],
      });

      mockUseStorageManager.mockReturnValue({
        storageInfo: { needsCleanup: true },
      });

      renderHook(() => useOfflineSync());

      expect(mockSetSyncStatus).toHaveBeenCalledWith("syncing");
      expect(mockSetPendingCount).toHaveBeenCalledWith(3);
      expect(mockSetConflictCount).toHaveBeenCalledWith(2);
      expect(mockSetNeedsCleanup).toHaveBeenCalledWith(true);
    });

    it("should reset state to defaults when not authenticated", () => {
      mockUsePrivy.mockReturnValue({ authenticated: false });
      mockUseUser.mockReturnValue({ smartAccountAddress: null });

      mockUseOffline.mockReturnValue({
        isOnline: true,
        pendingCount: 5,
        syncStatus: "syncing",
      });

      mockUseConflictResolver.mockReturnValue({
        conflicts: [{ workId: "work-1" }],
      });

      mockUseStorageManager.mockReturnValue({
        storageInfo: { needsCleanup: true },
      });

      renderHook(() => useOfflineSync());

      // Should reset to default values
      expect(mockSetSyncStatus).toHaveBeenCalledWith("idle");
      expect(mockSetPendingCount).toHaveBeenCalledWith(0);
      expect(mockSetConflictCount).toHaveBeenCalledWith(0);
      expect(mockSetNeedsCleanup).toHaveBeenCalledWith(false);
    });

    it("should reset state when user becomes unauthenticated", () => {
      const { rerender } = renderHook(() => useOfflineSync());

      // Initially authenticated - should sync real values
      expect(mockSetSyncStatus).toHaveBeenCalledWith("idle");
      expect(mockSetPendingCount).toHaveBeenCalledWith(0);

      // User becomes unauthenticated
      mockUsePrivy.mockReturnValue({ authenticated: false });
      mockUseUser.mockReturnValue({ smartAccountAddress: null });

      rerender();

      // Should reset to defaults
      expect(mockSetSyncStatus).toHaveBeenLastCalledWith("idle");
      expect(mockSetPendingCount).toHaveBeenLastCalledWith(0);
      expect(mockSetConflictCount).toHaveBeenLastCalledWith(0);
      expect(mockSetNeedsCleanup).toHaveBeenLastCalledWith(false);
    });

    it("should handle missing smartAccountAddress", () => {
      mockUsePrivy.mockReturnValue({ authenticated: true });
      mockUseUser.mockReturnValue({ smartAccountAddress: null });

      renderHook(() => useOfflineSync());

      // Should reset to defaults when smartAccountAddress is missing
      expect(mockSetSyncStatus).toHaveBeenCalledWith("idle");
      expect(mockSetPendingCount).toHaveBeenCalledWith(0);
      expect(mockSetConflictCount).toHaveBeenCalledWith(0);
      expect(mockSetNeedsCleanup).toHaveBeenCalledWith(false);
    });

    it("should handle empty string smartAccountAddress", () => {
      mockUsePrivy.mockReturnValue({ authenticated: true });
      mockUseUser.mockReturnValue({ smartAccountAddress: "" });

      renderHook(() => useOfflineSync());

      // Should reset to defaults when smartAccountAddress is empty
      expect(mockSetSyncStatus).toHaveBeenCalledWith("idle");
      expect(mockSetPendingCount).toHaveBeenCalledWith(0);
      expect(mockSetConflictCount).toHaveBeenCalledWith(0);
      expect(mockSetNeedsCleanup).toHaveBeenCalledWith(false);
    });
  });

  describe("State Update Synchronization", () => {
    it("should update sync status when it changes", () => {
      const { rerender } = renderHook(() => useOfflineSync());

      expect(mockSetSyncStatus).toHaveBeenCalledWith("idle");

      // Change sync status
      mockUseOffline.mockReturnValue({
        isOnline: true,
        pendingCount: 0,
        syncStatus: "syncing",
      });

      rerender();

      expect(mockSetSyncStatus).toHaveBeenCalledWith("syncing");
      expect(mockSetSyncStatus).toHaveBeenCalledTimes(2);
    });

    it("should update pending count when it changes", () => {
      const { rerender } = renderHook(() => useOfflineSync());

      expect(mockSetPendingCount).toHaveBeenCalledWith(0);

      // Change pending count
      mockUseOffline.mockReturnValue({
        isOnline: true,
        pendingCount: 7,
        syncStatus: "idle",
      });

      rerender();

      expect(mockSetPendingCount).toHaveBeenCalledWith(7);
      expect(mockSetPendingCount).toHaveBeenCalledTimes(2);
    });

    it("should update conflict count when conflicts change", () => {
      const { rerender } = renderHook(() => useOfflineSync());

      expect(mockSetConflictCount).toHaveBeenCalledWith(0);

      // Add conflicts
      mockUseConflictResolver.mockReturnValue({
        conflicts: [{ workId: "work-1" }, { workId: "work-2" }, { workId: "work-3" }],
      });

      rerender();

      expect(mockSetConflictCount).toHaveBeenCalledWith(3);
      expect(mockSetConflictCount).toHaveBeenCalledTimes(2);
    });

    it("should update cleanup status when storage info changes", () => {
      const { rerender } = renderHook(() => useOfflineSync());

      expect(mockSetNeedsCleanup).toHaveBeenCalledWith(false);

      // Storage needs cleanup
      mockUseStorageManager.mockReturnValue({
        storageInfo: { needsCleanup: true },
      });

      rerender();

      expect(mockSetNeedsCleanup).toHaveBeenCalledWith(true);
      expect(mockSetNeedsCleanup).toHaveBeenCalledTimes(2);
    });

    it("should handle missing storage info gracefully", () => {
      mockUseStorageManager.mockReturnValue({
        storageInfo: null,
      });

      renderHook(() => useOfflineSync());

      expect(mockSetNeedsCleanup).toHaveBeenCalledWith(false);
    });

    it("should handle undefined storage info gracefully", () => {
      mockUseStorageManager.mockReturnValue({
        storageInfo: undefined,
      });

      renderHook(() => useOfflineSync());

      expect(mockSetNeedsCleanup).toHaveBeenCalledWith(false);
    });

    it("should handle storage info without needsCleanup property", () => {
      mockUseStorageManager.mockReturnValue({
        storageInfo: { quota: 1000, usage: 500 }, // Missing needsCleanup
      });

      renderHook(() => useOfflineSync());

      expect(mockSetNeedsCleanup).toHaveBeenCalledWith(false);
    });
  });

  describe("Complex Authentication Scenarios", () => {
    it("should handle authentication state changes correctly", () => {
      // Start unauthenticated
      mockUsePrivy.mockReturnValue({ authenticated: false });
      mockUseUser.mockReturnValue({ smartAccountAddress: null });

      const { rerender } = renderHook(() => useOfflineSync());

      // Should reset to defaults
      expect(mockSetSyncStatus).toHaveBeenCalledWith("idle");
      expect(mockSetPendingCount).toHaveBeenCalledWith(0);
      expect(mockSetConflictCount).toHaveBeenCalledWith(0);
      expect(mockSetNeedsCleanup).toHaveBeenCalledWith(false);

      // Become authenticated
      mockUsePrivy.mockReturnValue({ authenticated: true });
      mockUseUser.mockReturnValue({ smartAccountAddress: "0x123" });

      mockUseOffline.mockReturnValue({
        isOnline: true,
        pendingCount: 5,
        syncStatus: "syncing",
      });

      rerender();

      // Should sync real values
      expect(mockSetSyncStatus).toHaveBeenCalledWith("syncing");
      expect(mockSetPendingCount).toHaveBeenCalledWith(5);
    });

    it("should handle partial authentication (authenticated but no address)", () => {
      mockUsePrivy.mockReturnValue({ authenticated: true });
      mockUseUser.mockReturnValue({ smartAccountAddress: null });

      mockUseOffline.mockReturnValue({
        isOnline: true,
        pendingCount: 3,
        syncStatus: "syncing",
      });

      renderHook(() => useOfflineSync());

      // Should reset to defaults due to missing address
      expect(mockSetSyncStatus).toHaveBeenCalledWith("idle");
      expect(mockSetPendingCount).toHaveBeenCalledWith(0);
      expect(mockSetConflictCount).toHaveBeenCalledWith(0);
      expect(mockSetNeedsCleanup).toHaveBeenCalledWith(false);
    });

    it("should handle address available but not authenticated", () => {
      mockUsePrivy.mockReturnValue({ authenticated: false });
      mockUseUser.mockReturnValue({ smartAccountAddress: "0x123" });

      mockUseOffline.mockReturnValue({
        isOnline: true,
        pendingCount: 3,
        syncStatus: "syncing",
      });

      renderHook(() => useOfflineSync());

      // Should reset to defaults due to not being authenticated
      expect(mockSetSyncStatus).toHaveBeenCalledWith("idle");
      expect(mockSetPendingCount).toHaveBeenCalledWith(0);
      expect(mockSetConflictCount).toHaveBeenCalledWith(0);
      expect(mockSetNeedsCleanup).toHaveBeenCalledWith(false);
    });
  });

  describe("Performance and Optimization", () => {
    it("should only call store setters when values actually change", () => {
      const { rerender } = renderHook(() => useOfflineSync());

      // Clear initial calls
      vi.clearAllMocks();

      // Rerender with same values
      rerender();

      // Should not call setters again if values haven't changed
      // This test verifies that the useEffect dependencies are working correctly
      expect(mockSetOnlineStatus).not.toHaveBeenCalled();
      expect(mockSetSyncStatus).not.toHaveBeenCalled();
      expect(mockSetPendingCount).not.toHaveBeenCalled();
      expect(mockSetConflictCount).not.toHaveBeenCalled();
      expect(mockSetNeedsCleanup).not.toHaveBeenCalled();
    });

    it("should handle rapid state changes efficiently", () => {
      // Mock authenticated state
      mockUsePrivy.mockReturnValue({ authenticated: true });
      mockUseUser.mockReturnValue({ smartAccountAddress: "0x123" });

      const { rerender } = renderHook(() => useOfflineSync());

      // Verify initial call
      expect(mockSetOnlineStatus).toHaveBeenCalledTimes(1);
      expect(mockSetPendingCount).toHaveBeenCalledTimes(1);
      expect(mockSetSyncStatus).toHaveBeenCalledTimes(1);

      // Clear mocks to count only the changes
      mockSetOnlineStatus.mockClear();
      mockSetPendingCount.mockClear();
      mockSetSyncStatus.mockClear();

      // Simulate rapid changes
      for (let i = 0; i < 10; i++) {
        mockUseOffline.mockReturnValue({
          isOnline: i % 2 === 0,
          pendingCount: i,
          syncStatus: i % 2 === 0 ? "idle" : "syncing",
        });
        rerender();
      }

      // Should handle all changes without issues
      expect(mockSetOnlineStatus).toHaveBeenCalledTimes(10);
      expect(mockSetPendingCount).toHaveBeenCalledTimes(10);
      expect(mockSetSyncStatus).toHaveBeenCalledTimes(10);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle hooks returning undefined gracefully", () => {
      mockUseOffline.mockReturnValue({
        isOnline: undefined,
        pendingCount: undefined,
        syncStatus: undefined,
      });

      mockUseConflictResolver.mockReturnValue({
        conflicts: undefined,
      });

      mockUseStorageManager.mockReturnValue({
        storageInfo: undefined,
      });

      renderHook(() => useOfflineSync());

      // Should handle undefined values gracefully
      expect(mockSetOnlineStatus).toHaveBeenCalledWith(undefined);
      expect(mockSetSyncStatus).toHaveBeenCalledWith(undefined);
      expect(mockSetPendingCount).toHaveBeenCalledWith(undefined);
      expect(mockSetConflictCount).toHaveBeenCalledWith(0); // conflicts.length with undefined should be 0
      expect(mockSetNeedsCleanup).toHaveBeenCalledWith(false);
    });

    it("should handle hook errors gracefully", () => {
      // Mock hooks throwing errors
      const mockError = new Error("useOffline error");
      mockUseOffline.mockImplementation(() => {
        throw mockError;
      });

      // Should throw the error (no error boundaries in the hook)
      expect(() => renderHook(() => useOfflineSync())).toThrow("useOffline error");

      // Reset mock for cleanup
      mockUseOffline.mockReturnValue({
        isOnline: true,
        pendingCount: 0,
        syncStatus: "idle",
      });
    });

    it("should handle store setter errors gracefully", () => {
      const mockError = new Error("Store setter error");
      mockSetOnlineStatus.mockImplementation(() => {
        throw mockError;
      });

      // Should throw the error (no error boundaries in the hook)
      expect(() => renderHook(() => useOfflineSync())).toThrow("Store setter error");

      // Reset mock for cleanup
      mockSetOnlineStatus.mockImplementation(() => {});
    });

    it("should handle null conflicts array", () => {
      mockUseConflictResolver.mockReturnValue({
        conflicts: null,
      });

      renderHook(() => useOfflineSync());

      expect(mockSetConflictCount).toHaveBeenCalledWith(0);
    });

    it("should handle conflicts without length property", () => {
      mockUseConflictResolver.mockReturnValue({
        conflicts: { notAnArray: true },
      });

      renderHook(() => useOfflineSync());

      // Should handle non-array conflicts gracefully
      expect(mockSetConflictCount).toHaveBeenCalledWith(0);
    });
  });
});
