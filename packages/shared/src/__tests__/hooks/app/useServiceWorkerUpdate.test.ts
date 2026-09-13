import { useWorkUpdateGuard, isWorkUpdateBlocked } from "../../../hooks/app/useWorkUpdateGuard";
import { useWorkFlowStore } from "../../../stores/useWorkFlowStore";
/**
 * useServiceWorkerUpdate Hook Tests
 *
 * Tests the service worker update management hook that detects
 * waiting workers and provides user-controlled update application.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type PropsWithChildren } from "react";
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
  LONG_SESSION_UPDATE_PROMPT_MS,
  ServiceWorkerUpdateProvider,
  type UpdateCheckResult,
  useServiceWorkerUpdate,
} from "../../../hooks/app/useServiceWorkerUpdate";
import { logger } from "../../../modules/app/logger";
import { track } from "../../../modules/app/posthog";
import { DOWNLOAD_TIMEOUT_MS } from "../../../modules/app/service-worker-update";

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

function installServiceWorkerMock(
  registration: ServiceWorkerRegistration,
  options: { controller?: ServiceWorker | null } = {}
) {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    enumerable: true,
    value: {
      controller:
        options.controller === undefined
          ? createMockWorker({
              state: "activated",
              scriptURL: "https://www.greengoods.app/sw.js?gg_v=release-old",
            })
          : options.controller,
      getRegistration: vi.fn().mockResolvedValue(registration),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
}

function ProtectedUpdateProvider({ children }: PropsWithChildren) {
  const activationBlocked = useWorkUpdateGuard();
  return createElement(ServiceWorkerUpdateProvider, {
    activationBlocked,
    isActivationBlocked: isWorkUpdateBlocked,
    children,
  });
}

function renderUpdateHook() {
  return renderHook(() => useServiceWorkerUpdate(), {
    wrapper: ProtectedUpdateProvider,
  });
}

describe("hooks/app/useServiceWorkerUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Reflect.deleteProperty(navigator, "serviceWorker");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("when service worker is not available", () => {
    it("returns default state when SW not supported", () => {
      const { result } = renderUpdateHook();

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
      const { result } = renderUpdateHook();

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
      const { result } = renderUpdateHook();

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

      const { result } = renderUpdateHook();

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

      const { result } = renderUpdateHook();

      await waitFor(() => {
        expect(result.current.updateAvailable).toBe(true);
      });

      expect(result.current.waitingWorker).toBe(waitingWorker);
      expect(result.current.phase).toBe("waiting");
      expect(track).toHaveBeenCalledWith(
        "sw_update_available",
        expect.objectContaining({
          source: "initial_check",
          phase: "waiting",
          app_version: expect.any(String),
          active_worker_version: "release-old",
          waiting_worker_version: "release-new",
        })
      );
    });

    it("transitions from downloading to waiting when an installing worker finishes", async () => {
      vi.stubEnv("VITE_ENABLE_SW_DEV", "true");
      const installingWorker = createMockWorker({ state: "installing" });
      const registration = createMockRegistration({ installing: installingWorker });
      installServiceWorkerMock(registration);

      const { result } = renderUpdateHook();

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
        expect(result.current.phase).toBe("waiting");
      });
      expect(result.current.updateAvailable).toBe(true);
      expect(result.current.waitingWorker).toBe(installingWorker);
    });
  });

  describe("checkForUpdate", () => {
    async function renderCheckedHook(registration: ServiceWorkerRegistration) {
      vi.stubEnv("VITE_ENABLE_SW_DEV", "true");
      installServiceWorkerMock(registration);
      const rendered = renderUpdateHook();
      // The mount check calls update() once; manual checks count from there.
      await waitFor(() => {
        expect(registration.update).toHaveBeenCalledTimes(1);
      });
      vi.mocked(track).mockClear();
      return rendered;
    }

    it("reports up to date right away when the browser finds no newer worker", async () => {
      const registration = createMockRegistration();
      const { result } = await renderCheckedHook(registration);
      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

      let found: UpdateCheckResult | undefined;
      await act(async () => {
        found = await result.current.checkForUpdate();
      });

      expect(found).toBe("up-to-date");
      expect(registration.update).toHaveBeenCalledTimes(2);
      // Nothing is installing, so there is nothing to wait for: neither the
      // settle wait nor the download watchdog may be scheduled.
      expect(setTimeoutSpy.mock.calls.some(([, delay]) => delay === DOWNLOAD_TIMEOUT_MS)).toBe(
        false
      );
      expect(result.current.phase).toBe("idle");
      expect(result.current.updateAvailable).toBe(false);
      expect(track).toHaveBeenCalledWith(
        "sw_update_check_completed",
        expect.objectContaining({ source: "manual_check", phase: "idle", found_update: false })
      );
      setTimeoutSpy.mockRestore();
    });

    it("surfaces a waiting worker, including one that was dismissed earlier", async () => {
      const registration = createMockRegistration();
      const { result } = await renderCheckedHook(registration);
      const waitingWorker = createMockWorker({ state: "installed" });
      Object.defineProperty(registration, "waiting", { configurable: true, value: waitingWorker });

      let found: UpdateCheckResult | undefined;
      await act(async () => {
        found = await result.current.checkForUpdate();
      });

      expect(found).toBe("ready");
      expect(result.current.phase).toBe("waiting");
      expect(result.current.updateAvailable).toBe(true);
      expect(result.current.waitingWorker).toBe(waitingWorker);
      expect(track).toHaveBeenCalledWith(
        "sw_update_available",
        expect.objectContaining({ source: "manual_check", phase: "waiting" })
      );

      act(() => {
        result.current.dismissUpdate();
      });
      expect(result.current.updateAvailable).toBe(false);
      expect(result.current.phase).toBe("idle");

      await act(async () => {
        found = await result.current.checkForUpdate();
      });

      expect(found).toBe("ready");
      expect(result.current.updateAvailable).toBe(true);
      expect(result.current.phase).toBe("waiting");
    });

    it("waits for a worker the check found installing and surfaces it once installed", async () => {
      const registration = createMockRegistration();
      const { result } = await renderCheckedHook(registration);
      const installingWorker = createMockWorker({ state: "installing" });
      vi.mocked(registration.update).mockImplementationOnce(async () => {
        Object.defineProperty(registration, "installing", {
          configurable: true,
          value: installingWorker,
        });
        return registration;
      });

      let check: Promise<UpdateCheckResult> | undefined;
      act(() => {
        check = result.current.checkForUpdate();
      });
      expect(result.current.phase).toBe("checking");
      await waitFor(() => {
        expect(installingWorker.addEventListener).toHaveBeenCalledWith(
          "statechange",
          expect.any(Function)
        );
      });

      await act(async () => {
        Object.defineProperty(installingWorker, "state", {
          configurable: true,
          value: "installed",
        });
        installingWorker.dispatchStateChange();
        await expect(check).resolves.toBe("ready");
      });

      expect(result.current.phase).toBe("waiting");
      expect(result.current.updateAvailable).toBe(true);
      expect(result.current.waitingWorker).toBe(installingWorker);
      expect(track).toHaveBeenCalledWith(
        "sw_update_available",
        expect.objectContaining({ source: "manual_check", phase: "waiting" })
      );
    });

    it("throws on a failed check and settles back to idle", async () => {
      const registration = createMockRegistration();
      const { result } = await renderCheckedHook(registration);
      vi.mocked(registration.update).mockRejectedValueOnce(new Error("offline"));

      await act(async () => {
        await expect(result.current.checkForUpdate()).rejects.toThrow("offline");
      });

      expect(result.current.phase).toBe("idle");
      expect(result.current.updateAvailable).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        "Service worker update check failed",
        expect.objectContaining({ source: "useServiceWorkerUpdate.checkForUpdate" })
      );
      expect(track).toHaveBeenCalledWith(
        "sw_update_check_failed",
        expect.objectContaining({ source: "manual_check" })
      );
    });
  });

  describe("install outcomes", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    async function renderMountedHook(options: { controller?: ServiceWorker | null } = {}) {
      vi.stubEnv("VITE_ENABLE_SW_DEV", "true");
      const registration = createMockRegistration();
      installServiceWorkerMock(registration, options);
      const rendered = renderUpdateHook();
      await waitFor(() => {
        expect(registration.update).toHaveBeenCalledTimes(1);
      });
      vi.mocked(track).mockClear();
      return { registration, ...rendered };
    }

    function startInstall(registration: MockServiceWorkerRegistration) {
      const installingWorker = createMockWorker({ state: "installing" });
      act(() => {
        Object.defineProperty(registration, "installing", {
          configurable: true,
          value: installingWorker,
        });
        registration.dispatchUpdateFound();
      });
      return installingWorker;
    }

    function settleInstall(worker: MockServiceWorker, state: ServiceWorkerState) {
      act(() => {
        Object.defineProperty(worker, "state", { configurable: true, value: state });
        worker.dispatchStateChange();
      });
    }

    it("treats a first install as up to date without reporting a download", async () => {
      const { registration, result } = await renderMountedHook({ controller: null });
      expect(result.current.phase).toBe("idle");

      const installingWorker = startInstall(registration);
      expect(result.current.phase).toBe("idle");
      expect(track).not.toHaveBeenCalledWith("sw_update_download_started", expect.anything());

      settleInstall(installingWorker, "installed");

      expect(result.current.phase).toBe("idle");
      expect(result.current.updateAvailable).toBe(false);
      expect(track).toHaveBeenCalledWith(
        "sw_update_check_completed",
        expect.objectContaining({
          source: "update_found",
          first_install: true,
          found_update: false,
        })
      );
    });

    it("marks a failed install and lets a fresh check recover", async () => {
      const { registration, result } = await renderMountedHook();

      const installingWorker = startInstall(registration);
      expect(result.current.phase).toBe("downloading");

      settleInstall(installingWorker, "redundant");

      expect(result.current.phase).toBe("install-failed");
      expect(track).toHaveBeenCalledWith(
        "sw_update_install_failed",
        expect.objectContaining({ source: "update_found", phase: "install-failed" })
      );
      expect(logger.warn).toHaveBeenCalledWith(
        "Service worker update failed to install",
        expect.objectContaining({ checkSource: "update_found" })
      );

      // Try Again runs a fresh check; with nothing newer the row settles on up to date.
      Object.defineProperty(registration, "installing", { configurable: true, value: null });
      let outcome: UpdateCheckResult | undefined;
      await act(async () => {
        outcome = await result.current.checkForUpdate();
      });
      expect(outcome).toBe("up-to-date");
      expect(result.current.phase).toBe("idle");
    });

    it("stops reporting a download that never settles and still surfaces a late install", async () => {
      const { registration, result } = await renderMountedHook();
      vi.useFakeTimers();

      const installingWorker = startInstall(registration);
      expect(result.current.phase).toBe("downloading");

      act(() => {
        vi.advanceTimersByTime(DOWNLOAD_TIMEOUT_MS);
      });

      expect(result.current.phase).toBe("idle");
      expect(track).toHaveBeenCalledWith(
        "sw_update_download_timeout",
        expect.objectContaining({ source: "update_found", timeout_ms: DOWNLOAD_TIMEOUT_MS })
      );
      expect(logger.warn).toHaveBeenCalledWith(
        "Service worker download did not settle before timeout",
        expect.objectContaining({ timeoutMs: DOWNLOAD_TIMEOUT_MS })
      );

      settleInstall(installingWorker, "installed");
      expect(result.current.phase).toBe("waiting");
      expect(result.current.updateAvailable).toBe(true);
    });

    it("surfaces a worker that was already waiting when an automatic check completes", async () => {
      vi.stubEnv("VITE_ENABLE_SW_DEV", "true");
      const waitingWorker = createMockWorker({ state: "installed" });
      const registration = createMockRegistration();
      vi.mocked(registration.update).mockImplementation(async () => {
        Object.defineProperty(registration, "waiting", {
          configurable: true,
          value: waitingWorker,
        });
        return registration;
      });
      installServiceWorkerMock(registration);
      const { result } = renderUpdateHook();

      await waitFor(() => {
        expect(result.current.phase).toBe("waiting");
      });
      expect(result.current.waitingWorker).toBe(waitingWorker);
      expect(track).toHaveBeenCalledWith(
        "sw_update_available",
        expect.objectContaining({ source: "initial_check" })
      );
    });

    it("reports a pending install when a manual check outlasts the wait", async () => {
      const { registration, result } = await renderMountedHook();
      const installingWorker = createMockWorker({ state: "installing" });
      vi.mocked(registration.update).mockImplementationOnce(async () => {
        Object.defineProperty(registration, "installing", {
          configurable: true,
          value: installingWorker,
        });
        return registration;
      });
      vi.useFakeTimers();

      let check: Promise<UpdateCheckResult> | undefined;
      act(() => {
        check = result.current.checkForUpdate();
      });
      // Let update() resolve and the watch attach before the clock moves.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(result.current.phase).toBe("downloading");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(DOWNLOAD_TIMEOUT_MS);
      });

      await expect(check).resolves.toBe("pending");
      expect(result.current.phase).toBe("idle");
      expect(track).toHaveBeenCalledWith(
        "sw_update_download_timeout",
        expect.objectContaining({ source: "manual_check" })
      );
    });
  });

  describe("return type stability", () => {
    it("returns consistent shape across renders", () => {
      const { result, rerender } = renderUpdateHook();

      const keys1 = Object.keys(result.current).sort();

      rerender();

      const keys2 = Object.keys(result.current).sort();

      expect(keys1).toEqual(keys2);
      expect(keys1).toEqual([
        "activateNow",
        "activationBlocked",
        "applyUpdate",
        "checkForUpdate",
        "dismissUpdate",
        "isUpdating",
        "phase",
        "restartedOnNewVersion",
        "shouldPrompt",
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

      const { result } = renderUpdateHook();

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
      expect(result.current.phase).toBe("activating");
      expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
      const addServiceWorkerListener = navigator.serviceWorker
        .addEventListener as unknown as ReturnType<typeof vi.fn>;
      const postWorkerMessage = waitingWorker.postMessage as ReturnType<typeof vi.fn>;
      expect(addServiceWorkerListener).toHaveBeenCalledWith(
        "controllerchange",
        expect.any(Function),
        { once: true }
      );
      expect(addServiceWorkerListener.mock.invocationCallOrder.at(-1)).toBeLessThan(
        postWorkerMessage.mock.invocationCallOrder[0]
      );

      // controllerchange never fires (the PRD-500 hang scenario)
      act(() => {
        vi.advanceTimersByTime(APPLY_UPDATE_TIMEOUT_MS);
      });

      expect(result.current.isUpdating).toBe(false);
      expect(result.current.updateStalled).toBe(true);
      expect(result.current.phase).toBe("error");
      expect(track).toHaveBeenCalledWith(
        "sw_update_apply_timeout",
        expect.objectContaining({
          phase: "error",
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

      const { result } = renderUpdateHook();

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
      expect(result.current.phase).toBe("activating");
    });

    it("keeps a waiting update passive until the long-session threshold", async () => {
      vi.stubEnv("VITE_ENABLE_SW_DEV", "true");
      const waitingWorker = createMockWorker({ state: "installed" });
      installServiceWorkerMock(createMockRegistration({ waiting: waitingWorker }));
      vi.useFakeTimers({ shouldAdvanceTime: true });

      const { result } = renderUpdateHook();

      await waitFor(() => expect(result.current.phase).toBe("waiting"));
      expect(result.current.shouldPrompt).toBe(false);

      act(() => {
        vi.advanceTimersByTime(LONG_SESSION_UPDATE_PROMPT_MS);
      });

      expect(result.current.shouldPrompt).toBe(true);
    });
  });
});

describe("applyUpdate activation", () => {
  const originalLocation = window.location;

  afterEach(() => {
    vi.unstubAllEnvs();
    sessionStorage.clear();
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });

  it("reloads onto the worker once it reports activated, even without a controller change", async () => {
    vi.stubEnv("VITE_ENABLE_SW_DEV", "true");
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "https://www.greengoods.app/home/", reload },
    });
    const waitingWorker = createMockWorker({ state: "installed" });
    const registration = createMockRegistration({ waiting: waitingWorker });
    installServiceWorkerMock(registration);

    const { result } = renderUpdateHook();
    await waitFor(() => {
      expect(result.current.updateAvailable).toBe(true);
    });

    act(() => {
      result.current.applyUpdate();
    });
    expect(result.current.phase).toBe("activating");
    expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });

    act(() => {
      Object.defineProperty(waitingWorker, "state", { configurable: true, value: "activated" });
      waitingWorker.dispatchStateChange();
    });

    expect(reload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem("gg-update-applied")).toBe("1");
    expect(track).toHaveBeenCalledWith(
      "sw_update_apply_completed",
      expect.objectContaining({ phase: "activating" })
    );
  });
});

describe("active work update protection", () => {
  it("defers worker activation while the current draft is saving", async () => {
    vi.stubEnv("VITE_ENABLE_SW_DEV", "true");
    const worker = createMockWorker({ state: "installed" });
    installServiceWorkerMock(createMockRegistration({ waiting: worker }));
    const { result, unmount } = renderUpdateHook();
    await waitFor(() => expect(result.current.updateAvailable).toBe(true));
    act(() =>
      useWorkFlowStore.setState({
        activeDraftId: "unfinished",
        draftSaveState: "saving",
        submissionCompleted: false,
      })
    );
    act(() => result.current.activateNow());
    expect(worker.postMessage).not.toHaveBeenCalled();
    expect(result.current.activationBlocked).toBe(true);
    expect(result.current.phase).toBe("waiting");
    act(() =>
      useWorkFlowStore.setState({
        activeDraftId: null,
        draftSaveState: "idle",
        submissionCompleted: false,
      })
    );
    unmount();
    vi.unstubAllEnvs();
  });
});

it("allows an uninitialized surface and safely saved drafts but blocks active execution", async () => {
  const { isWorkUpdateBlocked } = await import("../../../hooks/app/useWorkUpdateGuard");
  const { claimWorkJobs } = await import("../../../modules/work/execution-state");
  const original = useWorkFlowStore.getState();
  try {
    useWorkFlowStore.setState({ draftScope: null, activeDraftId: null, draftSaveState: "loading" });
    expect(isWorkUpdateBlocked()).toBe(false);
    useWorkFlowStore.setState({
      draftScope: "account:chain",
      activeDraftId: "saved",
      draftSaveState: "saved",
    });
    expect(isWorkUpdateBlocked()).toBe(false);
    const release = claimWorkJobs(["worker-update-test"]);
    expect(isWorkUpdateBlocked()).toBe(true);
    release?.();
    expect(isWorkUpdateBlocked()).toBe(false);
    useWorkFlowStore.setState({ draftSaveState: "failed" });
    expect(isWorkUpdateBlocked()).toBe(true);
  } finally {
    useWorkFlowStore.setState(original);
  }
});
