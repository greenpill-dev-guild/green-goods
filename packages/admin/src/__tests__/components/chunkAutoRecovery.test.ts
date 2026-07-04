/**
 * @vitest-environment jsdom
 *
 * Stale-deployment chunk-error self-heal: reload once per failing path,
 * fall through to the manual card on a repeat failure inside the guard
 * window, and self-heal again after the window expires (next deploy).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attemptChunkAutoRecovery } from "../../components/RouteErrorBoundary";

describe("attemptChunkAutoRecovery", () => {
  const reload = vi.fn();

  beforeEach(() => {
    sessionStorage.clear();
    reload.mockClear();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, pathname: "/hub/assess/create", reload },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reloads once for a fresh chunk failure", () => {
    expect(attemptChunkAutoRecovery()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload again for the same path inside the guard window", () => {
    expect(attemptChunkAutoRecovery()).toBe(true);
    expect(attemptChunkAutoRecovery()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("recovers a different path independently", () => {
    expect(attemptChunkAutoRecovery()).toBe(true);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, pathname: "/hub/work/submit", reload },
    });
    expect(attemptChunkAutoRecovery()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("self-heals the same path again after the guard window expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-02T12:00:00Z"));
    expect(attemptChunkAutoRecovery()).toBe(true);

    vi.setSystemTime(new Date("2026-07-02T12:02:00Z"));
    expect(attemptChunkAutoRecovery()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
