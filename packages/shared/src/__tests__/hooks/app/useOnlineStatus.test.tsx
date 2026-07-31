/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useOnlineStatus } from "../../../hooks/app/useOnlineStatus";

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
    act(() => window.dispatchEvent(new Event("online")));
    expect(result.current).toBe(true);
  });
});
