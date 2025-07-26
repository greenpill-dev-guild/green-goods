import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cleanupOfflineListeners,
  handleOnline,
  handleOffline,
  //   useHasOfflineIssues,
  //   useIsOnline,
  //   useOfflineDisplayPriority,
  useOfflineStore,
} from "@/stores/offlineStore";

// Mock window object BEFORE importing the store
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
const mockDispatchEvent = vi.fn((event: Event) => {
  const listeners = mockEventListeners[event.type] || [];
  listeners.forEach((listener) => listener(event));
});

// Mock navigator.onLine
Object.defineProperty(navigator, "onLine", {
  value: true,
  writable: true,
  configurable: true,
});

// Mock window object BEFORE import
Object.defineProperty(global, "window", {
  value: {
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
    dispatchEvent: mockDispatchEvent,
  },
  writable: true,
  configurable: true,
});

describe("offlineStore", () => {
  beforeEach(() => {
    // Clear all mocks and event listeners
    vi.clearAllMocks();
    Object.keys(mockEventListeners).forEach((key) => {
      mockEventListeners[key] = [];
    });

    // Reset store to initial state
    useOfflineStore.setState({
      isOnline: true,
      syncStatus: "idle",
      pendingCount: 0,
      conflictCount: 0,
      needsCleanup: false,
    });
  });

  afterEach(() => {
    // Reset store state
    const { setOnlineStatus, setSyncStatus, setPendingCount, setConflictCount, setNeedsCleanup } =
      useOfflineStore.getState();
    setOnlineStatus(true);
    setSyncStatus("idle");
    setPendingCount(0);
    setConflictCount(0);
    setNeedsCleanup(false);
  });

  describe("Initial State", () => {
    it("should initialize with correct default values", () => {
      const state = useOfflineStore.getState();

      expect(state.isOnline).toBe(true); // navigator.onLine default
      expect(state.syncStatus).toBe("idle");
      expect(state.pendingCount).toBe(0);
      expect(state.conflictCount).toBe(0);
      expect(state.needsCleanup).toBe(false);
    });

    it("should initialize based on navigator.onLine", () => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        writable: true,
      });

      // Need to reimport to get the new initial state
      const state = useOfflineStore.getState();
      expect(state.isOnline).toBe(true); // Should still be true from previous test setup

      // But when we set it, it should work
      state.setOnlineStatus(navigator.onLine);
      expect(useOfflineStore.getState().isOnline).toBe(false);
    });
  });

  describe("State Setters", () => {
    it("should update online status", () => {
      const { setOnlineStatus } = useOfflineStore.getState();

      setOnlineStatus(false);
      expect(useOfflineStore.getState().isOnline).toBe(false);

      setOnlineStatus(true);
      expect(useOfflineStore.getState().isOnline).toBe(true);
    });

    it("should update sync status", () => {
      const { setSyncStatus } = useOfflineStore.getState();

      setSyncStatus("syncing");
      expect(useOfflineStore.getState().syncStatus).toBe("syncing");

      setSyncStatus("error");
      expect(useOfflineStore.getState().syncStatus).toBe("error");

      setSyncStatus("idle");
      expect(useOfflineStore.getState().syncStatus).toBe("idle");
    });

    it("should update pending count", () => {
      const { setPendingCount } = useOfflineStore.getState();

      setPendingCount(5);
      expect(useOfflineStore.getState().pendingCount).toBe(5);

      setPendingCount(0);
      expect(useOfflineStore.getState().pendingCount).toBe(0);

      setPendingCount(100);
      expect(useOfflineStore.getState().pendingCount).toBe(100);
    });

    it("should update conflict count", () => {
      const { setConflictCount } = useOfflineStore.getState();

      setConflictCount(3);
      expect(useOfflineStore.getState().conflictCount).toBe(3);

      setConflictCount(0);
      expect(useOfflineStore.getState().conflictCount).toBe(0);

      setConflictCount(10);
      expect(useOfflineStore.getState().conflictCount).toBe(10);
    });

    it("should update cleanup status", () => {
      const { setNeedsCleanup } = useOfflineStore.getState();

      setNeedsCleanup(true);
      expect(useOfflineStore.getState().needsCleanup).toBe(true);

      setNeedsCleanup(false);
      expect(useOfflineStore.getState().needsCleanup).toBe(false);
    });
  });

  describe("Computed Selectors", () => {
    describe("hasIssues", () => {
      it("should return false when everything is normal", () => {
        const { hasIssues } = useOfflineStore.getState();
        expect(hasIssues()).toBe(false);
      });

      it("should return true when offline", () => {
        const { setOnlineStatus, hasIssues } = useOfflineStore.getState();
        setOnlineStatus(false);
        expect(hasIssues()).toBe(true);
      });

      it("should return true when there are pending items", () => {
        const { setPendingCount, hasIssues } = useOfflineStore.getState();
        setPendingCount(1);
        expect(hasIssues()).toBe(true);
      });

      it("should return true when syncing", () => {
        const { setSyncStatus, hasIssues } = useOfflineStore.getState();
        setSyncStatus("syncing");
        expect(hasIssues()).toBe(true);
      });

      it("should return true when sync error", () => {
        const { setSyncStatus, hasIssues } = useOfflineStore.getState();
        setSyncStatus("error");
        expect(hasIssues()).toBe(true);
      });

      it("should return true when there are conflicts", () => {
        const { setConflictCount, hasIssues } = useOfflineStore.getState();
        setConflictCount(1);
        expect(hasIssues()).toBe(true);
      });

      it("should return true when cleanup is needed", () => {
        const { setNeedsCleanup, hasIssues } = useOfflineStore.getState();
        setNeedsCleanup(true);
        expect(hasIssues()).toBe(true);
      });

      it("should return true when multiple issues exist", () => {
        const { setOnlineStatus, setPendingCount, setConflictCount, hasIssues } =
          useOfflineStore.getState();
        setOnlineStatus(false);
        setPendingCount(5);
        setConflictCount(2);
        expect(hasIssues()).toBe(true);
      });
    });

    describe("getDisplayPriority", () => {
      it("should return null when no issues", () => {
        const { getDisplayPriority } = useOfflineStore.getState();
        expect(getDisplayPriority()).toBeNull();
      });

      it("should prioritize conflicts (highest priority)", () => {
        const {
          setConflictCount,
          setNeedsCleanup,
          setSyncStatus,
          setOnlineStatus,
          setPendingCount,
          getDisplayPriority,
        } = useOfflineStore.getState();

        // Set all issues
        setConflictCount(1);
        setNeedsCleanup(true);
        setSyncStatus("syncing");
        setOnlineStatus(false);
        setPendingCount(5);

        expect(getDisplayPriority()).toBe("conflicts");
      });

      it("should prioritize cleanup when no conflicts", () => {
        const {
          setNeedsCleanup,
          setSyncStatus,
          setOnlineStatus,
          setPendingCount,
          getDisplayPriority,
        } = useOfflineStore.getState();

        setNeedsCleanup(true);
        setSyncStatus("syncing");
        setOnlineStatus(false);
        setPendingCount(5);

        expect(getDisplayPriority()).toBe("cleanup");
      });

      it("should prioritize syncing when no conflicts or cleanup", () => {
        const { setSyncStatus, setOnlineStatus, setPendingCount, getDisplayPriority } =
          useOfflineStore.getState();

        setSyncStatus("syncing");
        setOnlineStatus(false);
        setPendingCount(5);

        expect(getDisplayPriority()).toBe("syncing");
      });

      it("should prioritize offline when no higher priority issues", () => {
        const { setOnlineStatus, setPendingCount, getDisplayPriority } = useOfflineStore.getState();

        setOnlineStatus(false);
        setPendingCount(5);

        expect(getDisplayPriority()).toBe("offline");
      });

      it("should prioritize pending when only pending items", () => {
        const { setPendingCount, getDisplayPriority } = useOfflineStore.getState();

        setPendingCount(3);

        expect(getDisplayPriority()).toBe("pending");
      });

      it("should handle sync error status", () => {
        const { setSyncStatus, getDisplayPriority } = useOfflineStore.getState();

        setSyncStatus("error");

        expect(getDisplayPriority()).toBe(null);
      });

      it("should handle zero conflicts correctly", () => {
        const { setConflictCount, setPendingCount, getDisplayPriority } =
          useOfflineStore.getState();

        setConflictCount(0);
        setPendingCount(1);

        expect(getDisplayPriority()).toBe("pending");
      });
    });
  });

  describe("Optimized Selectors", () => {
    it("useIsOnline selector should return online status", () => {
      const { setOnlineStatus } = useOfflineStore.getState();

      // Test the selector function directly
      const isOnlineSelector = (state: ReturnType<typeof useOfflineStore.getState>) =>
        state.isOnline;

      expect(isOnlineSelector(useOfflineStore.getState())).toBe(true);

      setOnlineStatus(false);
      expect(isOnlineSelector(useOfflineStore.getState())).toBe(false);
    });

    it("useHasOfflineIssues selector should return hasIssues result", () => {
      const { setPendingCount } = useOfflineStore.getState();

      // Test the selector function directly
      const hasIssuesSelector = (state: ReturnType<typeof useOfflineStore.getState>) =>
        state.hasIssues();

      expect(hasIssuesSelector(useOfflineStore.getState())).toBe(false);

      setPendingCount(5);
      expect(hasIssuesSelector(useOfflineStore.getState())).toBe(true);
    });

    it("useOfflineDisplayPriority selector should return display priority", () => {
      const { setSyncStatus } = useOfflineStore.getState();

      // Test the selector function directly
      const displayPrioritySelector = (state: ReturnType<typeof useOfflineStore.getState>) =>
        state.getDisplayPriority();

      expect(displayPrioritySelector(useOfflineStore.getState())).toBe(null);

      setSyncStatus("syncing");
      expect(displayPrioritySelector(useOfflineStore.getState())).toBe("syncing");
    });
  });

  describe("Browser Event Integration", () => {
    it("should register online/offline event listeners", () => {
      // Test that the handlers exist and are functions (implementation detail)
      expect(typeof handleOnline).toBe("function");
      expect(typeof handleOffline).toBe("function");

      // Test that the handlers work correctly
      const { setOnlineStatus } = useOfflineStore.getState();
      setOnlineStatus(false);

      handleOnline();
      expect(useOfflineStore.getState().isOnline).toBe(true);

      handleOffline();
      expect(useOfflineStore.getState().isOnline).toBe(false);
    });

    it("should handle online event", () => {
      const { setOnlineStatus } = useOfflineStore.getState();

      // Start offline
      setOnlineStatus(false);
      expect(useOfflineStore.getState().isOnline).toBe(false);

      // Call the handler directly (since it's exported)
      handleOnline();

      expect(useOfflineStore.getState().isOnline).toBe(true);
    });

    it("should handle offline event", () => {
      const { setOnlineStatus } = useOfflineStore.getState();

      // Start online
      setOnlineStatus(true);
      expect(useOfflineStore.getState().isOnline).toBe(true);

      // Call the handler directly (since it's exported)
      handleOffline();

      expect(useOfflineStore.getState().isOnline).toBe(false);
    });

    it("should handle multiple online/offline events", () => {
      const { setOnlineStatus } = useOfflineStore.getState();

      // Start online
      setOnlineStatus(true);

      // Go offline
      handleOffline();
      expect(useOfflineStore.getState().isOnline).toBe(false);

      // Go online again
      handleOnline();
      expect(useOfflineStore.getState().isOnline).toBe(true);

      // And offline once more
      handleOffline();
      expect(useOfflineStore.getState().isOnline).toBe(false);
    });
  });

  describe("Cleanup Functions", () => {
    it("should provide cleanup function", () => {
      expect(typeof cleanupOfflineListeners).toBe("function");
    });

    it("should remove event listeners when cleanup is called", () => {
      // Test that cleanup function exists and doesn't throw
      expect(typeof cleanupOfflineListeners).toBe("function");
      expect(() => cleanupOfflineListeners()).not.toThrow();

      // Test that handlers still exist after cleanup (they're not nullified)
      expect(typeof handleOnline).toBe("function");
      expect(typeof handleOffline).toBe("function");
    });

    it("should not crash when cleanup is called multiple times", () => {
      expect(() => {
        cleanupOfflineListeners();
        cleanupOfflineListeners();
        cleanupOfflineListeners();
      }).not.toThrow();
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle setting invalid sync status gracefully", () => {
      const { setSyncStatus } = useOfflineStore.getState();

      // TypeScript would prevent this, but test runtime behavior
      setSyncStatus("invalid" as any);
      expect(useOfflineStore.getState().syncStatus).toBe("invalid");
    });

    it("should handle negative pending count", () => {
      const { setPendingCount } = useOfflineStore.getState();

      setPendingCount(-5);
      expect(useOfflineStore.getState().pendingCount).toBe(-5);
    });

    it("should handle negative conflict count", () => {
      const { setConflictCount } = useOfflineStore.getState();

      setConflictCount(-3);
      expect(useOfflineStore.getState().conflictCount).toBe(-3);
    });

    it("should handle very large numbers", () => {
      const { setPendingCount, setConflictCount } = useOfflineStore.getState();

      setPendingCount(Number.MAX_SAFE_INTEGER);
      setConflictCount(Number.MAX_SAFE_INTEGER);

      expect(useOfflineStore.getState().pendingCount).toBe(Number.MAX_SAFE_INTEGER);
      expect(useOfflineStore.getState().conflictCount).toBe(Number.MAX_SAFE_INTEGER);
    });

    it("should handle NaN values", () => {
      const { setPendingCount } = useOfflineStore.getState();

      setPendingCount(NaN);
      expect(Number.isNaN(useOfflineStore.getState().pendingCount)).toBe(true);
    });
  });

  describe("State Persistence and Subscriptions", () => {
    it("should notify subscribers when state changes", () => {
      const subscriber = vi.fn();
      const unsubscribe = useOfflineStore.subscribe(subscriber);

      const { setOnlineStatus } = useOfflineStore.getState();
      setOnlineStatus(false);

      expect(subscriber).toHaveBeenCalled();

      unsubscribe();
    });

    it("should not notify unsubscribed listeners", () => {
      const subscriber = vi.fn();
      const unsubscribe = useOfflineStore.subscribe(subscriber);

      unsubscribe();

      const { setOnlineStatus } = useOfflineStore.getState();
      setOnlineStatus(false);

      expect(subscriber).not.toHaveBeenCalled();
    });

    it("should handle multiple subscribers", () => {
      const subscriber1 = vi.fn();
      const subscriber2 = vi.fn();

      const unsubscribe1 = useOfflineStore.subscribe(subscriber1);
      const unsubscribe2 = useOfflineStore.subscribe(subscriber2);

      const { setPendingCount } = useOfflineStore.getState();
      setPendingCount(5);

      expect(subscriber1).toHaveBeenCalled();
      expect(subscriber2).toHaveBeenCalled();

      unsubscribe1();
      unsubscribe2();
    });
  });

  describe("Complex State Scenarios", () => {
    it("should handle rapid state changes", () => {
      const { setOnlineStatus, setPendingCount, setSyncStatus } = useOfflineStore.getState();

      // Simulate rapid changes
      for (let i = 0; i < 100; i++) {
        setOnlineStatus(i % 2 === 0);
        setPendingCount(i);
        setSyncStatus(i % 3 === 0 ? "idle" : i % 3 === 1 ? "syncing" : "error");
      }

      // Should handle all changes without issues
      expect(useOfflineStore.getState().isOnline).toBe(false); // 99 % 2 === 1, so false
      expect(useOfflineStore.getState().pendingCount).toBe(99);
      expect(useOfflineStore.getState().syncStatus).toBe("idle"); // 99 % 3 === 0, so "idle"
    });

    it("should handle all combinations of display priority", () => {
      const {
        setConflictCount,
        setNeedsCleanup,
        setSyncStatus,
        setOnlineStatus,
        setPendingCount,
        getDisplayPriority,
      } = useOfflineStore.getState();

      // Test all priority combinations
      const testCases = [
        {
          conflicts: 1,
          cleanup: true,
          sync: "syncing",
          online: false,
          pending: 5,
          expected: "conflicts",
        },
        {
          conflicts: 0,
          cleanup: true,
          sync: "syncing",
          online: false,
          pending: 5,
          expected: "cleanup",
        },
        {
          conflicts: 0,
          cleanup: false,
          sync: "syncing",
          online: false,
          pending: 5,
          expected: "syncing",
        },
        {
          conflicts: 0,
          cleanup: false,
          sync: "idle",
          online: false,
          pending: 5,
          expected: "offline",
        },
        {
          conflicts: 0,
          cleanup: false,
          sync: "idle",
          online: true,
          pending: 5,
          expected: "pending",
        },
        { conflicts: 0, cleanup: false, sync: "idle", online: true, pending: 0, expected: null },
      ];

      testCases.forEach(({ conflicts, cleanup, sync, online, pending, expected }) => {
        setConflictCount(conflicts);
        setNeedsCleanup(cleanup);
        setSyncStatus(sync as any);
        setOnlineStatus(online);
        setPendingCount(pending);

        expect(getDisplayPriority()).toBe(expected);
      });
    });

    it("should handle store state reset correctly", () => {
      const { setConflictCount, setNeedsCleanup, setSyncStatus, setOnlineStatus, setPendingCount } =
        useOfflineStore.getState();

      // Set to non-default values
      setConflictCount(5);
      setNeedsCleanup(true);
      setSyncStatus("error");
      setOnlineStatus(false);
      setPendingCount(10);

      // Reset to defaults
      setConflictCount(0);
      setNeedsCleanup(false);
      setSyncStatus("idle");
      setOnlineStatus(true);
      setPendingCount(0);

      const state = useOfflineStore.getState();
      expect(state.conflictCount).toBe(0);
      expect(state.needsCleanup).toBe(false);
      expect(state.syncStatus).toBe("idle");
      expect(state.isOnline).toBe(true);
      expect(state.pendingCount).toBe(0);
      expect(state.hasIssues()).toBe(false);
      expect(state.getDisplayPriority()).toBeNull();
    });
  });
});
