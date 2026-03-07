/**
 * useServiceWorkerUpdate Hook Tests
 *
 * Exercises the real waiting-service-worker flow:
 * - detect an already waiting worker
 * - check for a new worker manually
 * - send SKIP_WAITING and reload on controller change
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { useServiceWorkerUpdate } from "../../../hooks/app/useServiceWorkerUpdate";
import { track } from "../../../modules/app/posthog";

type MockWorker = ServiceWorker & {
  postMessage: ReturnType<typeof vi.fn>;
};

type MockRegistration = ServiceWorkerRegistration & {
  waiting: MockWorker | null;
  installing: MockWorker | null;
  update: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};

function createMockWorker(): MockWorker {
  return {
    postMessage: vi.fn(),
  } as unknown as MockWorker;
}

function createMockRegistration(): MockRegistration {
  return {
    waiting: null,
    installing: null,
    update: vi.fn(async () => {}),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MockRegistration;
}

describe("hooks/app/useServiceWorkerUpdate", () => {
  const getRegistration = vi.fn<() => Promise<MockRegistration | undefined>>();
  const addServiceWorkerListener = vi.fn();
  const removeServiceWorkerListener = vi.fn();
  const reloadSpy = vi.fn();
  let controllerChangeHandler: (() => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_ENABLE_SW_DEV", "true");
    controllerChangeHandler = undefined;

    Object.defineProperty(window, "location", {
      value: { reload: reloadSpy },
      configurable: true,
      writable: true,
    });

    addServiceWorkerListener.mockImplementation((event: string, handler: () => void) => {
      if (event === "controllerchange") {
        controllerChangeHandler = handler;
      }
    });

    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        controller: {},
        getRegistration,
        addEventListener: addServiceWorkerListener,
        removeEventListener: removeServiceWorkerListener,
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns default state when service workers are unavailable", () => {
    Object.defineProperty(global, "navigator", {
      value: {},
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useServiceWorkerUpdate());

    expect(result.current.updateAvailable).toBe(false);
    expect(result.current.isUpdating).toBe(false);
    expect(result.current.waitingWorker).toBeNull();
    expect(typeof result.current.checkForUpdate).toBe("function");
    expect(typeof result.current.applyUpdate).toBe("function");
    expect(typeof result.current.dismissUpdate).toBe("function");
  });

  it("detects an already waiting worker on mount", async () => {
    const registration = createMockRegistration();
    const waitingWorker = createMockWorker();
    registration.waiting = waitingWorker;
    getRegistration.mockResolvedValue(registration);

    const { result } = renderHook(() => useServiceWorkerUpdate());

    await waitFor(() => {
      expect(result.current.updateAvailable).toBe(true);
    });

    expect(result.current.waitingWorker).toBe(waitingWorker);
    expect(track).toHaveBeenCalledWith("sw_update_available", { source: "initial_check" });
  });

  it("checks for updates and surfaces a new waiting worker", async () => {
    const registration = createMockRegistration();
    const waitingWorker = createMockWorker();
    let updateCalls = 0;

    registration.update.mockImplementation(async () => {
      updateCalls += 1;
      if (updateCalls >= 2) {
        registration.waiting = waitingWorker;
      }
    });
    getRegistration.mockResolvedValue(registration);

    const { result } = renderHook(() => useServiceWorkerUpdate());

    await act(async () => {
      const updateReady = await result.current.checkForUpdate();
      expect(updateReady).toBe(true);
    });

    act(() => {
      result.current.applyUpdate();
    });

    expect(registration.update).toHaveBeenCalledTimes(2);
    expect(result.current.updateAvailable).toBe(true);
    expect(result.current.waitingWorker).toBe(waitingWorker);
    expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(track).toHaveBeenCalledWith("sw_update_available", { source: "manual_check" });
  });

  it("rethrows update check failures so callers can surface an error state", async () => {
    const registration = createMockRegistration();
    registration.update.mockRejectedValue(new Error("update failed"));
    getRegistration.mockResolvedValue(registration);

    const { result } = renderHook(() => useServiceWorkerUpdate());

    await expect(result.current.checkForUpdate()).rejects.toThrow("update failed");
  });

  it("applies the waiting worker through SKIP_WAITING and reloads on controller change", async () => {
    const registration = createMockRegistration();
    const waitingWorker = createMockWorker();
    registration.waiting = waitingWorker;
    getRegistration.mockResolvedValue(registration);

    const { result } = renderHook(() => useServiceWorkerUpdate());

    await waitFor(() => {
      expect(result.current.updateAvailable).toBe(true);
    });

    act(() => {
      result.current.applyUpdate();
    });

    expect(result.current.isUpdating).toBe(true);
    expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    expect(addServiceWorkerListener).toHaveBeenCalledWith(
      "controllerchange",
      expect.any(Function),
      { once: true }
    );

    act(() => {
      controllerChangeHandler?.();
    });

    expect(reloadSpy).toHaveBeenCalled();
  });

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
      "updateAvailable",
      "waitingWorker",
    ]);
  });
});
