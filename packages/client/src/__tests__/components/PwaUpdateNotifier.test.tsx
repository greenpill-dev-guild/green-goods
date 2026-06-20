/**
 * @vitest-environment jsdom
 */

import { render } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sharedMocks = vi.hoisted(() => ({
  applyUpdate: vi.fn(),
  createUpdateToasts: vi.fn(() => ({
    available: vi.fn(),
    stalled: vi.fn(),
    updating: vi.fn(),
  })),
  dismissUpdate: vi.fn(),
  stalled: vi.fn(),
  updateAvailable: vi.fn(),
  updating: vi.fn(),
  useApp: vi.fn(),
  useServiceWorkerUpdate: vi.fn(),
}));

vi.mock("@green-goods/shared", () => ({
  useApp: sharedMocks.useApp,
  useServiceWorkerUpdate: sharedMocks.useServiceWorkerUpdate,
}));

vi.mock("@green-goods/shared/components", () => ({
  createUpdateToasts: sharedMocks.createUpdateToasts,
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
    sharedMocks.createUpdateToasts.mockReturnValue({
      available: sharedMocks.updateAvailable,
      stalled: sharedMocks.stalled,
      updating: sharedMocks.updating,
    });
    sharedMocks.useApp.mockReturnValue({ isPwaPresentation: true });
    sharedMocks.useServiceWorkerUpdate.mockReturnValue({
      updateAvailable: false,
      isUpdating: false,
      applyTimedOut: false,
      applyUpdate: sharedMocks.applyUpdate,
      dismissUpdate: sharedMocks.dismissUpdate,
    });
  });

  it("does not subscribe to service worker updates in browser presentation", () => {
    sharedMocks.useApp.mockReturnValue({ isPwaPresentation: false });

    renderNotifier();

    expect(sharedMocks.useServiceWorkerUpdate).not.toHaveBeenCalled();
    expect(sharedMocks.updateAvailable).not.toHaveBeenCalled();
    expect(sharedMocks.stalled).not.toHaveBeenCalled();
    expect(sharedMocks.updating).not.toHaveBeenCalled();
  });

  it("shows the update toast in PWA presentation", () => {
    sharedMocks.useServiceWorkerUpdate.mockReturnValue({
      updateAvailable: true,
      isUpdating: false,
      applyTimedOut: false,
      applyUpdate: sharedMocks.applyUpdate,
      dismissUpdate: sharedMocks.dismissUpdate,
    });

    renderNotifier();

    expect(sharedMocks.useServiceWorkerUpdate).toHaveBeenCalledTimes(1);
    expect(sharedMocks.updateAvailable).toHaveBeenCalledWith(
      sharedMocks.applyUpdate,
      sharedMocks.dismissUpdate
    );
  });

  it("shows the updating toast in PWA presentation", () => {
    sharedMocks.useServiceWorkerUpdate.mockReturnValue({
      updateAvailable: false,
      isUpdating: true,
      applyTimedOut: false,
      applyUpdate: sharedMocks.applyUpdate,
      dismissUpdate: sharedMocks.dismissUpdate,
    });

    renderNotifier();

    expect(sharedMocks.updating).toHaveBeenCalledTimes(1);
  });

  it("shows the stalled toast when an update apply times out", () => {
    sharedMocks.useServiceWorkerUpdate.mockReturnValue({
      updateAvailable: true,
      isUpdating: false,
      applyTimedOut: true,
      applyUpdate: sharedMocks.applyUpdate,
      dismissUpdate: sharedMocks.dismissUpdate,
    });

    renderNotifier();

    expect(sharedMocks.stalled).toHaveBeenCalledWith(
      sharedMocks.applyUpdate,
      sharedMocks.dismissUpdate
    );
    expect(sharedMocks.updateAvailable).not.toHaveBeenCalled();
  });
});
