/**
 * @vitest-environment jsdom
 */

import { act, render } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sharedMocks = vi.hoisted(() => ({
  activateNow: vi.fn(),
  applyUpdate: vi.fn(),
  checkForUpdate: vi.fn(() => Promise.resolve("up-to-date")),
  dismissUpdate: vi.fn(),
  checking: vi.fn(),
  downloading: vi.fn(),
  ready: vi.fn(),
  applying: vi.fn(),
  stalled: vi.fn(),
  failed: vi.fn(),
  applied: vi.fn(),
  preparingOffline: vi.fn(),
  offlineReady: vi.fn(),
  dismiss: vi.fn(),
  schedulePwaShellPreparation: vi.fn(),
  useApp: vi.fn(),
  useServiceWorkerUpdate: vi.fn(),
}));

vi.mock("@green-goods/shared/components/Toast/presets/update", () => ({
  createUpdateToasts: () => ({
    checking: sharedMocks.checking,
    downloading: sharedMocks.downloading,
    ready: sharedMocks.ready,
    applying: sharedMocks.applying,
    stalled: sharedMocks.stalled,
    failed: sharedMocks.failed,
    applied: sharedMocks.applied,
    preparingOffline: sharedMocks.preparingOffline,
    offlineReady: sharedMocks.offlineReady,
    dismiss: sharedMocks.dismiss,
  }),
}));

vi.mock("@green-goods/shared/service-worker", () => ({
  schedulePwaShellPreparation: sharedMocks.schedulePwaShellPreparation,
}));

vi.mock("@green-goods/shared/providers/App", () => ({
  useApp: sharedMocks.useApp,
}));

vi.mock("@green-goods/shared/hooks/app/useServiceWorkerUpdate", () => ({
  useServiceWorkerUpdate: sharedMocks.useServiceWorkerUpdate,
}));

import { PwaUpdateNotifier } from "../../components/Communication/PwaUpdateNotifier";

function notifierTree() {
  return createElement(
    IntlProvider,
    { locale: "en", messages: {} },
    createElement(PwaUpdateNotifier)
  );
}

function renderNotifier() {
  return render(notifierTree());
}

function mockPhase(phase: string) {
  sharedMocks.useServiceWorkerUpdate.mockReturnValue({
    phase,
    updateAvailable: phase === "waiting",
    isUpdating: phase === "activating",
    updateStalled: phase === "error",
    shouldPrompt: false,
    activateNow: sharedMocks.activateNow,
    applyUpdate: sharedMocks.applyUpdate,
    checkForUpdate: sharedMocks.checkForUpdate,
    dismissUpdate: sharedMocks.dismissUpdate,
  });
}

describe("PwaUpdateNotifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sharedMocks.useApp.mockReturnValue({ isPwaPresentation: true });
    sharedMocks.useServiceWorkerUpdate.mockReturnValue({
      phase: "idle",
      updateAvailable: false,
      isUpdating: false,
      updateStalled: false,
      shouldPrompt: false,
      activateNow: sharedMocks.activateNow,
      applyUpdate: sharedMocks.applyUpdate,
      checkForUpdate: sharedMocks.checkForUpdate,
      dismissUpdate: sharedMocks.dismissUpdate,
    });
  });

  it("does not subscribe to service worker updates in browser presentation", () => {
    sharedMocks.useApp.mockReturnValue({ isPwaPresentation: false });

    renderNotifier();

    expect(sharedMocks.useServiceWorkerUpdate).not.toHaveBeenCalled();
    expect(sharedMocks.ready).not.toHaveBeenCalled();
    expect(sharedMocks.applying).not.toHaveBeenCalled();
  });

  it("keeps the automatic checking phase quiet in PWA presentation", () => {
    sharedMocks.useServiceWorkerUpdate.mockReturnValue({
      phase: "checking",
      updateAvailable: false,
      isUpdating: false,
      updateStalled: false,
      shouldPrompt: false,
      activateNow: sharedMocks.activateNow,
      applyUpdate: sharedMocks.applyUpdate,
      dismissUpdate: sharedMocks.dismissUpdate,
    });

    renderNotifier();

    expect(sharedMocks.useServiceWorkerUpdate).toHaveBeenCalledTimes(1);
    expect(sharedMocks.checking).not.toHaveBeenCalled();
    expect(sharedMocks.downloading).not.toHaveBeenCalled();
  });

  it("keeps passive update downloads quiet in PWA presentation", () => {
    sharedMocks.useServiceWorkerUpdate.mockReturnValue({
      phase: "downloading",
      updateAvailable: false,
      isUpdating: false,
      updateStalled: false,
      shouldPrompt: false,
      activateNow: sharedMocks.activateNow,
      applyUpdate: sharedMocks.applyUpdate,
      dismissUpdate: sharedMocks.dismissUpdate,
    });

    renderNotifier();

    expect(sharedMocks.downloading).not.toHaveBeenCalled();
  });

  it("keeps a newly waiting update quiet", () => {
    sharedMocks.useServiceWorkerUpdate.mockReturnValue({
      phase: "waiting",
      updateAvailable: true,
      isUpdating: false,
      updateStalled: false,
      shouldPrompt: false,
      activateNow: sharedMocks.activateNow,
      applyUpdate: sharedMocks.applyUpdate,
      dismissUpdate: sharedMocks.dismissUpdate,
    });

    renderNotifier();

    expect(sharedMocks.ready).not.toHaveBeenCalled();
  });

  it("shows the restart action after the long-session threshold", () => {
    sharedMocks.useServiceWorkerUpdate.mockReturnValue({
      phase: "waiting",
      updateAvailable: true,
      isUpdating: false,
      updateStalled: false,
      shouldPrompt: true,
      activateNow: sharedMocks.activateNow,
      applyUpdate: sharedMocks.applyUpdate,
      dismissUpdate: sharedMocks.dismissUpdate,
    });

    renderNotifier();

    expect(sharedMocks.ready).toHaveBeenCalledWith(
      sharedMocks.activateNow,
      sharedMocks.dismissUpdate
    );
  });

  it("shows the applying toast in PWA presentation", () => {
    sharedMocks.useServiceWorkerUpdate.mockReturnValue({
      phase: "activating",
      updateAvailable: false,
      isUpdating: true,
      updateStalled: false,
      shouldPrompt: false,
      activateNow: sharedMocks.activateNow,
      applyUpdate: sharedMocks.applyUpdate,
      dismissUpdate: sharedMocks.dismissUpdate,
    });

    renderNotifier();

    expect(sharedMocks.applying).toHaveBeenCalledTimes(1);
  });

  it("offers retry and dismiss on the stalled toast after an apply timeout", () => {
    sharedMocks.useServiceWorkerUpdate.mockReturnValue({
      phase: "error",
      updateAvailable: false,
      isUpdating: false,
      updateStalled: true,
      shouldPrompt: false,
      activateNow: sharedMocks.activateNow,
      applyUpdate: sharedMocks.applyUpdate,
      checkForUpdate: sharedMocks.checkForUpdate,
      dismissUpdate: sharedMocks.dismissUpdate,
    });

    renderNotifier();

    expect(sharedMocks.stalled).toHaveBeenCalledWith(
      sharedMocks.activateNow,
      sharedMocks.dismissUpdate
    );
  });

  const offerRestart = [sharedMocks.activateNow, sharedMocks.dismissUpdate];
  const offerRetry = [expect.any(Function), sharedMocks.dismissUpdate];

  it.each([
    ["the update is ready", () => Promise.resolve("ready"), "ready", offerRestart],
    ["the download fails again", () => Promise.resolve("failed"), "failed", offerRetry],
    [
      "the check fails",
      () => Promise.reject(new TypeError("Failed to fetch")),
      "failed",
      offerRetry,
    ],
    ["nothing newer is found", () => Promise.resolve("up-to-date"), "dismiss", []],
  ] as const)("follows a failed-install retry through when %s", async (_when, check, next, args) => {
    sharedMocks.checkForUpdate.mockImplementationOnce(check);
    mockPhase("install-failed");
    renderNotifier();
    const [retry, onDismiss] = sharedMocks.failed.mock.calls[0];
    expect(onDismiss).toBe(sharedMocks.dismissUpdate);
    sharedMocks.failed.mockClear();

    await act(async () => retry());

    // The failure is replaced the moment the reader acts, then by the outcome.
    expect(sharedMocks.checking).toHaveBeenCalledTimes(1);
    expect(sharedMocks[next]).toHaveBeenCalledTimes(1);
    expect(sharedMocks[next]).toHaveBeenCalledWith(...args);
  });

  it("keeps a retry's progress up until its check settles, then offers the restart", async () => {
    let finish: (result: string) => void = () => {};
    sharedMocks.checkForUpdate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    mockPhase("install-failed");
    const view = renderNotifier();
    const [retry] = sharedMocks.failed.mock.calls[0];

    act(() => retry());
    for (const phase of ["checking", "downloading", "waiting"]) {
      mockPhase(phase);
      view.rerender(notifierTree());
    }
    expect(sharedMocks.dismiss).not.toHaveBeenCalled();
    expect(sharedMocks.ready).not.toHaveBeenCalled();

    await act(async () => finish("ready"));
    expect(sharedMocks.ready).toHaveBeenCalledWith(
      sharedMocks.activateNow,
      sharedMocks.dismissUpdate
    );
  });

  it.each([
    ["install-failed", "checking", "dismiss"],
    ["install-failed", "downloading", "dismiss"],
    ["error", "waiting", "ready"],
  ] as const)("answers the %s toast once the phase moves on to %s", (from, to, next) => {
    mockPhase(from);
    const view = renderNotifier();

    mockPhase(to);
    view.rerender(notifierTree());

    expect(sharedMocks[next]).toHaveBeenCalledTimes(1);
  });

  it("uses the explicit phase instead of legacy boolean precedence", () => {
    sharedMocks.useServiceWorkerUpdate.mockReturnValue({
      phase: "activating",
      updateAvailable: true,
      isUpdating: true,
      updateStalled: false,
      shouldPrompt: false,
      activateNow: sharedMocks.activateNow,
      applyUpdate: sharedMocks.applyUpdate,
      dismissUpdate: sharedMocks.dismissUpdate,
    });

    renderNotifier();

    expect(sharedMocks.applying).toHaveBeenCalledTimes(1);
    expect(sharedMocks.ready).not.toHaveBeenCalled();
    expect(sharedMocks.stalled).not.toHaveBeenCalled();
  });
});

describe("PwaUpdateNotifier after an update reload", () => {
  function mockHookState(restartedOnNewVersion: boolean) {
    sharedMocks.useServiceWorkerUpdate.mockReturnValue({
      phase: "idle",
      updateAvailable: false,
      isUpdating: false,
      updateStalled: false,
      shouldPrompt: false,
      activateNow: sharedMocks.activateNow,
      applyUpdate: sharedMocks.applyUpdate,
      dismissUpdate: sharedMocks.dismissUpdate,
      checkForUpdate: vi.fn(),
      waitingWorker: null,
      restartedOnNewVersion,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    sharedMocks.useApp.mockReturnValue({ isPwaPresentation: true });
  });

  it("confirms the new version once when the page load began with an update reload", () => {
    mockHookState(true);

    const view = renderNotifier();
    expect(sharedMocks.applied).toHaveBeenCalledTimes(1);

    view.rerender(
      createElement(IntlProvider, { locale: "es", messages: {} }, createElement(PwaUpdateNotifier))
    );
    expect(sharedMocks.applied).toHaveBeenCalledTimes(1);
  });

  it("stays quiet on an ordinary boot", () => {
    mockHookState(false);
    renderNotifier();
    expect(sharedMocks.applied).not.toHaveBeenCalled();
  });

  it("says nothing more when the offline-ready tier lands before the grace period", async () => {
    vi.useFakeTimers();
    // The common case: the new shell reuses the previous one's copy, so the
    // tier is ready almost immediately and the wait is not worth a word.
    sharedMocks.schedulePwaShellPreparation.mockImplementation(
      (_tier: string, onStatus?: (status: string) => void) => onStatus?.("ready")
    );
    mockHookState(true);

    renderNotifier();
    await act(async () => {});
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(sharedMocks.applied).toHaveBeenCalledTimes(1);
    expect(sharedMocks.preparingOffline).not.toHaveBeenCalled();
    expect(sharedMocks.offlineReady).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("reports a real wait and closes the loop when the tier finally lands", async () => {
    vi.useFakeTimers();
    let notify: ((status: string) => void) | undefined;
    sharedMocks.schedulePwaShellPreparation.mockImplementation(
      (_tier: string, onStatus?: (status: string) => void) => {
        notify = onStatus;
      }
    );
    mockHookState(true);

    renderNotifier();
    await act(async () => {});

    expect(sharedMocks.applied).toHaveBeenCalledTimes(1);
    expect(sharedMocks.preparingOffline).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1_500);
    });
    expect(sharedMocks.preparingOffline).toHaveBeenCalledTimes(1);

    act(() => notify?.("ready"));
    expect(sharedMocks.offlineReady).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("closes an announced wait even when the tier is not coming", async () => {
    vi.useFakeTimers();
    let notify: ((status: string) => void) | undefined;
    sharedMocks.schedulePwaShellPreparation.mockImplementation(
      (_tier: string, onStatus?: (status: string) => void) => {
        notify = onStatus;
        return () => {};
      }
    );
    mockHookState(true);

    renderNotifier();
    await act(async () => {});
    act(() => {
      vi.advanceTimersByTime(1_500);
    });
    expect(sharedMocks.preparingOffline).toHaveBeenCalledTimes(1);

    // Data Saver, a failed fetch, a worker that cannot answer: whatever the
    // reason, a spinner that never resolves is worse than saying the app
    // updated. The toast settles rather than hanging.
    act(() => notify?.("paused"));
    expect(sharedMocks.offlineReady).not.toHaveBeenCalled();
    expect(sharedMocks.applied).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("asks for the offline-ready tier, not the send-time tail", async () => {
    sharedMocks.schedulePwaShellPreparation.mockImplementation(() => {});
    mockHookState(true);

    renderNotifier();
    await act(async () => {});

    expect(sharedMocks.schedulePwaShellPreparation).toHaveBeenCalledWith(
      "priority",
      expect.any(Function)
    );
  });
});
