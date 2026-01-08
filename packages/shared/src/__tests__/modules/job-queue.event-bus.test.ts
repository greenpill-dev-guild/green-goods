/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";

import { jobQueueEventBus } from "../../modules/job-queue/event-bus";

describe("modules/job-queue/event-bus", () => {
  it("subscribes and emits", () => {
    let received = false;
    const off = jobQueueEventBus.on("offline:status-changed", (data) => {
      received = data.isOnline;
    });
    jobQueueEventBus.emit("offline:status-changed", { isOnline: true });
    off();
    expect(received).toBe(true);
  });
});
