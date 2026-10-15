import { describe, expect, it, vi } from "vitest";
import { appCodeRecovery, isAppCodeLoadError } from "../../../modules/app/cache-recovery";

describe("app code recovery", () => {
  it.each([
    "Failed to fetch dynamically imported module: /assets/old.js",
    "Importing a module script failed.",
    "ChunkLoadError: Loading chunk 12 failed",
    "Unable to preload CSS for /assets/old.css",
  ])("recognizes an import failure: %s", (message) => {
    expect(isAppCodeLoadError(new TypeError(message))).toBe(true);
  });

  it("leaves ordinary connection and service failures retryable", () => {
    for (const message of ["Failed to fetch", "Network error", "503 Service Unavailable"])
      expect(appCodeRecovery.report(new Error(message))).toBe(false);
    expect(appCodeRecovery.getSnapshot()).toBe(0);
  });

  it("recognizes a wrapped import error without looping on cyclic causes", () => {
    expect(
      isAppCodeLoadError(
        new Error("Upload failed", {
          cause: new Error("Failed to fetch dynamically imported module"),
        })
      )
    ).toBe(true);
    const cyclic = new Error("Upload failed");
    cyclic.cause = cyclic;
    expect(isAppCodeLoadError(cyclic)).toBe(false);
  });

  it("keeps recovery required for the document and can prompt again after a manual retry", () => {
    const listener = vi.fn();
    const removed = vi.fn();
    const unsubscribe = appCodeRecovery.subscribe(listener);
    appCodeRecovery.subscribe(removed)();
    expect(appCodeRecovery.report("Failed to fetch dynamically imported module")).toBe(true);
    expect(appCodeRecovery.getSnapshot()).toBe(1);
    expect(listener).toHaveBeenCalledOnce();
    expect(removed).not.toHaveBeenCalled();
    unsubscribe();
    appCodeRecovery.report("Importing a module script failed");
    expect(appCodeRecovery.getSnapshot()).toBe(2);
    expect(listener).toHaveBeenCalledOnce();
  });
});
