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
  dismissUpdate: vi.fn(),
  checking: vi.fn(),
  downloading: vi.fn(),
  ready: vi.fn(),
  applying: vi.fn(),
  stalled: vi.fn(),
  applied: vi.fn(),
  preparingOffline: vi.fn(),
  offlineReady: vi.fn(),
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
    applied: sharedMocks.applied,
    preparingOffline: sharedMocks.preparingOffline,
    offlineReady: sharedMocks.offlineReady,
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

function renderNotifier() {
  return render(
    createElement(IntlProvider, { locale: "en", messages: {} }, createElement(PwaUpdateNotifier))
  );
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

  it("shows the stalled toast in PWA presentation", () => {
    sharedMocks.useServiceWorkerUpdate.mockReturnValue({
      phase: "error",
      updateAvailable: false,
      isUpdating: false,
      updateStalled: true,
      shouldPrompt: false,
      activateNow: sharedMocks.activateNow,
      applyUpdate: sharedMocks.applyUpdate,
      dismissUpdate: sharedMocks.dismissUpdate,
    });

    renderNotifier();

    expect(sharedMocks.stalled).toHaveBeenCalledWith(sharedMocks.dismissUpdate);
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

    // A tier that is still retrying is not an outcome; only a settled one is.
    act(() => notify?.("paused"));
    expect(sharedMocks.offlineReady).not.toHaveBeenCalled();

    act(() => notify?.("ready"));
    expect(sharedMocks.offlineReady).toHaveBeenCalledTimes(1);
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
