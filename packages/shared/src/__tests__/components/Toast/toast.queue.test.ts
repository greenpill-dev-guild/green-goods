import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createToastDismissQueue } from "../../../components/Toast/toast.queue";

describe("toast dismiss queue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    {
      name: "deduplicates replacement timers for the same toast id",
      ids: ["work-upload", "work-upload"],
      expected: ["work-upload"],
    },
    {
      name: "keeps independent timers for different toast ids",
      ids: ["work-upload", "profile-save"],
      expected: ["work-upload", "profile-save"],
    },
  ])("$name", ({ ids, expected }) => {
    const dismiss = vi.fn();
    const queue = createToastDismissQueue({ dismiss });

    for (const id of ids) queue.schedule(id, 1_000);
    vi.advanceTimersByTime(1_001);

    expect(dismiss.mock.calls.map(([id]) => id)).toEqual(expected);
  });

  it("restarts a replacement toast from its newest duration", () => {
    const dismiss = vi.fn();
    const queue = createToastDismissQueue({ dismiss });

    queue.schedule("work-upload", 1_000);
    vi.advanceTimersByTime(600);
    queue.schedule("work-upload", 1_000);
    vi.advanceTimersByTime(500);
    expect(dismiss).not.toHaveBeenCalled();

    vi.advanceTimersByTime(501);
    expect(dismiss).toHaveBeenCalledOnce();
  });
});
