/**
 * useServiceWorkerUpdate Hook Tests
 *
 * Tests the service worker update management hook that detects
 * waiting workers and provides user-controlled update application.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import {
  APPLY_UPDATE_TIMEOUT_MS,
  useServiceWorkerUpdate,
} from "../../../hooks/app/useServiceWorkerUpdate";
import { track } from "../../../modules/app/posthog";

function createMockRegistration(
  overrides: Partial<ServiceWorkerRegistration> = {}
): ServiceWorkerRegistration {
  return {
    waiting: null,
    installing: null,
    update: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    ...overrides,
  } as unknown as ServiceWorkerRegistration;
}

function installServiceWorkerMock(registration: ServiceWorkerRegistration) {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    enumerable: true,
    value: {
      controller: {} as ServiceWorker,
      getRegistration: vi.fn().mockResolvedValue(registration),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
}

describe("hooks/app/useServiceWorkerUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

  describe("waiting service worker detection", () => {
    it("keeps updateAvailable false when no waiting worker exists", async () => {
      vi.stubEnv("VITE_ENABLE_SW_DEV", "true");
      const registration = createMockRegistration();
      installServiceWorkerMock(registration);

      const { result } = renderHook(() => useServiceWorkerUpdate());

      await waitFor(() => {
        expect(navigator.serviceWorker.getRegistration).toHaveBeenCalled();
      });

      expect(result.current.updateAvailable).toBe(false);
      expect(result.current.waitingWorker).toBeNull();
    });

    it("sets updateAvailable when registration.waiting exists", async () => {
      vi.stubEnv("VITE_ENABLE_SW_DEV", "true");
      const waitingWorker = { postMessage: vi.fn() } as unknown as ServiceWorker;
      const registration = createMockRegistration({ waiting: waitingWorker });
      installServiceWorkerMock(registration);

      const { result } = renderHook(() => useServiceWorkerUpdate());

      await waitFor(() => {
        expect(result.current.updateAvailable).toBe(true);
      });

      expect(result.current.waitingWorker).toBe(waitingWorker);
      expect(track).toHaveBeenCalledWith("sw_update_available", {
        source: "initial_check",
      });
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
        "applyTimedOut",
        "applyUpdate",
        "checkForUpdate",
        "dismissUpdate",
        "isUpdating",
        "updateAvailable",
        "waitingWorker",
      ]);
    });
  });

  describe("applyUpdate timeout fallback", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("resets isUpdating and flags applyTimedOut when activation never happens", async () => {
      vi.stubEnv("VITE_ENABLE_SW_DEV", "true");
      const waitingWorker = { postMessage: vi.fn() } as unknown as ServiceWorker;
      const registration = createMockRegistration({ waiting: waitingWorker });
      installServiceWorkerMock(registration);

      const { result } = renderHook(() => useServiceWorkerUpdate());

      await waitFor(() => {
        expect(result.current.updateAvailable).toBe(true);
      });

      // Switch to fake timers only after the async setup settles so waitFor
      // above keeps working with real timers.
      vi.useFakeTimers();

      act(() => {
        result.current.applyUpdate();
      });

      expect(result.current.isUpdating).toBe(true);
      expect(result.current.applyTimedOut).toBe(false);
      expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });

      // controllerchange never fires (the PRD-500 hang scenario)
      act(() => {
        vi.advanceTimersByTime(APPLY_UPDATE_TIMEOUT_MS);
      });

      expect(result.current.isUpdating).toBe(false);
      expect(result.current.applyTimedOut).toBe(true);
      expect(track).toHaveBeenCalledWith("sw_update_apply_timeout", {});
      expect(navigator.serviceWorker.removeEventListener).toHaveBeenCalledWith(
        "controllerchange",
        expect.any(Function)
      );
    });

    it("clears the timed-out flag when the user retries the update", async () => {
      vi.stubEnv("VITE_ENABLE_SW_DEV", "true");
      const waitingWorker = { postMessage: vi.fn() } as unknown as ServiceWorker;
      const registration = createMockRegistration({ waiting: waitingWorker });
      installServiceWorkerMock(registration);

      const { result } = renderHook(() => useServiceWorkerUpdate());

      await waitFor(() => {
        expect(result.current.updateAvailable).toBe(true);
      });

      vi.useFakeTimers();

      act(() => {
        result.current.applyUpdate();
      });
      act(() => {
        vi.advanceTimersByTime(APPLY_UPDATE_TIMEOUT_MS);
      });
      expect(result.current.applyTimedOut).toBe(true);

      act(() => {
        result.current.applyUpdate();
      });

      expect(result.current.applyTimedOut).toBe(false);
      expect(result.current.isUpdating).toBe(true);
    });
  });
});
