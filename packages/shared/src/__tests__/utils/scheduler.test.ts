import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  scheduleTask,
  yieldToMain,
  processBatched,
  runWhenIdle,
  debounceWithScheduler,
  isSchedulerSupported,
} from "../../utils/scheduler";

describe("Scheduler Utilities", () => {
  describe("isSchedulerSupported", () => {
    it("returns boolean", () => {
      expect(typeof isSchedulerSupported()).toBe("boolean");
    });
  });

  describe("scheduleTask", () => {
    it("executes synchronous callback", async () => {
      const result = await scheduleTask(() => 42);
      expect(result).toBe(42);
    });

    it("executes async callback", async () => {
      const result = await scheduleTask(async () => {
        return "async result";
      });
      expect(result).toBe("async result");
    });

    it("handles callback that throws", async () => {
      await expect(
        scheduleTask(() => {
          throw new Error("Task failed");
        })
      ).rejects.toThrow("Task failed");
    });

    it("respects abort signal", async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(scheduleTask(() => "result", { signal: controller.signal })).rejects.toThrow(
        "Aborted"
      );
    });

    it("executes with different priorities", async () => {
      const results: string[] = [];

      await Promise.all([
        scheduleTask(
          () => {
            results.push("background");
          },
          { priority: "background" }
        ),
        scheduleTask(
          () => {
            results.push("user-visible");
          },
          { priority: "user-visible" }
        ),
        scheduleTask(
          () => {
            results.push("user-blocking");
          },
          { priority: "user-blocking" }
        ),
      ]);

      // All tasks should complete (order may vary based on implementation)
      expect(results).toHaveLength(3);
      expect(results).toContain("background");
      expect(results).toContain("user-visible");
      expect(results).toContain("user-blocking");
    });
  });

  describe("yieldToMain", () => {
    it("yields control and returns", async () => {
      const start = Date.now();
      await yieldToMain();
      const end = Date.now();
      // Should complete quickly (within 100ms even with setTimeout fallback)
      expect(end - start).toBeLessThan(100);
    });

    it("allows other tasks to run", async () => {
      let otherTaskRan = false;

      // Schedule another task
      setTimeout(() => {
        otherTaskRan = true;
      }, 0);

      // Yield to main
      await yieldToMain();

      // The other task should have run
      expect(otherTaskRan).toBe(true);
    });
  });

  describe("processBatched", () => {
    it("processes all items", async () => {
      const items = [1, 2, 3, 4, 5];
      const results = await processBatched(items, async (item) => item * 2);
      expect(results).toEqual([2, 4, 6, 8, 10]);
    });

    it("provides correct index to processor", async () => {
      const items = ["a", "b", "c"];
      const indices: number[] = [];
      await processBatched(items, async (_, index) => {
        indices.push(index);
        return index;
      });
      expect(indices).toEqual([0, 1, 2]);
    });

    it("calls onProgress callback", async () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const progressCalls: [number, number][] = [];

      await processBatched(items, async (item) => item, {
        batchSize: 3,
        onProgress: (processed, total) => {
          progressCalls.push([processed, total]);
        },
      });

      // Should have progress calls after batches and final
      expect(progressCalls.length).toBeGreaterThan(0);
      // Final call should be [10, 10]
      expect(progressCalls[progressCalls.length - 1]).toEqual([10, 10]);
    });

    it("respects abort signal", async () => {
      const controller = new AbortController();
      const items = [1, 2, 3, 4, 5];
      const processed: number[] = [];

      const promise = processBatched(
        items,
        async (item) => {
          processed.push(item);
          if (item === 2) {
            controller.abort();
          }
          return item;
        },
        { signal: controller.signal, batchSize: 1 }
      );

      await expect(promise).rejects.toThrow("Aborted");
      // Should have processed some items before abort
      expect(processed.length).toBeLessThanOrEqual(3);
    });

    it("handles empty array", async () => {
      const results = await processBatched([], async (item) => item);
      expect(results).toEqual([]);
    });

    it("handles async processor errors", async () => {
      const items = [1, 2, 3];
      await expect(
        processBatched(items, async (item) => {
          if (item === 2) throw new Error("Processing failed");
          return item;
        })
      ).rejects.toThrow("Processing failed");
    });
  });

  describe("runWhenIdle", () => {
    it("executes callback", async () => {
      const result = await runWhenIdle(() => "idle result");
      expect(result).toBe("idle result");
    });

    it("handles async callbacks", async () => {
      const result = await runWhenIdle(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "async idle result";
      });
      expect(result).toBe("async idle result");
    });

    it("handles callback errors", async () => {
      await expect(
        runWhenIdle(() => {
          throw new Error("Idle task failed");
        })
      ).rejects.toThrow("Idle task failed");
    });
  });

  describe("debounceWithScheduler", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("debounces multiple calls", async () => {
      const fn = vi.fn();
      const debounced = debounceWithScheduler(fn, 100);

      debounced();
      debounced();
      debounced();

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      // Need to flush promises for scheduleTask
      await vi.runAllTimersAsync();

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("passes arguments to debounced function", async () => {
      const fn = vi.fn();
      const debounced = debounceWithScheduler(fn, 100);

      debounced("arg1", "arg2");

      vi.advanceTimersByTime(100);
      await vi.runAllTimersAsync();

      expect(fn).toHaveBeenCalledWith("arg1", "arg2");
    });

    it("resets timer on subsequent calls", async () => {
      const fn = vi.fn();
      const debounced = debounceWithScheduler(fn, 100);

      debounced();
      vi.advanceTimersByTime(50);
      debounced(); // Reset timer
      vi.advanceTimersByTime(50);

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
