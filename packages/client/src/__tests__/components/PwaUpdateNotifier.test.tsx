/**
 * @vitest-environment jsdom
 */

import { render } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sharedMocks = vi.hoisted(() => ({
  applyUpdate: vi.fn(),
  dismissUpdate: vi.fn(),
  checking: vi.fn(),
  downloading: vi.fn(),
  ready: vi.fn(),
  applying: vi.fn(),
  stalled: vi.fn(),
  useApp: vi.fn(),
  useServiceWorkerUpdate: vi.fn(),
}));

vi.mock("@green-goods/shared", () => ({
  // The notifier binds i18n-aware toasts via createUpdateToasts(formatMessage).
  createUpdateToasts: () => ({
    checking: sharedMocks.checking,
    downloading: sharedMocks.downloading,
    ready: sharedMocks.ready,
    applying: sharedMocks.applying,
    stalled: sharedMocks.stalled,
  }),
  useApp: sharedMocks.useApp,
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
      applyUpdate: sharedMocks.applyUpdate,
      dismissUpdate: sharedMocks.dismissUpdate,
    });

    renderNotifier();

    expect(sharedMocks.useServiceWorkerUpdate).toHaveBeenCalledTimes(1);
    expect(sharedMocks.checking).not.toHaveBeenCalled();
    expect(sharedMocks.downloading).not.toHaveBeenCalled();
  });

  it("shows the downloading toast in PWA presentation", () => {
    sharedMocks.useServiceWorkerUpdate.mockReturnValue({
      phase: "downloading",
      updateAvailable: false,
      isUpdating: false,
      updateStalled: false,
      applyUpdate: sharedMocks.applyUpdate,
      dismissUpdate: sharedMocks.dismissUpdate,
    });

    renderNotifier();

    expect(sharedMocks.downloading).toHaveBeenCalledTimes(1);
  });

  it("shows the ready-to-restart toast in PWA presentation", () => {
    sharedMocks.useServiceWorkerUpdate.mockReturnValue({
      phase: "ready",
      updateAvailable: true,
      isUpdating: false,
      updateStalled: false,
      applyUpdate: sharedMocks.applyUpdate,
      dismissUpdate: sharedMocks.dismissUpdate,
    });

    renderNotifier();

    expect(sharedMocks.ready).toHaveBeenCalledWith(
      sharedMocks.applyUpdate,
      sharedMocks.dismissUpdate
    );
  });

  it("shows the applying toast in PWA presentation", () => {
    sharedMocks.useServiceWorkerUpdate.mockReturnValue({
      phase: "applying",
      updateAvailable: false,
      isUpdating: true,
      updateStalled: false,
      applyUpdate: sharedMocks.applyUpdate,
      dismissUpdate: sharedMocks.dismissUpdate,
    });

    renderNotifier();

    expect(sharedMocks.applying).toHaveBeenCalledTimes(1);
  });

  it("shows the stalled toast in PWA presentation", () => {
    sharedMocks.useServiceWorkerUpdate.mockReturnValue({
      phase: "stalled",
      updateAvailable: false,
      isUpdating: false,
      updateStalled: true,
      applyUpdate: sharedMocks.applyUpdate,
      dismissUpdate: sharedMocks.dismissUpdate,
    });

    renderNotifier();

    expect(sharedMocks.stalled).toHaveBeenCalledWith(sharedMocks.dismissUpdate);
  });

  it("uses the explicit phase instead of legacy boolean precedence", () => {
    sharedMocks.useServiceWorkerUpdate.mockReturnValue({
      phase: "applying",
      updateAvailable: true,
      isUpdating: true,
      updateStalled: false,
      applyUpdate: sharedMocks.applyUpdate,
      dismissUpdate: sharedMocks.dismissUpdate,
    });

    renderNotifier();

    expect(sharedMocks.applying).toHaveBeenCalledTimes(1);
    expect(sharedMocks.ready).not.toHaveBeenCalled();
    expect(sharedMocks.stalled).not.toHaveBeenCalled();
  });
});
