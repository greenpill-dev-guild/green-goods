import { describe, expect, it, vi } from "vitest";

import { registerTelemetrySink, track } from "../../modules/app/posthog";

describe("modules/posthog throttling", () => {
  it("throttles frequent identical events", () => {
    const sink = { capture: vi.fn() };
    const unregister = registerTelemetrySink(sink);

    track("storage_estimate", {});
    track("storage_estimate", {});

    expect(sink.capture).toHaveBeenCalledOnce();
    unregister();
  });
});
