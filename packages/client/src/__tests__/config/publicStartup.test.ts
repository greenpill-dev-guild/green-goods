/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("public startup scheduling", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (run: FrameRequestCallback) =>
      window.setTimeout(() => run(16), 16)
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("waits for route content and a paint before starting optional work", async () => {
    const { afterPublicContentPaint, markPublicContentReady } = await import(
      "../../config/publicStartup"
    );
    const task = vi.fn();
    afterPublicContentPaint(task);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(task).not.toHaveBeenCalled();
    markPublicContentReady();
    expect(task).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(task).toHaveBeenCalledOnce();
  });
  it("also schedules a caller that arrives after the shell committed", async () => {
    const { afterPublicContentPaint, markPublicContentReady } = await import(
      "../../config/publicStartup"
    );
    markPublicContentReady();
    const task = vi.fn();
    afterPublicContentPaint(task);
    expect(task).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(task).toHaveBeenCalledOnce();
  });
  it("starts once after a bounded wait when the public shell never mounts", async () => {
    const { afterPublicContentPaint, markPublicContentReady } = await import(
      "../../config/publicStartup"
    );
    const task = vi.fn();
    afterPublicContentPaint(task);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(task).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(task).toHaveBeenCalledOnce();
    markPublicContentReady();
    await vi.runAllTimersAsync();
    expect(task).toHaveBeenCalledOnce();
  });
  it("cleans the failure fallback when its caller is canceled", async () => {
    const { afterPublicContentPaint } = await import("../../config/publicStartup");
    const task = vi.fn();
    afterPublicContentPaint(task)();
    await vi.runAllTimersAsync();
    expect(task).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("removes work canceled before content arrives", async () => {
    const { afterPublicContentPaint, markPublicContentReady } = await import(
      "../../config/publicStartup"
    );
    const task = vi.fn();
    afterPublicContentPaint(task)();
    markPublicContentReady();
    await vi.runAllTimersAsync();
    expect(task).not.toHaveBeenCalled();
  });
  it("cancels a scheduled frame and starts each live caller only once", async () => {
    const { afterPublicContentPaint, markPublicContentReady } = await import(
      "../../config/publicStartup"
    );
    const canceled = vi.fn();
    const live = vi.fn();
    const cancel = afterPublicContentPaint(canceled);
    afterPublicContentPaint(live);
    markPublicContentReady();
    cancel();
    markPublicContentReady();
    await vi.runAllTimersAsync();
    expect(canceled).not.toHaveBeenCalled();
    expect(live).toHaveBeenCalledOnce();
  });
});
