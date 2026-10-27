// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { appCodeRecovery } from "../../../modules/app/cache-recovery";
import { initGlobalErrorHandlers } from "../../../modules/app/error-events";

vi.mock("../../../modules/app/posthog", () => ({ track: vi.fn() }));
vi.mock("../../../modules/app/error-categories", () => ({ trackError: vi.fn() }));

function importFailure(payload: unknown) {
  return Object.assign(new Event("vite:preloadError", { cancelable: true }), { payload });
}

afterEach(() => {
  initGlobalErrorHandlers()();
});

describe("global import-failure recovery", () => {
  it("requests recovery before a wallet SDK can swallow the import rejection", async () => {
    initGlobalErrorHandlers();
    const before = appCodeRecovery.getSnapshot();
    const error = new Error("Failed to fetch dynamically imported module");
    const event = importFailure(error);

    await Promise.reject(error).catch((caught) => {
      window.dispatchEvent(event);
      // AppKit catches the rejection after Vite has emitted this event.
    });

    expect(appCodeRecovery.getSnapshot()).toBe(before + 1);
    expect(event.defaultPrevented).toBe(false);
  });

  it("leaves ordinary application errors out of code-load recovery", () => {
    initGlobalErrorHandlers();
    const before = appCodeRecovery.getSnapshot();
    window.dispatchEvent(importFailure(new Error("Wallet request rejected")));
    window.dispatchEvent(new Event("vite:preloadError"));
    expect(appCodeRecovery.getSnapshot()).toBe(before);
  });

  it("registers only one listener when initialization is repeated", () => {
    initGlobalErrorHandlers();
    initGlobalErrorHandlers();
    const before = appCodeRecovery.getSnapshot();
    window.dispatchEvent(importFailure(new TypeError("Importing a module script failed.")));
    expect(appCodeRecovery.getSnapshot()).toBe(before + 1);
  });

  it("removes the import listener on cleanup and can initialize again", () => {
    const cleanup = initGlobalErrorHandlers();
    const before = appCodeRecovery.getSnapshot();
    cleanup();
    window.dispatchEvent(importFailure(new Error("Failed to fetch dynamically imported module")));
    expect(appCodeRecovery.getSnapshot()).toBe(before);

    initGlobalErrorHandlers();
    window.dispatchEvent(importFailure(new Error("Failed to fetch dynamically imported module")));
    expect(appCodeRecovery.getSnapshot()).toBe(before + 1);
  });
});
