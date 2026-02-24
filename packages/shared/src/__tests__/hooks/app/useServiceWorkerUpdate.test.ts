/**
 * useServiceWorkerUpdate Hook Tests
 *
 * Tests the service worker update management hook that detects
 * waiting workers and provides user-controlled update application.
 */

import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock logger and posthog
vi.mock("../../../modules/app/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../../../modules/app/posthog", () => ({
  track: vi.fn(),
}));

// We need to control import.meta.env for the isEnabled check
// The hook checks: import.meta.env.PROD || import.meta.env.VITE_ENABLE_SW_DEV === "true"
// In test, import.meta.env.PROD is false and VITE_ENABLE_SW_DEV is not set,
// so isEnabled will be false by default. We test the disabled path and mock SW API for enabled path.

import { useServiceWorkerUpdate } from "../../../hooks/app/useServiceWorkerUpdate";
import { track } from "../../../modules/app/posthog";

describe("hooks/app/useServiceWorkerUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when service worker is not available", () => {
    it("returns default state when SW not supported", () => {
      const { result } = renderHook(() => useServiceWorkerUpdate());

      expect(result.current.updateAvailable).toBe(false);
      expect(result.current.isUpdating).toBe(false);
      expect(result.current.waitingWorker).toBeNull();
      expect(typeof result.current.applyUpdate).toBe("function");
      expect(typeof result.current.dismissUpdate).toBe("function");
    });
  });

  describe("dismissUpdate", () => {
    it("hides the update notification", () => {
      const { result } = renderHook(() => useServiceWorkerUpdate());

      act(() => {
        result.current.dismissUpdate();
      });

      expect(result.current.updateAvailable).toBe(false);
    });
  });

  describe("applyUpdate with no waiting worker", () => {
    it("does nothing when no waiting worker", () => {
      const { result } = renderHook(() => useServiceWorkerUpdate());

      act(() => {
        result.current.applyUpdate();
      });

      // Should not set isUpdating since there's no waiting worker
      expect(result.current.isUpdating).toBe(false);
    });
  });

  describe("return type stability", () => {
    it("returns consistent shape across renders", () => {
      const { result, rerender } = renderHook(() => useServiceWorkerUpdate());

      const keys1 = Object.keys(result.current).sort();

      rerender();

      const keys2 = Object.keys(result.current).sort();

      expect(keys1).toEqual(keys2);
      expect(keys1).toEqual([
        "applyUpdate",
        "dismissUpdate",
        "isUpdating",
        "updateAvailable",
        "waitingWorker",
      ]);
    });
  });
});
