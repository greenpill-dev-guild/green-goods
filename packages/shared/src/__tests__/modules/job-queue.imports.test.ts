/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const composition = vi.hoisted(() => ({
  dependencies: { lifecycle: "browser" },
  handle: { processJob: vi.fn() },
  createDependencies: vi.fn(),
  createQueue: vi.fn(),
}));

vi.mock("../../modules/job-queue/default-dependencies", () => ({
  createDefaultJobQueueDependencies: composition.createDependencies,
}));
vi.mock("../../modules/job-queue/queue", () => ({
  createJobQueue: composition.createQueue,
}));

import { createBrowserJobQueueLifecycle } from "../../modules/job-queue/lifecycle";

describe("job queue import lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    composition.createDependencies.mockReturnValue(composition.dependencies);
    composition.createQueue.mockReturnValue(composition.handle);
  });

  it.each([
    "event-bus",
    "media-resource-manager",
  ])("does not attach beforeunload when importing %s", async (moduleName) => {
    const addEventListener = vi.spyOn(window, "addEventListener");

    if (moduleName === "event-bus") {
      await import("../../modules/job-queue/event-bus");
    } else {
      await import("../../modules/job-queue/media-resource-manager");
    }

    expect(addEventListener.mock.calls.filter(([type]) => type === "beforeunload")).toEqual([]);
    addEventListener.mockRestore();
  });

  it("composes the default singleton from the default dependency boundary", async () => {
    const { jobQueue } = await import("../../modules/job-queue/default-instance");

    expect(composition.createDependencies).toHaveBeenCalledOnce();
    expect(composition.createQueue).toHaveBeenCalledWith(composition.dependencies);
    expect(jobQueue).toBe(composition.handle);
  });

  it("attaches beforeunload once through the browser lifecycle", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const cleanup = vi.fn();
    const lifecycle = createBrowserJobQueueLifecycle();

    const detach = lifecycle.attach(cleanup);
    expect(lifecycle.attach(cleanup)).toBe(detach);

    expect(addEventListener.mock.calls.filter(([type]) => type === "beforeunload")).toHaveLength(1);
    window.dispatchEvent(new Event("beforeunload"));
    expect(cleanup).toHaveBeenCalledOnce();

    detach();
    expect(removeEventListener.mock.calls.filter(([type]) => type === "beforeunload")).toHaveLength(
      1
    );
    addEventListener.mockRestore();
    removeEventListener.mockRestore();
  });
});
