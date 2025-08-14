import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("posthog-js", () => ({
  posthog: {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    get_distinct_id: vi.fn(() => "mock-ph-id"),
  },
}));

import { track, identify, reset, getDistinctId } from "../../modules/posthog";

describe("modules/posthog", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("tracks events (no dev logs by default)", () => {
    track("test_event", { foo: "bar" });
    expect(console.log).not.toHaveBeenCalled();
  });

  it("identify/reset and getDistinctId work", () => {
    identify("user-1");
    reset();
    const id = getDistinctId();
    expect(typeof id).toBe("string");
  });
});
