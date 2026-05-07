/**
 * @vitest-environment jsdom
 */

import { render } from "@testing-library/react";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sharedMocks = vi.hoisted(() => ({
  applyUpdate: vi.fn(),
  updateAvailable: vi.fn(),
  updating: vi.fn(),
  useApp: vi.fn(),
  useServiceWorkerUpdate: vi.fn(),
}));

vi.mock("@green-goods/shared", () => ({
  updateToasts: {
    available: sharedMocks.updateAvailable,
    updating: sharedMocks.updating,
  },
  useApp: sharedMocks.useApp,
  useServiceWorkerUpdate: sharedMocks.useServiceWorkerUpdate,
}));

import { PwaUpdateNotifier } from "../../components/Communication/PwaUpdateNotifier";

describe("PwaUpdateNotifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sharedMocks.useApp.mockReturnValue({ isPwaPresentation: true });
    sharedMocks.useServiceWorkerUpdate.mockReturnValue({
      updateAvailable: false,
      isUpdating: false,
      applyUpdate: sharedMocks.applyUpdate,
    });
  });

  it("does not subscribe to service worker updates in browser presentation", () => {
    sharedMocks.useApp.mockReturnValue({ isPwaPresentation: false });

    render(createElement(PwaUpdateNotifier));

    expect(sharedMocks.useServiceWorkerUpdate).not.toHaveBeenCalled();
    expect(sharedMocks.updateAvailable).not.toHaveBeenCalled();
    expect(sharedMocks.updating).not.toHaveBeenCalled();
  });

  it("shows the update toast in PWA presentation", () => {
    sharedMocks.useServiceWorkerUpdate.mockReturnValue({
      updateAvailable: true,
      isUpdating: false,
      applyUpdate: sharedMocks.applyUpdate,
    });

    render(createElement(PwaUpdateNotifier));

    expect(sharedMocks.useServiceWorkerUpdate).toHaveBeenCalledTimes(1);
    expect(sharedMocks.updateAvailable).toHaveBeenCalledWith(sharedMocks.applyUpdate);
  });

  it("shows the updating toast in PWA presentation", () => {
    sharedMocks.useServiceWorkerUpdate.mockReturnValue({
      updateAvailable: false,
      isUpdating: true,
      applyUpdate: sharedMocks.applyUpdate,
    });

    render(createElement(PwaUpdateNotifier));

    expect(sharedMocks.updating).toHaveBeenCalledTimes(1);
  });
});
