/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
let useOnlineStatus: typeof import("../../../hooks/app/useOnlineStatus").useOnlineStatus;
let onlineManager: typeof import("@tanstack/react-query").onlineManager;
beforeEach(async () => {
  vi.resetModules();
  ({ useOnlineStatus } = await import("../../../hooks/app/useOnlineStatus"));
  ({ onlineManager } = await import("@tanstack/react-query"));
});

describe("useOnlineStatus", () => {
  afterEach(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("tracks browser online and offline events without queue context", () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current).toBe(true);
    act(() => window.dispatchEvent(new Event("offline")));
    expect(result.current).toBe(false);
    expect(onlineManager.isOnline()).toBe(false);
    act(() => window.dispatchEvent(new Event("online")));
    expect(result.current).toBe(true);
  });
  it("shares offline state with late subscribers and recovers on resume", () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    act(() => window.dispatchEvent(new Event("offline")));
    const first = renderHook(() => useOnlineStatus());
    const second = renderHook(() => useOnlineStatus());
    expect(first.result.current).toBe(false);
    expect(second.result.current).toBe(false);
    act(() => {
      Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(first.result.current).toBe(true);
    expect(second.result.current).toBe(true);
    expect(onlineManager.isOnline()).toBe(true);
  });
});
