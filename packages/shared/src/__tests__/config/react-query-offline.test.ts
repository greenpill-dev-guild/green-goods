/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("offline React Query configuration", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("preserves offline-first query and mutation defaults", async () => {
    const { queryClient } = await import("../../config/react-query");
    const defaults = queryClient.getDefaultOptions();

    expect(defaults.queries?.networkMode).toBe("offlineFirst");
    expect(defaults.queries?.refetchOnReconnect).toBe("always");
    expect(defaults.mutations?.networkMode).toBe("offlineFirst");
    expect(defaults.mutations?.retry).toBe(false);

    queryClient.clear();
  });

  it("resumes paused mutations when connectivity returns", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    const { queryClient } = await import("../../config/react-query");
    const resumePausedMutations = vi
      .spyOn(queryClient, "resumePausedMutations")
      .mockResolvedValue(undefined);
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    window.dispatchEvent(new Event("online"));

    expect(resumePausedMutations).toHaveBeenCalledOnce();
    queryClient.clear();
  });
});
