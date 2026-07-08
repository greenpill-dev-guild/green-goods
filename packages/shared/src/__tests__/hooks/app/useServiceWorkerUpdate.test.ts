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
import { logger } from "../../../modules/app/logger";
import { track } from "../../../modules/app/posthog";

type Listener = () => void;

interface MockServiceWorker extends ServiceWorker {
  dispatchStateChange: () => void;
}

interface MockServiceWorkerRegistration extends ServiceWorkerRegistration {
  dispatchUpdateFound: () => void;
}

function createMockWorker(overrides: Partial<ServiceWorker> = {}): MockServiceWorker {
  const listeners: Record<string, Listener[]> = {};
  const worker = {
    state: "installing",
    scriptURL: "https://www.greengoods.app/sw.js?gg_v=release-new",
    postMessage: vi.fn(),
    addEventListener: vi.fn((type: string, listener: Listener) => {
      listeners[type] = [...(listeners[type] ?? []), listener];
    }),
    removeEventListener: vi.fn((type: string, listener: Listener) => {
      listeners[type] = (listeners[type] ?? []).filter((item) => item !== listener);
    }),
    dispatchStateChange: () => {
      listeners.statechange?.forEach((listener) => listener());
    },
    ...overrides,
  } as unknown as MockServiceWorker;

  return worker;
}

function createMockRegistration(
  overrides: Partial<ServiceWorkerRegistration> = {}
): MockServiceWorkerRegistration {
  const listeners: Record<string, Listener[]> = {};
  return {
    waiting: null,
    installing: null,
    update: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn((type: string, listener: Listener) => {
      listeners[type] = [...(listeners[type] ?? []), listener];
    }),
    removeEventListener: vi.fn((type: string, listener: Listener) => {
      listeners[type] = (listeners[type] ?? []).filter((item) => item !== listener);
    }),
    dispatchUpdateFound: () => {
      listeners.updatefound?.forEach((listener) => listener());
    },
    ...overrides,
  } as unknown as MockServiceWorkerRegistration;
}

function installServiceWorkerMock(registration: ServiceWorkerRegistration) {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    enumerable: true,
    value: {
      controller: createMockWorker({
        state: "activated",
        scriptURL: "https://www.greengoods.app/sw.js?gg_v=release-old",
      }),
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
      expect(result.current.updateStalled).toBe(false);
      expect(result.current.phase).toBe("idle");
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
      expect(result.current.updateStalled).toBe(false);
      expect(result.current.phase).toBe("idle");
    });
  });

  describe("applyUpdate with no waiting worker", () => {
    it("does nothing when no waiting worker", () => {
      const { result } = renderHook(() => useServiceWorkerUpdate());

      act(() => {
        result.current.applyUpdate();
      });

      expect(result.current.isUpdating).toBe(false);
      expect(result.current.updateStalled).toBe(false);
      expect(result.current.phase).toBe("idle");
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
      expect(result.current.phase).toBe("idle");
      expect(result.current.waitingWorker).toBeNull();
    });

    it("sets updateAvailable when registration.waiting exists", async () => {
      vi.stubEnv("VITE_ENABLE_SW_DEV", "true");
      const waitingWorker = createMockWorker({ state: "installed" });
      const registration = createMockRegistration({ waiting: waitingWorker });
      installServiceWorkerMock(registration);

      const { result } = renderHook(() => useServiceWorkerUpdate());

      await waitFor(() => {
        expect(result.current.updateAvailable).toBe(true);
      });

      expect(result.current.waitingWorker).toBe(waitingWorker);
      expect(result.current.phase).toBe("ready");
      expect(track).toHaveBeenCalledWith(
        "sw_update_available",
        expect.objectContaining({
          source: "initial_check",
          phase: "ready",
          app_version: expect.any(String),
          active_worker_version: "release-old",
          waiting_worker_version: "release-new",
        })
      );
    });

    it("transitions from downloading to ready when an installing worker finishes", async () => {
      vi.stubEnv("VITE_ENABLE_SW_DEV", "true");
      const installingWorker = createMockWorker({ state: "installing" });
      const registration = createMockRegistration({ installing: installingWorker });
      installServiceWorkerMock(registration);

      const { result } = renderHook(() => useServiceWorkerUpdate());

      await waitFor(() => {
        expect(registration.addEventListener).toHaveBeenCalledWith(
          "updatefound",
          expect.any(Function)
        );
      });

      act(() => {
        registration.dispatchUpdateFound();
      });

      expect(result.current.phase).toBe("downloading");
      expect(track).toHaveBeenCalledWith(
        "sw_update_download_started",
        expect.objectContaining({ phase: "downloading" })
      );

      act(() => {
        Object.defineProperty(installingWorker, "state", {
          configurable: true,
          value: "installed",
        });
        installingWorker.dispatchStateChange();
      });

      await waitFor(() => {
        expect(result.current.phase).toBe("ready");
      });
      expect(result.current.updateAvailable).toBe(true);
      expect(result.current.waitingWorker).toBe(installingWorker);
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
        "checkForUpdate",
        "dismissUpdate",
        "isUpdating",
        "phase",
        "updateAvailable",
        "updateStalled",
        "waitingWorker",
      ]);
    });
  });

  describe("applyUpdate timeout fallback", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("resets isUpdating and flags updateStalled when activation never happens", async () => {
      vi.stubEnv("VITE_ENABLE_SW_DEV", "true");
      const waitingWorker = createMockWorker({ state: "installed" });
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
      expect(result.current.updateStalled).toBe(false);
      expect(result.current.phase).toBe("applying");
      expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });

      // controllerchange never fires (the PRD-500 hang scenario)
      act(() => {
        vi.advanceTimersByTime(APPLY_UPDATE_TIMEOUT_MS);
      });

      expect(result.current.isUpdating).toBe(false);
      expect(result.current.updateStalled).toBe(true);
      expect(result.current.phase).toBe("stalled");
      expect(track).toHaveBeenCalledWith(
        "sw_update_apply_timeout",
        expect.objectContaining({
          phase: "stalled",
          duration_ms: expect.any(Number),
          timeout_ms: APPLY_UPDATE_TIMEOUT_MS,
        })
      );
      expect(logger.warn).toHaveBeenCalledWith(
        "Service worker update did not activate before timeout",
        expect.objectContaining({ timeoutMs: APPLY_UPDATE_TIMEOUT_MS })
      );
      expect(navigator.serviceWorker.removeEventListener).toHaveBeenCalledWith(
        "controllerchange",
        expect.any(Function)
      );
    });

    it("clears the timed-out flag when the user retries the update", async () => {
      vi.stubEnv("VITE_ENABLE_SW_DEV", "true");
      const waitingWorker = createMockWorker({ state: "installed" });
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
      expect(result.current.updateStalled).toBe(true);

      act(() => {
        result.current.applyUpdate();
      });

      expect(result.current.updateStalled).toBe(false);
      expect(result.current.isUpdating).toBe(true);
      expect(result.current.phase).toBe("applying");
    });
  });
});
