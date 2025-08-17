import { describe, it, expect, vi } from "vitest";

import { track } from "../../modules/posthog";

describe("modules/posthog throttling", () => {
  it("throttles frequent identical events", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    track("unique_event_once", {}); // allowed
    const firstCalls = log.mock.calls.length;
    track("unique_event_once", {}); // throttled
    expect(log.mock.calls.length).toBe(firstCalls); // no new log for second call
  });
});
