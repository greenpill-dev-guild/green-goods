/**
 * useOffline Hook Tests
 *
 * Tests for offline detection, sync status, and queue metrics.
 */

import type { QueryClient } from "@tanstack/react-query";
import { act, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient } from "../test-utils/query-client";
import { renderHookWithQueryClient } from "../test-utils/query-client-render";

// Mock dependencies - use vi.hoisted to ensure mocks are available at hoist time
const { queueState } = vi.hoisted(() => ({
  queueState: { isProcessing: false },
}));

vi.mock("../../providers/JobQueue", () => ({
  useJobQueue: () => ({ isProcessing: queueState.isProcessing }),
}));

vi.mock("../../hooks/work/usePendingWorksCount", () => ({
  usePendingWorksCount: () => ({ data: 0 }),
}));

let useOffline: typeof import("../../hooks/app/useOffline")["useOffline"];
beforeAll(async () => {
  ({ useOffline } = await import("../../hooks/app/useOffline"));
});

describe("hooks/app/useOffline", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
    queueState.isProcessing = false;

    // Set initial online state
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
      writable: true,
    });
    window.dispatchEvent(new Event("online"));
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("initial state", () => {
    it("returns online status based on navigator.onLine", () => {
      const { result } = renderHookWithQueryClient(() => useOffline(), { queryClient });

      expect(result.current.isOnline).toBe(true);
      expect(result.current.syncStatus).toBe("idle");
    });

    it("returns offline when navigator.onLine is false", () => {
      Object.defineProperty(navigator, "onLine", { value: false });
      window.dispatchEvent(new Event("offline"));

      const { result } = renderHookWithQueryClient(() => useOffline(), { queryClient });

      expect(result.current.isOnline).toBe(false);
    });
  });

  describe("online/offline events", () => {
    it("updates to offline when offline event fires", async () => {
      const { result } = renderHookWithQueryClient(() => useOffline(), { queryClient });

      expect(result.current.isOnline).toBe(true);

      act(() => {
        Object.defineProperty(navigator, "onLine", { value: false });
        window.dispatchEvent(new Event("offline"));
        window.dispatchEvent(new Event("offline"));
      });

      await waitFor(() => {
        expect(result.current.isOnline).toBe(false);
      });
    });

    it("updates to online when online event fires", async () => {
      Object.defineProperty(navigator, "onLine", { value: false });
      window.dispatchEvent(new Event("offline"));

      const { result } = renderHookWithQueryClient(() => useOffline(), { queryClient });

      expect(result.current.isOnline).toBe(false);

      act(() => {
        Object.defineProperty(navigator, "onLine", { value: true });
        window.dispatchEvent(new Event("online"));
      });

      await waitFor(() => {
        expect(result.current.isOnline).toBe(true);
        expect(result.current.syncStatus).toBe("idle");
      });
    });
  });

  describe("sync status", () => {
    it("derives syncing from the queue provider", () => {
      queueState.isProcessing = true;
      const { result } = renderHookWithQueryClient(() => useOffline(), { queryClient });
      expect(result.current.syncStatus).toBe("syncing");
    });
  });

  describe("pending counts", () => {
    it("returns pending count from query", () => {
      const { result } = renderHookWithQueryClient(() => useOffline(), { queryClient });

      expect(result.current.pendingCount).toBe(0);
    });
  });
});
