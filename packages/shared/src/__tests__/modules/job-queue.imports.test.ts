/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

describe("job queue import lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
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

  it("attaches beforeunload once through default lifecycle wiring", async () => {
    const addEventListener = vi.spyOn(window, "addEventListener");

    // This is intentionally a cold import of the full default composition.
    // Under a loaded multi-file batch, module transformation can exceed the
    // generic test timeout before the lifecycle assertion executes.
    await import("../../modules/job-queue");

    expect(addEventListener.mock.calls.filter(([type]) => type === "beforeunload")).toHaveLength(1);
    addEventListener.mockRestore();
  }, 30_000);
});
